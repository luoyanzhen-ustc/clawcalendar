# 🛠️ 取消 vs 删除 - 工具使用指南

**版本**: 2.3.1  
**更新时间**: 2026-04-08

---

## 📋 核心区别

| 操作 | 工具 | 行为 | 归档 | 使用场景 |
|------|------|------|------|----------|
| **取消** | `calendar_cancel_plan` | 标记为 `cancelled` | ✅ 移动到归档区 | 用户主动取消计划 |
| **删除** | `calendar_delete_plan` | 直接从文件移除 | ❌ 不保留 | 错误数据、测试清理 |

---

## 🎯 使用场景

### 场景 1：用户取消计划

**用户输入**:
```
"取消明天的图书馆计划"
"我不去健身了"
"把周日的聚会取消吧"
```

**LLM 操作**:
```javascript
// 调用取消工具
calendar_cancel_plan(planId, reason);

// 示例参数
{
  planId: "plan-library-0409",
  reason: "用户取消"  // 或从对话中提取："临时有事"、"下雨"、"身体不适"
}
```

**返回**:
```json
{
  "success": true,
  "archived": true,
  "plan": {
    "id": "plan-library-0409",
    "title": "图书馆学习",
    "lifecycle": {
      "status": "cancelled",
      "cancelledAt": "2026-04-08T14:00:00Z",
      "cancelReason": "用户取消"
    }
  }
}
```

**用户回复**:
```
✅ 已取消明天的图书馆计划。

📝 取消原因已记录（如有需要可查询历史记录）
```

---

### 场景 2：删除错误数据

**用户输入**:
```
"我刚才误操作创建了一个计划，帮我删掉"
"删除那个测试事件"
```

**LLM 操作**:
```javascript
// 调用删除工具
calendar_delete_plan(planId);

// 示例参数
{
  planId: "plan-test-12345"
}
```

**返回**:
```json
{
  "success": true,
  "archived": false
}
```

**用户回复**:
```
✅ 已删除该事件（不保留历史）
```

---

## 📊 数据流向

### 取消事件流程

```
active/plans.json (active)
    ↓
用户取消
    ↓
标记为 cancelled + 记录原因
    ↓
移动到 archive/plans/week-N.json
    ↓
从 active/plans.json 删除
    ↓
用户看到"已取消"
```

**归档数据**:
```json
{
  "week": 6,
  "plans": [
    {
      "id": "plan-library-0409",
      "title": "图书馆学习",
      "schedule": {
        "displayDate": "2026-04-09",
        "displayTime": "14:00"
      },
      "lifecycle": {
        "status": "cancelled",
        "cancelledAt": "2026-04-08T14:00:00Z",
        "cancelReason": "用户取消"
      }
    }
  ],
  "stats": {
    "totalPlans": 5,
    "completed": 3,
    "cancelled": 1,
    "expired": 1,
    "completionRate": 0.60,
    "cancelRate": 0.20
  }
}
```

---

### 删除事件流程

```
active/plans.json
    ↓
用户要求删除
    ↓
直接从文件移除
    ↓
数据永久消失
    ↓
用户看到"已删除"
```

**无归档数据**。

---

## 🔍 查询历史

### 查询"我取消了哪些计划"

**LLM 操作**:
```javascript
// 1. 读取归档文件
const weekFiles = fs.readdirSync('archive/2026-spring/plans/');

// 2. 过滤 cancelled 事件
const cancelledPlans = [];
weekFiles.forEach(file => {
  const weekData = JSON.parse(fs.readFileSync(file));
  const cancelled = weekData.plans.filter(p => 
    p.lifecycle?.status === 'cancelled'
  );
  cancelledPlans.push(...cancelled);
});

// 3. 生成回答
```

**回复示例**:
```
📋 本学期你取消了 5 个计划：

1. 图书馆学习 (4 月 9 日) - 原因：用户取消
2. 健身房 (4 月 12 日) - 原因：下雨
3. 和朋友吃饭 (4 月 15 日) - 原因：临时有事
4. 图书馆学习 (4 月 18 日) - 原因：身体不适
5. 晨跑 (4 月 20 日) - 原因：起不来

💡 分析：
- 你取消了 2 次图书馆学习
- 天气是你取消计划的主要原因（2 次）
- 建议：下雨天安排室内备选方案
```

---

### 查询"完成率统计"

**LLM 操作**:
```javascript
// 读取学期总结
const summary = JSON.parse(
  fs.readFileSync('archive/2026-spring/summary.json')
);

// 提取统计
const { completed, cancelled, expired, completionRate, cancelRate } = 
  summary.stats;
```

**回复示例**:
```
📊 2026 春季学期统计：

总计划：48 个
- ✅ 完成：35 个 (73%)
- ❌ 取消：8 个 (17%)
- ⏰ 过期：5 个 (10%)

完成率：73%
取消率：17%

💡 亮点：完成率高于上学期（65%）
⚠️  注意：你取消了 8 个计划，其中 5 个是健身相关
```

---

## 🛠️ 工具参数详解

### `calendar_cancel_plan`

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `planId` | string | ✅ | 事件 ID |
| `reason` | string | ❌ | 取消原因（默认："用户取消"） |

**示例**:
```javascript
// 简单取消
calendar_cancel_plan("plan-12345");

// 带原因取消
calendar_cancel_plan("plan-12345", "下雨");
calendar_cancel_plan("plan-12345", "临时有事");
calendar_cancel_plan("plan-12345", "身体不适");
```

**返回**:
```json
{
  "success": true,
  "archived": true,
  "plan": { ... }  // 完整事件对象
}
```

---

### `calendar_delete_plan`

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `planId` | string | ✅ | 事件 ID |

**示例**:
```javascript
calendar_delete_plan("plan-test-12345");
```

**返回**:
```json
{
  "success": true,
  "archived": false
}
```

---

## 🎯 最佳实践

### 1. 默认使用 `cancel`

**原则**: 用户说"取消"、"不去了"、"删掉"时，默认调用 `calendar_cancel_plan`。

**理由**:
- 保留历史，便于分析
- 用户可能改变主意
- 学期总结需要完整数据

---

### 2. 仅在以下场景使用 `delete`

- **错误数据**: 用户误操作创建的事件
- **测试数据**: 开发/测试时创建的临时事件
- **重复事件**: 系统 bug 导致的重复记录

---

### 3. 提取取消原因

**对话示例**:
```
用户："取消明天的计划"
LLM："好的，请问取消的原因是什么？（如下雨、身体不适、临时有事等）"
用户："下雨"
LLM: calendar_cancel_plan(planId, "下雨");
```

**自动提取**:
```
用户："因为下雨，取消明天的晨跑"
LLM: 提取原因 "下雨" → calendar_cancel_plan(planId, "下雨");
```

---

### 4. 归档时机

**自动归档**:
- 取消事件 → 立即归档到 `archive/plans/week-{currentWeek}.json`
- 每周任务 → 移动上周所有事件到归档区

**学期归档**:
- 学期结束 → 所有归档文件打包到 `archive/{semester}/`

---

## 📊 统计指标

### 完成率计算

```javascript
completionRate = completed / (completed + cancelled + expired + active)
```

**示例**:
```
总计划：50 个
- 完成：35 个
- 取消：8 个
- 过期：5 个
- 活跃：2 个

完成率 = 35 / (35 + 8 + 5 + 2) = 35 / 50 = 70%
取消率 = 8 / 50 = 16%
```

---

### 取消原因分析

```javascript
// 从归档中提取取消原因
const cancelReasons = {};
cancelledPlans.forEach(plan => {
  const reason = plan.lifecycle.cancelReason || '未知';
  cancelReasons[reason] = (cancelReasons[reason] || 0) + 1;
});

// 输出
{
  "下雨": 3,
  "临时有事": 2,
  "身体不适": 2,
  "起不来": 1
}
```

---

## 🚨 常见问题

### Q1: 用户说"删除"，应该调用哪个工具？

**A**: 默认调用 `calendar_cancel_plan`，除非用户明确说"彻底删除"。

**理由**: 用户通常不知道"删除"和"取消"的技术区别，他们的真实意图是"我不去了"，而不是"抹除历史"。

---

### Q2: 取消的事件会永远保留吗？

**A**: 是的，归档到 `archive/{semester}/plans/`，学期结束后可查询。

**用途**:
- 学期总结
- 行为分析
- 个性化建议

---

### Q3: 归档文件会很大吗？

**A**: 不会，原因：
- 每周归档一次，文件分散
- JSON 压缩后很小（~1KB/事件）
- 学期结束后可压缩存储

---

### Q4: 用户能查看取消历史吗？

**A**: 可以，通过自然语言查询：

```
用户："我上个月取消了哪些计划？"
LLM: 读取归档 → 过滤 cancelled → 生成回答
```

---

## ✅ 总结

| 操作 | 工具 | 归档 | 历史 | 推荐度 |
|------|------|------|------|--------|
| **取消计划** | `calendar_cancel_plan` | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **删除错误** | `calendar_delete_plan` | ❌ | ❌ | ⭐⭐ |

**核心原则**:
- ✅ 默认使用 `cancel`（保留历史）
- ✅ 仅在必要时使用 `delete`（彻底删除）
- ✅ 取消原因尽量详细（便于分析）
- ✅ 归档数据用于学期总结和行为分析

---

*最后更新：2026-04-08*
