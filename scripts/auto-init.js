#!/usr/bin/env node

/**
 * 自动初始化脚本
 * 首次使用时运行，创建必要的文件和目录
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '/root/.openclaw/workspace';
const CALENDAR_DIR = path.join(WORKSPACE_DIR, 'calendar');
const SKILL_DIR = path.join(WORKSPACE_DIR, 'claw-calendar/skill');
const TEMPLATES_DIR = path.join(SKILL_DIR, 'templates');

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 创建目录：${dir}`);
  }
}

/**
 * 复制文件（如果不存在）
 */
function copyIfNotExists(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ 创建文件：${dest}`);
    return true;
  } else {
    console.log(`⏭️  已存在：${dest}`);
    return false;
  }
}

/**
 * 初始化配置
 */
function initConfig() {
  const settingsFile = path.join(CALENDAR_DIR, 'settings.json');
  const eventsFile = path.join(CALENDAR_DIR, 'events.json');
  
  // 创建日历目录
  ensureDir(CALENDAR_DIR);
  
  // 创建 settings.json（如果不存在）
  if (!fs.existsSync(settingsFile)) {
    const defaultSettings = {
      timezone: 'Asia/Shanghai',
      semesterStart: null,
      notify: {
        channels: ['current'],
        qq: { enabled: false },
        wechat: { enabled: false }
      },
      reminderDefaults: {
        high: [1440, 60],
        medium: [30],
        low: [10]
      },
      quietHours: {
        start: '23:00',
        end: '08:00'
      }
    };
    
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
    console.log(`✅ 创建配置文件：${settingsFile}`);
    console.log('   ⚠️  请设置 semesterStart（学期开始日期）');
  }
  
  // 创建 events.json（如果不存在）
  if (!fs.existsSync(eventsFile)) {
    const defaultEvents = {
      version: 1,
      events: [],
      metadata: {
        createdAt: new Date().toISOString(),
        timezone: 'Asia/Shanghai',
        updatedAt: null
      }
    };
    
    fs.writeFileSync(eventsFile, JSON.stringify(defaultEvents, null, 2), 'utf8');
    console.log(`✅ 创建事件文件：${eventsFile}`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 Claw Calendar 初始化...\n');
  
  // 确保目录存在
  ensureDir(CALENDAR_DIR);
  ensureDir(path.join(SKILL_DIR, 'tools'));
  ensureDir(path.join(SKILL_DIR, 'templates'));
  
  // 初始化配置文件
  initConfig();
  
  console.log('\n✅ 初始化完成！\n');
  console.log('下一步：');
  console.log('1. 设置学期开始日期：');
  console.log('   直接告诉我："我的这学期是 3 月 1 号开始的"');
  console.log('\n2. 上传课表图片，自动识别课程');
  console.log('\n3. 开始使用：');
  console.log('   - "今天有什么课？"');
  console.log('   - "明晚 7 点去图书馆"');
  console.log('   - "这周安排"');
}

// 运行
main();
