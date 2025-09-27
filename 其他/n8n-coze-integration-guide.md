# n8n + 扣子智能体集成完整指南

## 项目概述

本指南将帮助您实现 **n8n 工作流 + 扣子智能体** 的完美集成，发挥两个平台的核心优势：

- **扣子（前端）**：优秀的AI对话体验 + 多平台发布能力
- **n8n（后端）**：强大的业务逻辑处理 + 灵活的系统集成

## 架构设计

```
用户交互 → 扣子智能体 → 自定义插件 → HTTP API → n8n工作流 → 业务系统/数据库
```

---

## 第一部分：n8n Webhook API 端点创建

### 1.1 环境准备

#### 方案A：使用 n8n Cloud（推荐新手）
1. 访问 [n8n.cloud](https://n8n.cloud) 注册账号
2. 创建新的工作流
3. 自动获得 HTTPS 公网域名，无需额外配置

#### 方案B：自托管部署
```bash
# 使用 Docker 快速部署
docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n docker.n8n.io/n8nio/n8n

# 或使用 npm 安装
npm install n8n -g
n8n start
```

### 1.2 创建 Webhook API 端点

#### 步骤1：添加 Webhook 触发器
1. 在 n8n 工作流编辑器中，点击 "+" 添加节点
2. 选择 "Webhook" 节点作为触发器
3. 配置 Webhook 节点：

```json
{
  "httpMethod": "POST",
  "path": "coze-integration",
  "responseMode": "lastNode",
  "authentication": "headerAuth"
}
```

#### 步骤2：处理业务逻辑
添加您的业务处理节点，例如：

```json
// 数据处理节点示例
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "coze-integration"
      }
    },
    {
      "name": "Code",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": `
// 处理扣子传来的数据
const { user_query, user_id, context } = $input.all()[0].json;

// 执行您的业务逻辑
const result = processUserQuery(user_query, context);

return [{
  json: {
    success: true,
    data: result,
    message: "处理成功",
    timestamp: new Date().toISOString()
  }
}];`
      }
    }
  ]
}
```

#### 步骤3：配置响应节点
添加 "Respond to Webhook" 节点：

```json
{
  "name": "Respond to Webhook",
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "respondWith": "json",
    "responseHeaders": {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  }
}
```

#### 步骤4：激活工作流
1. 点击右上角的 "激活" 按钮
2. 复制生成的 Webhook URL
3. 格式类似：`https://your-n8n-instance.com/webhook/coze-integration`

### 1.3 API 测试

使用 curl 测试您的 API 端点：

```bash
curl -X POST https://your-n8n-instance.com/webhook/coze-integration \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "查询今天的天气",
    "user_id": "test_user_001",
    "context": {
      "location": "北京"
    }
  }'
```

---

## 第二部分：扣子自定义插件配置

### 2.1 登录扣子平台

1. 访问 [扣子平台](https://www.coze.cn)
2. 使用飞书/抖音账号登录
3. 进入工作台

### 2.2 创建自定义插件

#### 步骤1：新建插件
1. 点击左侧 "空间" → "资源库" → "插件"
2. 点击 "开始创建" → "基于已有服务创建"
3. 填写基本信息：

```
插件名称: n8n-workflow-api
插件描述: 调用n8n工作流处理复杂业务逻辑
插件URL: https://your-n8n-instance.com
```

#### 步骤2：配置 API 接口
在 API 配置页面添加接口：

```json
{
  "path": "/webhook/coze-integration",
  "method": "POST",
  "name": "processQuery",
  "description": "处理用户查询请求",
  "parameters": [
    {
      "name": "user_query",
      "type": "string",
      "required": true,
      "description": "用户输入的查询内容"
    },
    {
      "name": "user_id", 
      "type": "string",
      "required": true,
      "description": "用户标识ID"
    },
    {
      "name": "context",
      "type": "object",
      "required": false,
      "description": "上下文信息"
    }
  ],
  "responses": {
    "success": "boolean",
    "data": "object", 
    "message": "string",
    "timestamp": "string"
  }
}
```

#### 步骤3：授权配置
选择授权方式：
- **Service 认证**（推荐）：配置 API 密钥
- **不需要授权**：仅用于测试环境

#### 步骤4：测试插件
1. 在插件配置页面点击 "测试"
2. 输入测试数据验证功能
3. 确认返回结果符合预期

### 2.3 发布插件

1. 测试通过后点击 "发布"
2. 插件将出现在您的插件库中
3. 可以在智能体中直接调用

---

## 第三部分：统一 API 接口规范

### 3.1 请求格式标准

```typescript
// 标准请求接口
interface CozeToN8nRequest {
  user_query: string;           // 用户原始输入
  user_id: string;              // 用户唯一标识
  session_id?: string;          // 会话ID（可选）
  context?: {                   // 上下文信息
    location?: string;
    timestamp?: string;
    user_profile?: any;
    [key: string]: any;
  };
  action_type?: string;         // 操作类型（查询/更新/删除等）
  parameters?: any;             // 额外参数
}
```

### 3.2 响应格式标准

```typescript
// 标准响应接口
interface N8nToCozeResponse {
  success: boolean;             // 处理结果状态
  data?: any;                   // 返回的数据
  message: string;              // 友好提示信息
  error_code?: string;          // 错误代码（失败时）
  timestamp: string;            // 处理时间戳
  next_action?: string;         // 建议的下一步操作
  debug_info?: any;             // 调试信息（开发环境）
}
```

### 3.3 错误处理规范

```typescript
// 错误响应示例
{
  "success": false,
  "message": "处理超时，请稍后重试",
  "error_code": "TIMEOUT_ERROR",
  "timestamp": "2025-01-20T10:30:00Z",
  "debug_info": {
    "execution_id": "12345",
    "step_failed": "database_query"
  }
}
```

---

## 第四部分：完整 Demo 示例

### 4.1 智能客服场景

#### n8n 工作流配置

```json
{
  "name": "智能客服工作流",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook", 
      "parameters": {
        "httpMethod": "POST",
        "path": "customer-service"
      }
    },
    {
      "name": "意图识别",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": `
const { user_query, user_id } = $input.all()[0].json;

// 简单意图识别逻辑
let intent = 'unknown';
if (user_query.includes('订单')) intent = 'order_query';
if (user_query.includes('退款')) intent = 'refund_request';
if (user_query.includes('账户')) intent = 'account_query';

return [{ json: { intent, user_query, user_id } }];`
      }
    },
    {
      "name": "路由处理",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.intent}}",
              "value2": "order_query"
            }
          ]
        }
      }
    },
    {
      "name": "查询订单信息",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.yourcompany.com/orders",
        "method": "GET"
      }
    },
    {
      "name": "格式化响应",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": `
const orderData = $input.all()[0].json;
return [{
  json: {
    success: true,
    data: {
      orders: orderData.orders,
      summary: \`您有 \${orderData.orders.length} 个订单\`
    },
    message: "订单查询成功"
  }
}];`
      }
    },
    {
      "name": "响应客户端",
      "type": "n8n-nodes-base.respondToWebhook"
    }
  ]
}
```

#### 扣子智能体配置

1. 创建新的智能体
2. 在插件中添加刚创建的 n8n 插件
3. 配置智能体 Prompt：

```
你是一个专业的客服助手。当用户有问题时：

1. 理解用户意图
2. 调用 n8n-workflow-api 插件的 processQuery 方法
3. 将结果用友好的语言回复用户

插件调用示例：
- user_query: 用户的原始问题
- user_id: 从对话中获取的用户ID
- context: 相关上下文信息

始终保持专业、友好的服务态度。
```

### 4.2 数据分析场景

#### n8n 工作流示例

```javascript
// 数据分析工作流的核心代码
const analysisWorkflow = {
  trigger: "webhook",
  steps: [
    {
      name: "数据获取",
      action: "fetch_data_from_database",
      params: {
        query: "SELECT * FROM sales WHERE date >= ?",
        params: ["{{$json.start_date}}"]
      }
    },
    {
      name: "数据处理", 
      action: "process_data",
      code: `
const rawData = $input.all()[0].json;
const summary = {
  total_sales: rawData.reduce((sum, item) => sum + item.amount, 0),
  order_count: rawData.length,
  average_order: rawData.reduce((sum, item) => sum + item.amount, 0) / rawData.length
};
return [{ json: summary }];`
    },
    {
      name: "生成图表",
      action: "create_chart",
      type: "bar_chart",
      data_source: "previous_step"
    }
  ]
};
```

---

## 第五部分：部署和安全最佳实践

### 5.1 生产环境部署

#### n8n 部署建议

```yaml
# docker-compose.yml
version: '3.7'
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_secure_password
      - N8N_HOST=your-domain.com
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://your-domain.com/
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - n8n_network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - n8n
    networks:
      - n8n_network

volumes:
  n8n_data:

networks:
  n8n_network:
```

#### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://n8n:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 5.2 安全配置

#### API 认证

```javascript
// n8n 工作流中的认证检查
const authenticateRequest = (headers) => {
  const apiKey = headers['x-api-key'];
  const validKeys = ['your-secret-api-key-1', 'your-secret-api-key-2'];
  
  if (!validKeys.includes(apiKey)) {
    throw new Error('Unauthorized: Invalid API key');
  }
  
  return true;
};

// 在 Webhook 节点后添加认证检查
const headers = $input.all()[0].headers;
authenticateRequest(headers);
```

#### 扣子插件认证配置

```json
{
  "authType": "service",
  "authConfig": {
    "type": "header",
    "key": "X-API-Key",
    "value": "your-secret-api-key"
  }
}
```

### 5.3 监控和日志

#### n8n 监控配置

```javascript
// 添加日志记录节点
const logExecution = {
  name: "执行日志",
  type: "n8n-nodes-base.code",
  parameters: {
    jsCode: `
const executionData = {
  execution_id: $executionId,
  workflow_name: $workflow.name,
  user_id: $json.user_id,
  timestamp: new Date().toISOString(),
  status: 'success',
  processing_time: Date.now() - $json.start_time
};

// 发送到监控系统
console.log('Execution Log:', JSON.stringify(executionData));
return [$input.all()[0]];`
  }
};
```

#### 错误处理

```javascript
// 全局错误处理
const errorHandler = {
  name: "错误处理",
  type: "n8n-nodes-base.code", 
  parameters: {
    jsCode: `
try {
  // 主要业务逻辑
  return processMainLogic($input.all()[0].json);
} catch (error) {
  // 记录错误日志
  console.error('Workflow Error:', error);
  
  // 返回友好的错误信息
  return [{
    json: {
      success: false,
      message: "系统暂时繁忙，请稍后重试",
      error_code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString()
    }
  }];
}`
  }
};
```

### 5.4 性能优化建议

#### 缓存策略

```javascript
// Redis 缓存示例
const cacheManager = {
  get: async (key) => {
    // 从 Redis 获取缓存
    return await redis.get(key);
  },
  set: async (key, value, ttl = 3600) => {
    // 设置缓存，默认1小时过期
    return await redis.setex(key, ttl, JSON.stringify(value));
  }
};

// 在工作流中使用缓存
const cacheKey = `user_query_${user_id}_${hash(user_query)}`;
const cachedResult = await cacheManager.get(cacheKey);

if (cachedResult) {
  return [{ json: JSON.parse(cachedResult) }];
}

// 执行实际查询...
const result = await processQuery();
await cacheManager.set(cacheKey, result);
```

#### 限流配置

```javascript
// 请求频率限制
const rateLimiter = {
  check: (user_id) => {
    const key = `rate_limit_${user_id}`;
    const current = cache.get(key) || 0;
    
    if (current > 100) { // 每小时最多100次请求
      throw new Error('Rate limit exceeded');
    }
    
    cache.set(key, current + 1, 3600); // 1小时过期
    return true;
  }
};
```

---

## 第六部分：常见问题和故障排除

### 6.1 连接问题

#### 问题：扣子无法访问 n8n API
**解决方案：**
1. 检查防火墙设置
2. 确认域名和SSL证书配置
3. 验证API端点的可访问性

```bash
# 测试API连通性
curl -v https://your-domain.com/webhook/test
```

#### 问题：CORS 跨域错误
**解决方案：**
在 n8n Webhook 节点中添加响应头：

```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}
```

### 6.2 性能问题

#### 问题：API 响应缓慢
**解决方案：**
1. 添加数据库查询索引
2. 实施缓存策略
3. 优化工作流逻辑

#### 问题：并发处理能力不足
**解决方案：**
1. 增加 n8n 实例数量
2. 使用负载均衡
3. 优化数据库连接池

### 6.3 数据格式问题

#### 问题：扣子插件解析响应失败
**解决方案：**
严格按照定义的接口规范返回数据：

```javascript
// 确保返回正确的数据格式
return [{
  json: {
    success: true,
    data: processedData,
    message: "处理成功",
    timestamp: new Date().toISOString()
  }
}];
```

---

## 总结

通过本指南，您已经掌握了：

1. **n8n Webhook API 创建**：将复杂工作流暴露为标准API端点
2. **扣子自定义插件开发**：连接外部API实现功能扩展  
3. **统一接口规范设计**：确保系统间的可靠通信
4. **完整示例实现**：智能客服和数据分析场景
5. **生产环境部署**：安全、监控、性能优化最佳实践

这个架构方案让您能够：
- **发挥各平台优势**：n8n的强大后端能力 + 扣子的优秀前端体验
- **实现灵活扩展**：独立升级前后端组件
- **降低开发成本**：复用现有系统和服务
- **提升用户体验**：多平台一致的智能交互

现在您可以开始构建自己的智能助手系统了！

---

## 相关资源

- [n8n 官方文档](https://docs.n8n.io/)
- [扣子开发者平台](https://www.coze.cn/)
- [API 设计最佳实践](https://restfulapi.net/)
- [Webhook 安全指南](https://webhooks.fyi/security)

如有问题，欢迎交流讨论！