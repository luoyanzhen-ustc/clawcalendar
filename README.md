# Claw Calendar

**Agentic Workflow 日历助手** - 提示词即代码，自然语言交互

## 🎯 特性

- **100% 自然语言** - 无需记忆命令，像聊天一样使用
- **课表图片识别** - 上传课表截图，自动识别（USTC 专属优化）
- **本地存储** - 数据完全隐私，不上传云端
- **智能提醒** - 自动检查并推送提醒
- **提示词驱动** - 核心逻辑用自然语言编写，易于维护

## 🚀 快速开始

### 1. 初始化配置

首次使用时，设置学期开始日期：

```
我的这学期是 3 月 1 号开始的
```

### 2. 上传课表

直接上传课表图片，自动识别并添加。

### 3. 自然语言查询

```
今天有什么课？
明天呢？
这周安排
下周三下午有空吗？
```

### 4. 添加事件

```
明晚 7 点去图书馆
后天下午 3 点和朋友出去玩
提醒我下周一交作业
```

## 📁 目录结构

```
claw-calendar/
├── skill/
│   ├── SKILL.md              # 核心：提示词 + 工具定义
│   ├── config.json           # 配置
│   ├── tools/                # 底层工具库
│   │   ├── file-ops.js       # 文件读写
│   │   ├── date-math.js      # 日期计算
│   │   ├── ocr-wrapper.js    # OCR 调用
│   │   └── channel-notify.js # 多渠道推送
│   └── templates/            # 模板
├── scripts/
│   └── check-reminders.js    # 定时提醒脚本
└── docs/                     # 文档
```

## 🛠️ 架构设计

### Agentic Workflow

| 组件 | 技术 | 职责 |
|------|------|------|
| 意图识别 | LLM（提示词） | 理解用户自然语言 |
| 时间解析 | LLM + 工具 | 解析"明天下午 3 点" |
| 视图生成 | LLM（提示词） | 生成 Markdown 视图 |
| 文件读写 | JS 工具 | 精确读写 events.json |
| 日期计算 | JS 工具 | 周次计算、时间差 |
| 提醒调度 | OpenClaw cron | 定时触发检查 |

### 与旧版对比

| 功能 | 旧版 (calendar-assistant) | 新版 (claw-calendar) |
|------|--------------------------|---------------------|
| 意图识别 | 正则匹配（intent.js） | LLM 理解（SKILL.md） |
| 时间解析 | 硬编码规则 | LLM + 工具函数 |
| 视图渲染 | JS 模板（view.js） | LLM 生成（自然语言） |
| 提醒逻辑 | 自制轮询 | OpenClaw cron |
| 代码量 | ~800 行 JS | ~200 行工具 + 提示词 |

## 📊 数据格式

### 事件对象

```json
{
  "id": "evt-1775636984260-abc123",
  "type": "course|plan|reminder",
  "title": "事件标题",
  "priority": "high|medium|low",
  "schedule": {
    "kind": "weekly|once",
    "weekday": 1-7,
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "date": "YYYY-MM-DD",
    "weeks": "1-15",
    "weekRanges": [[1,15]]
  },
  "location": "地点",
  "reminderOffsets": [30, 1440],
  "active": true
}
```

### 存储位置

- `/root/.openclaw/workspace/calendar/events.json` - 事件数据
- `/root/.openclaw/workspace/calendar/settings.json` - 用户设置

## ⏰ 提醒配置

提醒通过 OpenClaw cron 定时触发：

```bash
# 创建 cron 任务（每 30 分钟检查）
openclaw cron add --schedule '*/30 * * * *' \
  --command 'node /root/.openclaw/workspace/claw-calendar/scripts/check-reminders.js'
```

## 📝 示例对话

### 查询日程
```
用户：今天有什么课？
助手：📅 2026-04-08 周三

    09:45 ⚡ 机器学习系统
          📍 G2-B403
    
    15:55 📌 新时代中国特色社会主义理论与实践
          📍 G3-115
    
    ────────
    今日共 2 个事件
```

### 添加计划
```
用户：明晚 7 点去图书馆
助手：✅ 已添加：
    
    📅 2026-04-09 19:00
    📝 去图书馆
    ⏰ 提前 30 分钟提醒
```

### 上传课表
```
用户：[上传图片]
助手：🔍 识别到 7 门课程：
    1. 机器学习系统 - 周二 09:45-12:10 @ G2-B403
    2. 工程硕士专业英语 - 周一 09:45-12:10 @ G3-115
    ...
    
    是否添加到日历？

用户：好的
助手：✅ 已添加 7 门课程！
```

## 🔧 开发

### 添加新工具

1. 在 `skill/tools/` 创建 JS 文件
2. 在 SKILL.md 中声明工具函数
3. 在提示词中描述调用方式

### 修改提示词

直接编辑 `skill/SKILL.md`，无需重启。

### 测试

```bash
# 测试 OCR 识别
node scripts/test-ocr.js path/to/image.jpg

# 测试提醒检查
node scripts/check-reminders.js
```

## 📄 License

MIT

## 🙏 致谢

基于 USTC calendar-assistant 重构，采用 Agentic Workflow 架构。
