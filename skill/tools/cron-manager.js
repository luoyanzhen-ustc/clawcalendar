#!/usr/bin/env node

/**
 * Cron 任务管理工具 v4.0
 * 
 * 功能：
 * - 为事件阶段创建 Cron 任务（支持多渠道推送）
 * - 更新事件关联的 Cron 任务
 * - 删除事件关联的 Cron 任务
 * - 查询 Cron 任务状态
 * 
 * v4.0 更新：
 * - 添加 --to 参数支持（关键！）
 * - 添加 --account 参数支持（微信必需）
 * - 支持多渠道推送（QQ + 微信）
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getKnownUsersPath } = require('./path-utils.js');

// ============================================================================
// 用户配置
// ============================================================================

/**
 * 获取用户渠道配置
 * 
 * @returns {Object} 渠道配置
 */
function getUserChannelConfig() {
  // 从 known-users.json 读取用户信息
  const knownUsersPath = getKnownUsersPath();
  
  try {
    if (fs.existsSync(knownUsersPath)) {
      const users = JSON.parse(fs.readFileSync(knownUsersPath, 'utf8'));
      // 返回第一个用户的配置
      if (users && users.length > 0) {
        return users[0];
      }
    }
  } catch (error) {
    console.error('读取用户配置失败:', error.message);
  }
  
  // 默认配置（从测试中获取）
  return {
    name: '小焰',
    qq: {
      openid: 'DCBCC0615C886C1EA3DC6718A972DC8E',
      enabled: true
    },
    weixin: {
      userId: 'o9cq807e4f8sPvVk2dHwLp2E1UiE@im.wechat',
      accountId: 'fb7d6c109a73-im-bot',
      enabled: true
    }
  };
}

/**
 * 获取启用的渠道列表
 * 
 * @param {Object} userConfig - 用户配置
 * @returns {Array} 启用的渠道列表
 */
function getEnabledChannels(userConfig) {
  const channels = [];
  
  if (userConfig.qq?.enabled && userConfig.qq?.openid) {
    channels.push({
      type: 'qq',
      channel: 'qqbot',
      to: `qqbot:c2c:${userConfig.qq.openid}`,
      account: null  // QQ 不需要 --account
    });
  }
  
  if (userConfig.weixin?.enabled && userConfig.weixin?.userId) {
    channels.push({
      type: 'weixin',
      channel: 'openclaw-weixin',
      to: userConfig.weixin.userId,
      account: userConfig.weixin.accountId  // 微信需要 --account
    });
  }
  
  return channels;
}

// ============================================================================
// Cron 操作
// ============================================================================

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
 * 创建 Cron 任务（支持多渠道 + 新逻辑：LLM 只生成文案，delivery 自动转发）
 * 
 * @param {string} name - 任务名称
 * @param {Object} schedule - 调度配置
 * @param {string} payloadMessage - 消息内容（包含完整指令）
 * @param {Object} channelConfig - 渠道配置
 * @param {Object} options - 其他选项
 * @returns {Object} 创建结果
 */
function createCronJob(name, schedule, payloadMessage, channelConfig, options = {}) {
  const {
    deleteAfterRun = true
  } = options;
  
  const { channel, to, account } = channelConfig;
  
  // 构建命令
  let cmd = `openclaw cron add --name '${name}'`;
  
  // 调度
  if (schedule.kind === 'at') {
    cmd += ` --at '${schedule.at}'`;
  } else if (schedule.kind === 'cron') {
    cmd += ` --cron '${schedule.expr}'`;
  } else if (schedule.kind === 'every') {
    cmd += ` --every '${schedule.everyMs}ms'`;
  }
  
  // Payload（纯文本，--message 会自动包装成 agentTurn）
  // 转义单引号
  const escapedMessage = payloadMessage.replace(/'/g, "'\\''");
  cmd += ` --message '${escapedMessage}'`;
  
  // Session 配置（isolated session）
  cmd += ` --session 'isolated'`;
  
  // Delivery 配置（关键！自动转发 LLM 回复）
  cmd += ` --announce`;  // 替代 --delivery 'announce'
  cmd += ` --channel '${channel}'`;
  cmd += ` --to '${to}'`;
  
  // 微信需要 --account
  if (account) {
    cmd += ` --account '${account}'`;
  }
  
  // 运行后自动删除
  if (deleteAfterRun) {
    cmd += ' --delete-after-run';
  }
  
  cmd += ' --json';
  
  console.log(`创建 Cron 任务：${name}`);
  console.log(`渠道：${channel}, 目标：${to}`);
  console.log(`Payload: ${payloadMessage.substring(0, 100)}...`);
  const result = exec(cmd);
  
  if (result.success) {
    try {
      const jobData = JSON.parse(result.output);
      return {
        success: true,
        cronJobId: jobData.id,
        name: jobData.name,
        channel: channel,
        to: to,
        nextRunAt: jobData.state?.nextRunAtMs,
        rawData: jobData
      };
    } catch (error) {
      console.log('解析结果:', result.output);
      return { success: true, message: 'Cron 任务创建成功', output: result.output };
    }
  } else {
    console.error('创建失败:', result.error);
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

// ============================================================================
// 提醒 Cron 管理
// ============================================================================

/**
 * 为事件阶段创建 Cron 任务（多渠道 + 新逻辑：LLM 只生成文案，delivery 自动转发）
 * 
 * @param {Object} options - 选项
 * @param {string} options.eventId - 事件 ID
 * @param {string} options.stageId - 阶段 ID
 * @param {Object} options.event - 事件对象（包含 title、schedule 等）
 * @param {string} options.eventTime - 事件时间（ISO 8601）
 * @param {number} options.offset - 提前量
 * @param {string} options.offsetUnit - 提前量单位（minutes/hours/days）
 * @returns {Object} 创建结果
 */
function createReminderCron({ eventId, stageId, event, eventTime, offset, offsetUnit }) {
  // 计算触发时间
  const eventDate = new Date(eventTime);
  const offsetMs = offset * (
    offsetUnit === 'minutes' ? 60000 :
    offsetUnit === 'hours' ? 3600000 :
    offsetUnit === 'days' ? 86400000 : 60000
  );
  
  const triggerTime = new Date(eventDate.getTime() - offsetMs);
  
  // 获取用户配置和启用的渠道
  const userConfig = getUserChannelConfig();
  const channels = getEnabledChannels(userConfig);
  
  if (channels.length === 0) {
    return {
      success: false,
      error: '没有启用的推送渠道'
    };
  }
  
  // 调度配置
  const schedule = {
    kind: 'at',
    at: triggerTime.toISOString()
  };
  
  // 为每个渠道创建 Cron 任务（新逻辑：LLM 只生成文案，delivery 自动转发）
  const results = [];
  for (const channelConfig of channels) {
    const cronName = `claw-calendar-${eventId}-${stageId}-${channelConfig.type}`;
    
    // 构建生成式 Payload（新逻辑）
    const channelName = channelConfig.type === 'qq' ? 'QQ' : '微信';
    const payloadMessage = `【提醒生成任务】

事件信息：
- 标题：${event.title}
- 时间：${event.schedule.date} ${event.schedule.startTime}（北京时间）
- 类型：${channelName}渠道提醒

请生成一条温馨、有人情味的提醒文案：
- 语气：温暖、友好、自然
- 长度：1-2 句话
- 包含：时间、事件、关怀
- 风格：像朋友一样的提醒

重要指令：
1. 不要调用任何工具（包括 message 工具）
2. 直接回复提醒文案即可
3. 不要发送确认消息
4. 不要解释、不要总结

你的回复会被自动推送给用户。`;
    
    const result = createCronJob(cronName, schedule, payloadMessage, channelConfig);
    
    if (result.success) {
      results.push({
        channel: channelConfig.type,
        cronJobId: result.cronJobId,
        to: result.to
      });
    }
  }
  
  if (results.length > 0) {
    return {
      success: true,
      triggerTime: triggerTime.toISOString(),
      channels: results,
      message: '已创建 Cron 任务（LLM 只生成文案，delivery 自动转发）'
    };
  } else {
    return {
      success: false,
      error: '所有渠道创建失败'
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
    if (stage.cronJobIds) {
      for (const cronJobId of stage.cronJobIds) {
        deleteCronJob(cronJobId);
        deletedCrons.push(cronJobId);
      }
    }
  }
  
  // 2. 重新创建 Cron 任务（新逻辑：传入完整 event 对象）
  const createdCrons = [];
  for (const stage of event.reminderStages) {
    const result = createReminderCron({
      eventId: eventId,
      stageId: stage.id,
      event: event,  // 传入完整事件对象
      eventTime: newEventTime,
      offset: stage.offset,
      offsetUnit: stage.offsetUnit || 'minutes'
    });
    
    if (result.success) {
      stage.cronJobIds = result.channels.map(c => c.cronJobId);
      stage.triggerTime = result.triggerTime;
      createdCrons.push(...stage.cronJobIds);
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
    if (stage.cronJobIds) {
      for (const cronJobId of stage.cronJobIds) {
        const result = deleteCronJob(cronJobId);
        if (result.success) {
          deletedCrons.push(cronJobId);
        }
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
  
  const userConfig = getUserChannelConfig();
  const channels = getEnabledChannels(userConfig);
  
  if (channels.length === 0) {
    return { success: false, error: '没有启用的推送渠道' };
  }
  
  const cronName = `test-cron-${Date.now()}`;
  const message = '🧪 Cron 测试任务';
  
  return createCronJob(cronName, schedule, message, channels[0]);
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
  
  // 用户配置
  getUserChannelConfig,
  getEnabledChannels,
  
  // 测试
  testCronCreation,
  
  // 工具
  exec,
  parseCronList
};
