#!/usr/bin/env node

/**
 * Claw Calendar 自动初始化脚本 v2.0
 * 
 * 功能：
 * 1. 创建学期元数据（metadata.json）
 * 2. 生成周次映射
 * 3. 初始化课程表、周期事件、临时事件文件
 * 4. 检查并引导用户配置 QQ/微信渠道
 * 5. 创建 known-users.json（如果不存在）
 */

const fs = require('fs');
const path = require('path');

const {
  getActiveDir,
  getDataDir,
  writeJsonFile
} = require('../tools/file-ops.js');

// 常量定义
const WORKSPACE = '/root/.openclaw/workspace';
const CALENDAR_DIR = path.join(WORKSPACE, 'claw-calendar', 'data');
const KNOWN_USERS_FILE = path.join(CALENDAR_DIR, 'known-users.json');

/**
 * 生成周次映射
 * @param {string} startDate - 学期开始日期 YYYY-MM-DD
 * @param {number} totalWeeks - 总周数
 * @returns {Object} weekMapping
 */
function generateWeekMapping(startDate, totalWeeks = 20) {
  const mapping = {};
  const start = new Date(startDate);
  
  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (week - 1) * 7);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    mapping[`week${week}`] = {
      start: formatDate(weekStart),
      end: formatDate(weekEnd)
    };
  }
  
  return mapping;
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 计算当前周次
 */
function calculateCurrentWeek(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // 如果还没到学期开始日期，返回第 1 周
  if (diffDays < 0) {
    return 1;
  }
  
  // 计算周次（第 1 周从 0 开始）
  const currentWeek = Math.floor(diffDays / 7) + 1;
  
  // 限制在 1-20 周范围内
  return Math.min(Math.max(currentWeek, 1), 20);
}

/**
 * 初始化学期
 */
function initializeSemester(semesterName, startDate, endDate = null) {
  console.log(`🎓 初始化学期：${semesterName}`);
  
  // 计算结束日期（默认 20 周）
  if (!endDate) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 20 * 7);
    endDate = formatDate(end);
  }
  
  // 生成周次映射
  const weekMapping = generateWeekMapping(startDate, 20);
  
  // 自动计算当前周次
  const currentWeek = calculateCurrentWeek(startDate);
  console.log(`📅 当前日期：${formatDate(new Date())}`);
  console.log(`📅 学期开始：${startDate}`);
  console.log(`📅 计算当前周次：第 ${currentWeek} 周`);
  
  // 创建元数据
  const metadata = {
    version: 1,
    semester: semesterName,
    name: `${semesterName}学期`,
    school: 'USTC',
    startDate,
    endDate,
    totalWeeks: 20,
    currentWeek: currentWeek,
    weekMapping,
    keyDates: {
      midtermWeek: [8, 9],
      finalWeek: [19, 20],
      holidays: []
    },
    stats: {
      totalCourses: 0,
      totalRecurring: 0,
      totalPlans: 0,
      byStatus: {}
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null
  };
  
  const dataDir = getDataDir();
  const activeDir = getActiveDir();
  
  // 创建目录
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(activeDir)) {
    fs.mkdirSync(activeDir, { recursive: true });
  }
  
  console.log('📝 写入学期元数据...');
  writeJsonFile(path.join(dataDir, 'metadata.json'), metadata);
  
  // 创建空课程表
  console.log('📚 初始化课程表...');
  writeJsonFile(path.join(activeDir, 'courses.json'), {
    version: 1,
    semester: semesterName,
    courses: [],
    metadata: {
      totalCourses: 0,
      createdAt: new Date().toISOString()
    }
  });
  
  // 创建空周期事件
  console.log('🔄 初始化周期事件...');
  writeJsonFile(path.join(activeDir, 'recurring.json'), {
    version: 1,
    recurring: [],
    metadata: {
      totalRecurring: 0,
      createdAt: new Date().toISOString()
    }
  });
  
  // 创建空临时事件
  console.log('📋 初始化临时事件...');
  writeJsonFile(path.join(activeDir, 'plans.json'), {
    version: 2,
    plans: [],
    metadata: {
      totalPlans: 0,
      createdAt: new Date().toISOString()
    }
  });
  
  console.log(`\n✅ 学期初始化完成！`);
  console.log(`   学期：${semesterName}`);
  console.log(`   时间：${startDate} ~ ${endDate}`);
  console.log(`   周数：20 周`);
  console.log(`   当前周：1`);
  
  return metadata;
}

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 读取 JSON 文件
 */
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * 写入 JSON 文件
 */
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 初始化 known-users.json
 */
function initKnownUsers() {
  if (fileExists(KNOWN_USERS_FILE)) {
    console.log('✅ known-users.json 已存在');
    const data = readJSON(KNOWN_USERS_FILE);
    if (data) {
      console.log('   当前配置：');
      if (data.qqUsers && data.qqUsers.length > 0) {
        console.log(`   - QQ 用户：${data.qqUsers.length} 个`);
      }
      if (data.wechatUsers && data.wechatUsers.length > 0) {
        console.log(`   - 微信用户：${data.wechatUsers.length} 个`);
      }
    }
    return true;
  }

  console.log('⚠️  known-users.json 不存在，创建默认配置...');
  
  const defaultConfig = {
    qqUsers: [],
    wechatUsers: [],
    lastUpdated: new Date().toISOString()
  };

  writeJSON(KNOWN_USERS_FILE, defaultConfig);
  console.log('✅ 已创建 known-users.json');
  console.log('');
  console.log('📝 下一步：配置你的 QQ 和微信用户 ID');
  console.log('   编辑文件：' + KNOWN_USERS_FILE);
  console.log('');
  console.log('   QQ 用户格式：');
  console.log('   {');
  console.log('     "userId": "你的 QQ 用户 ID",');
  console.log('     "name": "你的名字",');
  console.log('     "channels": ["qqbot"]');
  console.log('   }');
  console.log('');
  console.log('   微信用户格式：');
  console.log('   {');
  console.log('     "userId": "你的微信用户 ID",');
  console.log('     "name": "你的名字",');
  console.log('     "channels": ["openclaw-weixin"]');
  console.log('   }');
  console.log('');
  
  return true;
}

/**
 * 检查渠道配置
 */
function checkChannels() {
  console.log('🔍 检查渠道配置...');
  console.log('');
  
  const knownUsers = readJSON(KNOWN_USERS_FILE);
  
  if (!knownUsers) {
    console.log('❌ known-users.json 不存在或格式错误');
    return false;
  }
  
  const hasQQ = knownUsers.qqUsers && knownUsers.qqUsers.length > 0;
  const hasWechat = knownUsers.wechatUsers && knownUsers.wechatUsers.length > 0;
  
  if (!hasQQ && !hasWechat) {
    console.log('⚠️  未配置任何用户');
    console.log('');
    console.log('📋 配置步骤：');
    console.log('   1. 获取你的 QQ 用户 ID：');
    console.log('      - 在 QQ 频道中发送消息，然后查看日志');
    console.log('      - 或使用 QQ Bot API 查询');
    console.log('');
    console.log('   2. 获取你的微信用户 ID：');
    console.log('      - 在微信中发送消息，然后查看日志');
    console.log('      - 格式：o9cq807e4f8sPvVk2dHwLp2E1UiE@im.wechat');
    console.log('');
    console.log('   3. 编辑 known-users.json 添加你的用户信息');
    console.log('');
    return false;
  }
  
  if (hasQQ) {
    console.log('✅ QQ 渠道已配置 (' + knownUsers.qqUsers.length + ' 个用户)');
  } else {
    console.log('⚠️  QQ 渠道未配置');
  }
  
  if (hasWechat) {
    console.log('✅ 微信渠道已配置 (' + knownUsers.wechatUsers.length + ' 个用户)');
  } else {
    console.log('⚠️  微信渠道未配置');
  }
  
  console.log('');
  return true;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  // 如果是渠道检查模式
  if (args.includes('--check-channels')) {
    console.log('🗓️  Claw Calendar 渠道配置检查');
    console.log('========================');
    console.log('');
    
    // 确保日历目录存在
    if (!fs.existsSync(CALENDAR_DIR)) {
      console.log('📁 创建日历目录...');
      fs.mkdirSync(CALENDAR_DIR, { recursive: true });
      console.log('✅ 已创建：' + CALENDAR_DIR);
      console.log('');
    }
    
    // 初始化 known-users.json
    initKnownUsers();
    console.log('');
    
    // 检查渠道配置
    checkChannels();
    console.log('');
    
    console.log('========================');
    console.log('✅ 渠道配置检查完成');
    console.log('');
    console.log('💡 提示：');
    console.log('   - 如果看到 ⚠️ 警告，请按照提示配置你的渠道');
    console.log('   - 配置完成后，再次运行此脚本检查');
    console.log('   - 或者手动编辑 known-users.json 添加用户信息');
    console.log('');
    return;
  }
  
  // 如果是帮助模式
  if (args.includes('--help') || args.length === 0) {
    console.log('用法：node auto-init.js <学期名称> <开始日期>');
    console.log('      node auto-init.js --check-channels');
    console.log('');
    console.log('示例：');
    console.log('  学期初始化：');
    console.log('    node auto-init.js 2026-spring 2026-03-01');
    console.log('    node auto-init.js 2026-fall 2026-09-01');
    console.log('');
    console.log('  渠道配置检查：');
    console.log('    node auto-init.js --check-channels');
    console.log('');
    process.exit(0);
  }
  
  // 学期初始化模式
  const semesterName = args[0];
  const startDate = args[1];
  
  if (!semesterName || !startDate) {
    console.error('❌ 请提供学期名称和开始日期');
    console.error('   使用 --help 查看帮助');
    process.exit(1);
  }
  
  try {
    initializeSemester(semesterName, startDate);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

main();
