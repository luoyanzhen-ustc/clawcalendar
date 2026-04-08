#!/usr/bin/env node

/**
 * 推送提醒工具 v4.0 (多渠道 Cron 驱动架构)
 * 
 * 核心变更：
 * - 适配 v4.0 Schema: pushedChannels 对象
 * - 每个渠道独立推送状态
 * - 支持部分渠道推送失败的重试
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// 路径配置
// ============================================================================

function getBasePath() {
  return process.env.OPENCLAW_WORKSPACE || 
         path.join(os.homedir(), '.openclaw', 'workspace');
}

function getDataDir() {
  const basePath = getBasePath();
  return path.join(basePath, 'claw-calendar', 'data');
}

function getActiveDir() {
  return path.join(getDataDir(), 'active');
}

function getSettingsFile() {
  return path.join(getDataDir(), 'settings.json');
}

function getPlansFile() {
  return path.join(getActiveDir(), 'plans.json');
}

/**
 * 获取用户渠道配置（从 known-users.json）
 */
function getUserChannelConfig() {
  const knownUsersFile = path.join(getDataDir(), 'known-users.json');
  
  if (!fs.existsSync(knownUsersFile)) {
    return null;
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(knownUsersFile, 'utf8'));
    if (users && users.length > 0) {
      return users[0];
    }
  } catch (error) {
    console.error('读取 known-users.json 失败:', error.message);
  }
  
  return null;
}

/**
 * 格式化提醒消息
 */
function formatReminderMessage(event, stageMessage) {
  const display = event.schedule?.display || {};
  const eventTime = event.schedule?.startTime || display.time || '未知时间';
  const eventDate = event.schedule?.date || display.date || '未知日期';
  
  let message = `📅 提醒：${event.title}\n\n`;
  message += `⏰ 时间：${eventDate} ${eventTime}\n`;
  
  if (event.location) {
    message += `📍 地点：${event.location}\n`;
  }
  
  if (stageMessage) {
    message += `\n💡 ${stageMessage}`;
  }
  
  return message;
}

/**
 * 推送消息到 QQ
 */
function pushToQQ(event, stageMessage, callMessage) {
  const userConfig = getUserChannelConfig();
  
  if (!userConfig?.qq?.openid || !userConfig.qq.enabled) {
    console.log('⚠️  QQ 渠道未配置');
    return { success: false, reason: 'not_configured', pushed: 0 };
  }
  
  const target = `qqbot:c2c:${userConfig.qq.openid}`;
  const messageText = formatReminderMessage(event, stageMessage);
  
  try {
    const result = callMessage({
      action: 'send',
      channel: 'qqbot',
      target: target,
      message: messageText
    });
    
    if (result?.messageId || result?.success) {
      console.log(`✅ 推送到 QQ: ${target}`);
      return { 
        success: true, 
        pushed: 1, 
        messageId: result.messageId,
        target: target
      };
    } else {
      console.error(`❌ 推送失败到 QQ ${target}`);
      return { success: false, pushed: 0, error: 'unknown' };
    }
    
  } catch (error) {
    console.error(`❌ 推送异常到 QQ ${target}:`, error.message);
    return { success: false, pushed: 0, error: error.message };
  }
}

/**
 * 推送消息到微信
 */
function pushToWeChat(event, stageMessage, callMessage) {
  const userConfig = getUserChannelConfig();
  
  if (!userConfig?.weixin?.userId || !userConfig.weixin.enabled) {
    console.log('⚠️  微信渠道未配置');
    return { success: false, reason: 'not_configured', pushed: 0 };
  }
  
  const target = userConfig.weixin.userId;
  const messageText = formatReminderMessage(event, stageMessage);
  
  try {
    const result = callMessage({
      action: 'send',
      channel: 'openclaw-weixin',
      target: target,
      message: messageText
    });
    
    if (result?.messageId || result?.success) {
      console.log(`✅ 推送到微信：${target}`);
      return { 
        success: true, 
        pushed: 1, 
        messageId: result.messageId,
        target: target
      };
    } else {
      console.error(`❌ 推送失败到微信 ${target}`);
      return { success: false, pushed: 0, error: 'unknown' };
    }
    
  } catch (error) {
    console.error(`❌ 推送异常到微信 ${target}:`, error.message);
    return { success: false, pushed: 0, error: error.message };
  }
}

/**
 * 推送消息到 Web UI（当前会话）
 */
function pushToWeb(event, stageMessage) {
  console.log('📱 Web UI 推送:', formatReminderMessage(event, stageMessage));
  return { success: true, pushed: 1, channel: 'webchat' };
}

/**
 * 推送单个阶段的提醒（v4.0 Schema）
 * 
 * @param {Object} options - 选项
 * @param {string} options.eventId - 事件 ID
 * @param {string} options.stageId - 阶段 ID
 * @param {Function} options.callMessage - 调用 message 工具的函数
 * @returns {Object} 推送结果
 */
function pushReminder({ eventId, stageId, callMessage }) {
  console.log(`🔔 开始推送提醒：${eventId} - ${stageId}`);
  
  // 1. 读取事件
  const plansFile = getPlansFile();
  if (!fs.existsSync(plansFile)) {
    return { success: false, error: '事件文件不存在' };
  }
  
  const data = JSON.parse(fs.readFileSync(plansFile, 'utf8'));
  const event = data.plans.find(p => p.id === eventId);
  
  if (!event) {
    return { success: false, error: '事件不存在' };
  }
  
  // 2. 读取阶段
  const stage = event.reminderStages?.find(s => s.id === stageId);
  
  if (!stage) {
    return { success: false, error: '阶段不存在' };
  }
  
  // 3. 读取设置
  const settingsFile = getSettingsFile();
  const settings = fs.existsSync(settingsFile) 
    ? JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
    : {};
  
  const channels = settings.notify?.channels || ['qq', 'wechat', 'webchat'];
  
  console.log(`📱 推送渠道：${channels.join(', ')}`);
  
  // 4. 推送到各渠道（v4.0: 每个渠道独立状态）
  const pushedChannels = {};
  const results = {};
  
  for (const channelType of channels) {
    // 检查该渠道是否已推送
    if (stage.pushedChannels?.[channelType]?.pushedAt) {
      console.log(`⏭️  渠道 ${channelType} 已推送，跳过`);
      results[channelType] = { success: true, skipped: true };
      pushedChannels[channelType] = stage.pushedChannels[channelType];
      continue;
    }
    
    let result;
    
    // 推送到对应渠道
    if (channelType === 'qq') {
      result = pushToQQ(event, stage.message, callMessage);
    } else if (channelType === 'wechat' || channelType === 'weixin') {
      result = pushToWeChat(event, stage.message, callMessage);
    } else if (channelType === 'webchat') {
      result = pushToWeb(event, stage.message);
    } else {
      console.log(`⚠️  未知渠道：${channelType}`);
      continue;
    }
    
    results[channelType] = result;
    
    // 记录推送状态（v4.0 Schema）
    if (result.success) {
      pushedChannels[channelType] = {
        pushedAt: new Date().toISOString(),
        cronJobId: stage.cronJobIds?.find(id => id.includes(channelType)) || null,
        status: 'delivered',
        messageId: result.messageId
      };
      console.log(`✅ 渠道 ${channelType} 推送成功`);
    } else {
      pushedChannels[channelType] = {
        pushedAt: null,
        cronJobId: null,
        status: 'failed',
        error: result.error
      };
      console.error(`❌ 渠道 ${channelType} 推送失败：${result.error}`);
    }
  }
  
  // 5. 更新事件（v4.0 Schema: 更新 pushedChannels）
  stage.pushedChannels = {
    ...stage.pushedChannels,
    ...pushedChannels
  };
  
  // 检查是否所有渠道都推送成功
  const allPushed = channels.every(ch => 
    stage.pushedChannels[ch]?.pushedAt !== null
  );
  
  if (allPushed) {
    stage.pushedAt = new Date().toISOString();  // 兼容字段
  }
  
  // 更新事件文件
  data.plans = data.plans.map(p => 
    p.id === eventId ? { ...p, reminderStages: event.reminderStages } : p
  );
  data.metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(plansFile, JSON.stringify(data, null, 2), 'utf8');
  
  // 6. 计算总推送数
  const totalPushed = Object.values(results).filter(r => r?.success).length;
  
  console.log(`✅ 推送完成：${totalPushed}/${channels.length} 渠道成功`);
  
  return {
    success: totalPushed > 0,
    pushed: totalPushed,
    channels: channels.filter(ch => results[ch]?.success),
    results: results
  };
}

/**
 * 测试推送
 */
function testPush(callMessage) {
  console.log('🧪 测试推送功能...');
  
  const testEvent = {
    id: 'test-push-001',
    title: '测试推送',
    schedule: {
      date: '2026-04-08',
      startTime: '22:30',
      displayTimezone: 'Asia/Shanghai'
    },
    reminderStages: [
      {
        id: 'stage-001',
        offset: 30,
        offsetUnit: 'minutes',
        message: '30 分钟后有安排',
        pushedChannels: {}
      }
    ]
  };
  
  console.log('测试 QQ 推送...');
  const qqResult = pushToQQ(testEvent, '测试消息', callMessage);
  console.log('QQ 推送结果:', qqResult);
  
  console.log('测试微信推送...');
  const wechatResult = pushToWeChat(testEvent, '测试消息', callMessage);
  console.log('微信推送结果:', wechatResult);
  
  return {
    qq: qqResult,
    wechat: wechatResult
  };
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  pushReminder,
  pushToQQ,
  pushToWeChat,
  pushToWeb,
  
  // 工具函数
  formatReminderMessage,
  getUserChannelConfig,
  
  // 测试
  testPush
};
