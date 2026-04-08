#!/usr/bin/env node

/**
 * OCR 包装器
 * 调用 Qwen-VL 识别课表图片
 */

/**
 * USTC 固定节次时间映射
 */
const USTC_PERIOD_TIMES = {
  '1': ['07:50', '08:35'],
  '2': ['08:45', '09:30'],
  '3': ['09:45', '10:30'],
  '4': ['10:45', '11:30'],
  '5': ['11:40', '12:25'],
  '6': ['14:00', '14:45'],
  '7': ['14:55', '15:40'],
  '8': ['15:55', '16:40'],
  '9': ['16:50', '17:35'],
  '10': ['17:45', '18:30'],
  '11': ['18:40', '19:25'],
  '12': ['19:35', '20:20'],
  '13': ['20:30', '21:15']
};

/**
 * 识别课表图片
 * @param {string} imagePath - 图片路径或 base64
 * @param {Function} callModel - 调用模型的函数
 * @returns {Promise<Object>} 识别结果
 */
async function parseScheduleImage(imagePath, callModel) {
  const prompt = `
你是一名中国科学技术大学课表识别助手。请识别这张课表图片，提取课程信息。

USTC 课表特点：
1. 节次时间固定（见下方映射表）
2. 格式：课程名称 地点 (周次) 星期 (节次)
3. 研究生课表：课程名 地点 (周次) 星期 (节次)
4. 本科生课表：课程名 教师 地点 (周次) 星期 (节次)

节次时间映射：
- 1-2 节：07:50-09:30
- 3-5 节：09:45-12:10
- 6-7 节：14:00-15:40
- 8-10 节：15:55-18:30
- 11-13 节：18:40-21:55

请输出为 JSON 格式：
{
  "courses": [
    {
      "weekday": 1-7,
      "periods": "节次如 3-5",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "name": "课程名称",
      "code": "课程代码（如有）",
      "location": "地点",
      "weeks": "周次范围如 1-15 周",
      "teacher": "教师姓名（如有）",
      "isUndergraduate": true/false
    }
  ]
}

注意事项：
1. 识别周次范围（如"1~5, 7~14 周"）
2. 识别节次（如"3,4,5"表示 3-5 节）
3. 区分本科生和研究生课表
4. 如果信息不清晰，标记 needsReview: true
5. weekday: 1=周一，2=周二，...，7=周日
`;

  try {
    const result = await callModel('ustc/qwen-chat', {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image_url: { url: imagePath } }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    
    // 后处理：应用 USTC 规则修正
    const courses = applyUSTCRules(parsed.courses || []);
    
    return {
      success: true,
      courses: courses,
      periodTimes: USTC_PERIOD_TIMES
    };
  } catch (error) {
    console.error('USTC 课表识别失败:', error);
    return {
      success: false,
      error: '图片识别失败，请重新上传清晰的课表截图',
      suggestions: [
        '确保图片清晰，避免模糊',
        '确保光线充足，避免反光',
        '或者手动输入课表信息'
      ]
    };
  }
}

/**
 * 应用 USTC 规则修正
 */
function applyUSTCRules(courses) {
  return courses.map(course => {
    // 根据节次修正时间
    if (course.periods) {
      const periods = course.periods.split('-').map(Number);
      const startPeriod = periods[0];
      const endPeriod = periods[periods.length - 1];
      
      if (USTC_PERIOD_TIMES[startPeriod] && USTC_PERIOD_TIMES[endPeriod]) {
        course.startTime = USTC_PERIOD_TIMES[startPeriod][0];
        course.endTime = USTC_PERIOD_TIMES[endPeriod][1];
      }
    }
    
    // 检测课表类型
    course.isUndergraduate = !!course.teacher;
    
    return course;
  });
}

/**
 * 将识别结果转换为事件
 */
function coursesToEvents(courses, semesterStart) {
  const events = [];

  for (const course of courses) {
    const weekRanges = parseWeekRanges(course.weeks);
    
    const event = {
      id: generateId(),
      type: 'course',
      title: course.name,
      priority: 'medium',
      schedule: {
        kind: 'weekly',
        weekday: course.weekday,
        startTime: course.startTime,
        endTime: course.endTime,
        periods: course.periods,
        weeks: course.weeks,
        weekRanges: weekRanges
      },
      location: course.location,
      teacher: course.teacher || null,
      code: course.code || null,
      notes: course.isUndergraduate ? '本科生课程' : '研究生课程',
      reminderOffsets: [30],
      active: true,
      source: 'image',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    events.push(event);
  }

  return events;
}

/**
 * 解析周次范围
 */
function parseWeekRanges(weeksStr) {
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
 * 生成唯一 ID
 */
function generateId() {
  return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  parseScheduleImage,
  applyUSTCRules,
  coursesToEvents,
  parseWeekRanges,
  generateId,
  USTC_PERIOD_TIMES
};
