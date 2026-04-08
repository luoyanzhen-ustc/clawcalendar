#!/usr/bin/env node

/**
 * 事件管理工具 v4.0 (多渠道 Cron 驱动架构)
 * 
 * 核心变更：
 * - 支持 reminderStages 的 cronJobIds 数组（多渠道）
 * - 支持 pushedChannels 对象（每个渠道独立推送状态）
 * - Schema version: 4
 */

const { generateEventId, generateStageId, savePlan, getPlanById, deletePlanById, readSettings } = require('./file-ops.js');
const { createReminderCron, updateReminderCrons, deleteReminderCrons } = require('./cron-manager.js');

/**
 * 解析时间字符串
 */
function parseTime(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) {
    return null;
  }
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return { hours, minutes };
}

/**
 * 计算事件的完整时间（ISO 8601）
 * 
 * 重要：用户输入的是北京时间，需要转换为 UTC 存储
 * 
 * @param {Object} schedule - 事件时间表
 * @param {string} timezone - 时区（默认 Asia/Shanghai）
 * @returns {string|null} ISO 8601 格式（UTC）
 */
function calculateEventTime(schedule, timezone = 'Asia/Shanghai') {
  const date = schedule.date || schedule.displayDate;
  const startTime = schedule.startTime || schedule.displayTime || '00:00';
  
  const time = parseTime(startTime);
  if (!time) {
    return null;
  }
  
  // 关键修复：创建带时区的日期字符串
  // 用户输入：2026-04-09 00:50 (北京时间)
  // 转换为：2026-04-09T00:50:00+08:00
  const beijingTimeStr = `${date}T${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:00+08:00`;
  const eventDateBeijing = new Date(beijingTimeStr);
  
  // 转换为 UTC 存储（toISOString 自动处理）
  // 结果：2026-04-08T16:50:00.000Z
  return eventDateBeijing.toISOString();
}

/**
 * 创建默认提醒阶段（v4.0 Schema）
 */
function createDefaultStages(priority = 'medium') {
  const settings = readSettings();
  const defaults = settings.reminderDefaults || {
    high: [1440, 60],
    medium: [30],
    low: [10]
  };
  
  const offsets = defaults[priority] || defaults.medium;
  
  return offsets.map(offset => ({
    id: generateStageId(),
    offset: offset,
    offsetUnit: 'minutes',
    message: `${offset} 分钟后有安排`,
    priority: priority,
    // v4.0 Schema: 多渠道支持
    cronJobIds: [],  // 数组，每个渠道一个 Cron ID
    pushedChannels: {},  // 每个渠道独立推送状态
    triggerTime: null
  }));
}

/**
 * 创建事件（自动创建 Cron 任务）
 * 
 * @param {Object} plan - 事件对象
 * @returns {Object} 创建结果
 */
function appendPlan(plan) {
  console.log('📝 创建事件:', plan.title);
  
  const event = {
    id: generateEventId(),
    title: plan.title,
    type: plan.type || 'plan',
    priority: plan.priority || 'medium',
    schedule: plan.schedule,
    location: plan.location || null,
    description: plan.description || null,
    reminderStages: plan.reminderStages || [],
    notify: plan.notify || {
      channels: ['qq', 'wechat'],
      enabled: true
    },
    lifecycle: {
      status: 'active',
      completedAt: null,
      cancelledAt: null,
      expiredAt: null
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 4,  // v4.0 Schema
      archived: false,
      archivedAt: null
    }
  };
  
  if (event.reminderStages.length === 0) {
    event.reminderStages = createDefaultStages(event.priority);
  }
  
  // 计算 UTC 时间（用于排序和索引）
  const eventTime = calculateEventTime(event.schedule);
  if (eventTime) {
    event.schedule.utcStart = eventTime;
  }
  
  savePlan(event);
  if (!eventTime) {
    return { success: false, error: '无法解析事件时间' };
  }
  
  // 为每个阶段创建 Cron 任务（多渠道）
  const createdCrons = [];
  for (const stage of event.reminderStages) {
    const cronResult = createReminderCron({
      eventId: event.id,
      stageId: stage.id,
      eventTime: eventTime,
      offset: stage.offset,
      offsetUnit: stage.offsetUnit || 'minutes',
      message: stage.message || `${stage.offset} ${stage.offsetUnit} 后提醒`
    });
    
    if (cronResult.success) {
      // v4.0 Schema: 存储多个 Cron ID
      stage.cronJobIds = cronResult.channels.map(c => c.cronJobId);
      stage.triggerTime = cronResult.triggerTime;
      // 初始化推送状态
      stage.pushedChannels = {};
      for (const ch of cronResult.channels) {
        stage.pushedChannels[ch.channel] = {
          pushedAt: null,
          cronJobId: ch.cronJobId,
          status: 'pending'
        };
      }
      createdCrons.push(...stage.cronJobIds);
    } else {
      console.error(`创建 Cron 任务失败：${cronResult.error}`);
    }
  }
  
  savePlan(event);
  
  console.log(`✅ 事件创建成功：${event.id}`);
  console.log(`   创建了 ${createdCrons.length} 个 Cron 任务`);
  
  return {
    success: true,
    event: event,
    createdCrons: createdCrons.length
  };
}

/**
 * 更新事件（自动更新 Cron 任务）
 * 
 * @param {string} planId - 事件 ID
 * @param {Object} updates - 更新内容
 * @returns {Object} 更新结果
 */
function updatePlan(planId, updates) {
  console.log('📝 更新事件:', planId);
  
  const event = getPlanById(planId);
  
  if (!event) {
    return { success: false, error: '事件不存在' };
  }
  
  if (updates.schedule) {
    const newEventTime = calculateEventTime(updates.schedule);
    
    if (newEventTime) {
      // 更新 UTC 时间字段
      event.schedule.utcStart = newEventTime;
      
      console.log('   事件时间变更，更新 Cron 任务...');
      const cronResult = updateReminderCrons(planId, newEventTime);
      
      if (!cronResult.success) {
        console.error(`更新 Cron 任务失败：${cronResult.error}`);
      } else {
        console.log(`   更新了 ${cronResult.createdCrons} 个 Cron 任务`);
      }
    }
  }
  
  Object.assign(event, updates);
  event.metadata.updatedAt = new Date().toISOString();
  savePlan(event);
  
  console.log(`✅ 事件更新成功：${planId}`);
  
  return {
    success: true,
    event: event
  };
}

/**
 * 删除事件（自动删除 Cron 任务）
 * 
 * @param {string} planId - 事件 ID
 * @returns {Object} 删除结果
 */
function deletePlan(planId) {
  console.log('📝 删除事件:', planId);
  
  const event = getPlanById(planId);
  
  if (!event) {
    return { success: false, error: '事件不存在' };
  }
  
  console.log('   删除关联的 Cron 任务...');
  const cronResult = deleteReminderCrons(planId);
  
  if (!cronResult.success) {
    console.error(`删除 Cron 任务失败：${cronResult.error}`);
  } else {
    console.log(`   删除了 ${cronResult.deletedCount} 个 Cron 任务`);
  }
  
  const deleted = deletePlanById(planId);
  
  if (deleted) {
    console.log(`✅ 事件删除成功：${planId}`);
    return {
      success: true,
      deletedCrons: cronResult.deletedCount
    };
  } else {
    return { success: false, error: '删除事件失败' };
  }
}

/**
 * 取消事件（软删除）
 */
function cancelPlan(planId, reason = '用户取消') {
  console.log('📝 取消事件:', planId, reason);
  
  const event = getPlanById(planId);
  
  if (!event) {
    return { success: false, error: '事件不存在' };
  }
  
  deleteReminderCrons(planId);
  
  event.lifecycle.status = 'cancelled';
  event.lifecycle.cancelledAt = new Date().toISOString();
  event.cancelReason = reason;
  event.metadata.updatedAt = new Date().toISOString();
  savePlan(event);
  
  console.log(`✅ 事件已取消：${planId}`);
  
  return {
    success: true,
    event: event
  };
}

/**
 * 完成事件
 */
function completePlan(planId) {
  console.log('📝 完成事件:', planId);
  
  const event = getPlanById(planId);
  
  if (!event) {
    return { success: false, error: '事件不存在' };
  }
  
  event.lifecycle.status = 'completed';
  event.lifecycle.completedAt = new Date().toISOString();
  event.metadata.updatedAt = new Date().toISOString();
  savePlan(event);
  
  console.log(`✅ 事件已完成：${planId}`);
  
  return {
    success: true,
    event: event
  };
}

/**
 * 查询事件
 */
function getPlan(planId) {
  return getPlanById(planId);
}

/**
 * 列出所有事件
 */
function listPlans() {
  const { readPlans } = require('./file-ops.js');
  const data = readPlans();
  return data.plans;
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  appendPlan,
  updatePlan,
  deletePlan,
  cancelPlan,
  completePlan,
  getPlan,
  listPlans,
  parseTime,
  calculateEventTime,
  createDefaultStages
};
