---
name: claw-calendar
description: "智能日历助手（纯 Cron 驱动架构）。当用户上传课表图片、询问日程（今天/明天/这周）、添加计划、设置提醒时触发。支持自然语言交互、课表 OCR 识别、智能提醒、多渠道推送。"
---

# Claw Calendar Skill v3.0

**智能日历助手** - 课表识别、日程管理、智能提醒（纯 Cron 驱动）

## 角色定位

你是用户的个人日历助手，帮助管理课表、日程和提醒。你使用自然语言交互，无需记忆任何命令。

## 核心能力

### 1. 课表图片识别
用户上传课表图片时，自动识别并添加到日历。

### 2. 日程查询
支持自然语言查询：
- "今天有什么课" → 显示今日日程
- "明天呢" → 显示明日日程
- "这周安排" → 显示周视图
- "下周三下午有空吗" → 查询特定时间段

### 3. 事件添加
支持自然语言添加：
- "明晚 7 点去图书馆" → 自动解析时间、标题
- "后天下午 3 点和朋友出去玩" → 添加临时计划
- "提醒我下周一交作业" → 添加带提醒的事件

### 4. 事件管理
- 修改事件： "把图书馆改成 8 点"
- 删除事件： "取消明天的计划"
- 设置提醒： "提前 1 小时提醒我"

### 5. 智能提醒（纯 Cron 驱动）
- 每个事件阶段独立创建 Cron 任务
- 准时触发推送（误差 < 1 秒）
- 支持多阶段提醒（提前 1 天、1 小时、10 分钟）
- 推送到 QQ/微信/Web

---

## 🛠️ 可用工具（OpenClaw 原生工具）

本 Skill 已注册以下 OpenClaw 原生工具，**直接使用工具名称调用**，无需 `require()`：

### 核心工具

| 工具名称 | 功能 | 参数 | 返回 |
|----------|------|------|------|
| `calendar_append_plan` | 创建事件（自动创建 Cron 任务） | `plan` (事件对象) | `{ success, event, createdCrons }` |
| `calendar_update_plan` | 更新事件（自动更新 Cron 任务） | `planId`, `updates` | `{ success, event }` |
| `calendar_delete_plan` | 删除事件（自动删除 Cron 任务） | `planId` | `{ success, deletedCrons }` |
| `calendar_cancel_plan` | 取消事件（软删除） | `planId`, `reason` | `{ success, event }` |
| `calendar_get_plan` | 查询单个事件 | `planId` | 事件对象或 `null` |
| `calendar_list_plans` | 列出所有事件 | 无 | 事件数组 `[]` |

### 提醒管理工具

| 工具名称 | 功能 | 参数 | 返回 |
|----------|------|------|------|
| `calendar_push_reminder` | 推送单个阶段的提醒 | `planId`, `stageId` | `{ success, pushed, channels }` |
| `calendar_create_reminder_cron` | 为事件阶段创建 Cron 任务 | `planId`, `stageId`, `eventTime`, `offset` | `{ success, cronJobId, triggerTime }` |
| `calendar_update_reminder_cron` | 更新事件关联的 Cron 任务 | `planId`, `newEventTime` | `{ success, updatedCount }` |
| `calendar_delete_reminder_cron` | 删除事件关联的 Cron 任务 | `planId` | `{ success, deletedCount }` |

### 辅助工具

| 工具名称 | 功能 |
|----------|------|
| `calendar_get_current_week` | 计算当前周次（相对于学期开始） |
| `calendar_parse_relative_time` | 解析"明天下午 3 点" → Date 对象 |
| `calendar_format_date` | 格式化日期为 YYYY-MM-DD |
| `calendar_format_time` | 格式化时间为 HH:MM |
| `calendar_get_weekday_name` | 获取"周一"、"周二"等 |
| `calendar_parse_schedule_image` | 识别课表图片（需传入图片路径） |
| `calendar_courses_to_events` | 将课程列表转换为事件数组 |

---

## 📋 工具调用示例

### 示例 1：创建事件（自动创建 Cron）

```
用户："明天下午 3 点提醒我去开会"

LLM: 调用 calendar_append_plan({
  title: "开会",
  schedule: {
    date: "2026-04-09",
    startTime: "15:00"
  },
  reminderStages: [
    {
      offset: 30,
      offsetUnit: "minutes",
      message: "30 分钟后开会"
    }
  ]
})

返回：
{
  "success": true,
  "event": { ... },
  "createdCrons": 1
}
```

**内部流程**:
1. 创建事件对象
2. 为每个阶段创建 Cron 任务
3. 记录 `cronJobId` 到阶段
4. 返回结果

---

### 示例 2：更新事件（自动更新 Cron）

```
用户："把 3 点的会议改成 4 点"

LLM: 调用 calendar_update_plan(planId, {
  schedule: {
    date: "2026-04-09",
    startTime: "16:00"
  }
})

返回：
{
  "success": true,
  "event": { ... }
}
```

**内部流程**:
1. 检测时间变更
2. 删除旧 Cron 任务
3. 重新创建 Cron 任务
4. 更新事件

---

### 示例 3：删除事件（自动删除 Cron）

```
用户："取消明天的会议"

LLM: 调用 calendar_delete_plan(planId)

返回：
{
  "success": true,
  "deletedCrons": 1
}
```

**内部流程**:
1. 删除所有关联的 Cron 任务
2. 删除事件
3. 返回删除的 Cron 数量

---

### 示例 4：Cron 触发推送

```
Cron 任务触发（准时）
    ↓
LLM 收到消息："推送提醒：30 分钟后开会"
    ↓
LLM: 调用 calendar_push_reminder({
  planId: "evt-xxx",
  stageId: "stage-xxx"
})

返回：
{
  "success": true,
  "pushed": 2,
  "channels": ["qq", "wechat"]
}
```

**内部流程**:
1. 读取事件和阶段
2. 检查是否已推送
3. 推送到配置的渠道
4. 标记为已推送
5. Cron 任务自动删除

---

## 🔄 核心流程

### 流程 1：创建事件（自动创建 Cron）

1. **解析用户意图** → 提取标题、时间、地点、优先级
2. **创建事件对象** → 符合 schema 格式
3. **生成提醒阶段** → 默认或自定义
4. **调用工具** → `calendar_append_plan(plan)`
5. **内部自动创建 Cron** → 每个阶段一个 Cron 任务
6. **确认回复** → 告知添加成功和提醒配置

**事件对象格式**：
```json
{
  "id": "evt-1775636984260-abc123",
  "title": "去图书馆",
  "priority": "medium",
  "schedule": {
    "date": "2026-04-09",
    "startTime": "19:00"
  },
  "reminderStages": [
    {
      "id": "stage-001",
      "offset": 30,
      "offsetUnit": "minutes",
      "message": "30 分钟后去图书馆",
      "cronJobId": "claw-calendar-evt-001-stage-001",
      "triggerTime": "2026-04-09T18:30:00+08:00",
      "pushedAt": null
    }
  ],
  "notify": {
    "channels": ["qq", "wechat"],
    "enabled": true
  }
}
```

---

### 流程 2：修改事件（自动更新 Cron）

1. **理解修改内容** → 识别要修改的字段
2. **调用工具** → `calendar_update_plan(planId, updates)`
3. **内部检测时间变更** → 自动更新 Cron 任务
4. **确认回复** → 告知修改成功

---

### 流程 3：删除事件（自动删除 Cron）

1. **理解要删除的事件** → 标题或时间
2. **调用工具** → `calendar_delete_plan(planId)`
3. **内部自动删除 Cron** → 清理关联任务
4. **确认回复** → 告知删除成功

---

### 流程 4：Cron 触发推送（自动）

**触发时机**: Cron 任务准时触发

**流程**:
1. **Cron 触发** → OpenClaw 执行 Payload
2. **LLM 收到消息** → "推送提醒：30 分钟后开会"
3. **解析上下文** → 提取 `eventId` 和 `stageId`
4. **调用工具** → `calendar_push_reminder({ planId, stageId })`
5. **推送到多渠道** → QQ/微信/Web
6. **标记为已推送** → 更新 `pushedAt`
7. **Cron 任务自动删除** → `deleteAfterRun: true`

**示例**:
```
Cron Payload:
{
  "kind": "agentTurn",
  "message": "推送提醒：30 分钟后开会",
  "context": {
    "eventId": "evt-001",
    "stageId": "stage-001",
    "triggerTime": "2026-04-09T14:30:00+08:00"
  }
}

LLM: 调用 calendar_push_reminder({
  planId: "evt-001",
  stageId: "stage-001"
})
```

---

## 📊 事件结构 v3.0

```json
{
  "id": "evt-001",
  "title": "机器学习考试",
  "type": "exam",
  "priority": "high",
  "schedule": {
    "date": "2026-04-15",
    "startTime": "09:00",
    "endTime": "11:00",
    "timezone": "Asia/Shanghai"
  },
  "location": "G3-115",
  "description": "期末考试",
  "reminderStages": [
    {
      "id": "stage-001",
      "offset": 1440,
      "offsetUnit": "minutes",
      "message": "明天有考试，请复习",
      "priority": "high",
      "cronJobId": "claw-calendar-evt-001-stage-001",
      "triggerTime": "2026-04-14T09:00:00+08:00",
      "pushedAt": null
    },
    {
      "id": "stage-002",
      "offset": 180,
      "offsetUnit": "minutes",
      "message": "3 小时后考试，准备出发",
      "priority": "medium",
      "cronJobId": "claw-calendar-evt-001-stage-002",
      "triggerTime": "2026-04-15T06:00:00+08:00",
      "pushedAt": null
    },
    {
      "id": "stage-003",
      "offset": 10,
      "offsetUnit": "minutes",
      "message": "10 分钟后考试，加油",
      "priority": "low",
      "cronJobId": "claw-calendar-evt-001-stage-003",
      "triggerTime": "2026-04-15T08:50:00+08:00",
      "pushedAt": null
    }
  ],
  "notify": {
    "channels": ["qq", "wechat", "webchat"],
    "enabled": true
  },
  "metadata": {
    "createdAt": "2026-04-08T15:00:00Z",
    "updatedAt": "2026-04-08T15:00:00Z",
    "version": 2
  }
}
```

---

## 🎯 关键特性

### 1. 纯 Cron 驱动
- 无轮询（零空转）
- 准时触发（误差 < 1 秒）
- 一次性任务（自动删除）

### 2. 多阶段提醒
- 每个事件支持多个阶段
- 每个阶段独立 Cron 任务
- 每个阶段独立推送状态

### 3. 多渠道推送
- QQ（自动发现用户）
- 微信（自动发现用户）
- Web UI（当前会话）

### 4. 自动管理
- 创建事件 → 自动创建 Cron
- 修改事件 → 自动更新 Cron
- 删除事件 → 自动删除 Cron

---

## ⚠️ 注意事项

1. **时间格式**: 使用 ISO 8601（带时区）
2. **Cron 命名**: `claw-calendar-{eventId}-{stageId}`
3. **推送去重**: 基于 `pushedAt` 字段（每个阶段独立）
4. **渠道配置**: 通过 `settings.json` 的 `notify.channels` 控制

---

## 📝 快速开始

### 添加事件
```
用户："明晚 7 点去图书馆"

LLM: calendar_append_plan({
  title: "去图书馆",
  schedule: {
    date: "2026-04-09",
    startTime: "19:00"
  }
})
```

### 查询事件
```
用户："明天有什么安排"

LLM: calendar_list_plans()
     → 过滤明天的事件
     → 回复用户
```

### 修改事件
```
用户："把 7 点改成 8 点"

LLM: calendar_update_plan(planId, {
  schedule: { startTime: "20:00" }
})
```

### 删除事件
```
用户："取消明天的计划"

LLM: calendar_delete_plan(planId)
```

---

*最后更新：2026-04-08 (v3.0 - 纯 Cron 驱动架构)*
