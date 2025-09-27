# 🔒 Chatlog-WebUI 安全检查清单

## 🚨 立即安全修复 (已完成 ✅)

### ✅ 1. 环境变量管理
- [x] 移除硬编码API密钥
- [x] 创建 `.env.example` 模板
- [x] 更新 `.gitignore` 防止敏感信息泄露
- [x] 添加环境变量验证逻辑

### ✅ 2. 依赖包安全
- [x] 添加安全相关依赖：
  - `dotenv` - 环境变量管理
  - `helmet` - HTTP头安全
  - `express-rate-limit` - 请求限速
  - `bcrypt` - 密码哈希
  - `jsonwebtoken` - JWT令牌
  - `express-session` - 会话管理

## 🔐 待实施安全措施

### 🎯 高优先级 (Phase 1)

#### 1. HTTP安全头配置
```javascript
// 在 app.js 中添加
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:8080"]
    }
  }
}));
```

#### 2. 请求限速
```javascript
const rateLimit = require('express-rate-limit');

// 全局限速
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000个请求
  message: '请求过于频繁，请稍后再试'
});

// API限速
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'API请求过于频繁，请稍后再试'
});

// 登录限速
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: '登录尝试过于频繁，请稍后再试'
});
```

#### 3. 输入验证和清理
```javascript
const { body, query, validationResult } = require('express-validator');

// 搜索参数验证
const validateSearchParams = [
  query('q').optional().isLength({ min: 1, max: 200 }).trim().escape(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('talker').optional().isLength({ min: 1, max: 100 }).trim()
];

// 分析参数验证
const validateAnalysisParams = [
  body('analysisType').isIn(['summary', 'sentiment', 'keywords', 'topics', 'statistics', 'custom']),
  body('dateRange').optional().isLength({ min: 1, max: 50 }).trim(),
  body('contacts').optional().isLength({ min: 1, max: 500 }).trim(),
  body('customPrompt').optional().isLength({ min: 1, max: 1000 }).trim()
];
```

### 🎯 中优先级 (Phase 2)

#### 4. 身份验证系统
```javascript
// JWT令牌验证
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '访问令牌缺失' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: '无效的访问令牌' 
      });
    }
    req.user = user;
    next();
  });
};
```

#### 5. 用户会话管理
```javascript
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // 防止XSS
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));
```

#### 6. API密钥管理
```javascript
// 创建API密钥管理服务
class ApiKeyManager {
  constructor() {
    this.keys = new Map();
  }

  generateKey(userId, permissions = []) {
    const key = crypto.randomBytes(32).toString('hex');
    this.keys.set(key, {
      userId,
      permissions,
      createdAt: new Date(),
      lastUsed: null
    });
    return key;
  }

  validateKey(key) {
    const keyData = this.keys.get(key);
    if (!keyData) return false;
    
    keyData.lastUsed = new Date();
    return keyData;
  }

  revokeKey(key) {
    return this.keys.delete(key);
  }
}
```

### 🎯 低优先级 (Phase 3)

#### 7. 日志安全
```javascript
const winston = require('winston');

// 敏感信息过滤器
const sensitiveFilter = winston.format((info) => {
  // 过滤敏感字段
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  
  if (info.message && typeof info.message === 'object') {
    sensitiveFields.forEach(field => {
      if (info.message[field]) {
        info.message[field] = '[FILTERED]';
      }
    });
  }
  
  return info;
});

const logger = winston.createLogger({
  format: winston.format.combine(
    sensitiveFilter(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log', level: 'warn' }),
    new winston.transports.File({ filename: 'logs/access.log' })
  ]
});
```

#### 8. 文件上传安全
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // 生成安全的文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    // 只允许特定文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'application/json'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  }
});
```

## 🔍 安全测试检查清单

### 1. 认证和授权测试
- [ ] 测试未授权访问保护
- [ ] 测试JWT令牌验证
- [ ] 测试会话管理
- [ ] 测试密码哈希和验证

### 2. 输入验证测试
- [ ] SQL注入测试
- [ ] XSS攻击测试
- [ ] 命令注入测试
- [ ] 路径遍历测试

### 3. 配置安全测试
- [ ] 环境变量泄露测试
- [ ] 敏感文件访问测试
- [ ] 错误信息泄露测试
- [ ] 默认配置安全测试

### 4. 网络安全测试
- [ ] HTTPS强制重定向测试
- [ ] 安全头检查
- [ ] CORS配置验证
- [ ] 请求限速测试

## 🛡️ 生产环境安全配置

### 1. 环境变量设置
```bash
# 生产环境 .env
NODE_ENV=production
LOG_LEVEL=warn
SECURE_COOKIES=true
HTTPS_ONLY=true
RATE_LIMIT_STRICT=true
```

### 2. 反向代理配置 (Nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # 代理设置
    location / {
        proxy_pass http://localhost:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 防火墙配置
```bash
# 只允许必要端口
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw deny 3333/tcp # 隐藏应用端口
sudo ufw enable
```

## 🔄 持续安全监控

### 1. 依赖包安全扫描
```bash
# 定期运行
npm audit
npm audit fix

# 使用Snyk扫描
npx snyk test
```

### 2. 代码安全扫描
```bash
# ESLint安全规则
npm install eslint-plugin-security --save-dev

# 在.eslintrc.js中添加
{
  "plugins": ["security"],
  "extends": ["plugin:security/recommended"]
}
```

### 3. 运行时安全监控
```javascript
// 异常活动监控
const monitorSecurity = (req, res, next) => {
  // 监控异常请求模式
  if (req.path.includes('../') || req.path.includes('..\\')) {
    logger.warn('可疑路径访问尝试', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
};
```

## 📋 安全审计清单

### 部署前检查
- [ ] 所有环境变量正确设置
- [ ] 生产环境配置验证
- [ ] SSL证书配置正确
- [ ] 防火墙规则配置
- [ ] 备份和恢复计划制定

### 运行时检查
- [ ] 日志监控系统正常
- [ ] 异常活动检测启用
- [ ] 性能监控指标正常
- [ ] 安全更新及时应用

## 🚨 应急响应计划

### 1. 安全事件响应
```javascript
// 紧急关闭系统
const emergencyShutdown = () => {
  logger.error('安全事件：系统紧急关闭');
  process.exit(1);
};

// 限制特定IP
const blockIP = (ip) => {
  blockedIPs.add(ip);
  logger.warn(`IP ${ip} 已被阻止`);
};
```

### 2. 恢复流程
1. 识别和隔离威胁
2. 评估损害程度
3. 恢复服务
4. 加强防护措施
5. 报告和总结

---

**🔒 安全是持续的过程，不是一次性的任务。定期审查和更新安全措施！**