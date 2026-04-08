# Claw Calendar 重构总结

**完成时间**: 2026-04-08  
**重构目标**: 从硬编码 JS → Agentic Workflow（提示词即代码）

---

## 📊 重构成果

### 代码对比

| 指标 | 旧版 (calendar-assistant) | 新版 (claw-calendar) | 变化 |
|------|--------------------------|---------------------|------|
| **JS 代码行数** | ~800 行 | ~200 行 | -75% |
| **SKILL.md** | 3.7 KB（混合逻辑） | 5.0 KB（纯提示词） | +35% |
| **工具文件** | 7 个脚本 | 4 个工具库 | 职责更清晰 |
| **配置文件** | config.json | config.json | 保持不变 |

### 架构变化

```
旧版架构：
┌─────────────────────────────────────┐
│  SKILL.md (混合业务逻辑)            │
│  ├── 意图识别规则（硬编码）         │
│  ├── 视图模板（硬编码）             │
│  └── 调用 JS 脚本                    │
├─────────────────────────────────────┤
│  intent.js (正则匹配)               │
│  parse-image.js (OCR+ 规则)          │
│  view.js (视图渲染)                 │
│  check-reminders.js (轮询)          │
└─────────────────────────────────────┘

新版架构：
┌─────────────────────────────────────┐
│  SKILL.md (纯提示词)                │
│  ├── 角色定位                       │
│  ├── 工作流程（自然语言描述）       │
│  ├── 视图模板（自然语言描述）       │
│  └── 工具函数声明                   │
├─────────────────────────────────────┤
│  tools/ (底层工具库)                │
│  ├── file-ops.js (文件读写)         │
│  ├── date-math.js (日期计算)        │
│  ├── ocr-wrapper.js (OCR 调用)       │
│  └── channel-notify.js (推送)       │
├─────────────────────────────────────┤
│  scripts/ (定时脚本)                │
│  └── check-reminders.js (cron 触发)  │
└─────────────────────────────────────┘
```

---

## 🎯 核心改进

### 1. 意图识别：正则 → LLM

**旧版** (`intent.js`):
```javascript
const intentPatterns = [
  { pattern: /今天 | 今天 | 今早有 (.*) 课/, intent: 'query_today' },
  { pattern: /明天 | 明晚 | 明天 (.*) 安排/, intent: 'query_tomorrow' },
  // ... 20+ 正则规则
];
```

**新版** (SKILL.md):
```markdown
### 流程 2：查询日程

1. **理解意图** → 识别查询目标（今天/明天/特定日期）
2. **解析时间** → `parse_relative_time()` 获取目标日期
3. **读取事件** → `read_events()`
...
```

**优势**：
- ✅ 支持复杂表达（"这周有什么安排"、"后天下午有空吗"）
- ✅ 无需维护正则规则
- ✅ 自动处理同义词、口语化表达

---

### 2. 时间解析：硬编码 → LLM + 工具

**旧版**:
```javascript
function parseTimeExpression(text) {
  if (/今天 | 今天/.test(text)) {
    result.date = new Date(now);
  } else if (/明天 | 明晚/.test(text)) {
    result.date = new Date(now);
    result.date.setDate(result.date.getDate() + 1);
  }
  // ... 50+ 行规则
}
```

**新版**:
```javascript
// date-math.js
function parseRelativeTime(text, baseDate = new Date()) {
  // LLM 先理解意图，再调用工具精确计算
  // 支持"明天下午 3 点"、"下周三"、"后天晚上"等
}
```

**优势**：
- ✅ 支持更复杂的自然语言
- ✅ 代码更简洁
- ✅ 易于扩展（添加新表达）

---

### 3. 视图渲染：JS 模板 → 自然语言描述

**旧版** (`view.js`):
```javascript
function formatDayView(events, date) {
  let output = `📅 ${dateStr} ${dayName}\n\n`;
  for (const event of events) {
    output += `${event.schedule.startTime} ${emoji} ${event.title}\n`;
    // ... 30+ 行格式化逻辑
  }
  return output;
}
```

**新版** (SKILL.md):
```markdown
**视图模板**：
```
📅 2026-04-08 周三

09:45 ⚡ 机器学习系统
      📍 G2-B403
      
────────
今日共 2 个事件
```
```

**优势**：
- ✅ 模板即用，无需代码
- ✅ 易于定制（改提示词即可）
- ✅ LLM 自动处理边界情况

---

### 4. 提醒调度：自制轮询 → OpenClaw Cron

**旧版**:
```javascript
// 每 30 分钟轮询检查
setInterval(checkReminders, 30 * 60 * 1000);
```

**新版**:
```bash
# 使用 OpenClaw cron
openclaw cron add --schedule '*/30 * * * *' \
  --command 'node check-reminders.js'
```

**优势**：
- ✅ 复用平台能力
- ✅ 更可靠（平台管理）
- ✅ 易于调试（查看 cron 日志）

---

## 📁 文件清单

### 新增文件

```
claw-calendar/
├── skill/
│   ├── SKILL.md              # ✅ 核心：提示词驱动
│   ├── config.json           # ✅ 配置
│   ├── tools/
│   │   ├── file-ops.js       # ✅ 文件读写
│   │   ├── date-math.js      # ✅ 日期计算
│   │   └── ocr-wrapper.js    # ✅ OCR 调用
│   └── templates/
│       ├── events.json       # ✅ 事件模板
│       └── settings.json     # ✅ 设置模板
├── scripts/
│   ├── check-reminders.js    # ✅ 定时提醒
│   └── auto-init.js          # ✅ 自动初始化
└── docs/
    ├── QUICKSTART.md         # ✅ 快速开始
    ├── MIGRATION.md          # ✅ 迁移指南
    └── REFACTOR_SUMMARY.md   # ✅ 重构总结
```

### 删除文件（旧版）

```
calendar-assistant/skill/scripts/
├── intent.js                 # ❌ 删除：改为 LLM 理解
├── view.js                   # ❌ 删除：改为自然语言描述
└── parse-image.js            # ❌ 删除：逻辑拆分到 ocr-wrapper.js
```

---

## 🧪 测试状态

### 已完成测试

- [x] 目录结构创建
- [x] 工具函数编写
- [x] SKILL.md 编写
- [x] 初始化脚本运行
- [x] 配置文件创建

### 待测试

- [ ] 上传课表图片 → OCR 识别
- [ ] 自然语言查询 → 意图识别
- [ ] 添加事件 → 写入文件
- [ ] 提醒触发 → cron 运行
- [ ] 视图生成 → Markdown 格式

---

## 🚀 下一步

### 立即可用

1. **设置学期开始日期**
   ```
   我的这学期是 3 月 1 号开始的
   ```

2. **上传课表图片**
   - 直接上传课表截图
   - 自动识别并添加

3. **开始使用**
   ```
   今天有什么课？
   明晚 7 点去图书馆
   这周安排
   ```

### 后续优化

1. **添加测试用例**
   - 单元测试（工具函数）
   - 集成测试（完整流程）

2. **添加多渠道推送**
   - QQ 推送
   - 微信推送

3. **性能优化**
   - 缓存事件数据
   - 增量更新

---

## 📝 设计原则

### 1. 提示词即代码

核心业务逻辑用自然语言描述，存放在 SKILL.md 中。

**好处**：
- 易于理解和修改
- 无需重启即可更新
- 支持复杂场景描述

### 2. 工具函数最小化

JS 工具只负责：
- 精确计算（日期、周次）
- 文件读写
- 外部 API 调用

**好处**：
- 职责清晰
- 易于测试
- 可复用

### 3. 复用平台能力

优先使用 OpenClaw 内置功能：
- 文件读写 → `read`/`write` 工具
- 消息发送 → `message` 工具
- 定时任务 → `cron` 工具
- 图片识别 → 多模态模型

**好处**：
- 减少自制轮子
- 更稳定可靠
- 易于维护

---

## 🎓 学习要点

### Agentic Workflow 核心

1. **LLM 负责理解** → 意图、时间、视图
2. **工具负责执行** → 读写、计算、调用
3. **提示词驱动** → 逻辑在 SKILL.md 中

### 与传统 Skill 对比

| 传统 Skill | Agentic Workflow |
|-----------|------------------|
| 硬编码规则 | 自然语言描述 |
| 正则匹配 | LLM 理解 |
| JS 模板 | 提示词生成 |
| 改代码 → 重启 | 改提示词 → 即时生效 |

---

*重构完成！🎉*
