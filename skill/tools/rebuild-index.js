#!/usr/bin/env node

/**
 * 索引重建脚本 v4.0
 * 
 * 功能：
 * - 每天凌晨 2 点重建 today.json 和 upcoming.json
 * - 清理过期事件
 * - 更新学期周次
 * 
 * 适配 v4.0 Schema:
 * - lifecycle.status 替代旧 status 字段
 */

const fs = require('fs');
const path = require('path');

const {
  readCourses,
  readRecurring,
  readPlans,
  readMetadata,
  writeTodayIndex,
  writeUpcomingIndex,
  writePlans,
  toUTC,
  toLocal
} = require('./file-ops.js');

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取星期几 (0-6, 0=周日)
 */
function getWeekday(date) {
  return date.getDay();
}

/**
 * 从周次范围获取某一天的日期
 */
function getDateFromWeekRange(weekRange, weekday) {
  const start = new Date(weekRange.start);
  const diff = weekday - start.getDay();
  const target = new Date(start);
  target.setDate(start.getDate() + diff);
  return target;
}

/**
 * 构建今天索引
 */
function buildTodayIndex() {
  const today = new Date();
  const todayStr = formatDate(today);
  const weekday = getWeekday(today);
  
  const metadata = readMetadata();
  const coursesData = readCourses();
  const recurringData = readRecurring();
  const plansData = readPlans();
  
  const events = [];
  
  // 1. 从 courses.json 获取今天的课
  if (coursesData.courses) {
    const todayCourses = coursesData.courses.filter(course => {
      const courseWeekday = course.schedule.weekday;
      const isInWeekRange = metadata.currentWeek >= course.schedule.weekRange[0] &&
                           metadata.currentWeek <= course.schedule.weekRange[1];
      const isActive = course.lifecycle?.status !== 'cancelled';
      
      return courseWeekday === weekday && isInWeekRange && isActive;
    });
    
    events.push(...todayCourses.map(c => ({
      ...c,
      source: 'courses',
      type: 'course'
    })));
  }
  
  // 2. 从 recurring.json 获取今天的周期事件
  if (recurringData.recurring) {
    const todayRecurring = recurringData.recurring.filter(rec => {
      const recWeekdays = Array.isArray(rec.schedule.weekday)
        ? rec.schedule.weekday
        : [rec.schedule.weekday];
      
      return recWeekdays.includes(weekday) && rec.lifecycle?.status !== 'cancelled';
    });
    
    events.push(...todayRecurring.map(r => ({
      ...r,
      source: 'recurring',
      type: 'recurring'
    })));
  }
  
  // 3. 从 plans.json 获取今天的临时事件
  if (plansData.plans) {
    const todayPlans = plansData.plans.filter(p => 
      p.schedule.displayDate === todayStr &&
      p.lifecycle?.status === 'active'
    );
    
    events.push(...todayPlans.map(p => ({
      ...p,
      source: 'plans',
      type: 'plan'
    })));
  }
  
  // 4. 按时间排序
  events.sort((a, b) => {
    const timeA = a.schedule.utcStart || a.schedule.displayTime || '00:00';
    const timeB = b.schedule.utcStart || b.schedule.displayTime || '00:00';
    return timeA.localeCompare(timeB);
  });
  
  // 5. 生成统计
  const summary = {
    total: events.length,
    byType: groupBy(events, 'type'),
    byPriority: groupBy(events, 'priority')
  };
  
  return {
    date: todayStr,
    generatedAt: new Date().toISOString(),
    events,
    summary
  };
}

/**
 * 构建未来 7 天索引
 */
function buildUpcomingIndex(days = 7) {
  const today = new Date();
  const eventsByDay = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = formatDate(date);
    const weekday = getWeekday(date);
    
    const dayEvents = [];
    
    // 1. 课程
    const coursesData = readCourses();
    if (coursesData.courses) {
      const courses = coursesData.courses.filter(c => 
        c.schedule.weekday === weekday &&
        c.lifecycle?.status !== 'cancelled'
      );
      
      dayEvents.push(...courses.map(c => ({
        ...c,
        source: 'courses',
        type: 'course',
        date: dateStr
      })));
    }
    
    // 2. 周期事件
    const recurringData = readRecurring();
    if (recurringData.recurring) {
      const recurring = recurringData.recurring.filter(r => {
        const weekdays = Array.isArray(r.schedule.weekday)
          ? r.schedule.weekday
          : [r.schedule.weekday];
        return weekdays.includes(weekday) && r.lifecycle?.status !== 'cancelled';
      });
      
      dayEvents.push(...recurring.map(r => ({
        ...r,
        source: 'recurring',
        type: 'recurring',
        date: dateStr
      })));
    }
    
    // 3. 临时事件
    const plansData = readPlans();
    if (plansData.plans) {
      const plans = plansData.plans.filter(p => 
        p.schedule.displayDate === dateStr &&
        p.lifecycle?.status === 'active'
      );
      
      dayEvents.push(...plans.map(p => ({
        ...p,
        source: 'plans',
        type: 'plan',
        date: dateStr
      })));
    }
    
    // 排序
    dayEvents.sort((a, b) => {
      const timeA = a.schedule.utcStart || a.schedule.displayTime || '00:00';
      const timeB = b.schedule.utcStart || b.schedule.displayTime || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    eventsByDay.push({
      date: dateStr,
      events: dayEvents
    });
  }
  
  // 生成提醒列表
  const reminders = generateReminders(eventsByDay);
  
  return {
    generatedAt: new Date().toISOString(),
    range: {
      start: formatDate(today),
      end: formatDate(new Date(today.getTime() + days * 24 * 60 * 60 * 1000))
    },
    events: eventsByDay,
    reminders
  };
}

/**
 * 生成提醒
 */
function generateReminders(eventsByDay) {
  const reminders = [];
  const now = new Date();
  
  eventsByDay.forEach(day => {
    day.events.forEach(event => {
      if (!event.reminderOffsets) return;
      
      const eventTime = new Date(event.schedule.utcStart);
      const primaryOffset = event.reminderOffsets[0] || 30;
      const reminderTime = new Date(eventTime.getTime() - primaryOffset * 60 * 1000);
      
      // 检查是否在提醒时间窗口内（±1 分钟）
      const timeDiff = now.getTime() - reminderTime.getTime();
      if (timeDiff >= -60 * 1000 && timeDiff <= 60 * 1000) {
        reminders.push({
          ...event,
          reminderTime: reminderTime.toISOString(),
          minutesUntilEvent: Math.round((eventTime.getTime() - now.getTime()) / 60000)
        });
      }
    });
  });
  
  return reminders;
}

/**
 * 清理过期事件（v4.0 Schema）
 */
function cleanupExpiredPlans() {
  const plansData = readPlans();
  const today = new Date();
  const todayStr = formatDate(today);
  
  if (!plansData.plans) return false;
  
  let changed = false;
  let expiredCount = 0;
  
  plansData.plans.forEach(plan => {
    // v4.0 Schema: 使用 lifecycle.status
    const status = plan.lifecycle?.status || plan.status || 'active';
    if (status !== 'active') return;
    
    const planDate = plan.schedule.displayDate;
    
    if (planDate < todayStr) {
      if (!plan.lifecycle) plan.lifecycle = {};
      plan.lifecycle.status = 'expired';
      plan.lifecycle.expiredAt = new Date().toISOString();
      expiredCount++;
      changed = true;
    }
  });
  
  if (changed) {
    writePlans(plansData);
    console.log(`🧹 清理了 ${expiredCount} 个过期事件`);
  }
  
  return changed;
}

/**
 * 更新课程周次
 */
function updateCourseWeek() {
  const metadata = readMetadata();
  const today = new Date();
  const start = new Date(metadata.startDate);
  
  const diffDays = Math.floor((today - start) / (24 * 60 * 60 * 1000));
  const newWeek = Math.floor(diffDays / 7) + 1;
  
  if (newWeek > metadata.currentWeek) {
    console.log(`📅 进入第 ${newWeek} 周`);
    metadata.currentWeek = newWeek;
    metadata.updatedAt = new Date().toISOString();
    
    const { writeMetadata } = require('./file-ops.js');
    writeMetadata(metadata);
    
    return true;
  }
  
  return false;
}

// 辅助函数
function groupBy(array, key) {
  if (!array || array.length === 0) return {};
  
  return array.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

// 主函数
function main() {
  console.log('🔄 开始重建索引...');
  
  try {
    // 1. 重建 today.json
    const today = buildTodayIndex();
    writeTodayIndex(today);
    console.log('✅ 重建 today.json');
    
    // 2. 重建 upcoming.json
    const upcoming = buildUpcomingIndex(7);
    writeUpcomingIndex(upcoming);
    console.log('✅ 重建 upcoming.json');
    
    // 3. 清理过期事件
    cleanupExpiredPlans();
    
    // 4. 更新课程周次
    updateCourseWeek();
    
    console.log('✅ 索引重建完成');
    
  } catch (error) {
    console.error('❌ 索引重建失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行
if (require.main === module) {
  main();
}

module.exports = {
  buildTodayIndex,
  buildUpcomingIndex,
  cleanupExpiredPlans,
  updateCourseWeek
};
