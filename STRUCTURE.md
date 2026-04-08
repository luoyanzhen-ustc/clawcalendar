# Claw Calendar Skill 目录结构

## 完整结构

```
claw-calendar/
├── package.json              # ✅ npm 包配置（新增）
├── README.md                 # 项目说明
├── INSTALL.md                # ✅ 安装指南（新增）
├── STRUCTURE.md              # ✅ 本文件
├── REFACTOR_SUMMARY.md       # 重构总结
├── COMPLETED.md              # 完成报告
│
├── skill/                    # ✅ Skill 核心目录
│   ├── SKILL.md              # ✅ 核心提示词（含 YAML frontmatter）
│   ├── config.json           # ✅ 配置
│   ├── tools/
│   │   ├── file-ops.js       # ✅ 文件读写工具
│   │   ├── date-math.js      # ✅ 日期计算工具
│   │   └── ocr-wrapper.js    # ✅ OCR 调用封装
│   └── templates/
│       ├── events.json       # ✅ 事件模板
│       └── settings.json     # ✅ 设置模板
│
├── scripts/                  # ✅ 辅助脚本
│   ├── auto-init.js          # ✅ 自动初始化
│   ├── install.js            # ✅ 安装脚本（新增）
│   └── test-ocr.js           # （可选）OCR 测试
│
└── docs/                     # ✅ 文档
    ├── QUICKSTART.md         # ✅ 快速开始
    ├── MIGRATION.md          # ✅ 迁移指南
    └── FAQ.md                # （可选）常见问题
```

---

## 核心文件说明

### `skill/SKILL.md` (必需)

**作用**: Skill 的核心定义文件

**内容**:
- YAML frontmatter（name, description）
- 角色定位
- 工作流程
- 工具调用声明
- 数据 Schema
- 错误处理

**触发条件**:
- 用户上传课表图片
- 用户提到时间相关词汇（今天、明天、课、计划）
- 用户直接询问日程

---

### `package.json` (必需)

**作用**: npm 包配置，支持安装和管理

**关键字段**:
```json
{
  "name": "claw-calendar",
  "version": "2.0.0",
  "openclaw": {
    "type": "skill",
    "category": "productivity",
    "triggers": ["课表", "日程", "今天有什么课"],
    "cron": {
      "schedule": "*/30 * * * *",
      "message": "检查日历提醒"
    }
  }
}
```

---

### `skill/tools/*.js` (必需)

**作用**: 底层工具函数库

**文件**:
- `file-ops.js` - 文件读写
- `date-math.js` - 日期计算
- `ocr-wrapper.js` - OCR 调用

**调用方式**:
```javascript
const path = require('path');
const toolsDir = __dirname.replace('/skill', '/tools');
const { readEvents } = require(path.join(toolsDir, 'file-ops.js'));
```

---

### `skill/config.json` (必需)

**作用**: Skill 配置

**内容**:
```json
{
  "name": "claw-calendar",
  "timezone": "Asia/Shanghai",
  "ocr": { "provider": "qwen-chat", "enabled": true },
  "notify": { "channels": ["current"] }
}
```

---

### `scripts/install.js` (必需)

**作用**: 自动安装脚本

**功能**:
1. 复制 Skill 到系统目录
2. 禁用旧版 Skill
3. 创建数据目录
4. 创建 cron 任务
5. 重启 Gateway

**使用**:
```bash
node scripts/install.js --force
```

---

### `scripts/auto-init.js` (必需)

**作用**: 初始化数据目录

**功能**:
- 创建 `data/` 目录
- 创建默认 `events.json`
- 创建默认 `settings.json`

**使用**:
```bash
node scripts/auto-init.js
```

---

## 安装后的目录

### 系统 Skill 目录

```
/usr/lib/node_modules/openclaw/skills/claw-calendar/
├── SKILL.md
├── config.json
├── tools/
│   ├── file-ops.js
│   ├── date-math.js
│   └── ocr-wrapper.js
└── templates/
    ├── events.json
    └── settings.json
```

### 数据目录

```
/root/.openclaw/workspace/claw-calendar/data/
├── events.json           # 事件数据
└── settings.json         # 用户设置
```

---

## Cron 任务

安装时自动创建：

```bash
openclaw cron add \
  --schedule '*/30 * * * *' \
  --name 'claw-calendar-remind' \
  --payload '{"kind": "agentTurn", "message": "检查日历提醒"}'
```

**查看任务**:
```bash
openclaw cron list
```

**删除任务**:
```bash
openclaw cron remove claw-calendar-remind
```

---

## 数据流

```
用户输入
    ↓
[触发 Skill]
    ↓
LLM 理解意图
    ↓
调用工具函数
    ↓
读写 data/ 目录
    ↓
生成回复
    ↓
用户看到结果
```

---

## 关键设计决策

### 1. 工具函数内联

**决策**: 所有工具函数都在 `tools/` 目录中，通过 `require()` 调用

**理由**:
- 保持 Skill 自包含
- 易于调试和测试
- 不依赖外部工具注册

### 2. 数据目录独立

**决策**: 数据存储在 `/root/.openclaw/workspace/claw-calendar/data/`

**理由**:
- 与 Skill 代码分离
- 易于备份和迁移
- 避免系统更新覆盖

### 3. 使用 OpenClaw Cron

**决策**: 不自制轮询脚本，使用 OpenClaw 原生 cron

**理由**:
- 复用平台能力
- 更可靠（平台管理）
- 易于调试（查看 cron 日志）

### 4. 提示词驱动

**决策**: 核心逻辑在 SKILL.md 中用自然语言描述

**理由**:
- 易于理解和修改
- 无需重启即可更新
- 支持复杂场景描述

---

*最后更新：2026-04-08*
