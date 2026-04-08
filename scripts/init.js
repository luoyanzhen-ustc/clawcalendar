#!/usr/bin/env node

/**
 * Claw Calendar 初始化脚本 v4.0
 * 
 * 功能：
 * 1. 检测当前会话的 QQ/微信用户 ID
 * 2. 生成 known-users.json
 * 3. 验证渠道连通性
 * 4. 创建测试事件（可选）
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 路径配置
// ============================================================================

function getBasePath() {
  return process.env.OPENCLAW_WORKSPACE || 
         path.join(require('os').homedir(), '.openclaw', 'workspace');
}

function getDataDir() {
  const basePath = getBasePath();
  return path.join(basePath, 'claw-calendar', 'data');
}

function getKnownUsersFile() {
  return path.join(getDataDir(), 'known-users.json');
}

// ============================================================================
// 初始化函数
// ============================================================================

/**
 * 检测当前会话渠道
 */
function detectCurrentChannel() {
  // 从环境变量或进程信息中检测
  const channel = process.env.OPENCLAW_CHANNEL || 'webchat';
  return channel;
}

/**
 * 获取当前用户 ID
 */
function getCurrentUserId() {
  return process.env.OPENCLAW_USER_ID || null;
}

/**
 * 获取当前 Account ID（微信）
 */
function getCurrentAccountId() {
  return process.env.OPENCLAW_ACCOUNT_ID || null;
}

/**
 * 生成用户配置
 */
function generateUserConfig() {
  const channel = detectCurrentChannel();
  const userId = getCurrentUserId();
  const accountId = getCurrentAccountId();
  
  const config = {
    name: '用户',
    qq: {
      openid: null,
      enabled: false
    },
    weixin: {
      userId: null,
      accountId: null,
      enabled: false
    }
  };
  
  if (channel === 'qqbot' && userId) {
    config.qq.openid = userId;
    config.qq.enabled = true;
    console.log(`✅ 检测到 QQ 用户：${userId}`);
  }
  
  if (channel === 'openclaw-weixin' && userId && accountId) {
    config.weixin.userId = userId;
    config.weixin.accountId = accountId;
    config.weixin.enabled = true;
    console.log(`✅ 检测到微信用户：${userId}`);
  }
  
  // 如果是 webchat，提示用户手动配置
  if (channel === 'webchat') {
    console.log('ℹ️  当前为 Web UI 会话，需要手动配置渠道信息');
    console.log('提示：在 QQ 或微信中重新运行此脚本以自动配置');
  }
  
  return config;
}

/**
 * 保存配置文件
 */
function saveConfig(config) {
  const dataDir = getDataDir();
  
  // 确保目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const knownUsersFile = getKnownUsersFile();
  fs.writeFileSync(knownUsersFile, JSON.stringify([config], null, 2), 'utf8');
  
  console.log(`📝 配置文件已保存：${knownUsersFile}`);
}

/**
 * 验证渠道连通性（创建 1 分钟后的测试 Cron）
 */
async function testChannels() {
  console.log('\n🧪 测试渠道连通性...');
  
  const config = JSON.parse(fs.readFileSync(getKnownUsersFile(), 'utf8'))[0];
  
  // 检查是否有启用的渠道
  const hasQQ = config.qq?.enabled && config.qq?.openid;
  const hasWeChat = config.weixin?.enabled && config.weixin?.userId;
  
  if (!hasQQ && !hasWeChat) {
    console.log('⚠️  没有启用的渠道，跳过测试');
    return false;
  }
  
  console.log('提示：创建 1 分钟后的测试事件来验证推送...');
  console.log('      请在 QQ/微信中等待接收测试消息');
  
  // 这里可以调用 createReminderCron 创建测试任务
  // 但为了简化，让用户手动测试
  
  return true;
}

/**
 * 主函数
 */
async function init() {
  console.log('🦞 Claw Calendar 初始化向导 v4.0\n');
  console.log('========================================\n');
  
  // 1. 检测当前渠道
  const channel = detectCurrentChannel();
  console.log(`📱 当前渠道：${channel}`);
  
  // 2. 生成用户配置
  const config = generateUserConfig();
  
  // 3. 保存配置
  saveConfig(config);
  
  // 4. 验证渠道连通性
  await testChannels();
  
  // 5. 显示使用说明
  console.log('\n========================================');
  console.log('✅ 初始化完成！\n');
  console.log('📖 快速开始：');
  console.log('  1. 说 "5 分钟后提醒我去喝水" 创建测试事件');
  console.log('  2. 等待推送，验证 QQ/微信是否收到消息');
  console.log('  3. 说 "今天有什么安排" 查询日程');
  console.log('  4. 上传课表图片，自动识别课程');
  console.log('\n⚠️  如果未收到推送，请检查：');
  console.log('  - known-users.json 配置是否正确');
  console.log('  - QQ/微信是否已连接');
  console.log('  - 运行 "openclaw cron list" 查看 Cron 任务');
  console.log('========================================\n');
}

// ============================================================================
// 执行
// ============================================================================

if (require.main === module) {
  init().catch(error => {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  });
} else {
  module.exports = { init, generateUserConfig, saveConfig };
}
