# 🏗️ Claw Calendar 架构更新

**时间**: 2026-04-08 12:00 UTC  
**版本**: 2.1.0 → 2.2.0  
**状态**: ✅ 架构重构完成

---

## 🎯 架构变更

### 之前：LLM require() JS 模块

```markdown
## SKILL.md（旧版）

### 可用工具（内联脚本）

```javascript
const path = require('path');
const toolsDir = __dirname.replace('/skill', '/tools');
const { get_upcoming_reminders } = require(path.join(toolsDir, 'file-ops.js'));

const upcoming = get_upcoming_reminders(30);
```
```

**问题**：
- ❌ LLM 执行 JS 代码（不安全）
- ❌ 需要理解 `require()` 语法
- ❌ 路径计算复杂（`__dirname.replace(...)`）
- ❌ 难以调试和测试
- ❌ 无法复用 OpenClaw 工具系统

---

### 现在：OpenClaw 原生工具

```markdown
## SKILL.md（新版）

## 🛠️ 可用工具（OpenClaw 原生工具）

本 Skill 已注册以下 OpenClaw 原生工具，**直接使用工具名称调用**：

### 核心工具

| 工具名称 | 功能 | 参数 |
|----------|------|------|
| `calendar_get_reminders` | 获取即将发生的事件 | `advanceMinutes` (可选) |
| `calendar_read_events` | 读取所有事件 | 无 |
| `calendar_append_event` | 添加事件 | `event` |
| ... | ... | ... |

---

## 流程 5：定时提醒

当 Cron 触发时：

1. **调用工具** → `calendar_get_reminders(30)`
2. **分支处理**：
   - 返回 `[]` → 静默
   - 返回 `[...]` → 生成提醒
```

**优势**：
- ✅ LLM 直接使用工具名称
- ✅ 无需理解 JS 语法
- ✅ 平台管理工具调用
- ✅ 易于调试和监控
- ✅ 复用 OpenClaw 工具系统

---

## 📦 新增文件

### 1. `scripts/register-tools.js`

**功能**: 自动注册所有工具为 OpenClaw 原生工具

**使用**:
```bash
# 安装时自动调用
node scripts/register-tools.js

# 或手动调用
node scripts/register-tools.js --list
```

**注册的工具**:
```
✅ calendar_read_events
✅ calendar_write_events
✅ calendar_append_event
✅ calendar_delete_event
✅ calendar_read_settings
✅ calendar_write_settings
✅ calendar_get_reminders  ← 核心工具
✅ calendar_is_quiet_hours
✅ calendar_get_current_week
✅ calendar_parse_relative_time
✅ calendar_format_date
✅ calendar_format_time
✅ calendar_get_weekday_name
✅ calendar_parse_schedule_image
✅ calendar_courses_to_events
```

---

### 2. 修改 `scripts/install.js`

**新增步骤**:
```javascript
// 步骤 3: 注册工具
registerTools();

function registerTools() {
  exec('node scripts/register-tools.js');
}
```

---

### 3. 重写 `SKILL.md`

**删除**:
- ❌ 所有 `require()` 代码示例
- ❌ `const path = require('path')`
- ❌ `__dirname.replace('/skill', '/tools')`
- ❌ JS 函数调用示例

**新增**:
- ✅ 工具名称表格
- ✅ 工具调用示例（自然语言）
- ✅ 工具参数说明
- ✅ 返回值说明

---

## 🔄 工具调用对比

### 旧版（JS require）

```javascript
const path = require('path');
const toolsDir = __dirname.replace('/skill', '/tools');
const { get_upcoming_reminders } = require(path.join(toolsDir, 'file-ops.js'));

const upcoming = get_upcoming_reminders(30);

if (upcoming.length === 0) {
  return;
}
```

### 新版（OpenClaw 工具）

```
调用 calendar_get_reminders(30)

如果返回 []:
  静默结束

如果返回 [...]:
  生成提醒消息
```

---

## 📊 架构对比

| 维度 | 旧版 (require) | 新版 (原生工具) |
|------|----------------|-----------------|
| **代码复杂度** | JS require + 路径计算 | 直接调用工具名称 |
| **LLM 负担** | 理解 JS 语法 | 理解工具名称 |
| **安全性** | LLM 执行 JS 代码 | 平台调用工具 |
| **调试** | 难以追踪 | 平台日志 |
| **复用性** | 仅限本 Skill | 所有 Skill 可用 |
| **安装** | 手动配置 | 自动注册 |
| **维护** | 修改 SKILL.md | 修改工具脚本 |

---

## 🚀 安装流程

### 自动安装（推荐）

```bash
node scripts/install.js --force
```

**自动完成**:
1. ✅ 复制 Skill 到系统目录
2. ✅ 禁用旧版
3. ✅ **注册工具** ← 新增
4. ✅ 创建数据目录
5. ✅ 创建 cron 任务
6. ✅ 重启 Gateway

### 手动注册工具

```bash
node scripts/register-tools.js
```

**输出**:
```
🚀 开始注册 Claw Calendar 工具...

📦 模块：file-ops
  ✅ calendar_read_events
  ✅ calendar_write_events
  ✅ calendar_append_event
  ✅ calendar_delete_event
  ✅ calendar_get_reminders
  ...

✅ 注册完成！共注册 14 个工具
```

---

## 🧪 测试

### 测试工具注册

```bash
# 列出已注册工具
node scripts/register-tools.js --list
```

### 测试工具调用

```bash
# 测试 get_reminders
node -e "
const tools = require('./skill/tools/file-ops.js');
const upcoming = tools.get_upcoming_reminders(30);
console.log(upcoming);
"
```

### 测试 SKILL.md 流程

1. 上传课表图片
2. 查询"今天有什么课"
3. 添加"明晚 7 点去图书馆"
4. 等待 cron 触发（或手动触发）

---

## 📝 工具命名规范

### 命名规则

```
calendar_<功能>_<动作>
```

**示例**:
- `calendar_read_events` - 读取事件
- `calendar_append_event` - 添加事件
- `calendar_get_reminders` - 获取提醒
- `calendar_is_quiet_hours` - 检查静默时段

### 参数规范

**工具参数**:
- 使用自然语言参数名
- 可选参数标注 `(可选)`
- 默认值在文档中说明

**示例**:
```
calendar_get_reminders(advanceMinutes)

参数:
- advanceMinutes (可选): 提前多少分钟，默认 30

返回:
- [] 或 [{ event, minutesUntilEvent, ... }]
```

---

## 🎯 设计原则

### 1. 工具即服务

- 每个工具是一个独立功能
- 工具之间松耦合
- 可被其他 Skill 复用

### 2. LLM 专注核心

- LLM 负责：理解意图、生成回复
- 工具负责：精确计算、文件操作
- 不混用职责

### 3. 零配置

- 安装时自动注册
- 无需手动配置
- 开箱即用

### 4. 平台优先

- 复用 OpenClaw 工具系统
- 遵循平台规范
- 易于集成

---

## 🔮 未来扩展

### 工具市场

```
OpenClaw 工具市场：
  - calendar_* (本 Skill)
  - weather_* (天气 Skill)
  - github_* (GitHub Skill)
  - ...

其他 Skill 可以调用：
  calendar_get_reminders()
  weather_get_forecast()
  github_create_issue()
```

### 跨 Skill 协作

```
用户：明天有课吗？如果有，查一下天气

LLM:
  1. 调用 calendar_get_reminders(1440)
  2. 如果有课，调用 weather_get_forecast()
  3. 生成综合回复
```

---

**架构重构完成！** 🎉

---

*最后更新：2026-04-08 12:00 UTC*
