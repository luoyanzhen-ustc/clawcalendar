#!/usr/bin/env node

/**
 * Claw Calendar 工具注册脚本
 * 
 * 将所有工具函数注册为 OpenClaw 原生工具
 * 安装时自动调用，无需手动配置
 */

const fs = require('fs');
const path = require('path');

// 工具目录
const TOOLS_DIR = path.join(__dirname, '..', 'skill', 'tools');

/**
 * 需要注册的工具列表
 * 格式：{ 工具名称，描述，参数，模块，函数 }
 */
const TOOLS_TO_REGISTER = [
  // 文件操作工具
  {
    name: 'calendar_read_courses',
    description: '读取本学期课程表',
    params: [],
    module: 'file-ops',
    function: 'readCourses'
  },
  {
    name: 'calendar_write_courses',
    description: '写入课程表（原子写入）',
    params: [{ name: 'data', description: '课程表对象', required: true }],
    module: 'file-ops',
    function: 'writeCourses'
  },
  {
    name: 'calendar_read_recurring',
    description: '读取周期事件',
    params: [],
    module: 'file-ops',
    function: 'readRecurring'
  },
  {
    name: 'calendar_write_recurring',
    description: '写入周期事件',
    params: [{ name: 'data', description: '周期事件对象', required: true }],
    module: 'file-ops',
    function: 'writeRecurring'
  },
  {
    name: 'calendar_read_plans',
    description: '读取临时事件',
    params: [],
    module: 'file-ops',
    function: 'readPlans'
  },
  {
    name: 'calendar_write_plans',
    description: '写入临时事件（带锁）',
    params: [{ name: 'data', description: '临时事件对象', required: true }],
    module: 'file-ops',
    function: 'writePlans'
  },
  {
    name: 'calendar_append_plan',
    description: '添加单个事件到临时事件列表',
    params: [{ name: 'plan', description: '事件对象', required: true }],
    module: 'file-ops',
    function: 'appendPlan'
  },
  {
    name: 'calendar_cancel_plan',
    description: '取消事件（保留历史，移动到归档区）',
    params: [
      { name: 'planId', description: '事件 ID', required: true },
      { name: 'reason', description: '取消原因，可选', required: false }
    ],
    module: 'file-ops',
    function: 'cancelPlan'
  },
  {
    name: 'calendar_delete_plan',
    description: '物理删除事件（不保留历史，用于错误数据）',
    params: [{ name: 'planId', description: '事件 ID', required: true }],
    module: 'file-ops',
    function: 'deletePlan'
  },
  {
    name: 'calendar_read_metadata',
    description: '读取学期元数据',
    params: [],
    module: 'file-ops',
    function: 'readMetadata'
  },
  {
    name: 'calendar_write_metadata',
    description: '写入学期元数据',
    params: [{ name: 'data', description: '元数据对象', required: true }],
    module: 'file-ops',
    function: 'writeMetadata'
  },
  {
    name: 'calendar_read_today_index',
    description: '读取今天索引（预计算视图）',
    params: [],
    module: 'file-ops',
    function: 'readTodayIndex'
  },
  {
    name: 'calendar_read_upcoming_index',
    description: '读取未来 7 天索引',
    params: [],
    module: 'file-ops',
    function: 'readUpcomingIndex'
  },
  {
    name: 'calendar_get_reminders',
    description: '获取即将发生的事件（智能过滤，用于提醒）',
    params: [{ name: 'advanceMinutes', description: '提前多少分钟，默认 30', required: false }],
    module: 'file-ops',
    function: 'get_upcoming_reminders'
  },
  {
    name: 'calendar_is_quiet_hours',
    description: '检查当前是否在静默时段（23:00-08:00）',
    params: [{ name: 'date', description: '要检查的时间，默认现在', required: false }],
    module: 'file-ops',
    function: 'isQuietHours'
  },
  {
    name: 'calendar_to_utc',
    description: '将本地时间转换为 UTC（时区协调）',
    params: [
      { name: 'date', description: '日期 YYYY-MM-DD', required: true },
      { name: 'time', description: '时间 HH:MM', required: true },
      { name: 'timezone', description: '时区，默认 Asia/Shanghai', required: false }
    ],
    module: 'file-ops',
    function: 'toUTC'
  },
  {
    name: 'calendar_to_local',
    description: '将 UTC 转换为本地时间展示',
    params: [
      { name: 'utcString', description: 'ISO 8601 UTC 时间', required: true },
      { name: 'targetTimezone', description: '目标时区，默认 Asia/Shanghai', required: false }
    ],
    module: 'file-ops',
    function: 'toLocal'
  },
  {
    name: 'calendar_read_settings',
    description: '读取用户设置',
    params: [],
    module: 'file-ops',
    function: 'readSettings'
  },
  {
    name: 'calendar_write_settings',
    description: '写入用户设置',
    params: [{ name: 'settings', description: '设置对象', required: true }],
    module: 'file-ops',
    function: 'writeSettings'
  },
  
  // 归档工具
  {
    name: 'calendar_generate_weekly_report',
    description: '生成周总结',
    params: [{ name: 'weekNumber', description: '周次', required: true }],
    module: 'archive-ops',
    function: 'generateWeeklyReport'
  },
  {
    name: 'calendar_archive_last_week_plans',
    description: '归档上周计划',
    params: [],
    module: 'archive-ops',
    function: 'archiveLastWeekPlans'
  },
  {
    name: 'calendar_archive_semester',
    description: '学期末归档',
    params: [{ name: 'semesterName', description: '学期名称，可选', required: false }],
    module: 'archive-ops',
    function: 'archiveSemester'
  },
  {
    name: 'calendar_generate_semester_summary',
    description: '生成学期总结',
    params: [{ name: 'semester', description: '学期名称', required: true }],
    module: 'archive-ops',
    function: 'generateSemesterSummary'
  },
  
  // 索引重建工具
  {
    name: 'calendar_build_today_index',
    description: '重建今天索引',
    params: [],
    module: 'rebuild-index',
    function: 'buildTodayIndex'
  },
  {
    name: 'calendar_build_upcoming_index',
    description: '重建未来 7 天索引',
    params: [{ name: 'days', description: '天数，默认 7', required: false }],
    module: 'rebuild-index',
    function: 'buildUpcomingIndex'
  },
  {
    name: 'calendar_cleanup_expired_plans',
    description: '清理过期事件',
    params: [],
    module: 'rebuild-index',
    function: 'cleanupExpiredPlans'
  },
  {
    name: 'calendar_update_course_week',
    description: '更新课程周次',
    params: [],
    module: 'rebuild-index',
    function: 'updateCourseWeek'
  },
  
  // 日期计算工具
  {
    name: 'calendar_get_current_week',
    description: '计算当前周次（相对于学期开始日期）',
    params: [{ name: 'semesterStart', description: '学期开始日期 YYYY-MM-DD', required: true }],
    module: 'date-math',
    function: 'getCurrentWeek'
  },
  {
    name: 'calendar_parse_relative_time',
    description: '解析相对时间表达（如"明天下午 3 点"）',
    params: [
      { name: 'text', description: '时间表达', required: true },
      { name: 'baseDate', description: '基准时间，默认现在', required: false }
    ],
    module: 'date-math',
    function: 'parseRelativeTime'
  },
  {
    name: 'calendar_format_date',
    description: '格式化日期为 YYYY-MM-DD',
    params: [{ name: 'date', description: 'Date 对象或时间戳', required: true }],
    module: 'date-math',
    function: 'formatDate'
  },
  {
    name: 'calendar_format_time',
    description: '格式化时间为 HH:MM',
    params: [{ name: 'date', description: 'Date 对象或时间戳', required: true }],
    module: 'date-math',
    function: 'formatTime'
  },
  {
    name: 'calendar_get_weekday_name',
    description: '获取星期几（如"周一"）',
    params: [{ name: 'date', description: 'Date 对象，默认现在', required: false }],
    module: 'date-math',
    function: 'getWeekdayName'
  },
  
  // OCR 工具
  {
    name: 'calendar_parse_schedule_image',
    description: '识别课表图片（需要传入图片路径）',
    params: [
      { name: 'imagePath', description: '图片路径', required: true },
      { name: 'callModel', description: '调用模型的函数', required: true }
    ],
    module: 'ocr-wrapper',
    function: 'parseScheduleImage'
  },
  {
    name: 'calendar_courses_to_events',
    description: '将课程列表转换为事件数组',
    params: [{ name: 'courses', description: '课程数组', required: true }],
    module: 'ocr-wrapper',
    function: 'coursesToEvents'
  }
];

/**
 * 生成工具配置文件
 */
function generateToolConfig(tool) {
  return {
    name: tool.name,
    description: tool.description,
    category: 'calendar',
    module: `claw-calendar/tools/${tool.module}`,
    function: tool.function,
    params: tool.params || [],
    version: '2.2.0',
    createdAt: new Date().toISOString()
  };
}

/**
 * 注册单个工具
 */
function registerTool(tool) {
  const config = generateToolConfig(tool);
  const toolsDir = path.join(process.env.HOME || '/root', '.openclaw', 'tools', 'calendar');
  const configFile = path.join(toolsDir, `${tool.name}.json`);
  
  // 确保目录存在
  if (!fs.existsSync(toolsDir)) {
    fs.mkdirSync(toolsDir, { recursive: true });
  }
  
  // 写入配置文件
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  
  console.log(`  ✅ ${tool.name}`);
  return true;
}

/**
 * 批量注册所有工具
 */
function registerAllTools() {
  console.log('🚀 开始注册 Claw Calendar 工具...\n');
  
  let registered = 0;
  let failed = 0;
  
  for (const tool of TOOLS_TO_REGISTER) {
    try {
      if (registerTool(tool)) {
        registered++;
      }
    } catch (error) {
      console.error(`  ❌ ${tool.name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ 注册完成！`);
  console.log(`   成功：${registered} 个工具`);
  console.log(`   失败：${failed} 个工具\n`);
  
  return { registered, failed };
}

/**
 * 生成工具文档（用于 SKILL.md）
 */
function generateToolDocs() {
  const docs = ['# Claw Calendar 工具列表\n\n'];
  docs.push('## 核心工具\n\n');
  docs.push('| 工具名称 | 功能 | 参数 |\n');
  docs.push('|----------|------|------|\n');
  
  for (const tool of TOOLS_TO_REGISTER) {
    const params = tool.params.length === 0 ? '无' : tool.params.map(p => p.name).join(', ');
    docs.push(`| \`${tool.name}\` | ${tool.description} | ${params} |\n`);
  }
  
  return docs.join('');
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--docs')) {
    // 生成工具文档
    const docs = generateToolDocs();
    const outputPath = path.join(__dirname, '..', 'docs', 'TOOLS.md');
    
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    
    fs.writeFileSync(outputPath, docs, 'utf8');
    console.log(`✅ 工具文档已生成：${outputPath}`);
    
  } else if (args.includes('--list')) {
    // 列出所有工具
    console.log('Claw Calendar 工具列表:\n');
    for (const tool of TOOLS_TO_REGISTER) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }
    
  } else {
    // 默认：注册所有工具
    registerAllTools();
  }
}

// 运行
main();
