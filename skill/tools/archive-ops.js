#!/usr/bin/env node

/**
 * 归档工具
 * 
 * 功能：
 * - 周归档：每周一凌晨生成上周总结，移动已完成计划
 * - 学期归档：学期末统一打包
 * - 生成学期总结
 */

const fs = require('fs');
const path = require('path');

// 导入 file-ops
const toolsDir = __dirname;
const {
  readPlans,
  writePlans,
  readCourses,
  readRecurring,
  readMetadata,
  writeMetadata,
  getArchiveDir,
  getIndexDir,
  getActiveDir
} = require('./file-ops.js');

/**
 * 获取周次范围
 */
function getWeekRange(weekNumber, metadata) {
  return metadata.weekMapping[`week${weekNumber}`];
}

/**
 * 生成周总结
 */
function generateWeeklyReport(weekNumber) {
  const metadata = readMetadata();
  const weekRange = getWeekRange(weekNumber, metadata);
  
  if (!weekRange) {
    console.log(`⚠️  无法获取第 ${weekNumber} 周范围`);
    return null;
  }
  
  // 读取该周所有事件
  const plansData = readPlans();
  const coursesData = readCourses();
  const recurringData = readRecurring();
  
  const events = [];
  
  // 1. 从 plans.json 过滤该周的临时事件
  const weekPlans = plansData.plans.filter(p => 
    p.schedule.displayDate >= weekRange.start &&
    p.schedule.displayDate <= weekRange.end
  );
  
  events.push(...weekPlans.map(p => ({ ...p, type: 'plan' })));
  
  // 2. 统计
  const totalPlans = weekPlans.length;
  const completed = weekPlans.filter(p => p.lifecycle?.status === 'completed').length;
  const cancelled = weekPlans.filter(p => p.lifecycle?.status === 'cancelled').length;
  const expired = weekPlans.filter(p => p.lifecycle?.status === 'expired').length;
  const active = weekPlans.filter(p => p.lifecycle?.status === 'active').length;
  
  const stats = {
    totalEvents: events.length,
    totalPlans,
    byType: groupBy(events, 'type'),
    byStatus: groupBy(events, 'lifecycle.status'),
    completed,
    cancelled,
    expired,
    active,
    completionRate: totalPlans > 0 ? (completed / totalPlans).toFixed(2) : 0,
    cancelRate: totalPlans > 0 ? (cancelled / totalPlans).toFixed(2) : 0
  };
  
  const report = {
    week: weekNumber,
    period: `${weekRange.start} ~ ${weekRange.end}`,
    semester: metadata.semester,
    stats,
    events,
    highlights: extractHighlights(events),
    generatedAt: new Date().toISOString()
  };
  
  return report;
}

/**
 * 归档上周计划
 */
function archiveLastWeekPlans() {
  const metadata = readMetadata();
  const lastWeek = metadata.currentWeek - 1;
  const weekRange = getWeekRange(lastWeek, metadata);
  
  if (!weekRange) {
    console.log(`⚠️  无法获取上周范围`);
    return false;
  }
  
  const plansData = readPlans();
  
  // 过滤出上周的计划
  const archivedPlans = plansData.plans.filter(p => 
    p.schedule.displayDate >= weekRange.start &&
    p.schedule.displayDate <= weekRange.end
  );
  
  if (archivedPlans.length === 0) {
    console.log(`ℹ️  上周没有计划`);
    return true;
  }
  
  // 写入归档
  const archiveDir = getArchiveDir(metadata.semester);
  const plansArchiveDir = path.join(archiveDir, 'plans');
  
  if (!fs.existsSync(plansArchiveDir)) {
    fs.mkdirSync(plansArchiveDir, { recursive: true });
  }
  
  const archiveFile = path.join(plansArchiveDir, `week-${lastWeek}.json`);
  fs.writeFileSync(archiveFile, JSON.stringify({
    week: lastWeek,
    period: weekRange,
    plans: archivedPlans,
    archivedAt: new Date().toISOString()
  }, null, 2), 'utf8');
  
  console.log(`✅ 归档上周 ${archivedPlans.length} 个计划`);
  
  // 从 active 中删除已归档的计划
  plansData.plans = plansData.plans.filter(p => 
    p.schedule.displayDate < weekRange.start ||
    p.schedule.displayDate > weekRange.end
  );
  
  writePlans(plansData);
  
  return true;
}

/**
 * 学期末归档
 */
function archiveSemester(semesterName = null) {
  const metadata = readMetadata();
  const semester = semesterName || metadata.semester;
  
  console.log(`📦 开始归档学期：${semester}`);
  
  const archiveDir = getArchiveDir(semester);
  
  // 创建归档目录
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  // 移动课程表
  const coursesFile = path.join(getActiveDir(), 'courses.json');
  if (fs.existsSync(coursesFile)) {
    fs.copyFileSync(coursesFile, path.join(archiveDir, 'courses.json'));
    console.log('✅ 归档课程表');
  }
  
  // 移动周期事件
  const recurringFile = path.join(getActiveDir(), 'recurring.json');
  if (fs.existsSync(recurringFile)) {
    fs.copyFileSync(recurringFile, path.join(archiveDir, 'recurring.json'));
    console.log('✅ 归档周期事件');
  }
  
  // 移动剩余计划
  const plansFile = path.join(getActiveDir(), 'plans.json');
  if (fs.existsSync(plansFile)) {
    const plansData = readPlans();
    if (plansData.plans && plansData.plans.length > 0) {
      fs.copyFileSync(plansFile, path.join(archiveDir, 'plans.json'));
      console.log(`✅ 归档 ${plansData.plans.length} 个剩余计划`);
    }
  }
  
  // 生成学期总结
  generateSemesterSummary(semester);
  
  console.log(`✅ 学期归档完成：${archiveDir}`);
  
  return true;
}

/**
 * 生成学期总结
 */
function generateSemesterSummary(semester) {
  const archiveDir = getArchiveDir(semester);
  const weeklyDir = path.join(archiveDir, 'weekly');
  
  if (!fs.existsSync(weeklyDir)) {
    console.log(`⚠️  没有找到周总结目录`);
    return null;
  }
  
  // 读取所有周总结
  const weekFiles = fs.readdirSync(weeklyDir).filter(f => f.endsWith('.json'));
  
  const weekReports = weekFiles.map(f => {
    const content = fs.readFileSync(path.join(weeklyDir, f), 'utf8');
    return JSON.parse(content);
  });
  
  // 聚合统计
  const totalStats = {
    totalWeeks: weekReports.length,
    totalEvents: 0,
    totalPlans: 0,
    totalCompleted: 0,
    totalCancelled: 0,
    totalExpired: 0
  };
  
  weekReports.forEach(report => {
    totalStats.totalEvents += report.stats.totalEvents || 0;
    totalStats.totalPlans += report.stats.totalPlans || 0;
    totalStats.totalCompleted += report.stats.completed || 0;
    totalStats.totalCancelled += report.stats.cancelled || 0;
    totalStats.totalExpired += report.stats.expired || 0;
  });
  
  totalStats.completionRate = totalStats.totalPlans > 0
    ? (totalStats.totalCompleted / totalStats.totalPlans).toFixed(2)
    : 0;
  
  const summary = {
    semester: semester,
    totalWeeks: weekReports.length,
    stats: totalStats,
    highlights: extractHighlights(weekReports.flatMap(r => r.events || [])),
    generatedAt: new Date().toISOString()
  };
  
  const summaryFile = path.join(archiveDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
  
  console.log(`✅ 生成学期总结：${summaryFile}`);
  
  return summary;
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

function extractHighlights(events) {
  if (!events || events.length === 0) return [];
  
  const highlights = [];
  
  // 高优先级完成事件
  const highPriorityCompleted = events.filter(e => 
    e.priority === 'high' && e.lifecycle?.status === 'completed'
  );
  
  highPriorityCompleted.slice(0, 5).forEach(e => {
    highlights.push(`完成了高优先级任务：${e.title}`);
  });
  
  // 考试
  const exams = events.filter(e => e.type === 'exam' && e.lifecycle?.status === 'completed');
  if (exams.length > 0) {
    highlights.push(`完成了 ${exams.length} 次考试`);
  }
  
  return highlights;
}

// 导出
module.exports = {
  generateWeeklyReport,
  archiveLastWeekPlans,
  archiveSemester,
  generateSemesterSummary
};
