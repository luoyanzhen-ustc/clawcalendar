# Claw Calendar Skill 安装指南

## 📦 安装方式

### 方式 1：自动安装（推荐）

```bash
cd /root/.openclaw/workspace/claw-calendar
node scripts/install.js --force
```

**自动完成**：
- ✅ 复制 Skill 到系统目录
- ✅ 禁用旧版 calendar-assistant
- ✅ 创建数据目录
- ✅ 创建 cron 定时任务
- ✅ 重启 Gateway

### 方式 2：手动安装

#### 步骤 1：复制 Skill 文件

```bash
sudo cp -r /root/.openclaw/workspace/claw-calendar/skill \
         /usr/lib/node_modules/openclaw/skills/claw-calendar
```

#### 步骤 2：禁用旧版（如果存在）

```bash
sudo mv /usr/lib/node_modules/openclaw/skills/calendar-assistant \
        /usr/lib/node_modules/openclaw/skills/calendar-assistant.disabled
```

#### 步骤 3：创建数据目录

```bash
mkdir -p /root/.openclaw/workspace/claw-calendar/data
```

#### 步骤 4：创建默认配置文件

```bash
cat > /root/.openclaw/workspace/claw-calendar/data/settings.json << 'EOF'
{
  "timezone": "Asia/Shanghai",
  "semesterStart": null,
  "notify": {
    "channels": ["current"]
  }
}
EOF
```

```bash
cat > /root/.openclaw/workspace/claw-calendar/data/events.json << 'EOF'
{
  "version": 1,
  "events": [],
  "metadata": {
    "createdAt": "2026-04-08T00:00:00.000Z",
    "timezone": "Asia/Shanghai"
  }
}
EOF
```

#### 步骤 5：创建 cron 定时任务

```bash
openclaw cron add \
  --schedule '*/30 * * * *' \
  --name 'claw-calendar-remind' \
  --payload '{"kind": "agentTurn", "message": "检查日历提醒，如果有即将发生的事件（30 分钟内），发送提醒消息。"}'
```

#### 步骤 6：重启 Gateway

```bash
openclaw gateway restart
```

---

## 🧪 测试安装

### 测试 1：检查 Skill 是否安装

```bash
ls -la /usr/lib/node_modules/openclaw/skills/claw-calendar/
```

应该看到：
- `SKILL.md`
- `config.json`
- `tools/`
- `templates/`

### 测试 2：触发 Skill

1. **上传课表图片**
   - 直接上传课表截图
   - 应该自动识别并询问是否添加

2. **查询日程**
   ```
   今天有什么课？
   ```

3. **添加事件**
   ```
   明晚 7 点去图书馆
   ```

### 测试 3：检查 cron 任务

```bash
openclaw cron list
```

应该看到 `claw-calendar-remind` 任务。

---

## 📊 目录结构

安装后的目录结构：

```
/usr/lib/node_modules/openclaw/skills/claw-calendar/
├── SKILL.md              # 核心提示词
├── config.json           # 配置
├── tools/
│   ├── file-ops.js       # 文件读写
│   ├── date-math.js      # 日期计算
│   └── ocr-wrapper.js    # OCR 调用
└── templates/
    ├── events.json       # 事件模板
    └── settings.json     # 设置模板

/root/.openclaw/workspace/claw-calendar/data/
├── events.json           # 事件数据
└── settings.json         # 用户设置
```

---

## 🔧 配置说明

### 设置学期开始日期

首次使用时，设置学期开始日期：

**方法 1：自然语言**
```
我的这学期是 3 月 1 号开始的
```

**方法 2：手动编辑**
```bash
cat > /root/.openclaw/workspace/claw-calendar/data/settings.json << 'EOF'
{
  "timezone": "Asia/Shanghai",
  "semesterStart": "2026-03-01",
  "notify": {
    "channels": ["current"]
  }
}
EOF
```

### 自定义提醒频率

默认每 30 分钟检查一次，修改 cron 表达式：

```bash
# 每 15 分钟
openclaw cron update claw-calendar-remind --schedule '*/15 * * * *'

# 每 1 小时
openclaw cron update claw-calendar-remind --schedule '0 * * * *'

# 每天 8 点
openclaw cron update claw-calendar-remind --schedule '0 8 * * *'
```

---

## 🚫 卸载

### 步骤 1：删除 cron 任务

```bash
openclaw cron remove claw-calendar-remind
```

### 步骤 2：删除 Skill

```bash
sudo rm -rf /usr/lib/node_modules/openclaw/skills/claw-calendar
```

### 步骤 3：恢复旧版（如果需要）

```bash
sudo mv /usr/lib/node_modules/openclaw/skills/calendar-assistant.disabled \
        /usr/lib/node_modules/openclaw/skills/calendar-assistant
```

### 步骤 4：删除数据（可选）

```bash
rm -rf /root/.openclaw/workspace/claw-calendar/data
```

### 步骤 5：重启 Gateway

```bash
openclaw gateway restart
```

---

## 🐛 故障排查

### 问题 1：Skill 不触发

**检查**：
```bash
# 查看 Skill 是否存在
ls -la /usr/lib/node_modules/openclaw/skills/claw-calendar/

# 查看 Gateway 日志
tail -f /tmp/openclaw/openclaw-*.log | grep claw-calendar
```

**解决**：
```bash
openclaw gateway restart
```

### 问题 2：cron 任务不运行

**检查**：
```bash
openclaw cron list
openclaw cron runs claw-calendar-remind
```

**解决**：
```bash
# 删除并重新创建
openclaw cron remove claw-calendar-remind
openclaw cron add --schedule '*/30 * * * *' --name 'claw-calendar-remind' --payload '{"kind": "agentTurn", "message": "检查日历提醒"}'
```

### 问题 3：数据文件不存在

**检查**：
```bash
ls -la /root/.openclaw/workspace/claw-calendar/data/
```

**解决**：
```bash
node /root/.openclaw/workspace/claw-calendar/scripts/install.js
```

---

## 📞 获取帮助

- **文档**: `/root/.openclaw/workspace/claw-calendar/README.md`
- **FAQ**: `/root/.openclaw/workspace/claw-calendar/docs/FAQ.md`
- **GitHub**: https://github.com/luoyanzhen-ustc/USTCclaw-calendar

---

*最后更新：2026-04-08*
