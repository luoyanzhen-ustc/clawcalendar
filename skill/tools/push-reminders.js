#!/usr/bin/env node

/**
 * 推送提醒工具
 * 
 * 功能：
 * - 检查即将发生的事件
 * - 推送到配置的渠道（Web/QQ/微信）
 * - 去重机制（不重复推送）
 * - 渠道自治（独立开关）
 */

const fs = require('fs');
const path = require('path');

/**
 * 获取已知的 QQ 用户列表
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
 * 检查 QQ 是否已连接
 */
function isQQConnected() {
  const qqbotDir = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'qqbot'
  );
  
  return fs.existsSync(qqbotDir);
}

/**
 * 检查微信是否已连接
 */
function isWeChatConnected() {
  const wechatDir = path.join(
    process.env.HOME || '/root',
    '.openclaw',
    'wechat'
  );
  
  return fs.existsSync(wechatDir);
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
  
  if (minutesUntil > 0) {
    message += `\n💡 提示：还有 ${minutesUntil} 分钟开始`;
  }
  
  return message;
}

/**
 * 推送消息到 QQ
 */
function pushToQQ(event, callMessage) {
  const knownUsers = getKnownQQUsers();
  
  if (knownUsers.length === 0) {
    console.log('⚠️  没有已知的 QQ 用户');
    return { success: false, reason: 'no_users' };
  }
  
  const results = [];
  const messageText = formatReminderMessage(event);
  
  for (const user of knownUsers) {
    const target = `qqbot:c2c:${user.openid}`;
    
    try {
      // 通过 OpenClaw message 工具发送
      const result = callMessage({
        action: 'send',
        channel: 'qqbot',
        target: target,
        message: messageText
      });
      
      results.push({
        target,
        success: true,
        messageId: result?.messageId
      });
      
      console.log(`✅ 推送到 QQ: ${target}`);
      
    } catch (error) {
      results.push({
        target,
        success: false,
        error: error.message
      });
      
      console.error(`❌ 推送失败到 QQ ${target}:`, error.message);
    }
  }
  
  return {
    success: results.some(r => r.success),
    results
  };
}

/**
 * 推送消息到微信
 */
function pushToWeChat(event, callMessage) {
  if (!isWeChatConnected()) {
    console.log('⚠️  微信未配置，跳过推送');
    return { success: false, reason: 'not_configured' };
  }
  
  // TODO: 实现微信推送
  console.log('ℹ️  微信推送功能待实现');
  return { success: false, reason: 'not_implemented' };
}

/**
 * 推送消息到 Web UI（当前会话）
 */
function pushToWeb(event) {
  // Web UI 推送通过返回结果实现
  console.log('📱 Web UI 推送:', formatReminderMessage(event));
  return { success: true };
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
 * 主函数：推送提醒
 * 
 * @param {Array} events - 即将发生的事件列表
 * @param {Object} settings - 设置对象
 * @param {Function} callMessage - 调用 message 工具的函数
 * @returns {Object} 推送结果
 */
function pushReminders(events, settings, callMessage) {
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
      const result = pushToQQ(event, callMessage);
      if (result.success) {
        pushedChannels.push('qq');
      }
    }
    
    // 推送到微信
    if (wechatEnabled) {
      const result = pushToWeChat(event, callMessage);
      if (result.success) {
        pushedChannels.push('wechat');
      }
    }
    
    // 标记为已推送
    if (pushedChannels.length > 0) {
      markAsPushed(event, pushedChannels);
      pushedCount++;
    }
  }
  
  console.log(`✅ 推送完成：${pushedCount} 个事件`);
  
  return { pushed: pushedCount };
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
  
  const data = JSON.parse(fs.readFileSync(plansFile, 'utf8'));
  const index = data.plans.findIndex(p => p.id === event.id);
  
  if (index === -1) {
    return false;
  }
  
  data.plans[index].notify = event.notify;
  data.plans[index].updatedAt = new Date().toISOString();
  
  fs.writeFileSync(plansFile, JSON.stringify(data, null, 2), 'utf8');
  return true;
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
  
  const result = pushToQQ(testEvent, callMessage);
  console.log('推送结果:', result);
  
  return result;
}

// 导出
module.exports = {
  pushReminders,
  pushToQQ,
  pushToWeChat,
  pushToWeb,
  formatReminderMessage,
  isAlreadyPushed,
  markAsPushed,
  updateEventNotifyState,
  testPush,
  getKnownQQUsers,
  isQQConnected,
  isWeChatConnected
};

// 如果直接运行
if (require.main === module) {
  console.log('推送工具 - 直接运行模式');
  console.log('请使用 OpenClaw 工具系统调用此模块');
}
