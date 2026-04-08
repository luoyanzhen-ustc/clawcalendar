#!/usr/bin/env node

/**
 * 文件操作工具 v2.0
 * 
 * 重构内容：
 * - 时区协调：UTC 存储 + 北京时间展示
 * - 分层存储：active / archive / index
 * - 事件状态：active / completed / cancelled / expired
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

// 缓存路径
const DATA_DIR = getDataDir();
const ACTIVE_DIR = getActiveDir();
const INDEX_DIR = getIndexDir();

// ============================================================================
// 原子写入工具
// ============================================================================

function processExists(pid) {
  try {
    process.kill(parseInt(pid), 0);
    return true;
  } catch (e) {
    return false;
  }
}

function acquireLock(lockFile, timeout = 5000) {
  const pidFile = lockFile + '.pid';
  const startTime = Date.now();
  
  while (true) {
    if (!fs.existsSync(pidFile)) {
      try {
        fs.writeFileSync(pidFile, process.pid.toString(), 'utf8');
        return true;
      } catch (e) {
        // 并发冲突，重试
      }
    } else {
      try {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        if (!processExists(pid)) {
          try { fs.unlinkSync(pidFile); } catch (e) {}
        }
      } catch (e) {}
    }
    
    if (Date.now() - startTime > timeout) {
      console.error('获取文件锁超时');
      return false;
    }
    
    const waitTime = Math.min(10, timeout - (Date.now() - startTime));
    if (waitTime > 0) {
      const start = Date.now();
      while (Date.now() - start < waitTime) {}
    }
  }
}

function releaseLock(lockFile) {
  const pidFile = lockFile + '.pid';
  try {
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch (e) {
    console.error('释放锁失败:', e.message);
  }
}

function atomicWrite(filePath, data) {
  const tmpFile = filePath + '.tmp';
  
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpFile, content, 'utf8');
    fs.renameSync(tmpFile, filePath);
    return { success: true };
  } catch (error) {
    console.error('原子写入失败:', error.message);
    try {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch (e) {}
    return { success: false, error: error.message };
  }
}

function lockedWrite(filePath, transformFn) {
  const lockFile = filePath + '.lock';
  
  if (!acquireLock(lockFile)) {
    return { success: false, error: '无法获取文件锁' };
  }
  
  try {
    let data;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      data = JSON.parse(content);
    } else {
      data = { version: 1, events: [], metadata: {} };
    }
    
    const newData = transformFn(data);
    return atomicWrite(filePath, newData);
    
  } catch (error) {
    console.error('带锁写入失败:', error.message);
    return { success: false, error: error.message };
  } finally {
    releaseLock(lockFile);
  }
}

// ============================================================================
// 时区工具
// ============================================================================

const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const BEIJING_OFFSET = 480; // 分钟

/**
 * 将本地时间转换为 UTC
 * @param {string} date - "YYYY-MM-DD"
 * @param {string} time - "HH:MM"
 * @param {string} timezone - 时区
 * @returns {string} ISO 8601 UTC 时间
 */
function toUTC(date, time, timezone = DEFAULT_TIMEZONE) {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  
  const local = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  // 北京时间固定偏移 +8
  const offset = timezone === 'Asia/Shanghai' ? BEIJING_OFFSET : 0;
  const utc = new Date(local.getTime() - offset * 60 * 1000);
  
  return utc.toISOString();
}

/**
 * 将 UTC 时间转换为本地时间展示
 * @param {string} utcString - ISO 8601 UTC 时间
 * @param {string} targetTimezone - 目标时区
 * @returns {{ date: string, time: string, timezone: string }}
 */
function toLocal(utcString, targetTimezone = DEFAULT_TIMEZONE) {
  const utc = new Date(utcString);
  
  // 转换为北京时间
  const beijing = new Date(utc.getTime() + BEIJING_OFFSET * 60 * 1000);
  
  const date = beijing.toISOString().split('T')[0];
  const time = beijing.toTimeString().slice(0, 5);
  
  return {
    date,
    time,
    timezone: targetTimezone
  };
}

/**
 * 检查是否在静默时段
 */
function isQuietHours(date, quietHours = { start: '23:00', end: '08:00' }) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const time = hour * 60 + minute;
  
  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (startTime > endTime) {
    return time >= startTime || time < endTime;
  }
  
  return time >= startTime && time < endTime;
}

// ============================================================================
// 核心函数 - 活跃层
// ============================================================================

function ensureActiveDir() {
  if (!fs.existsSync(ACTIVE_DIR)) {
    fs.mkdirSync(ACTIVE_DIR, { recursive: true });
  }
}

function getCoursesFile() {
  return path.join(ACTIVE_DIR, 'courses.json');
}

function getRecurringFile() {
  return path.join(ACTIVE_DIR, 'recurring.json');
}

function getPlansFile() {
  return path.join(ACTIVE_DIR, 'plans.json');
}

function getMetadataFile() {
  return path.join(ACTIVE_DIR, 'metadata.json');
}

/**
 * 读取课程表
 */
function readCourses() {
  const file = getCoursesFile();
  if (!fs.existsSync(file)) {
    return {
      version: 1,
      semester: 'unknown',
      courses: [],
      metadata: {}
    };
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

/**
 * 写入课程表（原子写入）
 */
function writeCourses(data) {
  ensureActiveDir();
  return atomicWrite(getCoursesFile(), data);
}

/**
 * 读取周期事件
 */
function readRecurring() {
  const file = getRecurringFile();
  if (!fs.existsSync(file)) {
    return {
      version: 1,
      recurring: [],
      metadata: {}
    };
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

/**
 * 写入周期事件
 */
function writeRecurring(data) {
  ensureActiveDir();
  return atomicWrite(getRecurringFile(), data);
}

/**
 * 读取临时事件
 */
function readPlans() {
  const file = getPlansFile();
  if (!fs.existsSync(file)) {
    return {
      version: 1,
      plans: [],
      metadata: {}
    };
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

/**
 * 写入临时事件（带锁）
 */
function writePlans(data) {
  ensureActiveDir();
  return lockedWrite(getPlansFile(), () => data);
}

/**
 * 添加单个事件
 */
function appendPlan(plan) {
  return lockedWrite(getPlansFile(), (data) => {
    if (!data.plans) {
      data.plans = [];
    }
    
    const exists = data.plans.some(p => p.id === plan.id);
    if (exists) {
      const index = data.plans.findIndex(p => p.id === plan.id);
      data.plans[index] = {
        ...data.plans[index],
        ...plan,
        updatedAt: new Date().toISOString()
      };
    } else {
      plan.createdAt = plan.createdAt || new Date().toISOString();
      plan.updatedAt = plan.updatedAt || new Date().toISOString();
      
      // 初始化 notify 字段（用于推送去重）
      if (!plan.notify) {
        plan.notify = {
          lastPushedAt: null,
          pushedChannels: [],
          nextPushTime: null
        };
      }
      
      data.plans.push(plan);
    }
    
    data.metadata.updatedAt = new Date().toISOString();
    return data;
  });
}

/**
 * 取消事件（保留历史，移动到归档区）
 * @param {string} planId - 事件 ID
 * @param {string} reason - 取消原因
 * @returns {{ success: boolean, archived: boolean, error?: string }}
 */
function cancelPlan(planId, reason = '用户取消') {
  const lockFile = getPlansFile() + '.lock';
  
  if (!acquireLock(lockFile)) {
    return { success: false, error: '无法获取文件锁' };
  }
  
  try {
    const plansFile = getPlansFile();
    let data;
    
    if (fs.existsSync(plansFile)) {
      const content = fs.readFileSync(plansFile, 'utf8');
      data = JSON.parse(content);
    } else {
      return { success: false, error: '事件文件不存在' };
    }
    
    // 找到要取消的事件
    const planIndex = data.plans.findIndex(p => p.id === planId);
    if (planIndex === -1) {
      return { success: false, error: '未找到事件' };
    }
    
    const plan = data.plans[planIndex];
    
    // 标记为 cancelled
    plan.lifecycle = {
      ...plan.lifecycle,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelReason: reason
    };
    
    // 归档到本周
    const metadata = readMetadata();
    const currentWeek = metadata.currentWeek;
    const archiveDir = getArchiveDir(metadata.semester);
    const plansArchiveDir = path.join(archiveDir, 'plans');
    
    if (!fs.existsSync(plansArchiveDir)) {
      fs.mkdirSync(plansArchiveDir, { recursive: true });
    }
    
    const archiveFile = path.join(plansArchiveDir, `week-${currentWeek}.json`);
    let weekData = { week: currentWeek, plans: [], archivedAt: new Date().toISOString() };
    
    if (fs.existsSync(archiveFile)) {
      weekData = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    }
    
    // 添加到归档
    weekData.plans.push(plan);
    fs.writeFileSync(archiveFile, JSON.stringify(weekData, null, 2), 'utf8');
    
    // 从 active 中删除
    data.plans.splice(planIndex, 1);
    data.metadata.updatedAt = new Date().toISOString();
    
    atomicWrite(plansFile, data);
    
    console.log(`✅ 取消事件：${plan.title} (原因：${reason})`);
    
    return { success: true, archived: true, plan };
    
  } catch (error) {
    console.error('取消事件失败:', error.message);
    return { success: false, error: error.message };
  } finally {
    releaseLock(lockFile);
  }
}

/**
 * 删除事件（物理删除，不保留历史）
 * @param {string} planId - 事件 ID
 * @returns {{ success: boolean, archived: boolean }}
 */
function deletePlan(planId) {
  return lockedWrite(getPlansFile(), (data) => {
    if (!data.plans) {
      return data;
    }
    
    const initialLength = data.plans.length;
    const plan = data.plans.find(p => p.id === planId);
    data.plans = data.plans.filter(p => p.id !== planId);
    
    if (data.plans.length === initialLength) {
      throw new Error('未找到事件');
    }
    
    data.metadata.updatedAt = new Date().toISOString();
    
    console.log(`🗑️  物理删除事件：${plan?.title || planId}`);
    
    return data;
  });
}

/**
 * 读取学期元数据
 */
function readMetadata() {
  const file = getMetadataFile();
  if (!fs.existsSync(file)) {
    return {
      version: 1,
      semester: 'unknown',
      startDate: null,
      endDate: null,
      currentWeek: 1,
      weekMapping: {},
      keyDates: {},
      stats: {},
      createdAt: new Date().toISOString()
    };
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

/**
 * 写入学期元数据
 */
function writeMetadata(data) {
  ensureActiveDir();
  return atomicWrite(getMetadataFile(), data);
}

// ============================================================================
// 核心函数 - 索引层
// ============================================================================

function getTodayIndexFile() {
  return path.join(INDEX_DIR, 'today.json');
}

function getUpcomingIndexFile() {
  return path.join(INDEX_DIR, 'upcoming.json');
}

/**
 * 读取今天索引
 */
function readTodayIndex() {
  const file = getTodayIndexFile();
  if (!fs.existsSync(file)) {
    return null;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

/**
 * 写入今天索引
 */
function writeTodayIndex(data) {
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }
  return atomicWrite(getTodayIndexFile(), data);
}

/**
 * 读取未来 7 天索引
 */
function readUpcomingIndex() {
  const file = getUpcomingIndexFile();
  if (!fs.existsSync(file)) {
    return null;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

/**
 * 写入未来 7 天索引
 */
function writeUpcomingIndex(data) {
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }
  return atomicWrite(getUpcomingIndexFile(), data);
}

// ============================================================================
// 智能过滤函数（用于提醒）
// ============================================================================

/**
 * 获取即将发生的事件
 * @param {number} advanceMinutes - 提前多少分钟
 * @returns {Array} 需要提醒的事件
 */
function get_upcoming_reminders(advanceMinutes = 30) {
  const plansData = readPlans();
  const metadata = readMetadata();
  const now = new Date();
  
  if (!plansData.plans || plansData.plans.length === 0) {
    return [];
  }
  
  const upcoming = [];
  const beijingNow = new Date(now.getTime() + BEIJING_OFFSET * 60 * 1000);
  
  for (const plan of plansData.plans) {
    // 跳过已完成、已取消、已过期的事件
    if (plan.lifecycle && plan.lifecycle.status !== 'active') {
      continue;
    }
    
    // 计算事件时间
    const eventDate = plan.schedule.displayDate;
    const eventTime = plan.schedule.displayTime || '00:00';
    const eventTimezone = plan.schedule.displayTimezone || DEFAULT_TIMEZONE;
    
    // 转换为 UTC 进行比较
    const utcStart = plan.schedule.utcStart || toUTC(eventDate, eventTime, eventTimezone);
    const eventUTC = new Date(utcStart);
    
    // 计算提醒时间
    const reminderOffsets = plan.reminderOffsets || [30];
    const primaryOffset = reminderOffsets[0] || 30;
    const reminderTime = new Date(eventUTC.getTime() - primaryOffset * 60 * 1000);
    
    // 检查是否在提醒时间窗口内（±1 分钟）
    const timeDiff = now.getTime() - reminderTime.getTime();
    if (timeDiff < -60 * 1000 || timeDiff > 60 * 1000) {
      continue;
    }
    
    // 检查静默时段
    const settings = readSettings();
    const quietHours = settings.quietHours || { start: '23:00', end: '08:00' };
    const inQuietHours = isQuietHours(beijingNow, quietHours);
    
    if (inQuietHours) {
      // 静默时段只推送高优先级事件
      if (plan.priority !== 'high') {
        continue;
      }
    }
    
    // 通过所有检查，添加到结果
    const local = toLocal(utcStart, eventTimezone);
    upcoming.push({
      ...plan,
      display: {
        date: local.date,
        time: local.time,
        timezone: eventTimezone
      },
      minutesUntilEvent: Math.round((eventUTC.getTime() - now.getTime()) / 60000)
    });
  }
  
  return upcoming;
}

// ============================================================================
// 设置文件
// ============================================================================

function readSettings() {
  const file = getSettingsFile();
  if (!fs.existsSync(file)) {
    return {
      timezone: 'Asia/Shanghai',
      semesterStart: null,
      notify: {
        enabled: true,
        channels: {
          webchat: true,
          qq: true,
          wechat: false
        },
        timing: {
          advanceMinutes: 30,
          maxReminders: 3,
          intervalMinutes: 10
        }
      },
      reminderDefaults: {
        high: [1440, 60],
        medium: [30],
        low: [10]
      },
      quietHours: {
        start: '23:00',
        end: '08:00'
      }
    };
  }
  
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

function writeSettings(settings) {
  const dir = path.dirname(getSettingsFile());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return atomicWrite(getSettingsFile(), settings);
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  readCourses,
  writeCourses,
  readRecurring,
  writeRecurring,
  readPlans,
  writePlans,
  appendPlan,
  deletePlan,
  readMetadata,
  writeMetadata,
  
  // 索引
  readTodayIndex,
  writeTodayIndex,
  readUpcomingIndex,
  writeUpcomingIndex,
  
  // 智能过滤
  get_upcoming_reminders,
  isQuietHours,
  
  // 时区工具
  toUTC,
  toLocal,
  
  // 设置
  readSettings,
  writeSettings,
  
  // 路径工具
  getBasePath,
  getDataDir,
  getActiveDir,
  getArchiveDir,
  getIndexDir
};
