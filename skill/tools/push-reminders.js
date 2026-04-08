#!/usr/bin/env node

/**
 * 推送提醒工具
 * 
 * 功能：
 * - 检查即将发生的事件
 * - 推送到所有已知用户（QQ + 微信）
 * - 去重机制（不重复推送）
 * - 渠道自治（独立开关）
 */

const fs = require('fs');
const path = require('path');

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
  const qqbotDir = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'qqbot'
  );
  
  return fs.existsSync(qqbotDir) && getKnownQQUsers().length > 0;
}

/**
 * 检查微信是否已连接
 */
function isWeChatConnected() {
  const wechatDir = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'openclaw-weixin'
  );
  
  return fs.existsSync(wechatDir) && getKnownWeChatUsers().length > 0;
}

/**
 * 格式化提醒消息
 */
function formatReminderMessage(event) {
  const display = event.schedule?.display || {};
  const minutesUntil = event.minutesUntilEvent || 0;
  
  let message = `📅 提醒：${event.title}\n\n`;
  
  if (display.date) {
    message += `⏰ 时间：${display.date} ${display.time}\n`;
  } else if (event.schedule?.displayDate) {
    message += `⏰ 时间：${event.schedule.displayDate} ${event.schedule.displayTime || ''}\n`;
  }
  
  if (event.location) {
    message += `📍 地点：${event.location}\n`;
  }
  
  if (event.schedule?.displayLocation) {
    message += `📍 地点：${event.schedule.displayLocation}\n`;
  }
  
  if (minutesUntil > 0) {
    message += `\n💡 提示：还有 ${minutesUntil} 分钟开始`;
  }
  
  return message;
}

/**
 * 推送消息到所有 QQ 用户
 */
function pushToQQUsers(event, callMessage) {
  const users = getKnownQQUsers();
  
  if (users.length === 0) {
    console.log('⚠️  没有已知的 QQ 用户');
    return { success: false, reason: 'no_users', pushed: 0, failed: 0 };
  }
  
  const results = { pushed: 0, failed: 0, details: [] };
  const messageText = formatReminderMessage(event);
  
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
function pushToWeChatUsers(event, callMessage) {
  const users = getKnownWeChatUsers();
  
  if (users.length === 0) {
    console.log('⚠️  没有已知的微信用户');
    return { success: false, reason: 'no_users', pushed: 0, failed: 0 };
  }
  
  const results = { pushed: 0, failed: 0, details: [] };
  const messageText = formatReminderMessage(event);
  
  for (const userId of users) {
    // 微信直接使用 userId，不需要前缀
    
    try {
      const result = callMessage({
        action: 'send',
        channel: 'openclaw-weixin',
        target: userId,  // 微信直接使用 userId
        message: messageText
      });
      
      if (result?.messageId || result?.success) {
        results.pushed++;
        console.log(`✅ 推送到微信：${target}`);
        results.details.push({ target, success: true, messageId: result.messageId });
      } else {
        results.failed++;
        console.error(`❌ 推送失败到微信 ${target}`);
        results.details.push({ target, success: false, error: 'unknown' });
      }
      
    } catch (error) {
      results.failed++;
      console.error(`❌ 推送异常到微信 ${target}:`, error.message);
      results.details.push({ target, success: false, error: error.message });
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
function pushToWeb(event) {
  console.log('📱 Web UI 推送:', formatReminderMessage(event));
  return { success: true, pushed: 1 };
}

/**
 * 检查事件是否已推送过
 */
function isAlreadyPushed(event) {
  if (!event.notify) {
    return false;
  }
  
  if (!event.notify.lastPushedAt) {
    return false;
  }
  
  const lastPush = new Date(event.notify.lastPushedAt);
  const now = new Date();
  const timeSinceLastPush = (now - lastPush) / 60000; // 分钟
  
  // 30 分钟内不重复推送
  return timeSinceLastPush < 30;
}

/**
 * 标记事件为已推送
 */
function markAsPushed(event, channels) {
  if (!event.notify) {
    event.notify = {
      lastPushedAt: null,
      pushedChannels: [],
      nextPushTime: null
    };
  }
  
  const now = new Date().toISOString();
  event.notify.lastPushedAt = now;
  
  for (const channel of channels) {
    if (!event.notify.pushedChannels.includes(channel)) {
      event.notify.pushedChannels.push(channel);
    }
  }
  
  return event;
}

/**
 * 更新事件的推送状态到文件
 */
function updateEventNotifyState(event) {
  const plansFile = path.join(
    process.env.OPENCLAW_WORKSPACE || '/root/.openclaw/workspace',
    'claw-calendar',
    'data',
    'active',
    'plans.json'
  );
  
  if (!fs.existsSync(plansFile)) {
    return false;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(plansFile, 'utf8'));
    const index = data.plans.findIndex(p => p.id === event.id);
    
    if (index === -1) {
      return false;
    }
    
    data.plans[index].notify = event.notify;
    data.plans[index].updatedAt = new Date().toISOString();
    
    fs.writeFileSync(plansFile, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('更新事件状态失败:', error.message);
    return false;
  }
}

/**
 * 主函数：推送提醒
 * 
 * @param {Object} options - 选项
 * @param {Array} options.events - 即将发生的事件列表
 * @param {Object} options.settings - 设置对象
 * @param {Function} options.callMessage - 调用 message 工具的函数
 * @returns {Object} 推送结果
 */
function pushReminders({ events, settings, callMessage }) {
  console.log('🔔 开始检查提醒推送...');
  
  // 检查推送总开关
  if (!settings.notify?.enabled) {
    console.log('ℹ️  推送已关闭，跳过');
    return { pushed: 0, reason: 'disabled' };
  }
  
  if (!events || events.length === 0) {
    console.log('ℹ️  没有即将发生的事件');
    return { pushed: 0 };
  }
  
  console.log(`📋 获取到 ${events.length} 个即将发生的事件`);
  
  // 检查渠道配置
  const channels = settings.notify?.channels || {};
  const webchatEnabled = channels.webchat !== false; // 默认开启
  const qqEnabled = channels.qq !== false && isQQConnected();
  const wechatEnabled = channels.wechat !== false && isWeChatConnected();
  
  console.log(`📱 渠道配置：Web=${webchatEnabled}, QQ=${qqEnabled}, 微信=${wechatEnabled}`);
  
  let pushedCount = 0;
  const pushedEvents = [];
  
  for (const event of events) {
    // 检查是否已推送过
    if (isAlreadyPushed(event)) {
      console.log(`⏭️  跳过已推送事件：${event.title}`);
      continue;
    }
    
    console.log(`📤 推送事件：${event.title}`);
    
    const pushedChannels = [];
    
    // 推送到 Web UI（总是推送）
    if (webchatEnabled) {
      pushToWeb(event);
      pushedChannels.push('webchat');
    }
    
    // 推送到 QQ
    if (qqEnabled) {
      const result = pushToQQUsers(event, callMessage);
      if (result.pushed > 0) {
        pushedChannels.push('qq');
        pushedCount += result.pushed;
      }
    }
    
    // 推送到微信
    if (wechatEnabled) {
      const result = pushToWeChatUsers(event, callMessage);
      if (result.pushed > 0) {
        pushedChannels.push('wechat');
        pushedCount += result.pushed;
      }
    }
    
    // 标记为已推送
    if (pushedChannels.length > 0) {
      markAsPushed(event, pushedChannels);
      updateEventNotifyState(event);
      pushedEvents.push(event.id);
    }
  }
  
  console.log(`✅ 推送完成：${pushedCount} 次推送（${pushedEvents.length} 个事件）`);
  
  return { 
    pushed: pushedCount,
    events: pushedEvents,
    channels: {
      webchat: webchatEnabled,
      qq: qqEnabled,
      wechat: wechatEnabled
    }
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
      displayDate: '2026-04-08',
      displayTime: '22:30',
      displayTimezone: 'Asia/Shanghai'
    },
    notify: {
      lastPushedAt: null,
      pushedChannels: []
    }
  };
  
  console.log('测试 QQ 推送...');
  const qqResult = pushToQQUsers(testEvent, callMessage);
  console.log('QQ 推送结果:', qqResult);
  
  console.log('测试微信推送...');
  const wechatResult = pushToWeChatUsers(testEvent, callMessage);
  console.log('微信推送结果:', wechatResult);
  
  return {
    qq: qqResult,
    wechat: wechatResult
  };
}

// 导出
module.exports = {
  pushReminders,
  pushToQQUsers,
  pushToWeChatUsers,
  pushToWeb,
  formatReminderMessage,
  isAlreadyPushed,
  markAsPushed,
  updateEventNotifyState,
  testPush,
  getKnownQQUsers,
  getKnownWeChatUsers,
  isQQConnected,
  isWeChatConnected
};

// 如果直接运行
if (require.main === module) {
  console.log('推送工具 - 直接运行模式');
  console.log('请使用 OpenClaw 工具系统调用此模块');
}
