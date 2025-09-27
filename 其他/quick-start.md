# 🚀 n8n + 扣子 集成快速入门

## 5分钟快速体验

### 步骤 1：准备 n8n 环境

#### 选项A：使用 n8n Cloud（推荐新手）
1. 访问 [n8n.cloud](https://n8n.cloud) 并注册
2. 创建新工作流
3. 跳到步骤2

#### 选项B：本地快速启动
```bash
# 使用Docker（推荐）
docker run -it --rm --name n8n -p 5678:5678 docker.n8n.io/n8nio/n8n

# 或使用npm
npm install n8n -g && n8n start
```

### 步骤 2：导入示例工作流

1. 在 n8n 界面中，点击右上角的 "..." 菜单
2. 选择 "导入工作流"
3. 复制并粘贴 `n8n-workflows/simple-echo-workflow.json` 的内容
4. 点击 "导入"
5. **重要：点击右上角的 "激活" 按钮**

### 步骤 3：获取 Webhook URL

激活后，在 Webhook 节点中可以看到生产URL，类似：
```
https://your-instance.app.n8n.cloud/webhook/echo-service
```

### 步骤 4：测试 API 端点

运行提供的测试脚本：

```bash
# 进入项目目录
cd /Users/mengyu/Desktop/Cursor

# 修改测试配置
node -e "
const config = require('./test-scripts/integration-test.js').CONFIG;
config.N8N_BASE_URL = 'https://your-instance.app.n8n.cloud';  // 替换为您的URL
console.log('配置已更新');
"

# 运行测试
node test-scripts/integration-test.js
```

或者手动测试：
```bash
curl -X POST https://your-instance.app.n8n.cloud/webhook/echo-service \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "你好世界",
    "user_id": "test_user_001"
  }'
```

### 步骤 5：配置扣子插件

1. 访问 [扣子平台](https://www.coze.cn)
2. 进入 "空间" → "资源库" → "插件"
3. 点击 "开始创建" → "基于已有服务创建"
4. 使用 `coze-plugins/n8n-echo-plugin.json` 中的配置：

#### 基本信息
```
插件名称: n8n-echo-service
插件描述: 连接到n8n工作流的回声服务
插件URL: https://your-instance.app.n8n.cloud
```

#### API配置
```
路径: /webhook/echo-service
方法: POST
参数:
  - user_query (string, 必需): 用户输入
  - user_id (string, 必需): 用户ID
  - context (object, 可选): 上下文信息
```

### 步骤 6：创建智能体

1. 在扣子中创建新的智能体
2. 在插件库中添加您刚创建的插件
3. 配置智能体Prompt：

```
你是一个测试助手。当用户发送消息时：

1. 调用 n8n-echo-service 插件的 processEcho 方法
2. 将用户的输入作为 user_query 参数传递
3. 使用返回的结果回复用户

插件调用格式：
- user_query: 用户的原始输入
- user_id: 从会话信息中获取的用户ID

始终确认用户的输入已被正确理解。
```

### 步骤 7：测试端到端功能

1. 在扣子智能体中发送：`"测试消息"`
2. 智能体应该调用您的n8n工作流
3. 返回类似：`"您说的是: 测试消息"`

---

## 🎯 成功标志

如果看到以下结果，说明集成成功：

### n8n 测试成功
```bash
🧪 运行测试: 基本回声测试
✅ 测试通过
📊 HTTP状态码: 200
⏱️  响应时间: 245ms
```

### 扣子智能体响应
```
用户: 你好
智能体: 我收到了您的消息"你好"，n8n工作流已成功处理。您说的是: 你好
```

---

## 🛠️ 故障排除

### 常见问题

#### 1. n8n Webhook 无响应
```bash
# 检查工作流是否激活
# 确认URL拼写正确
# 测试网络连通性
curl -I https://your-instance.app.n8n.cloud/webhook/echo-service
```

#### 2. 扣子插件调用失败
- 检查插件URL配置
- 确认参数名称匹配
- 验证授权设置

#### 3. CORS跨域错误
在n8n的"返回响应"节点中添加响应头：
```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}
```

#### 4. 中文乱码问题
确保响应头包含：
```json
{
  "Content-Type": "application/json; charset=utf-8"
}
```

### 调试技巧

#### 查看n8n执行日志
1. 在n8n界面点击 "执行" 标签页
2. 查看最近的执行记录
3. 点击执行记录查看详细数据流

#### 测试API端点
```javascript
// 浏览器控制台测试
fetch('https://your-instance.app.n8n.cloud/webhook/echo-service', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_query: '测试',
    user_id: 'test_001'
  })
}).then(r => r.json()).then(console.log);
```

---

## 🎉 下一步

集成成功后，您可以：

### 1. 扩展工作流功能
- 添加数据库查询
- 集成第三方API
- 实现条件逻辑分支

### 2. 优化用户体验
- 添加错误处理
- 实现结果缓存
- 优化响应时间

### 3. 部署到生产环境
- 配置域名和SSL
- 设置监控和日志
- 实施安全认证

### 4. 创建更多场景
- 智能客服系统
- 数据分析助手
- 自动化工作流触发

---

## 📚 相关资源

- [完整集成指南](./n8n-coze-integration-guide.md)
- [n8n官方文档](https://docs.n8n.io/)
- [扣子开发者文档](https://www.coze.cn/docs)

---

## 🤝 支持

如有问题，请检查：
1. [常见问题解答](./n8n-coze-integration-guide.md#第六部分常见问题和故障排除)
2. n8n社区论坛
3. 扣子开发者社区

祝您使用愉快！🎊