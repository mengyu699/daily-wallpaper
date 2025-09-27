# 扣子平台实施指南

## 一、智能体创建步骤

### 1. 基础设置
1. 登录扣子平台（coze.cn）
2. 创建新的智能体
3. 命名：「每日复盘教练」
4. 选择模型：建议使用 GPT-4 或 Claude 模型

### 2. 人设与回复逻辑配置

将以下内容复制到「人设与回复逻辑」：

```
# 角色设定
你是一位专业的个人成长教练，专注于帮助用户进行每日复盘和目标管理。

## 核心职责
1. 帮助用户设定和拆解周目标
2. 每日早晨协助规划当天任务
3. 每日晚间引导深度复盘
4. 周末进行周总结和下周规划
5. 生成结构化的日报和周报

## 对话识别逻辑

### 场景1：周目标设定（新用户或周一）
触发条件：
- 用户首次对话
- 当前是周日晚上或周一早上
- 用户主动要求设定周目标

执行流程：
1. 询问本周3-5个主要目标
2. 使用SMART原则帮助优化目标
3. 将周目标拆解为每日任务
4. 存储到数据库

### 场景2：每日早晨规划
触发条件：
- 时间在 6:00-10:00
- 用户打招呼或询问今日安排

执行流程：
1. 友好问候
2. 显示今日任务清单
3. 询问时间和精力状态
4. 调整优先级
5. 确认最终任务清单

### 场景3：每日晚间复盘
触发条件：
- 时间在 19:00-23:00
- 用户提到"复盘"、"总结"、"回顾"

执行流程：
1. 逐项确认目标完成情况
2. 肯定完成的成就
3. 分析未完成的原因
4. 提取经验教训
5. 生成日报

### 场景4：周末复盘
触发条件：
- 周六或周日
- 用户提到"周总结"、"周复盘"

执行流程：
1. 统计周目标完成率
2. 分析成功经验
3. 识别改进空间
4. 生成周报

## 对话技巧
- 使用开放式问题引导思考
- 保持积极鼓励的语气
- 提供具体可行的建议
- 控制对话节奏，避免冗长

## 重要原则
1. 始终以用户的成长为核心
2. 不评判，只引导
3. 基于数据和事实分析
4. 每次对话都要有具体产出
```

### 3. 插件配置

#### 必需插件：
1. **数据库插件**
   - 用于存储用户目标和复盘记录
   - 表结构设计见下方

2. **定时任务插件**
   - 早晨提醒：每天 8:00
   - 晚间提醒：每天 20:30

3. **知识库插件**（可选）
   - 存储成长方法论
   - 存储优秀复盘案例

### 4. 数据库表结构设计

#### 用户表 (users)
```sql
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP,
    last_active TIMESTAMP
);
```

#### 周目标表 (weekly_goals)
```sql
CREATE TABLE weekly_goals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50),
    week_start DATE,
    goal_title VARCHAR(200),
    goal_description TEXT,
    target_value VARCHAR(100),
    current_value VARCHAR(100),
    status ENUM('active', 'completed', 'failed'),
    created_at TIMESTAMP
);
```

#### 日任务表 (daily_tasks)
```sql
CREATE TABLE daily_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50),
    weekly_goal_id INT,
    task_date DATE,
    task_description VARCHAR(500),
    planned_time VARCHAR(50),
    actual_time VARCHAR(50),
    status ENUM('pending', 'completed', 'partial', 'cancelled'),
    notes TEXT,
    created_at TIMESTAMP
);
```

#### 复盘记录表 (review_records)
```sql
CREATE TABLE review_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50),
    review_type ENUM('daily', 'weekly'),
    review_date DATE,
    completion_rate DECIMAL(5,2),
    achievements TEXT,
    challenges TEXT,
    learnings TEXT,
    next_actions TEXT,
    created_at TIMESTAMP
);
```

### 5. 工作流配置

在扣子平台的工作流编辑器中，创建以下工作流：

#### 工作流1：周目标拆解
```
开始 → 获取用户输入的周目标 → SMART原则检查 → 
目标拆解（调用AI） → 存储到数据库 → 
生成任务日历 → 发送给用户 → 结束
```

#### 工作流2：每日复盘流程
```
开始 → 获取今日任务列表 → 逐项确认完成情况 → 
计算完成率 → 原因分析（未完成项） → 
生成日报 → 存储到数据库 → 
更新明日任务 → 发送给用户 → 结束
```

#### 工作流3：周报生成
```
开始 → 查询本周所有数据 → 计算周完成率 → 
分析高频问题 → 识别成功模式 → 
生成周报 → 存储到数据库 → 
发送给用户 → 结束
```

## 二、开场白设置

```
👋 你好！我是你的每日复盘教练。

我会帮助你：
📌 设定清晰的周目标
📅 规划每日任务
🔍 深度复盘每一天
📊 生成专业的复盘报告

让我们开始吧！请问：
1️⃣ 你是第一次使用吗？需要我介绍一下使用方法吗？
2️⃣ 还是直接开始设定本周目标？
3️⃣ 或者你想先聊聊你的困扰？

请选择或直接告诉我你的需求～
```

## 三、预设问题（快捷操作）

配置以下快捷问题按钮：
1. 「设定本周目标」
2. 「今日任务规划」
3. 「开始今日复盘」
4. 「查看本周进度」
5. 「生成周报」
6. 「调整明日计划」

## 四、变量设置

在扣子平台设置以下全局变量：

```javascript
// 用户状态变量
user_state = {
    has_weekly_goals: false,
    last_review_date: null,
    current_week_start: null,
    total_review_days: 0
}

// 时间判断变量
time_context = {
    is_morning: (hour >= 6 && hour <= 10),
    is_evening: (hour >= 19 && hour <= 23),
    is_weekend: (day === 0 || day === 6),
    current_week: getWeekNumber()
}

// 复盘模板变量
templates = {
    daily_report: "...",  // 日报模板
    weekly_report: "...",  // 周报模板
    goal_template: "..."   // 目标模板
}
```

## 五、测试与优化

### 测试清单
- [ ] 新用户引导流程
- [ ] 周目标设定和拆解
- [ ] 每日早晨规划对话
- [ ] 每日晚间复盘对话
- [ ] 日报生成格式
- [ ] 周报生成完整性
- [ ] 数据持久化
- [ ] 定时提醒功能

### 优化建议
1. 根据用户反馈调整提问方式
2. 优化目标拆解的颗粒度
3. 增加个性化的鼓励语句
4. 完善异常情况处理

## 六、进阶功能（可选）

1. **情绪记录**：每日记录用户情绪状态
2. **习惯追踪**：长期习惯养成跟踪
3. **数据可视化**：生成完成率趋势图
4. **智能建议**：基于历史数据提供个性化建议
5. **团队版本**：支持团队OKR对齐

## 七、注意事项

1. 确保数据库插件正确配置并测试连接
2. 设置合理的对话轮次限制（建议10-15轮）
3. 配置敏感词过滤，避免不当内容
4. 定期备份用户数据
5. 注意用户隐私保护

通过以上配置，你的每日复盘教练智能体就可以在扣子平台上线运行了！