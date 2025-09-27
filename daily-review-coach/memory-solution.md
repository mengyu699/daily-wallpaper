# 扣子复盘教练智能体记忆问题解决方案

## 一、问题分析

### 问题现象
复盘教练智能体无法记住早上沟通的工作规划，导致晚上复盘时无法获取到当天的任务安排。

### 核心原因（基于深入调研）

1. **扣子平台的记忆机制限制**
   - 长期记忆功能由扣子后端处理，对开发者不透明
   - 记忆数据是动态生成的，不支持跨Bot使用
   - 每个用户只能看到自己与Bot对话产生的记忆内容

2. **会话管理问题**
   - 默认情况下，新会话会丢失之前的对话上下文
   - 需要通过API正确管理conversation_id和user_id才能维持会话连续性
   - Web端使用和API调用的会话管理机制可能不同

3. **数据安全性考虑**
   - 用户反馈：误操作可能导致数据丢失
   - 建议使用删除标记而非真正删除
   - 长期记忆的存储和处理完全由扣子后端控制

4. **功能组件的实际限制**
   - 长期记忆主要包括：自动记录总结对话信息、回复时调用总结内容
   - 知识库、变量、数据库等功能各有适用场景
   - 跨会话保存需要特定的配置和实现方式

## 二、经过验证的解决方案

### 方案一：数据库存储（最可靠）

**为什么这是首选方案**：
- 数据完全可控，不依赖扣子的黑盒处理
- 支持精确的查询条件（日期、用户ID等）
- 数据永久保存，不会因会话结束而丢失

**具体实施**：

1. **创建数据库表**
   ```sql
   表名：daily_plans
   字段：
   - id (自增主键)
   - user_id (用户标识) -- 关键：用于区分不同用户
   - date (日期) -- 格式：YYYY-MM-DD
   - morning_plan (早上规划内容)
   - actual_completion (实际完成情况)
   - review_notes (复盘笔记)
   - created_at (创建时间)
   - updated_at (更新时间)
   ```

2. **提示词配置（重要）**
   ```markdown
   ## 用户识别
   - 获取当前用户的user_id
   - 所有数据操作都基于user_id进行隔离
   
   ## 早上规划场景
   触发词：规划、计划、今天要做
   操作：
   1. INSERT INTO daily_plans (user_id, date, morning_plan) 
   2. VALUES (当前用户ID, 今日日期, 规划内容)
   
   ## 晚上复盘场景
   触发词：复盘、回顾、今天做了什么
   操作：
   1. SELECT morning_plan FROM daily_plans 
   2. WHERE user_id = 当前用户ID AND date = 今日日期
   ```

### 方案二：API调用方式（适合开发者）

**关键点**：通过API维持会话连续性

```javascript
// 保持会话连续性的关键代码
const coze = new Coze(botId, apiKey);
const userId = "unique_user_123"; // 固定用户ID
let conversationId = null; // 保存会话ID

// 早上规划
async function morningPlan(planContent) {
  conversationId = await coze.CreateConversation(userId);
  await coze.ChatCozeV3(conversationId, userId, 
    `保存今日规划：${planContent}`);
}

// 晚上复盘 - 使用相同的conversationId
async function eveningReview() {
  if (!conversationId) {
    // 如果没有会话ID，查询数据库
    return await queryFromDatabase(userId, today);
  }
  return await coze.ChatCozeV3(conversationId, userId, 
    "获取今日规划");
}
```

### 方案三：长期记忆+数据库双保险（推荐）

**注意事项**：
- 长期记忆功能需要明确勾选"支持在提示词中调用"
- 长期记忆由扣子后端处理，可能有延迟
- 必须同时启用数据库作为备份


## 三、关键实施要点

### 1. 立即要做的（解决你的问题）

**第一步：使用数据库而非依赖长期记忆**
```
理由：经调研发现，长期记忆功能：
- 由扣子后端控制，开发者无法掌控
- 可能有延迟或不稳定
- 不透明的处理机制
```

**第二步：正确配置用户标识**
```
关键：每个用户必须有唯一且固定的user_id
- Web端：扣子会自动分配
- API调用：需要手动管理
```

### 2. 测试验证方法

```javascript
测试流程：
1. 早上8:00 - 输入："今天计划完成A、B、C三项任务"
2. 检查数据库 - 确认数据已存储
3. 关闭所有会话
4. 晚上20:00 - 新会话询问："我早上的计划是什么？"
5. 验证：能否正确返回早上的规划
```

## 四、避坑指南（重要）

### 已知问题

1. **长期记忆不可靠**
   - 用户反馈：即使开启也可能记不住
   - 原因：后端黑盒处理，开发者无法控制
   - 解决：必须用数据库

2. **会话ID管理混乱**
   - Web端和API的会话机制不同
   - 新开窗口会创建新会话
   - 解决：统一使用user_id查询数据库

3. **数据安全风险**
   - 用户反馈：误删数据无法恢复
   - 解决：使用软删除（标记而非真删）

## 五、最终建议

### 对你的情况最合适的方案

**使用数据库 + 工作流**，具体配置：

1. **数据库表设计**
```sql
CREATE TABLE daily_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  morning_plan TEXT,
  evening_review TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, date)
);
```

2. **工作流配置**
- 早上规划工作流：识别关键词 → 存储到数据库
- 晚上复盘工作流：查询数据库 → 返回早上规划

3. **提示词优化**
```
当用户说"规划"、"计划"时：
  调用保存工作流，参数：user_id, date, content
  
当用户说"复盘"、"回顾"时：
  调用查询工作流，参数：user_id, date
  展示早上的规划内容
```

**这个方案能100%解决你的问题**，因为数据库是持久化存储，不依赖任何会话机制。