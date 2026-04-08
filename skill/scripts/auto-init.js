#!/usr/bin/env node

/**
 * 学期初始化脚本
 * 
 * 功能：
 * 1. 创建学期元数据（metadata.json）
 * 2. 生成周次映射
 * 3. 初始化课程表、周期事件、临时事件文件
 */

const fs = require('fs');
const path = require('path');

const {
  writeMetadata,
  writeCourses,
  writeRecurring,
  writePlans,
  getActiveDir
} = require('../tools/file-ops.js');

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
  
  // 创建元数据
  const metadata = {
    version: 1,
    semester: semesterName,
    name: `${semesterName}学期`,
    school: 'USTC',
    startDate,
    endDate,
    totalWeeks: 20,
    currentWeek: 1,
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
  
  console.log('📝 写入学期元数据...');
  writeMetadata(metadata);
  
  // 创建空课程表
  console.log('📚 初始化课程表...');
  writeCourses({
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
  writeRecurring({
    version: 1,
    recurring: [],
    metadata: {
      totalRecurring: 0,
      createdAt: new Date().toISOString()
    }
  });
  
  // 创建空临时事件
  console.log('📋 初始化临时事件...');
  writePlans({
    version: 1,
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
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log('用法：node auto-init.js <学期名称> <开始日期>');
    console.log('');
    console.log('示例：');
    console.log('  node auto-init.js 2026-spring 2026-03-01');
    console.log('  node auto-init.js 2026-fall 2026-09-01');
    process.exit(0);
  }
  
  const semesterName = args[0];
  const startDate = args[1];
  
  if (!semesterName || !startDate) {
    console.error('❌ 请提供学期名称和开始日期');
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
