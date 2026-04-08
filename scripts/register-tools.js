#!/usr/bin/env node

/**
 * OpenClaw 工具注册脚本
 * 
 * 将 claw-calendar 的工具函数注册为 OpenClaw 原生工具
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 工具目录
const TOOLS_DIR = path.join(__dirname, '..', 'skill', 'tools');

/**
 * 扫描工具目录，获取所有可注册的函数
 */
function scanTools() {
  const tools = {};
  
  const files = fs.readdirSync(TOOLS_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.js')) {
      continue;
    }
    
    const filePath = path.join(TOOLS_DIR, file);
    const moduleName = path.basename(file, '.js');
    
    try {
      // 加载模块
      const mod = require(filePath);
      
      // 获取所有导出的函数
      const exports = Object.keys(mod).filter(key => typeof mod[key] === 'function');
      
      tools[moduleName] = {
        path: filePath,
        exports: exports,
        functions: {}
      };
      
      for (const fnName of exports) {
        tools[moduleName].functions[fnName] = {
          name: `${moduleName}_${fnName}`,
          module: moduleName,
          function: fnName,
          path: filePath
        };
      }
    } catch (error) {
      console.error(`加载工具模块失败 ${file}:`, error.message);
    }
  }
  
  return tools;
}

/**
 * 注册单个工具到 OpenClaw
 */
function registerTool(toolInfo) {
  const toolName = toolInfo.name;
  
  // 工具元数据
  const metadata = {
    name: toolName,
    description: `Claw Calendar 工具 - ${toolInfo.module}.${toolInfo.function}`,
    module: toolInfo.module,
    function: toolInfo.function,
    path: toolInfo.path,
    category: 'calendar'
  };
  
  console.log(`🔧 注册工具：${toolName}`);
  
  // 写入工具配置文件
  const toolsConfigDir = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'tools');
  const toolsConfigFile = path.join(toolsConfigDir, `${toolName}.json`);
  
  if (!fs.existsSync(toolsConfigDir)) {
    fs.mkdirSync(toolsConfigDir, { recursive: true });
  }
  
  fs.writeFileSync(toolsConfigFile, JSON.stringify(metadata, null, 2), 'utf8');
  
  return true;
}

/**
 * 批量注册所有工具
 */
function registerAllTools() {
  console.log('🚀 开始注册 Claw Calendar 工具...\n');
  
  const tools = scanTools();
  let registered = 0;
  
  for (const moduleName in tools) {
    const module = tools[moduleName];
    
    console.log(`📦 模块：${moduleName}`);
    
    for (const fnName in module.functions) {
      const toolInfo = module.functions[fnName];
      
      // 只注册核心工具（过滤内部函数）
      if (shouldRegister(toolInfo)) {
        if (registerTool(toolInfo)) {
          registered++;
          console.log(`  ✅ ${toolInfo.name}`);
        }
      } else {
        console.log(`  ⏭️  跳过：${toolInfo.name}（内部函数）`);
      }
    }
    
    console.log();
  }
  
  console.log(`✅ 注册完成！共注册 ${registered} 个工具\n`);
  
  return registered;
}

/**
 * 判断是否应该注册该工具
 */
function shouldRegister(toolInfo) {
  // 不注册的函数模式
  const skipPatterns = [
    /^_/,           // 下划线开头的私有函数
    /^ensure/,      // 辅助函数
    /^get.*Path$/,  // 路径获取函数
    /^acquireLock$/, // 锁相关
    /^releaseLock$/,
    /^atomicWrite$/,
    /^lockedWrite$/,
    /^processExists$/
  ];
  
  const name = toolInfo.function;
  
  for (const pattern of skipPatterns) {
    if (pattern.test(name)) {
      return false;
    }
  }
  
  // 只注册核心业务函数
  const registerList = [
    'readEvents',
    'writeEvents',
    'appendEvent',
    'deleteEvent',
    'readSettings',
    'writeSettings',
    'get_upcoming_reminders',
    'isQuietHours',
    'getCurrentWeek',
    'parseRelativeTime',
    'formatDate',
    'formatTime',
    'getWeekdayName',
    'parseScheduleImage',
    'coursesToEvents'
  ];
  
  return registerList.includes(name);
}

/**
 * 生成工具调用示例（用于 SKILL.md）
 */
function generateToolExamples() {
  const tools = scanTools();
  const examples = [];
  
  examples.push('# Claw Calendar 工具调用示例\n');
  examples.push('## 核心工具\n');
  
  for (const moduleName in tools) {
    const module = tools[moduleName];
    
    for (const fnName in module.functions) {
      const toolInfo = module.functions[fnName];
      
      if (shouldRegister(toolInfo)) {
        examples.push(`### ${toolInfo.name}`);
        examples.push(`\n**功能**: ${toolInfo.module}.${toolInfo.function}\n`);
        examples.push(`**调用方式**: 在 SKILL.md 中直接使用工具名称\n`);
        examples.push(`**示例**:\n`);
        examples.push(`\`\`\`\n调用 ${toolInfo.name}()\n\`\`\`\n`);
        examples.push('---\n');
      }
    }
  }
  
  return examples.join('\n');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--generate-examples')) {
    // 生成工具调用示例
    const examples = generateToolExamples();
    const outputPath = path.join(__dirname, '..', 'docs', 'TOOLS_USAGE.md');
    
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    
    fs.writeFileSync(outputPath, examples, 'utf8');
    console.log(`✅ 工具调用示例已生成：${outputPath}`);
    
  } else if (args.includes('--list')) {
    // 列出所有可注册的工具
    const tools = scanTools();
    console.log('可注册的工具:\n');
    
    for (const moduleName in tools) {
      const module = tools[moduleName];
      console.log(`${moduleName}:`);
      
      for (const fnName in module.functions) {
        const toolInfo = module.functions[fnName];
        const status = shouldRegister(toolInfo) ? '✅' : '⏭️';
        console.log(`  ${status} ${toolInfo.name}`);
      }
    }
    
  } else {
    // 默认：注册所有工具
    registerAllTools();
  }
}

// 运行
main();
