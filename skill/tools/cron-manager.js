#!/usr/bin/env node

/**
 * Cron 任务管理工具 v3.0
 * 
 * 功能：
 * - 为事件阶段创建 Cron 任务
 * - 更新事件关联的 Cron 任务
 * - 删除事件关联的 Cron 任务
 * - 查询 Cron 任务状态
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * 执行 OpenClaw 命令
 */
function exec(command, options = {}) {
  const { encoding = 'utf8', stdio = 'pipe' } = options;
  
  try {
    const output = execSync(command, { encoding, stdio });
    return { success: true, output, error: null };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.message || error.stderr 
    };
  }
}

/**
 * 解析 Cron 列表输出
 */
function parseCronList(output) {
  try {
    const data = JSON.parse(output);
    return data.jobs || [];
  } catch (error) {
    console.error('解析 Cron 列表失败:', error.message);
    return [];
  }
}

/**
 * 创建 Cron 任务
 */
function createCronJob(name, schedule, payload, options = {}) {
  const {
    sessionTarget = 'isolated',
    deleteAfterRun = true,
    deliveryMode = 'announce'
  } = options;
  
  let cmd = `openclaw cron add --name '${name}'`;
  
  // 根据 schedule 类型构建命令
  if (schedule.kind === 'at') {
    cmd += ` --at '${schedule.at}'`;
  } else if (schedule.kind === 'cron') {
    cmd += ` --cron '${schedule.expr}'`;
  } else if (schedule.kind === 'every') {
    cmd += ` --every '${schedule.everyMs}ms'`;
  }
  
  // 添加 payload（使用 --message）
  const messageJson = JSON.stringify(payload);
  cmd += ` --message '${messageJson}'`;
  
  // 添加其他选项
  if (deleteAfterRun) {
    cmd += ' --delete-after-run';
  }
  
  cmd += ' --json';
  
  console.log(`创建 Cron 任务：${name}`);
  console.log(`命令：${cmd}`);
  const result = exec(cmd);
  
  if (result.success) {
    try {
      const jobData = JSON.parse(result.output);
      return {
        success: true,
        cronJobId: jobData.id,
        name: jobData.name,
        nextRunAt: jobData.state?.nextRunAtMs,
        rawData: jobData
      };
    } catch (error) {
      console.log('解析结果:', result.output);
      return { success: true, message: 'Cron 任务创建成功', output: result.output };
    }
  } else {
    return { success: false, error: result.error, output: result.output };
  }
}

/**
 * 删除 Cron 任务
 */
function deleteCronJob(jobId) {
  const cmd = `openclaw cron remove --jobId '${jobId}'`;
  console.log(`删除 Cron 任务：${jobId}`);
  const result = exec(cmd);
  
  return {
    success: result.success,
    deleted: result.success,
    error: result.error
  };
}

/**
 * 列出所有 Claw Calendar 相关的 Cron 任务
 */
function listCalendarCrons() {
  const result = exec('openclaw cron list --json');
  
  if (!result.success) {
    return { success: false, error: result.error, jobs: [] };
  }
  
  const allJobs = parseCronList(result.output);
  const calendarJobs = allJobs.filter(job => 
    job.name && job.name.startsWith('claw-calendar-')
  );
  
  return {
    success: true,
    jobs: calendarJobs,
    total: calendarJobs.length
  };
}

/**
 * 为事件阶段创建 Cron 任务
 * 
 * @param {Object} options - 选项
 * @param {string} options.eventId - 事件 ID
 * @param {string} options.stageId - 阶段 ID
 * @param {string} options.eventTime - 事件时间（ISO 8601）
 * @param {number} options.offset - 提前量
 * @param {string} options.offsetUnit - 提前量单位（minutes/hours/days）
 * @param {string} options.message - 推送消息
 * @returns {Object} 创建结果
 */
function createReminderCron({ eventId, stageId, eventTime, offset, offsetUnit, message }) {
  // 计算触发时间
  const eventDate = new Date(eventTime);
  const offsetMs = offset * (
    offsetUnit === 'minutes' ? 60000 :
    offsetUnit === 'hours' ? 3600000 :
    offsetUnit === 'days' ? 86400000 : 60000
  );
  
  const triggerTime = new Date(eventDate.getTime() - offsetMs);
  
  // 生成 Cron 任务名称
  const cronName = `claw-calendar-${eventId}-${stageId}`;
  
  // 创建 Cron 任务（一次性）
  const schedule = {
    kind: 'at',
    at: triggerTime.toISOString()
  };
  
  const payload = {
    kind: 'agentTurn',
    message: `推送提醒：${message}`,
    context: {
      eventId: eventId,
      stageId: stageId,
      triggerTime: triggerTime.toISOString()
    }
  };
  
  const result = createCronJob(cronName, schedule, payload, {
    sessionTarget: 'isolated',
    deleteAfterRun: true,
    deliveryMode: 'announce'
  });
  
  if (result.success) {
    return {
      success: true,
      cronJobId: result.cronJobId || cronName,
      triggerTime: triggerTime.toISOString(),
      message: message,
      rawData: result.rawData
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

/**
 * 更新事件关联的 Cron 任务
 * 
 * @param {string} eventId - 事件 ID
 * @param {string} newEventTime - 新的事件时间（ISO 8601）
 * @returns {Object} 更新结果
 */
function updateReminderCrons(eventId, newEventTime) {
  const { getPlanById, savePlan } = require('./file-ops.js');
  const event = getPlanById(eventId);
  
  if (!event) {
    return { success: false, error: '事件不存在' };
  }
  
  if (!event.reminderStages || event.reminderStages.length === 0) {
    return { success: true, message: '事件无提醒阶段' };
  }
  
  // 1. 删除旧 Cron 任务
  const deletedCrons = [];
  for (const stage of event.reminderStages) {
    if (stage.cronJobId) {
      deleteCronJob(stage.cronJobId);
      deletedCrons.push(stage.cronJobId);
    }
  }
  
  // 2. 重新创建 Cron 任务
  const createdCrons = [];
  for (const stage of event.reminderStages) {
    const result = createReminderCron({
      eventId: eventId,
      stageId: stage.id,
      eventTime: newEventTime,
      offset: stage.offset,
      offsetUnit: stage.offsetUnit || 'minutes',
      message: stage.message || `${stage.offset} ${stage.offsetUnit} 后提醒`
    });
    
    if (result.success) {
      stage.cronJobId = result.cronJobId;
      stage.triggerTime = result.triggerTime;
      createdCrons.push(result.cronJobId);
    }
  }
  
  // 3. 更新事件
  savePlan(event);
  
  return {
    success: true,
    deletedCrons: deletedCrons.length,
    createdCrons: createdCrons.length,
    cronJobIds: createdCrons
  };
}

/**
 * 删除事件关联的所有 Cron 任务
 * 
 * @param {string} eventId - 事件 ID
 * @returns {Object} 删除结果
 */
function deleteReminderCrons(eventId) {
  const { getPlanById } = require('./file-ops.js');
  const event = getPlanById(eventId);
  
  if (!event) {
    return { success: true, message: '事件不存在' };
  }
  
  if (!event.reminderStages || event.reminderStages.length === 0) {
    return { success: true, message: '事件无提醒阶段' };
  }
  
  // 删除所有 Cron 任务
  const deletedCrons = [];
  for (const stage of event.reminderStages) {
    if (stage.cronJobId) {
      const result = deleteCronJob(stage.cronJobId);
      if (result.success) {
        deletedCrons.push(stage.cronJobId);
      }
    }
  }
  
  return {
    success: true,
    deletedCount: deletedCrons.length,
    deletedCronIds: deletedCrons
  };
}

/**
 * 列出事件的所有 Cron 任务
 * 
 * @param {string} eventId - 事件 ID
 * @returns {Object} Cron 任务列表
 */
function listReminderCrons(eventId) {
  const result = listCalendarCrons();
  
  if (!result.success) {
    return result;
  }
  
  // 过滤出该事件的 Cron 任务
  const eventCrons = result.jobs.filter(job => 
    job.name && job.name.startsWith(`claw-calendar-${eventId}-`)
  );
  
  return {
    success: true,
    cronJobs: eventCrons.map(job => ({
      cronJobId: job.id,
      name: job.name,
      nextRunAt: job.state?.nextRunAtMs,
      enabled: job.enabled
    })),
    total: eventCrons.length
  };
}

/**
 * 测试 Cron 创建
 * 
 * @param {string} triggerTime - 触发时间（ISO 8601）
 * @returns {Object} 测试结果
 */
function testCronCreation(triggerTime) {
  const schedule = {
    kind: 'at',
    at: triggerTime
  };
  
  const payload = {
    kind: 'agentTurn',
    message: '🧪 Cron 测试任务'
  };
  
  const cronName = `test-cron-${Date.now()}`;
  
  return createCronJob(cronName, schedule, payload);
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  createReminderCron,
  updateReminderCrons,
  deleteReminderCrons,
  listReminderCrons,
  
  // 底层函数
  createCronJob,
  deleteCronJob,
  listCalendarCrons,
  
  // 测试
  testCronCreation,
  
  // 工具
  exec,
  parseCronList
};
