#!/usr/bin/env node

/**
 * Claw Calendar Skill v3.0 安装脚本
 * 
 * 功能：
 * 1. 复制 Skill 到系统目录
 * 2. 禁用旧版 Skill
 * 3. 创建数据目录和默认设置
 * 4. 注册 OpenClaw 原生工具
 * 5. 重启 Gateway
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 路径配置
const WORKSPACE_DIR = '/root/.openclaw/workspace';
const SYSTEM_SKILLS_DIR = '/usr/lib/node_modules/openclaw/skills';
const SOURCE_DIR = path.join(WORKSPACE_DIR, 'claw-calendar/skill');
const TARGET_DIR = path.join(SYSTEM_SKILLS_DIR, 'claw-calendar');
const OLD_SKILL_DIR = path.join(SYSTEM_SKILLS_DIR, 'calendar-assistant');
const DATA_DIR = path.join(WORKSPACE_DIR, 'claw-calendar/data');

/**
 * 执行 shell 命令
 */
function exec(command, options = {}) {
  console.log(`🔧 执行：${command}`);
  try {
    const result = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      ...options 
    });
    console.log(result);
    return result;
  } catch (error) {
    if (options.ignoreError) {
      console.log(`⚠️  警告：${error.message}`);
      return null;
    }
    throw error;
  }
}

/**
 * 复制目录
 */
function copyDir(src, dest) {
  console.log(`📁 复制：${src} → ${dest}`);
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 禁用旧版 Skill
 */
function disableOldSkill() {
  if (fs.existsSync(OLD_SKILL_DIR)) {
    const disabledDir = OLD_SKILL_DIR + '.disabled';
    console.log(`🚫 禁用旧版：${OLD_SKILL_DIR} → ${disabledDir}`);
    
    if (fs.existsSync(disabledDir)) {
      exec(`rm -rf ${disabledDir}`, { ignoreError: true });
    }
    
    fs.renameSync(OLD_SKILL_DIR, disabledDir);
  } else {
    console.log(`ℹ️  旧版 Skill 不存在，跳过禁用`);
  }
}

/**
 * 创建数据目录
 */
function createDataDir() {
  console.log(`📂 创建数据目录：${DATA_DIR}`);
  
  const activeDir = path.join(DATA_DIR, 'active');
  const archiveDir = path.join(DATA_DIR, 'archive');
  const indexDir = path.join(DATA_DIR, 'index');
  
  [activeDir, archiveDir, indexDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 创建默认 plans.json
  const plansFile = path.join(activeDir, 'plans.json');
  if (!fs.existsSync(plansFile)) {
    const defaultPlans = {
      version: 2,
      plans: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timezone: 'Asia/Shanghai'
      }
    };
    
    fs.writeFileSync(plansFile, JSON.stringify(defaultPlans, null, 2), 'utf8');
    console.log(`✅ 创建默认 plans.json`);
  }
  
  // 创建默认 settings.json
  const settingsFile = path.join(DATA_DIR, 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    const defaultSettings = {
      version: 2,
      timezone: 'Asia/Shanghai',
      semesterStart: null,
      notify: {
        enabled: true,
        channels: {
          webchat: true,
          qq: true,
          wechat: true
        }
      },
      reminderDefaults: {
        high: [1440, 60],
        medium: [30],
        low: [10]
      },
      quietHours: {
        enabled: true,
        start: '23:00',
        end: '08:00'
      }
    };
    
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
    console.log(`✅ 创建默认 settings.json`);
  }
}

/**
 * 注册 OpenClaw 原生工具
 */
function registerTools() {
  console.log(`\n🔧 注册 OpenClaw 原生工具...`);
  
  const registerScript = path.join(SOURCE_DIR, 'tools', 'register-tools.js');
  
  if (!fs.existsSync(registerScript)) {
    console.log(`⚠️  注册脚本不存在，跳过`);
    return;
  }
  
  try {
    exec(`node ${registerScript}`);
    console.log(`✅ 工具注册完成`);
  } catch (error) {
    console.log(`⚠️  工具注册失败：${error.message}`);
  }
}

/**
 * 重启 Gateway
 */
function restartGateway() {
  console.log(`\n🔄 重启 Gateway...`);
  exec('openclaw gateway restart');
  console.log(`✅ Gateway 已重启`);
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 Claw Calendar Skill v3.0 安装程序\n');
  
  // 1. 禁用旧版
  disableOldSkill();
  
  // 2. 复制 Skill
  copyDir(SOURCE_DIR, TARGET_DIR);
  console.log(`✅ Skill 已复制到：${TARGET_DIR}`);
  
  // 3. 创建数据目录
  createDataDir();
  
  // 4. 注册工具
  registerTools();
  
  // 5. 重启 Gateway
  restartGateway();
  
  console.log('\n✅ 安装完成！');
  console.log('\n下一步：');
  console.log('1. 在聊天中测试："明天下午 3 点提醒我"');
  console.log('2. 查看工具列表：openclaw tools list');
  console.log('3. 查看日志：openclaw logs');
}

// 执行
main();
