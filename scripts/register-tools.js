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
    name: 'calendar_read_events',
    description: '读取所有日历事件',
    params: [],
    module: 'file-ops',
    function: 'readEvents'
  },
  {
    name: 'calendar_append_event',
    description: '添加单个事件到日历',
    params: [{ name: 'event', description: '事件对象', required: true }],
    module: 'file-ops',
    function: 'appendEvent'
  },
  {
    name: 'calendar_delete_event',
    description: '删除指定事件',
    params: [{ name: 'eventId', description: '事件 ID', required: true }],
    module: 'file-ops',
    function: 'deleteEvent'
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
