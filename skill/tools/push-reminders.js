#!/usr/bin/env node

/**
 * 推送提醒工具 v3.0 (纯 Cron 驱动架构)
 * 
 * 核心变更：
 * - 从推送多个事件 → 推送单个阶段
 * - 不再需要去重逻辑（Cron 一次性触发）
 * - 支持多渠道推送（QQ/微信/Web）
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
 * 获取已知 QQ 用户列表
 */
function getKnownQQUsers() {
  const knownUsersFile = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'qqbot',
    'data',
    'known-users.json'
  );
  
  if (!fs.existsSync(knownUsersFile)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(knownUsersFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取 known-users.json 失败:', error.message);
    return [];
  }
}

/**
 * 获取已知微信用户列表
 */
function getKnownWeChatUsers() {
  const wechatDir = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'openclaw-weixin',
    'accounts'
  );
  
  const accountsFile = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'openclaw-weixin',
    'accounts.json'
  );
  
  if (!fs.existsSync(accountsFile) || !fs.existsSync(wechatDir)) {
    return [];
  }
  
  try {
    const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
    
    const users = [];
    for (const accountId of accounts) {
      const accountFile = path.join(wechatDir, `${accountId}.json`);
      if (!fs.existsSync(accountFile)) {
        continue;
      }
      
      const account = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
      if (account.userId) {
        users.push(account.userId);
      }
    }
    
    return users;
  } catch (error) {
    console.error('读取微信用户失败:', error.message);
    return [];
  }
}

/**
 * 检查 QQ 是否已连接
 */
function isQQConnected() {
  return getKnownQQUsers().length > 0;
}

/**
 * 检查微信是否已连接
 */
function isWeChatConnected() {
  return getKnownWeChatUsers().length > 0;
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
 * 推送消息到所有 QQ 用户
 */
function pushToQQUsers(event, stageMessage, callMessage) {
  const users = getKnownQQUsers();
  
  if (users.length === 0) {
    console.log('⚠️  没有已知的 QQ 用户');
    return { success: false, reason: 'no_users', pushed: 0, failed: 0 };
  }
  
  const results = { pushed: 0, failed: 0, details: [] };
  const messageText = formatReminderMessage(event, stageMessage);
  
  for (const user of users) {
    const target = `qqbot:${user.type}:${user.openid}`;
    
    try {
      const result = callMessage({
        action: 'send',
        channel: 'qqbot',
        target: target,
        message: messageText
      });
      
      if (result?.messageId || result?.success) {
        results.pushed++;
        console.log(`✅ 推送到 QQ: ${target}`);
        results.details.push({ target, success: true, messageId: result.messageId });
      } else {
        results.failed++;
        console.error(`❌ 推送失败到 QQ ${target}`);
        results.details.push({ target, success: false, error: 'unknown' });
      }
      
    } catch (error) {
      results.failed++;
      console.error(`❌ 推送异常到 QQ ${target}:`, error.message);
      results.details.push({ target, success: false, error: error.message });
    }
  }
  
  return {
    success: results.pushed > 0,
    ...results
  };
}

/**
 * 推送消息到所有微信用户
 */
function pushToWeChatUsers(event, stageMessage, callMessage) {
  const users = getKnownWeChatUsers();
  
  if (users.length === 0) {
    console.log('⚠️  没有已知的微信用户');
    return { success: false, reason: 'no_users', pushed: 0, failed: 0 };
  }
  
  const results = { pushed: 0, failed: 0, details: [] };
  const messageText = formatReminderMessage(event, stageMessage);
  
  for (const userId of users) {
    try {
      const result = callMessage({
        action: 'send',
        channel: 'openclaw-weixin',
        target: userId,
        message: messageText
      });
      
      if (result?.messageId || result?.success) {
        results.pushed++;
        console.log(`✅ 推送到微信：${userId}`);
        results.details.push({ target: userId, success: true, messageId: result.messageId });
      } else {
        results.failed++;
        console.error(`❌ 推送失败到微信 ${userId}`);
        results.details.push({ target: userId, success: false, error: 'unknown' });
      }
      
    } catch (error) {
      results.failed++;
      console.error(`❌ 推送异常到微信 ${userId}:`, error.message);
      results.details.push({ target: userId, success: false, error: error.message });
    }
  }
  
  return {
    success: results.pushed > 0,
    ...results
  };
}

/**
 * 推送消息到 Web UI（当前会话）
 */
function pushToWeb(event, stageMessage) {
  console.log('📱 Web UI 推送:', formatReminderMessage(event, stageMessage));
  return { success: true, pushed: 1 };
}

/**
 * 推送单个阶段的提醒
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
  
  if (stage.pushedAt) {
    return { success: false, error: '阶段已推送过', pushedAt: stage.pushedAt };
  }
  
  // 3. 读取设置
  const settingsFile = getSettingsFile();
  const settings = fs.existsSync(settingsFile) 
    ? JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
    : {};
  
  const channels = settings.notify?.channels || {};
  const webchatEnabled = channels.webchat !== false;
  const qqEnabled = channels.qq !== false && isQQConnected();
  const wechatEnabled = channels.wechat !== false && isWeChatConnected();
  
  console.log(`📱 渠道配置：Web=${webchatEnabled}, QQ=${qqEnabled}, 微信=${wechatEnabled}`);
  
  // 4. 推送到各渠道
  const pushedChannels = [];
  const results = {
    webchat: { success: false, pushed: 0 },
    qq: { success: false, pushed: 0 },
    wechat: { success: false, pushed: 0 }
  };
  
  // 推送到 Web UI
  if (webchatEnabled) {
    const result = pushToWeb(event, stage.message);
    results.webchat = result;
    if (result.success) pushedChannels.push('webchat');
  }
  
  // 推送到 QQ
  if (qqEnabled) {
    const result = pushToQQUsers(event, stage.message, callMessage);
    results.qq = result;
    if (result.success) pushedChannels.push('qq');
  }
  
  // 推送到微信
  if (wechatEnabled) {
    const result = pushToWeChatUsers(event, stage.message, callMessage);
    results.wechat = result;
    if (result.success) pushedChannels.push('wechat');
  }
  
  // 5. 标记为已推送
  stage.pushedAt = new Date().toISOString();
  
  // 6. 更新事件
  data.plans = data.plans.map(p => 
    p.id === eventId ? { ...p, reminderStages: event.reminderStages } : p
  );
  data.metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(plansFile, JSON.stringify(data, null, 2), 'utf8');
  
  // 7. 计算总推送数
  const totalPushed = results.webchat.pushed + results.qq.pushed + results.wechat.pushed;
  
  console.log(`✅ 推送完成：${totalPushed} 次推送`);
  
  return {
    success: true,
    pushed: totalPushed,
    channels: pushedChannels,
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
        pushedAt: null
      }
    ]
  };
  
  console.log('测试 QQ 推送...');
  const qqResult = pushToQQUsers(testEvent, '测试消息', callMessage);
  console.log('QQ 推送结果:', qqResult);
  
  console.log('测试微信推送...');
  const wechatResult = pushToWeChatUsers(testEvent, '测试消息', callMessage);
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
  pushToQQUsers,
  pushToWeChatUsers,
  pushToWeb,
  
  // 工具函数
  formatReminderMessage,
  getKnownQQUsers,
  getKnownWeChatUsers,
  isQQConnected,
  isWeChatConnected,
  
  // 测试
  testPush
};
