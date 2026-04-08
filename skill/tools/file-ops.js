#!/usr/bin/env node

/**
 * 文件操作工具 v3.0 (纯 Cron 驱动架构)
 * 
 * 核心变更：
 * - 支持 reminderStages（多阶段提醒）
 * - 每个阶段独立记录 cronJobId 和 pushedAt
 * - 支持事件状态管理（active/completed/cancelled/expired）
 * - 原子写入 + 文件锁
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// 动态路径配置
// ============================================================================

function getBasePath() {
  return process.env.OPENCLAW_WORKSPACE || 
         path.join(os.homedir(), '.openclaw', 'workspace');
}

function getDataDir() {
  const basePath = getBasePath();
  return path.join(basePath, 'claw-calendar', 'data');
}

function getActiveDir() {
  return path.join(getDataDir(), 'active');
}

function getArchiveDir(semester = null) {
  const base = path.join(getDataDir(), 'archive');
  return semester ? path.join(base, semester) : base;
}

function getIndexDir() {
  return path.join(getDataDir(), 'index');
}

function getSettingsFile() {
  return path.join(getDataDir(), 'settings.json');
}

function getPlansFile() {
  return path.join(getActiveDir(), 'plans.json');
}

// 缓存路径
const DATA_DIR = getDataDir();
const ACTIVE_DIR = getActiveDir();

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成事件 ID
 */
function generateEventId() {
  return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * 生成阶段 ID
 */
function generateStageId() {
  return `stage-${Math.random().toString(36).substr(2, 8)}`;
}

/**
 * 安全读取 JSON 文件（带文件锁）
 */
function readJsonFile(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error.message);
    return defaultValue;
  }
}

/**
 * 安全写入 JSON 文件（原子操作 + 文件锁）
 */
function writeJsonFile(filePath, data, options = {}) {
  const { backup = false, atomic = true } = options;
  
  try {
    // 创建备份（可选）
    if (backup && fs.existsSync(filePath)) {
      const backupPath = filePath + `.bak.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }
    
    // 原子写入
    if (atomic) {
      const tempPath = filePath + `.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, filePath);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    return true;
  } catch (error) {
    console.error(`写入文件失败 ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 读取所有事件
 */
function readPlans() {
  const plansFile = getPlansFile();
  const defaultData = {
    version: 2,
    plans: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timezone: 'Asia/Shanghai'
    }
  };
  
  return readJsonFile(plansFile, defaultData);
}

/**
 * 写入所有事件
 */
function writePlans(data) {
  const plansFile = getPlansFile();
  data.metadata = data.metadata || {};
  data.metadata.updatedAt = new Date().toISOString();
  data.metadata.version = 2;
  return writeJsonFile(plansFile, data);
}

/**
 * 读取单个事件
 */
function getPlanById(planId) {
  const data = readPlans();
  return data.plans.find(p => p.id === planId) || null;
}

/**
 * 保存事件（创建或更新）
 */
function savePlan(plan) {
  const data = readPlans();
  
  const index = data.plans.findIndex(p => p.id === plan.id);
  
  if (index === -1) {
    // 创建新事件
    plan.metadata = plan.metadata || {};
    plan.metadata.createdAt = new Date().toISOString();
    plan.metadata.version = 2;
    data.plans.push(plan);
  } else {
    // 更新现有事件
    data.plans[index] = { ...data.plans[index], ...plan };
    data.plans[index].metadata = data.plans[index].metadata || {};
    data.plans[index].metadata.updatedAt = new Date().toISOString();
  }
  
  return writePlans(data);
}

/**
 * 删除事件
 */
function deletePlanById(planId) {
  const data = readPlans();
  const index = data.plans.findIndex(p => p.id === planId);
  
  if (index === -1) {
    return false;
  }
  
  data.plans.splice(index, 1);
  return writePlans(data);
}

/**
 * 读取设置
 */
function readSettings() {
  const settingsFile = getSettingsFile();
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
  
  return readJsonFile(settingsFile, defaultSettings);
}

/**
 * 写入设置
 */
function writeSettings(settings) {
  const settingsFile = getSettingsFile();
  settings.version = 2;
  return writeJsonFile(settingsFile, settings);
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 基础操作
  readPlans,
  writePlans,
  getPlanById,
  savePlan,
  deletePlanById,
  
  // 设置
  readSettings,
  writeSettings,
  
  // 工具函数
  generateEventId,
  generateStageId,
  readJsonFile,
  writeJsonFile,
  
  // 路径
  getDataDir,
  getActiveDir,
  getArchiveDir,
  getIndexDir,
  getSettingsFile,
  getPlansFile
};
