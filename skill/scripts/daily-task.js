#!/usr/bin/env node

/**
 * 每日定时任务脚本
 * 
 * 运行时间：每天凌晨 2:00
 * 
 * 任务：
 * 1. 重建索引（today.json + upcoming.json）
 * 2. 清理过期事件
 * 3. 更新课程周次
 */

const path = require('path');
const { execSync } = require('child_process');

const scriptDir = __dirname;
const rebuildIndexScript = path.join(scriptDir, 'rebuild-index.js');

console.log('🌅 每日定时任务启动');
console.log(`⏰ 时间：${new Date().toISOString()}`);

try {
  // 执行索引重建
  console.log('\n📊 重建索引...');
  execSync(`node "${rebuildIndexScript}"`, {
    stdio: 'inherit',
    cwd: scriptDir
  });
  
  console.log('\n✅ 每日任务完成');
  
} catch (error) {
  console.error('\n❌ 每日任务失败:', error.message);
  process.exit(1);
}
