#!/usr/bin/env node

/**
 * Claw Calendar Cron 配置脚本
 * 
 * 功能：
 * - 配置定时提醒任务（每 30 分钟）
 * - 配置每日索引重建任务（凌晨 2 点）
 * - 配置每周总结任务（周一凌晨 0 点）
 */

const { execSync } = require('child_process');
const path = require('path');

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || '/root/.openclaw/workspace';
const CALENDAR_DIR = path.join(WORKSPACE, 'claw-calendar');

/**
 * 执行 OpenClaw 命令
 */
function exec(command) {
  console.log(`🔧 执行：${command}`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(output);
    return { success: true, output };
  } catch (error) {
    console.error(`❌ 执行失败：${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 配置 Cron 任务
 */
function setupCronJobs() {
  console.log('🕐 开始配置 Claw Calendar Cron 任务...\n');
  
  const jobs = [
    {
      name: 'claw-calendar-remind',
      schedule: '*/30 * * * *',  // 每 30 分钟
      timezone: 'Asia/Shanghai',
      description: '检查日历提醒并推送给所有已知用户',
      message: '检查日历提醒，推送即将发生的事件到 QQ 和微信。如果有事件，调用 calendar_get_reminders(30) 获取事件，然后调用 calendar_push_reminders 推送。如果没有事件，回复 HEARTBEAT_OK。'
    },
    {
      name: 'claw-calendar-daily',
      schedule: '0 2 * * *',  // 北京时间凌晨 2 点
      timezone: 'Asia/Shanghai',
      description: '每日索引重建任务',
      message: '执行每日索引重建任务。调用 calendar_build_today_index 和 calendar_build_upcoming_index 重建索引，然后调用 calendar_cleanup_expired_plans 清理过期事件。完成后回复 HEARTBEAT_OK。'
    },
    {
      name: 'claw-calendar-weekly',
      schedule: '0 0 * * 1',  // 北京时间周一凌晨 0 点
      timezone: 'Asia/Shanghai',
      description: '每周总结归档任务',
      message: '执行每周总结归档任务。调用 calendar_archive_last_week_plans 归档上周计划，然后调用 calendar_generate_weekly_report 生成周总结。完成后回复 HEARTBEAT_OK。'
    }
  ];
  
  const results = [];
  
  for (const job of jobs) {
    console.log(`\n📋 配置任务：${job.name}`);
    console.log(`   时间：${job.schedule}`);
    console.log(`   说明：${job.description}\n`);
    
    // 检查是否已存在
    const checkCmd = `openclaw cron list`;
    const checkResult = exec(checkCmd);
    
    if (checkResult.output && checkResult.output.includes(job.name)) {
      console.log(`⚠️  任务 ${job.name} 已存在，跳过创建\n`);
      results.push({ name: job.name, status: 'exists' });
      continue;
    }
    
    // 创建 Cron 任务（添加时区参数）
    const createCmd = `openclaw cron add --cron '${job.schedule}' --name '${job.name}' --message '${job.message}' --tz '${job.timezone || 'UTC'}'`;
    
    const result = exec(createCmd);
    
    if (result.success) {
      console.log(`✅ 任务 ${job.name} 配置成功\n`);
      results.push({ name: job.name, status: 'created' });
    } else {
      console.log(`⚠️  任务 ${job.name} 配置失败，可能需要手动配置\n`);
      results.push({ name: job.name, status: 'failed', error: result.error });
    }
  }
  
  return results;
}

/**
 * 验证 Cron 配置
 */
function verifyCronJobs() {
  console.log('\n🔍 验证 Cron 配置...\n');
  
  const result = exec('openclaw cron list');
  
  if (result.success) {
    console.log('\n✅ Cron 配置验证完成\n');
    console.log('已配置的任务:');
    console.log('  - claw-calendar-remind (每 30 分钟)');
    console.log('  - claw-calendar-daily (每天 02:00)');
    console.log('  - claw-calendar-weekly (每周一 00:00)');
  } else {
    console.log('\n⚠️  无法验证 Cron 配置，请手动检查\n');
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 Claw Calendar Cron 配置脚本\n');
  console.log('工作目录:', WORKSPACE);
  console.log('日历目录:', CALENDAR_DIR);
  console.log('');
  
  const results = setupCronJobs();
  
  const successCount = results.filter(r => r.status === 'created').length;
  const existsCount = results.filter(r => r.status === 'exists').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 配置总结:');
  console.log(`   新增任务：${successCount}`);
  console.log(`   已存在：${existsCount}`);
  console.log(`   失败：${failedCount}`);
  console.log('='.repeat(50) + '\n');
  
  if (failedCount > 0) {
    console.log('⚠️  部分任务配置失败，请手动配置或重试\n');
    console.log('手动配置命令:');
    console.log('  openclaw cron add --schedule \'*/30 * * * *\' --name \'claw-calendar-remind\' --payload \'{"kind": "agentTurn", "message": "检查日历提醒并推送"}\'');
    console.log('');
  } else {
    console.log('✅ 所有 Cron 任务配置成功！\n');
    console.log('下一步:');
    console.log('  1. 运行 `openclaw cron list` 查看任务列表');
    console.log('  2. 等待 30 分钟后检查推送日志');
    console.log('  3. 或手动触发：openclaw cron run --name \'claw-calendar-remind\'');
    console.log('');
  }
}

main();
