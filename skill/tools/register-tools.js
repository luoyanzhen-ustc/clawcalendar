#!/usr/bin/env node

/**
 * OpenClaw 原生工具注册脚本 v3.0
 * 
 * 将所有 claw-calendar 工具注册为 OpenClaw Native Tools
 * 无需在 SKILL.md 中使用 require()
 */

const path = require('path');
const fs = require('fs');

// ============================================================================
// 工具定义
// ============================================================================

const TOOLS = [
  // 事件管理工具
  {
    name: 'calendar_append_plan',
    description: '创建事件（自动创建 Cron 任务）',
    module: 'plan-manager',
    function: 'appendPlan'
  },
  {
    name: 'calendar_update_plan',
    description: '更新事件（自动更新 Cron 任务）',
    module: 'plan-manager',
    function: 'updatePlan'
  },
  {
    name: 'calendar_delete_plan',
    description: '删除事件（自动删除 Cron 任务）',
    module: 'plan-manager',
    function: 'deletePlan'
  },
  {
    name: 'calendar_cancel_plan',
    description: '取消事件（软删除）',
    module: 'plan-manager',
    function: 'cancelPlan'
  },
  {
    name: 'calendar_get_plan',
    description: '查询单个事件',
    module: 'plan-manager',
    function: 'getPlan'
  },
  {
    name: 'calendar_list_plans',
    description: '列出所有事件',
    module: 'plan-manager',
    function: 'listPlans'
  },
  
  // Cron 管理工具
  {
    name: 'calendar_create_reminder_cron',
    description: '为事件阶段创建 Cron 任务',
    module: 'cron-manager',
    function: 'createReminderCron'
  },
  {
    name: 'calendar_update_reminder_cron',
    description: '更新事件关联的 Cron 任务',
    module: 'cron-manager',
    function: 'updateReminderCrons'
  },
  {
    name: 'calendar_delete_reminder_cron',
    description: '删除事件关联的 Cron 任务',
    module: 'cron-manager',
    function: 'deleteReminderCrons'
  },
  {
    name: 'calendar_list_reminder_crons',
    description: '列出事件的所有 Cron 任务',
    module: 'cron-manager',
    function: 'listReminderCrons'
  },
  
  // 推送工具
  {
    name: 'calendar_push_reminder',
    description: '推送单个阶段的提醒',
    module: 'push-reminders',
    function: 'pushReminder'
  },
  {
    name: 'calendar_test_push',
    description: '测试推送功能',
    module: 'push-reminders',
    function: 'testPush'
  },
  
  // 辅助工具
  {
    name: 'calendar_get_current_week',
    description: '计算当前周次',
    module: 'date-math',
    function: 'getCurrentWeek'
  },
  {
    name: 'calendar_parse_relative_time',
    description: '解析相对时间',
    module: 'date-math',
    function: 'parseRelativeTime'
  },
  {
    name: 'calendar_format_date',
    description: '格式化日期',
    module: 'date-math',
    function: 'formatDate'
  },
  {
    name: 'calendar_format_time',
    description: '格式化时间',
    module: 'date-math',
    function: 'formatTime'
  },
  {
    name: 'calendar_get_weekday_name',
    description: '获取星期名称',
    module: 'date-math',
    function: 'getWeekdayName'
  },
  {
    name: 'calendar_parse_schedule_image',
    description: '识别课表图片',
    module: 'ocr',
    function: 'parseScheduleImage'
  },
  {
    name: 'calendar_courses_to_events',
    description: '将课程列表转换为事件数组',
    module: 'ocr',
    function: 'coursesToEvents'
  }
];

// ============================================================================
// 主函数
// ============================================================================

function registerTools() {
  console.log('🔧 开始注册 Claw Calendar 工具...\n');
  
  const toolsDir = path.join(__dirname, 'tools');
  const registeredTools = [];
  
  for (const tool of TOOLS) {
    const modulePath = path.join(toolsDir, `${tool.module}.js`);
    
    if (!fs.existsSync(modulePath)) {
      console.warn(`⚠️  模块不存在：${modulePath}`);
      continue;
    }
    
    try {
      const module = require(modulePath);
      const fn = module[tool.function];
      
      if (!fn || typeof fn !== 'function') {
        console.warn(`⚠️  函数不存在：${tool.function} in ${modulePath}`);
        continue;
      }
      
      // 注册为全局函数（OpenClaw 会自动识别）
      global[tool.name] = fn;
      
      registeredTools.push(tool.name);
      console.log(`✅ 注册工具：${tool.name}`);
      
    } catch (error) {
      console.error(`❌ 注册失败：${tool.name} - ${error.message}`);
    }
  }
  
  console.log(`\n✅ 工具注册完成：${registeredTools.length} 个工具`);
  console.log(`\n已注册工具：`);
  registeredTools.forEach(name => console.log(`  - ${name}`));
  
  return {
    success: true,
    count: registeredTools.length,
    tools: registeredTools
  };
}

// ============================================================================
// 执行
// ============================================================================

if (require.main === module) {
  const result = registerTools();
  console.log('\n注册结果:', JSON.stringify(result, null, 2));
} else {
  module.exports = { registerTools };
}
