#!/usr/bin/env node

/**
 * 文件操作工具
 * 
 * 重构版本：
 * - 动态路径（支持环境变量）
 * - 原子写入（临时文件 + renameSync）
 * - 文件锁（防止并发冲突）
 * - 新增 get_upcoming_reminders() 过滤函数
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// 动态路径配置
// ============================================================================

/**
 * 获取基础工作目录
 * 优先级：OPENCLAW_WORKSPACE 环境变量 > ~/.openclaw/workspace
 */
function getBasePath() {
  return process.env.OPENCLAW_WORKSPACE || 
         path.join(os.homedir(), '.openclaw', 'workspace');
}

/**
 * 获取日历数据目录
 */
function getDataDir() {
  // 优先使用 claw-calendar/data，回退到 calendar（兼容旧版）
  const basePath = getBasePath();
  const newDir = path.join(basePath, 'claw-calendar', 'data');
  const oldDir = path.join(basePath, 'calendar');
  
  // 如果新目录存在，用新的；否则用旧的（兼容）
  if (fs.existsSync(newDir)) {
    return newDir;
  }
  return oldDir;
}

/**
 * 获取文件路径
 */
function getEventsFile() {
  return path.join(getDataDir(), 'events.json');
}

function getSettingsFile() {
  return path.join(getDataDir(), 'settings.json');
}

function getLockFile() {
  return path.join(getDataDir(), '.events.lock');
}

// 缓存路径（避免重复计算）
const DATA_DIR = getDataDir();
const EVENTS_FILE = getEventsFile();
const SETTINGS_FILE = getSettingsFile();
const LOCK_FILE = getLockFile();

// ============================================================================
// 原子写入工具
// ============================================================================

/**
 * 检查进程是否存在
 */
function processExists(pid) {
  try {
    process.kill(parseInt(pid), 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 获取文件锁
 * @param {string} lockFile - 锁文件路径
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {boolean} 是否成功获取锁
 */
function acquireLock(lockFile, timeout = 5000) {
  const startTime = Date.now();
  const pidFile = lockFile + '.pid';
  
  while (true) {
    // 尝试获取锁
    if (!fs.existsSync(pidFile)) {
      try {
        fs.writeFileSync(pidFile, process.pid.toString(), 'utf8');
        return true;
      } catch (e) {
        // 并发冲突，重试
      }
    } else {
      // 检查锁是否有效
      try {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        if (!processExists(pid)) {
          // 死锁，清理
          try { fs.unlinkSync(pidFile); } catch (e) {}
        }
      } catch (e) {
        // 文件不存在或读取失败
      }
    }
    
    // 检查超时
    if (Date.now() - startTime > timeout) {
      console.error('获取文件锁超时');
      return false;
    }
    
    // 等待 10ms 后重试
    const waitTime = Math.min(10, timeout - (Date.now() - startTime));
    if (waitTime > 0) {
      const start = Date.now();
      while (Date.now() - start < waitTime) {
        // 忙等待
      }
    }
  }
}

/**
 * 释放文件锁
 */
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

/**
 * 原子写入文件
 * @param {string} filePath - 目标文件路径
 * @param {any} data - 要写入的数据（会被 JSON.stringify）
 * @returns {{ success: boolean, error?: string }}
 */
function atomicWrite(filePath, data) {
  const tmpFile = filePath + '.tmp';
  
  try {
    // 1. 写入临时文件
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpFile, content, 'utf8');
    
    // 2. 原子替换（renameSync 是原子的）
    fs.renameSync(tmpFile, filePath);
    
    return { success: true };
  } catch (error) {
    console.error('原子写入失败:', error.message);
    
    // 3. 清理临时文件
    try {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch (e) {}
    
    return { success: false, error: error.message };
  }
}

/**
 * 带锁的原子写入
 * @param {string} filePath - 目标文件路径
 * @param {Function} transformFn - 转换函数 (data) => newData
 * @returns {{ success: boolean, error?: string }}
 */
function lockedWrite(filePath, transformFn) {
  if (!acquireLock(LOCK_FILE)) {
    return { success: false, error: '无法获取文件锁' };
  }
  
  try {
    // 1. 读取现有数据
    let data;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      data = JSON.parse(content);
    } else {
      data = { version: 1, events: [], metadata: {} };
    }
    
    // 2. 应用转换
    const newData = transformFn(data);
    
    // 3. 原子写入
    return atomicWrite(filePath, newData);
    
  } catch (error) {
    console.error('带锁写入失败:', error.message);
    return { success: false, error: error.message };
  } finally {
    releaseLock(LOCK_FILE);
  }
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 读取事件文件
 */
function readEvents() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) {
      return { version: 1, events: [], metadata: {} };
    }
    
    const content = fs.readFileSync(EVENTS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取事件文件失败:', error.message);
    return { version: 1, events: [], metadata: {}, error: error.message };
  }
}

/**
 * 写入事件文件（原子写入）
 */
function writeEvents(data) {
  ensureDir(DATA_DIR);
  return atomicWrite(EVENTS_FILE, data);
}

/**
 * 添加单个事件（带锁）
 */
function appendEvent(event) {
  return lockedWrite(EVENTS_FILE, (data) => {
    if (!data.events) {
      data.events = [];
    }
    
    // 检查是否已存在
    const exists = data.events.some(e => e.id === event.id);
    if (exists) {
      // 更新现有事件
      const index = data.events.findIndex(e => e.id === event.id);
      data.events[index] = {
        ...data.events[index],
        ...event,
        updatedAt: new Date().toISOString()
      };
    } else {
      // 添加新事件
      event.createdAt = event.createdAt || new Date().toISOString();
      event.updatedAt = event.updatedAt || new Date().toISOString();
      data.events.push(event);
    }
    
    data.metadata.updatedAt = new Date().toISOString();
    return data;
  });
}

/**
 * 删除事件（带锁）
 */
function deleteEvent(eventId) {
  const result = lockedWrite(EVENTS_FILE, (data) => {
    if (!data.events) {
      return data;
    }
    
    const initialLength = data.events.length;
    data.events = data.events.filter(e => e.id !== eventId);
    
    if (data.events.length === initialLength) {
      throw new Error('未找到事件');
    }
    
    data.metadata.updatedAt = new Date().toISOString();
    return data;
  });
  
  if (result.success) {
    return { success: true, deletedId: eventId };
  }
  return result;
}

/**
 * 读取设置文件
 */
function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return {
        timezone: 'Asia/Shanghai',
        semesterStart: null,
        notify: {
          channels: ['current']
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
    
    const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取设置文件失败:', error.message);
    return null;
  }
}

/**
 * 写入设置文件（原子写入）
 */
function writeSettings(settings) {
  ensureDir(DATA_DIR);
  return atomicWrite(SETTINGS_FILE, settings);
}

// ============================================================================
// 新增：智能过滤函数
// ============================================================================

/**
 * 检查时间是否在静默时段内
 * @param {Date} date - 要检查的时间
 * @param {Object} quietHours - { start: '23:00', end: '08:00' }
 * @returns {boolean} true = 在静默时段
 */
function isQuietHours(date, quietHours) {
  if (!quietHours || !quietHours.start || !quietHours.end) {
    return false;
  }
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const time = hour * 60 + minute;
  
  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  // 处理跨天情况（如 23:00 - 08:00）
  if (startTime > endTime) {
    return time >= startTime || time < endTime;
  }
  
  return time >= startTime && time < endTime;
}

/**
 * 获取即将发生的事件（用于提醒）
 * 
 * @param {number} advanceMinutes - 提前多少分钟（默认 30）
 * @returns {Array} 需要提醒的事件数组
 */
function get_upcoming_reminders(advanceMinutes = 30) {
  const eventsData = readEvents();
  const settings = readSettings();
  const now = new Date();
  
  if (!eventsData.events || eventsData.events.length === 0) {
    return [];
  }
  
  const upcoming = [];
  
  for (const event of eventsData.events) {
    // 跳过已完成、已取消、已归档的事件
    if (event.lifecycle && event.lifecycle.status !== 'active') {
      continue;
    }
    if (event.completed || event.cancelled) {
      continue;
    }
    
    // 计算事件时间
    let eventTime;
    if (event.schedule.kind === 'once' && event.schedule.date) {
      // 一次性事件
      eventTime = new Date(`${event.schedule.date}T${event.schedule.startTime}:00+08:00`);
    } else if (event.schedule.kind === 'weekly' && event.schedule.weekday) {
      // 每周重复事件（计算本周的日期）
      const currentWeekday = now.getDay();
      const targetWeekday = event.schedule.weekday;
      const daysToAdd = (targetWeekday - currentWeekday + 7) % 7;
      const eventDate = new Date(now);
      eventDate.setDate(now.getDate() + daysToAdd);
      eventDate.setHours(0, 0, 0, 0);
      
      const [hours, minutes] = event.schedule.startTime.split(':').map(Number);
      eventTime = new Date(eventDate);
      eventTime.setHours(hours, minutes, 0, 0);
      
      // 如果时间已过，加 7 天到下周
      if (eventTime.getTime() < now.getTime()) {
        eventTime.setDate(eventTime.getDate() + 7);
      }
    } else {
      // 无法识别的事件类型
      continue;
    }
    
    // 计算提醒时间
    const reminderOffsets = event.reminderOffsets || [30];
    const primaryOffset = reminderOffsets[0] || 30;
    const reminderTime = new Date(eventTime.getTime() - primaryOffset * 60 * 1000);
    
    // 检查是否在提醒时间窗口内（±1 分钟）
    const timeDiff = now.getTime() - reminderTime.getTime();
    if (timeDiff < -60 * 1000 || timeDiff > 60 * 1000) {
      // 不在提醒窗口内
      continue;
    }
    
    // 检查静默时段
    const quietHours = settings.quietHours || { start: '23:00', end: '08:00' };
    const inQuietHours = isQuietHours(now, quietHours);
    
    if (inQuietHours) {
      // 静默时段只推送高优先级事件
      if (event.priority !== 'high') {
        continue;
      }
    }
    
    // 通过所有检查，添加到结果
    upcoming.push({
      ...event,
      reminderTime: reminderTime.toISOString(),
      eventTime: eventTime.toISOString(),
      minutesUntilEvent: Math.round((eventTime.getTime() - now.getTime()) / 60000)
    });
  }
  
  return upcoming;
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  readEvents,
  writeEvents,
  appendEvent,
  deleteEvent,
  readSettings,
  writeSettings,
  
  // 新增：智能过滤
  get_upcoming_reminders,
  isQuietHours,
  
  // 工具函数
  atomicWrite,
  lockedWrite,
  acquireLock,
  releaseLock,
  
  // 路径（导出供测试使用）
  getBasePath,
  getDataDir,
  getEventsFile,
  getSettingsFile,
  getLockFile,
  
  // 常量（兼容旧版）
  EVENTS_FILE,
  SETTINGS_FILE,
  DATA_DIR
};
