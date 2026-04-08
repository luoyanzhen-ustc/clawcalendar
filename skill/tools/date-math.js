#!/usr/bin/env node

/**
 * 日期数学工具
 * 提供精确的日期计算功能
 */

/**
 * USTC 校历工具
 */

/**
 * 计算当前周次（相对于学期开始日期）
 * @param {string} semesterStart - 学期开始日期 "YYYY-MM-DD"
 * @returns {number|null} 当前周次，1-20
 */
function getCurrentWeek(semesterStart) {
  if (!semesterStart) {
    return null;
  }
  
  const now = new Date();
  const start = new Date(semesterStart + 'T00:00:00+08:00');
  now.setHours(0, 0, 0, 0);
  
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 0; // 学期还没开始
  }
  
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return weekNumber;
}

/**
 * 解析相对时间表达
 * 
 * 重要：返回的是北京时间（UTC+8），不是 UTC
 * 
 * @param {string} text - 如"明天下午 3 点"、"下周三"
 * @param {Date} baseDate - 基准时间（默认现在，北京时间）
 * @returns {Date|null} 解析后的日期（北京时间）
 */
function parseRelativeTime(text, baseDate = new Date()) {
  const now = baseDate || new Date();
  let result = new Date(now);
  
  // 清除时分秒（保持当前时区）
  result.setHours(0, 0, 0, 0);
  
  // 相对日期
  if (/今天 | 今天/.test(text)) {
    // 保持当前日期
  } else if (/明天 | 明晚/.test(text)) {
    result.setDate(result.getDate() + 1);
  } else if (/后天/.test(text)) {
    result.setDate(result.getDate() + 2);
  } else if (/大后天/.test(text)) {
    result.setDate(result.getDate() + 3);
  } else if (/前天/.test(text)) {
    result.setDate(result.getDate() - 2);
  } else if (/大前天/.test(text)) {
    result.setDate(result.getDate() - 3);
  }
  
  // 星期几
  const weekdayMatch = text.match(/周 (.*)|星期 (.*)/);
  if (weekdayMatch) {
    const weekdayMap = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '0': 0
    };
    const day = weekdayMatch[1] || weekdayMatch[2];
    const targetWeekday = weekdayMap[day];
    
    if (targetWeekday !== undefined) {
      // 计算目标星期几的日期
      const currentWeekday = result.getDay();
      let daysToAdd = targetWeekday - currentWeekday;
      
      // 如果是"下周"，加 7 天
      if (/下周/.test(text)) {
        daysToAdd += 7;
      }
      
      // 如果是"这周"且目标日期已过，加 7 天到下周
      if (/这周 | 本周/.test(text) && daysToAdd <= 0) {
        daysToAdd += 7;
      }
      
      // 如果只说"周 X"且 X 在今天之前，默认下周
      if (!/这周 | 本周 | 下周/.test(text) && daysToAdd <= 0) {
        daysToAdd += 7;
      }
      
      result.setDate(result.getDate() + daysToAdd);
    }
  }
  
  // 时间段（用于推断小时）
  let hourOffset = 0;
  if (/早上/.test(text)) {
    hourOffset = 8;
  } else if (/上午/.test(text)) {
    hourOffset = 9;
  } else if (/中午/.test(text)) {
    hourOffset = 12;
  } else if (/下午/.test(text)) {
    hourOffset = 14;
  } else if (/晚上 | 今晚 | 明晚/.test(text)) {
    hourOffset = 19;
  }
  
  // 具体时间点
  const timeMatch = text.match(/(\d+)[点：:](\d*)?/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    let minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    // 处理 12 小时制
    if (/晚上/.test(text) && hour < 12) {
      hour += 12;
    } else if (/下午/.test(text) && hour < 12) {
      hour += 12;
    } else if (/早上 | 上午/.test(text) && hour === 12) {
      hour = 0;
    }
    
    result.setHours(hour, minute, 0, 0);
  } else if (hourOffset > 0) {
    // 只有时间段，没有具体时间
    result.setHours(hourOffset, 0, 0, 0);
  }
  
  // 重要：返回的是北京时间（UTC+8）
  // 调用者需要使用 toISOString() 转换为 UTC 存储
  return result;
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间为 HH:MM
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 获取星期几的中文名称
 */
function getWeekdayName(date) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[date.getDay()];
}

/**
 * 检查日期是否在周次范围内
 * @param {Date} date - 要检查的日期
 * @param {string} semesterStart - 学期开始日期
 * @param {Array} weekRanges - 周次范围 [[1,15], [17,18]]
 * @returns {boolean}
 */
function isWithinWeekRanges(date, semesterStart, weekRanges) {
  if (!semesterStart || !weekRanges || weekRanges.length === 0) {
    return true; // 没有限制
  }
  
  const currentWeek = getCurrentWeek(semesterStart);
  if (!currentWeek) {
    return false;
  }
  
  for (const [startWeek, endWeek] of weekRanges) {
    if (currentWeek >= startWeek && currentWeek <= endWeek) {
      return true;
    }
  }
  
  return false;
}

/**
 * 解析周次范围字符串
 * @param {string} weeksStr - 如"1-15 周"、"1~5, 7~14 周"
 * @returns {Array} [[1,15]] 或 [[1,5], [7,14]]
 */
function parseWeekRanges(weeksStr) {
  if (!weeksStr) {
    return [];
  }
  
  const ranges = [];
  const parts = weeksStr.replace(/周/g, '').split(/[,,]/).map(s => s.trim());
  
  for (const part of parts) {
    const match = part.match(/(\d+)[~\-](\d+)/);
    if (match) {
      ranges.push([parseInt(match[1]), parseInt(match[2])]);
    } else {
      const single = parseInt(part);
      if (!isNaN(single)) {
        ranges.push([single, single]);
      }
    }
  }
  
  return ranges;
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffMs = d2.getTime() - d1.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

module.exports = {
  getCurrentWeek,
  parseRelativeTime,
  formatDate,
  formatTime,
  getWeekdayName,
  isWithinWeekRanges,
  parseWeekRanges,
  daysBetween
};
