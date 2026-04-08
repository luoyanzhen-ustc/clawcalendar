#!/usr/bin/env node

/**
 * 每周定时任务脚本
 * 
 * 运行时间：每周一凌晨 0:00
 * 
 * 任务：
 * 1. 生成上周总结
 * 2. 归档上周计划
 * 3. 更新学期元数据
 */

const fs = require('fs');
const path = require('path');

const {
  readMetadata,
  writeMetadata,
  getArchiveDir
} = require('../tools/file-ops.js');

const {
  generateWeeklyReport,
  archiveLastWeekPlans
} = require('../tools/archive-ops.js');

console.log('📅 每周定时任务启动');
console.log(`⏰ 时间：${new Date().toISOString()}`);

try {
  const metadata = readMetadata();
  const lastWeek = metadata.currentWeek - 1;
  
  if (lastWeek < 1) {
    console.log('ℹ️  当前是第 1 周，跳过周归档');
    process.exit(0);
  }
  
  console.log(`\n📊 生成第 ${lastWeek} 周总结...`);
  
  // 1. 生成周总结
  const weekReport = generateWeeklyReport(lastWeek);
  
  if (weekReport) {
    // 保存到归档目录
    const archiveDir = getArchiveDir(metadata.semester);
    const weeklyDir = path.join(archiveDir, 'weekly');
    
    if (!fs.existsSync(weeklyDir)) {
      fs.mkdirSync(weeklyDir, { recursive: true });
    }
    
    const reportFile = path.join(weeklyDir, `week-${lastWeek}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(weekReport, null, 2), 'utf8');
    
    console.log(`✅ 生成周总结：${reportFile}`);
    console.log(`   - 总事件数：${weekReport.stats.totalEvents}`);
    console.log(`   - 完成率：${Math.round(weekReport.stats.completionRate * 100)}%`);
  }
  
  // 2. 归档上周计划
  console.log('\n📦 归档上周计划...');
  archiveLastWeekPlans();
  
  console.log('\n✅ 每周任务完成');
  
} catch (error) {
  console.error('\n❌ 每周任务失败:', error.message);
  process.exit(1);
}
