# 🕐 Cron 配置指南

**版本**: 2.3.0  
**更新时间**: 2026-04-08

---

## 📋 Cron 任务列表

### 每日任务

| 时间 | 任务 | 脚本 | 功能 |
|------|------|------|------|
| 02:00 | `daily-task` | `scripts/daily-task.js` | 重建索引、清理过期事件 |

### 每周任务

| 时间 | 任务 | 脚本 | 功能 |
|------|------|------|------|
| 周一 00:00 | `weekly-task` | `scripts/weekly-task.js` | 生成周总结、归档上周计划 |

---

## 🔧 配置步骤

### 1. 安装 OpenClaw Cron

```bash
openclaw cron add --schedule '0 2 * * *' \
  --name 'claw-calendar-daily' \
  --payload '{"kind": "systemEvent", "text": "node /root/.openclaw/workspace/claw-calendar/skill/scripts/daily-task.js"}'
```

### 2. 配置每周任务

```bash
openclaw cron add --schedule '0 0 * * 1' \
  --name 'claw-calendar-weekly' \
  --payload '{"kind": "systemEvent", "text": "node /root/.openclaw/workspace/claw-calendar/skill/scripts/weekly-task.js"}'
```

### 3. 验证配置

```bash
openclaw cron list
```

---

## 📝 任务说明

### 每日任务（02:00）

**执行内容**:
1. 重建 `today.json` 索引
2. 重建 `upcoming.json` 索引（未来 7 天）
3. 清理过期事件（标记为 `expired`）
4. 更新课程周次

**日志输出**:
```
🔄 开始重建索引...
✅ 重建 today.json
✅ 重建 upcoming.json
🧹 清理了 3 个过期事件
📅 进入第 7 周
✅ 索引重建完成
```

---

### 每周任务（周一 00:00）

**执行内容**:
1. 生成上周总结（`weekly/week-N.json`）
2. 归档上周计划（移动到 `archive/plans/week-N.json`）
3. 从 `active/plans.json` 删除已归档计划

**日志输出**:
```
📅 每周定时任务启动
⏰ 时间：2026-04-08T00:00:00.000Z

📊 生成第 5 周总结...
✅ 生成周总结：/root/.openclaw/workspace/claw-calendar/data/archive/2026-spring/weekly/week-5.json
   - 总事件数：18
   - 完成率：89%

📦 归档上周计划...
✅ 归档上周 12 个计划

✅ 每周任务完成
```

---

## 🚨 故障处理

### 任务未执行

**检查**:
```bash
openclaw cron status
openclaw cron runs --name 'claw-calendar-daily'
```

**手动触发**:
```bash
openclaw cron run --name 'claw-calendar-daily'
```

---

### 索引重建失败

**症状**: `today.json` 或 `upcoming.json` 不存在

**解决**:
```bash
node /root/.openclaw/workspace/claw-calendar/skill/tools/rebuild-index.js
```

---

### 归档失败

**症状**: 周总结未生成

**检查**:
1. 确认 `metadata.json` 中的 `currentWeek` 正确
2. 确认 `weekMapping` 存在
3. 手动运行周任务：
   ```bash
   node /root/.openclaw/workspace/claw-calendar/skill/scripts/weekly-task.js
   ```

---

## 📊 监控建议

### 1. 日志记录

在 `daily-task.js` 和 `weekly-task.js` 中添加日志：

```javascript
const logFile = '/root/.openclaw/workspace/claw-calendar/logs/daily.log';
fs.appendFileSync(logFile, `${new Date().toISOString()} - Task completed\n`);
```

### 2. 健康检查

每天检查索引文件是否存在：

```bash
ls -la /root/.openclaw/workspace/claw-calendar/data/index/
```

### 3. 归档验证

每周检查归档目录：

```bash
ls -la /root/.openclaw/workspace/claw-calendar/data/archive/2026-spring/weekly/
```

---

## 🎯 最佳实践

### 1. 时区配置

确保 Cron 使用正确时区（Asia/Shanghai）：

```json
{
  "schedule": {
    "kind": "cron",
    "expr": "0 2 * * *",
    "tz": "Asia/Shanghai"
  }
}
```

### 2. 错误处理

所有脚本都应包含 `try-catch`：

```javascript
try {
  main();
} catch (error) {
  console.error('任务失败:', error.message);
  process.exit(1);
}
```

### 3. 幂等性

确保任务可重复执行：

```javascript
// 检查是否已执行
if (alreadyRunToday()) {
  console.log('今日任务已完成，跳过');
  process.exit(0);
}
```

---

*最后更新：2026-04-08*
