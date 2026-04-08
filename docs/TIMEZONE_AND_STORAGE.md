# 🕐 时区协调与分层存储指南

**版本**: 2.3.0  
**更新时间**: 2026-04-08

---

## 📍 时区协调策略

### 核心原则

> **存储统一 UTC，展示默认北京时间**

### 时间处理流程

#### 1. 用户输入 → UTC 存储

```
用户："明天早上 9 点开会"
    ↓
LLM 解析：
  - displayDate: "2026-04-09"
  - displayTime: "09:00"
  - displayTimezone: "Asia/Shanghai"
    ↓
转换为 UTC：
  - utcStart: "2026-04-09T01:00:00Z"
    ↓
存储：
{
  "schedule": {
    "displayDate": "2026-04-09",
    "displayTime": "09:00",
    "displayTimezone": "Asia/Shanghai",
    "utcStart": "2026-04-09T01:00:00Z"
  }
}
```

#### 2. UTC 存储 → 北京时间展示

```
读取事件：
  - utcStart: "2026-04-09T01:00:00Z"
    ↓
转换为北京时间：
  - date: "2026-04-09"
  - time: "09:00"
  - timezone: "Asia/Shanghai"
    ↓
展示：
"明天 09:00 开会"
```

### 工具函数

#### `calendar_to_utc(date, time, timezone)`

**功能**: 将本地时间转换为 UTC

**输入**:
```javascript
{
  date: "2026-04-09",
  time: "09:00",
  timezone: "Asia/Shanghai"
}
```

**输出**:
```javascript
"2026-04-09T01:00:00Z"
```

---

#### `calendar_to_local(utcString, targetTimezone)`

**功能**: 将 UTC 转换为本地时间展示

**输入**:
```javascript
{
  utcString: "2026-04-09T01:00:00Z",
  targetTimezone: "Asia/Shanghai"
}
```

**输出**:
```javascript
{
  date: "2026-04-09",
  time: "09:00",
  timezone: "Asia/Shanghai"
}
```

---

## 📚 分层存储架构

### 目录结构

```
claw-calendar/
├── data/
│   ├── active/              # 活跃层（当前学期）
│   │   ├── courses.json     # 本学期课程
│   │   ├── recurring.json   # 周期事件
│   │   ├── plans.json       # 临时事件（当前周 + 未来）
│   │   └── metadata.json    # 学期元数据
│   │
│   ├── archive/             # 归档层（按学期）
│   │   └── 2026-spring/
│   │       ├── weekly/      # 周总结
│   │       │   ├── week-1.json
│   │       │   └── ...
│   │       ├── plans/       # 已归档计划
│   │       │   ├── week-1.json
│   │       │   └── ...
│   │       ├── courses.json
│   │       ├── recurring.json
│   │       └── summary.json
│   │
│   └── index/               # 索引层
│       ├── today.json       # 今天的事件
│       └── upcoming.json    # 未来 7 天事件
│
└── settings.json
```

---

### 各层职责

#### 1. 活跃层（active/）

**用途**: 存储当前学期高频访问的数据

**文件**:
- `courses.json`: 本学期课程表（稳定，只读）
- `recurring.json`: 周期事件（如每周组会）
- `plans.json`: 临时事件（动态变化）
- `metadata.json`: 学期元数据

**特点**:
- ✅ 高频访问
- ✅ 当前学期数据
- ✅ 每周清理过期计划

---

#### 2. 归档层（archive/）

**用途**: 存储历史学期数据（只读）

**结构**:
```
archive/2026-spring/
├── weekly/        # 每周总结（每周一生成）
├── plans/         # 已归档计划（按周）
├── courses.json   # 课程表（学期末归档）
├── recurring.json # 周期事件（学期末归档）
└── summary.json   # 学期总结
```

**触发时机**:
- **周总结**: 每周一凌晨自动生成
- **计划归档**: 每周一移动上周计划
- **学期归档**: 学期末统一打包

---

#### 3. 索引层（index/）

**用途**: 预计算视图，支持毫秒级查询

**文件**:
- `today.json`: 今天的事件（每天凌晨 2 点重建）
- `upcoming.json`: 未来 7 天事件（每天凌晨 2 点重建）

**查询示例**:
```javascript
// 查询"今天有什么课"
const today = readTodayIndex();  // O(1)

// 查询"未来 7 天安排"
const upcoming = readUpcomingIndex();  // O(1)
```

---

## 🔄 归档流程

### 周归档（每周一凌晨 0:00）

**步骤**:
1. 生成上周总结（`weekly/week-N.json`）
2. 移动上周计划到归档区（`plans/week-N.json`）
3. 从 `active/plans.json` 删除已归档计划
4. 更新 `metadata.json` 中的统计快照

**代码示例**:
```javascript
const { archiveLastWeekPlans, generateWeeklyReport } = 
  require('./tools/archive-ops.js');

// 生成周总结
const report = generateWeeklyReport(lastWeek);
writeFileSync(`archive/2026-spring/weekly/week-${lastWeek}.json`, report);

// 归档上周计划
archiveLastWeekPlans();
```

---

### 学期归档（学期末手动触发）

**步骤**:
1. 移动 `active/courses.json` → `archive/{semester}/courses.json`
2. 移动 `active/recurring.json` → `archive/{semester}/recurring.json`
3. 移动剩余计划 → `archive/{semester}/plans.json`
4. 生成学期总结（聚合所有周总结）
5. 清空 `active/`，创建新学期

**代码示例**:
```javascript
const { archiveSemester } = require('./tools/archive-ops.js');

archiveSemester('2026-spring');
```

---

## 📊 事件状态管理

### 状态机

```
active (活跃)
  ↓
completed (完成)  ← 用户确认完成
cancelled (取消)  ← 用户取消
expired (过期)    ← 自动标记（date < 今天）
```

### 字段设计

```json
{
  "lifecycle": {
    "status": "active",
    "completedAt": null,
    "cancelledAt": null,
    "cancelReason": null,
    "expiredAt": null
  }
}
```

### 状态转换

**完成**:
```javascript
plan.lifecycle.status = 'completed';
plan.lifecycle.completedAt = new Date().toISOString();
```

**取消**:
```javascript
plan.lifecycle.status = 'cancelled';
plan.lifecycle.cancelledAt = new Date().toISOString();
plan.lifecycle.cancelReason = '用户取消';
```

**过期**（自动）:
```javascript
// 每天凌晨检查
if (plan.schedule.displayDate < today && plan.lifecycle.status === 'active') {
  plan.lifecycle.status = 'expired';
  plan.lifecycle.expiredAt = new Date().toISOString();
}
```

---

## 🎯 最佳实践

### 1. 时区处理

✅ **正确**:
```javascript
// 存储时转换为 UTC
const utcStart = toUTC("2026-04-09", "09:00", "Asia/Shanghai");

// 展示时转换为本地时间
const local = toLocal(utcStart, "Asia/Shanghai");
// { date: "2026-04-09", time: "09:00" }
```

❌ **错误**:
```javascript
// 直接存储本地时间字符串（无法排序）
{ "time": "09:00" }

// 混合时区（混乱）
{ "utcStart": "...", "timezone": "America/New_York" }
```

---

### 2. 分层存储

✅ **正确**:
```javascript
// 查询今天：直接读索引
const today = readTodayIndex();

// 查询历史：读归档
const weekReport = readFileSync('archive/2026-spring/weekly/week-5.json');
```

❌ **错误**:
```javascript
// 遍历所有事件（慢）
const allPlans = readPlans();
const today = allPlans.filter(p => p.date === today);
```

---

### 3. 归档时机

✅ **正确**:
- 周总结：每周一自动生成
- 计划归档：每周一移动上周
- 学期归档：学期末手动触发

❌ **错误**:
- 每天都归档（过度 I/O）
- 学期中归档课程表（数据还在用）
- 不生成周总结（丢失历史）

---

## 📝 总结

### 时区协调

| 环节 | 策略 |
|------|------|
| **存储** | UTC 时间戳 |
| **元数据** | 记录原始时区（Asia/Shanghai） |
| **展示** | 转换为北京时间 |
| **计算** | 统一使用 UTC |

### 分层存储

| 层级 | 内容 | 更新频率 |
|------|------|----------|
| **active** | 当前学期数据 | 实时 |
| **archive** | 历史学期数据 | 每周 + 学期末 |
| **index** | 预计算视图 | 每天凌晨 |

### 事件状态

| 状态 | 触发条件 | 清理时机 |
|------|----------|----------|
| **active** | 新创建 | - |
| **completed** | 用户确认 | 周归档 |
| **cancelled** | 用户取消 | 周归档 |
| **expired** | 日期 < 今天 | 每天凌晨自动 |

---

*最后更新：2026-04-08*
