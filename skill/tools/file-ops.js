#!/usr/bin/env node

/**
 * 文件操作工具
 * 提供日历事件和设置的读写功能
 */

const fs = require('fs');
const path = require('path');

// 默认路径
const DEFAULT_CALENDAR_DIR = '/root/.openclaw/workspace/calendar';
const EVENTS_FILE = path.join(DEFAULT_CALENDAR_DIR, 'events.json');
const SETTINGS_FILE = path.join(DEFAULT_CALENDAR_DIR, 'settings.json');

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
    console.error('读取事件文件失败:', error);
    return { version: 1, events: [], metadata: {}, error: error.message };
  }
}

/**
 * 写入事件文件
 */
function writeEvents(data) {
  try {
    ensureDir(DEFAULT_CALENDAR_DIR);
    
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(EVENTS_FILE, content, 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error('写入事件文件失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 添加单个事件
 */
function appendEvent(event) {
  const data = readEvents();
  
  if (!data.events) {
    data.events = [];
  }
  
  // 检查是否已存在（避免重复）
  const exists = data.events.some(e => e.id === event.id);
  if (exists) {
    // 更新现有事件
    const index = data.events.findIndex(e => e.id === event.id);
    data.events[index] = { ...data.events[index], ...event, updatedAt: new Date().toISOString() };
  } else {
    // 添加新事件
    event.createdAt = event.createdAt || new Date().toISOString();
    event.updatedAt = event.updatedAt || new Date().toISOString();
    data.events.push(event);
  }
  
  data.metadata.updatedAt = new Date().toISOString();
  
  return writeEvents(data);
}

/**
 * 删除事件
 */
function deleteEvent(eventId) {
  const data = readEvents();
  
  if (!data.events) {
    return { success: false, error: '事件列表为空' };
  }
  
  const initialLength = data.events.length;
  data.events = data.events.filter(e => e.id !== eventId);
  
  if (data.events.length === initialLength) {
    return { success: false, error: '未找到事件' };
  }
  
  data.metadata.updatedAt = new Date().toISOString();
  writeEvents(data);
  
  return { success: true, deletedId: eventId };
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
        }
      };
    }
    
    const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取设置文件失败:', error);
    return null;
  }
}

/**
 * 写入设置文件
 */
function writeSettings(settings) {
  try {
    ensureDir(DEFAULT_CALENDAR_DIR);
    
    const content = JSON.stringify(settings, null, 2);
    fs.writeFileSync(SETTINGS_FILE, content, 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error('写入设置文件失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取当前周次（相对于学期开始）
 */
function getCurrentWeek(semesterStart) {
  if (!semesterStart) {
    return null;
  }
  
  const now = new Date();
  const start = new Date(semesterStart);
  
  // 计算周次差
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;
  
  return weekNumber > 0 ? weekNumber : null;
}

module.exports = {
  readEvents,
  writeEvents,
  appendEvent,
  deleteEvent,
  readSettings,
  writeSettings,
  getCurrentWeek,
  EVENTS_FILE,
  SETTINGS_FILE
};
