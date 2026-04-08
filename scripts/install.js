#!/usr/bin/env node

/**
 * Claw Calendar Skill 安装脚本
 * 
 * 功能：
 * 1. 复制 Skill 到系统目录
 * 2. 禁用旧版 calendar-assistant
 * 3. 创建数据目录
 * 4. 创建 cron 任务
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
      stdio: 'inherit',
      ...options 
    });
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
  
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // 创建默认 events.json
  const eventsFile = path.join(DATA_DIR, 'events.json');
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
    console.log(`✅ 创建：${eventsFile}`);
  }
  
  // 创建默认 settings.json
  const settingsFile = path.join(DATA_DIR, 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    const defaultSettings = {
      version: 1,
      timezone: 'Asia/Shanghai',
      semesterStart: null,
      notify: {
        enabled: true,
        channels: {
          webchat: true,
          qq: true,
          wechat: true
        },
        timing: {
          advanceMinutes: 30,
          maxReminders: 3,
          intervalMinutes: 10
        },
        quietHours: {
          enabled: true,
          start: '23:00',
          end: '08:00'
        }
      },
      reminderDefaults: {
        high: [1440, 60],
        medium: [30],
        low: [10]
      }
    };
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
    console.log(`✅ 创建：${settingsFile}`);
  }
  
  // 创建数据目录结构
  const subDirs = ['active', 'archive', 'index'];
  for (const dir of subDirs) {
    const dirPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ 创建目录：${dirPath}`);
    }
  }
}

/**
 * 创建 cron 任务
 */
function createCronJob() {
  console.log(`⏰ 创建定时任务...`);
  
  const cronScript = path.join(WORKSPACE_DIR, 'claw-calendar', 'skill', 'scripts', 'setup-cron.js');
  
  if (fs.existsSync(cronScript)) {
    console.log(`📋 执行 Cron 配置脚本...`);
    exec(`node "${cronScript}"`, { ignoreError: true });
  } else {
    console.log(`⚠️  Cron 配置脚本不存在，创建基础任务...`);
    
    try {
      // 检查是否已存在
      const listOutput = execSync('openclaw cron list --json', { encoding: 'utf8' });
      const jobs = JSON.parse(listOutput);
      
      const exists = jobs.some(job => job.name === 'claw-calendar-remind');
      if (exists) {
        console.log(`ℹ️  Cron 任务已存在，跳过创建`);
        return;
      }
      
      // 创建 cron 任务
      exec(`openclaw cron add --schedule '*/30 * * * *' --name 'claw-calendar-remind' --payload '{"kind": "agentTurn", "message": "检查日历提醒，推送即将发生的事件到 QQ 和微信。调用 calendar_get_reminders(30) 获取事件，然后调用 calendar_push_reminders 推送。如果没有事件，回复 HEARTBEAT_OK。"}'`);
      console.log(`✅ Cron 任务创建成功`);
    } catch (error) {
      console.log(`⚠️  创建 cron 任务失败：${error.message}`);
      console.log(`   请手动执行：`);
      console.log(`   openclaw cron add --schedule '*/30 * * * *' --name 'claw-calendar-remind' --payload '{"kind": "agentTurn", "message": "检查日历提醒并推送"}'`);
    }
  }
}

/**
 * 重启 Gateway
 */
function restartGateway() {
  console.log(`🔄 重启 Gateway...`);
  exec('openclaw gateway restart');
  console.log(`✅ Gateway 重启成功`);
}

/**
 * 注册工具
 */
function registerTools() {
  console.log(`🔧 步骤 X: 注册 OpenClaw 工具`);
  
  try {
    const registerScript = path.join(WORKSPACE_DIR, 'claw-calendar', 'scripts', 'register-tools.js');
    exec(`node "${registerScript}"`, { ignoreError: true });
    console.log(`✅ 工具注册成功`);
  } catch (error) {
    console.log(`⚠️  工具注册失败：${error.message}`);
    console.log(`   请手动执行：`);
    console.log(`   node /root/.openclaw/workspace/claw-calendar/scripts/register-tools.js`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 Claw Calendar Skill 安装程序\n');
  console.log('='.repeat(50));
  
  // 1. 复制 Skill 到系统目录
  console.log('\n📦 步骤 1: 复制 Skill 文件');
  copyDir(SOURCE_DIR, TARGET_DIR);
  
  // 2. 禁用旧版
  console.log('\n🚫 步骤 2: 禁用旧版 Skill');
  disableOldSkill();
  
  // 3. 注册工具
  console.log('\n🔧 步骤 3: 注册 OpenClaw 工具');
  registerTools();
  
  // 4. 创建数据目录
  console.log('\n📂 步骤 4: 创建数据目录');
  createDataDir();
  
  // 5. 创建 cron 任务
  console.log('\n⏰ 步骤 5: 创建定时任务');
  createCronJob();
  
  // 6. 重启 Gateway
  console.log('\n🔄 步骤 6: 重启 Gateway');
  console.log('\n⚠️  注意：重启 Gateway 会中断当前会话');
  console.log('   是否继续？(y/N)');
  
  // 简单确认（实际使用时应该交互式询问）
  const confirm = process.argv.includes('--force') || process.argv.includes('-y');
  if (confirm) {
    restartGateway();
  } else {
    console.log('\n⏭️  跳过重启，请手动执行：');
    console.log('   openclaw gateway restart');
  }
  
  // 完成
  console.log('\n' + '='.repeat(50));
  console.log('✅ 安装完成！\n');
  console.log('下一步：');
  console.log('1. 如果还没重启 Gateway，请执行：openclaw gateway restart');
  console.log('2. 重启后，上传课表图片或询问"今天有什么课"测试功能');
  console.log('3. 设置学期开始日期："我的这学期是 3 月 1 号开始的"');
}

// 运行
main();
