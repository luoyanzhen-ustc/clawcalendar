# ✅ Claw Calendar Skill 安装前检查清单

**日期**: 2026-04-08  
**版本**: 2.0.0

---

## 📦 文件完整性检查

### 核心文件

- [ ] `skill/SKILL.md` - 含 YAML frontmatter
- [ ] `skill/config.json` - 配置文件
- [ ] `skill/tools/file-ops.js` - 文件读写
- [ ] `skill/tools/date-math.js` - 日期计算
- [ ] `skill/tools/ocr-wrapper.js` - OCR 调用
- [ ] `skill/templates/events.json` - 事件模板
- [ ] `skill/templates/settings.json` - 设置模板
- [ ] `package.json` - npm 配置
- [ ] `scripts/install.js` - 安装脚本
- [ ] `scripts/auto-init.js` - 初始化脚本

**检查命令**:
```bash
ls -la /root/.openclaw/workspace/claw-calendar/skill/
ls -la /root/.openclaw/workspace/claw-calendar/skill/tools/
ls -la /root/.openclaw/workspace/claw-calendar/scripts/
```

---

## 📝 SKILL.md 检查

### YAML Frontmatter

- [ ] 包含 `name: claw-calendar`
- [ ] 包含 `description` 字段
- [ ] 描述清晰说明触发条件

**检查**:
```bash
head -5 /root/.openclaw/workspace/claw-calendar/skill/SKILL.md
```

**期望输出**:
```yaml
---
name: claw-calendar
description: "智能日历助手。当用户上传课表图片、询问日程..."
---
```

### 工具声明

- [ ] 工具函数声明为内联脚本
- [ ] 包含 `require()` 示例
- [ ] 说明调用方式

**检查**:
```bash
grep -A 5 "可用工具" /root/.openclaw/workspace/claw-calendar/skill/SKILL.md
```

### 定时任务说明

- [ ] 说明使用 OpenClaw cron
- [ ] 说明 cron 配置
- [ ] 说明工作流程

**检查**:
```bash
grep -A 10 "定时任务" /root/.openclaw/workspace/claw-calendar/skill/SKILL.md
```

---

## 🛠️ 工具函数检查

### file-ops.js

- [ ] 导出 `readEvents()`
- [ ] 导出 `writeEvents()`
- [ ] 导出 `appendEvent()`
- [ ] 导出 `deleteEvent()`
- [ ] 导出 `readSettings()`
- [ ] 导出 `writeSettings()`

**检查**:
```bash
grep "module.exports" /root/.openclaw/workspace/claw-calendar/skill/tools/file-ops.js
```

### date-math.js

- [ ] 导出 `getCurrentWeek()`
- [ ] 导出 `parseRelativeTime()`
- [ ] 导出 `formatDate()`
- [ ] 导出 `formatTime()`
- [ ] 导出 `getWeekdayName()`
- [ ] 导出 `isWithinWeekRanges()`

**检查**:
```bash
grep "module.exports" /root/.openclaw/workspace/claw-calendar/skill/tools/date-math.js
```

### ocr-wrapper.js

- [ ] 导出 `parseScheduleImage()`
- [ ] 导出 `coursesToEvents()`
- [ ] 包含 USTC_PERIOD_TIMES
- [ ] 包含 `applyUSTCRules()`

**检查**:
```bash
grep "module.exports" /root/.openclaw/workspace/claw-calendar/skill/tools/ocr-wrapper.js
```

---

## 📁 目录结构检查

### 源代码目录

```bash
tree /root/.openclaw/workspace/claw-calendar/ -L 2
```

**期望结构**:
```
claw-calendar/
├── package.json
├── skill/
│   ├── SKILL.md
│   ├── config.json
│   ├── tools/
│   └── templates/
├── scripts/
├── docs/
└── README.md
```

### 文档完整性

- [ ] `README.md`
- [ ] `INSTALL.md`
- [ ] `STRUCTURE.md`
- [ ] `READY_FOR_INSTALL.md`
- [ ] `FINAL_SUMMARY.md`
- [ ] `CHECKLIST.md` (本文件)

---

## 🔧 安装脚本检查

### install.js

- [ ] 复制 Skill 到系统目录
- [ ] 禁用旧版 Skill
- [ ] 创建数据目录
- [ ] 创建 cron 任务
- [ ] 重启 Gateway

**检查**:
```bash
grep -A 3 "function main" /root/.openclaw/workspace/claw-calendar/scripts/install.js
```

### auto-init.js

- [ ] 创建数据目录
- [ ] 创建默认 events.json
- [ ] 创建默认 settings.json

**检查**:
```bash
grep -A 3 "function main" /root/.openclaw/workspace/claw-calendar/scripts/auto-init.js
```

---

## 🚀 安装前准备

### 系统要求

- [ ] OpenClaw 已安装
- [ ] Node.js >= 18.0.0
- [ ] 有 sudo 权限（安装到系统目录）

**检查**:
```bash
node --version
openclaw --version
```

### 备份旧版

- [ ] 备份旧版数据（如有）
  ```bash
  cp -r /root/.openclaw/workspace/calendar \
        /root/.openclaw/workspace/calendar.backup
  ```

- [ ] 记录旧版 cron 任务
  ```bash
  openclaw cron list > cron-backup.txt
  ```

---

## 🧪 安装后测试

### 1. 检查 Skill 安装

```bash
ls -la /usr/lib/node_modules/openclaw/skills/claw-calendar/
```

**期望**: 看到 `SKILL.md`, `config.json`, `tools/`

### 2. 检查数据目录

```bash
ls -la /root/.openclaw/workspace/claw-calendar/data/
```

**期望**: 看到 `events.json`, `settings.json`

### 3. 检查 cron 任务

```bash
openclaw cron list
```

**期望**: 看到 `claw-calendar-remind`

### 4. 检查 Gateway 状态

```bash
openclaw gateway status
```

**期望**: `running`

### 5. 功能测试

- [ ] 上传课表图片 → 识别成功
- [ ] 查询"今天有什么课" → 正确显示
- [ ] 添加"明晚 7 点去图书馆" → 成功添加
- [ ] 设置学期开始日期 → 保存成功
- [ ] 等待 cron 触发 → 收到提醒

---

## ⚠️ 故障排查

### 问题 1: Skill 不触发

**检查**:
```bash
# 查看 Skill 是否存在
ls -la /usr/lib/node_modules/openclaw/skills/claw-calendar/

# 查看 Gateway 日志
tail -f /tmp/openclaw/openclaw-*.log | grep claw-calendar
```

**解决**:
```bash
openclaw gateway restart
```

### 问题 2: cron 任务不运行

**检查**:
```bash
openclaw cron list
openclaw cron runs claw-calendar-remind
```

**解决**:
```bash
# 删除并重新创建
openclaw cron remove claw-calendar-remind
openclaw cron add --schedule '*/30 * * * *' \
  --name 'claw-calendar-remind' \
  --payload '{"kind": "agentTurn", "message": "检查日历提醒"}'
```

### 问题 3: 数据文件不存在

**检查**:
```bash
ls -la /root/.openclaw/workspace/claw-calendar/data/
```

**解决**:
```bash
node /root/.openclaw/workspace/claw-calendar/scripts/auto-init.js
```

---

## ✅ 最终确认

- [ ] 所有文件已创建
- [ ] YAML frontmatter 已添加
- [ ] 工具函数内联声明
- [ ] 删除自制提醒脚本
- [ ] 安装脚本就绪
- [ ] 文档完整
- [ ] 已备份旧版数据
- [ ] 准备好安装

**签名**: _______________  
**日期**: 2026-04-08

---

**准备就绪！可以运行安装脚本了！** 🎉

```bash
cd /root/.openclaw/workspace/claw-calendar
node scripts/install.js --force
```
