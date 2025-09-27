const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../utils/logger');
const { RateLimitError } = require('../utils/errors');

/**
 * 安全中间件集合
 */
class SecurityMiddleware {
  /**
   * 基础安全头配置
   */
  static helmet() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Bootstrap需要
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com"
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // 某些内联脚本需要
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "http://localhost:8080" // Chatlog图片服务
          ],
          connectSrc: [
            "'self'",
            "http://localhost:8080", // Chatlog API
            "https://api.deepseek.com" // DeepSeek API
          ],
          fontSrc: [
            "'self'",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com"
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false, // 某些外部资源需要
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * 全局请求限流
   */
  static globalRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 1000, // 每个IP最多1000个请求
      message: {
        success: false,
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '15分钟后重试'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.security('全局限流触发', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method
        });

        throw new RateLimitError('请求过于频繁，请稍后再试');
      }
    });
  }

  /**
   * API请求限流
   */
  static apiRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 200, // API请求更严格
      message: {
        success: false,
        message: 'API请求过于频繁，请稍后再试',
        code: 'API_RATE_LIMIT_EXCEEDED',
        retryAfter: '15分钟后重试'
      },
      keyGenerator: (req) => {
        // 可以基于用户ID或API密钥进行限流
        return req.user?.id || req.ip;
      },
      handler: (req, res) => {
        logger.security('API限流触发', {
          ip: req.ip,
          user: req.user?.id || 'anonymous',
          url: req.url,
          method: req.method
        });

        throw new RateLimitError('API请求过于频繁');
      }
    });
  }

  /**
   * AI分析请求限流（更严格）
   */
  static aiAnalysisRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 20, // AI分析成本高，限制更严格
      message: {
        success: false,
        message: 'AI分析请求过于频繁，请稍后再试',
        code: 'AI_RATE_LIMIT_EXCEEDED',
        retryAfter: '15分钟后重试'
      },
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      handler: (req, res) => {
        logger.security('AI分析限流触发', {
          ip: req.ip,
          user: req.user?.id || 'anonymous',
          analysisType: req.body?.analysisType,
          url: req.url
        });

        throw new RateLimitError('AI分析请求过于频繁，请稍后再试');
      }
    });
  }

  /**
   * 登录限流
   */
  static loginRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 5, // 登录尝试次数限制
      skipSuccessfulRequests: true, // 成功的请求不计入限制
      message: {
        success: false,
        message: '登录尝试过于频繁，请稍后再试',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
        retryAfter: '15分钟后重试'
      },
      handler: (req, res) => {
        logger.security('登录限流触发', {
          ip: req.ip,
          username: req.body?.username,
          userAgent: req.get('User-Agent')
        });

        throw new RateLimitError('登录尝试过于频繁，请稍后再试');
      }
    });
  }

  /**
   * 请求大小限制
   */
  static requestSizeLimit() {
    return (req, res, next) => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
        logger.security('请求大小超限', {
          ip: req.ip,
          contentLength: req.headers['content-length'],
          url: req.url,
          method: req.method
        });

        return res.status(413).json({
          success: false,
          message: '请求数据过大',
          code: 'REQUEST_TOO_LARGE',
          maxSize: '10MB'
        });
      }

      next();
    };
  }

  /**
   * 可疑活动检测
   */
  static suspiciousActivityDetection() {
    return (req, res, next) => {
      const suspiciousPatterns = [
        /\.\./,           // 路径遍历
        /<script/i,       // XSS尝试
        /union.*select/i, // SQL注入尝试
        /javascript:/i,   // JavaScript协议
        /vbscript:/i,     // VBScript协议
        /on\w+=/i,        // 事件处理器
        /eval\(/i,        // eval函数
        /exec\(/i         // exec函数
      ];

      const checkString = req.url + JSON.stringify(req.query) + JSON.stringify(req.body);
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(checkString)) {
          logger.security('检测到可疑活动', {
            ip: req.ip,
            pattern: pattern.toString(),
            url: req.url,
            method: req.method,
            userAgent: req.get('User-Agent'),
            body: req.body,
            query: req.query
          });

          return res.status(400).json({
            success: false,
            message: '检测到可疑请求',
            code: 'SUSPICIOUS_ACTIVITY'
          });
        }
      }

      next();
    };
  }

  /**
   * IP白名单检查（可选）
   */
  static ipWhitelist(allowedIPs = []) {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next(); // 没有配置白名单则跳过
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (!allowedIPs.includes(clientIP)) {
        logger.security('IP不在白名单', {
          ip: clientIP,
          allowedIPs,
          url: req.url,
          method: req.method
        });

        return res.status(403).json({
          success: false,
          message: '访问被拒绝',
          code: 'IP_NOT_ALLOWED'
        });
      }

      next();
    };
  }

  /**
   * 用户代理检查
   */
  static userAgentValidation() {
    return (req, res, next) => {
      const userAgent = req.get('User-Agent');
      
      // 阻止空的或可疑的User-Agent
      if (!userAgent || userAgent.length < 5) {
        logger.security('可疑User-Agent', {
          ip: req.ip,
          userAgent,
          url: req.url,
          method: req.method
        });

        return res.status(400).json({
          success: false,
          message: '无效的User-Agent',
          code: 'INVALID_USER_AGENT'
        });
      }

      // 阻止已知的恶意爬虫
      const blockedAgents = [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /masscan/i,
        /zap/i
      ];

      for (const pattern of blockedAgents) {
        if (pattern.test(userAgent)) {
          logger.security('阻止恶意User-Agent', {
            ip: req.ip,
            userAgent,
            pattern: pattern.toString(),
            url: req.url
          });

          return res.status(403).json({
            success: false,
            message: '访问被拒绝',
            code: 'BLOCKED_USER_AGENT'
          });
        }
      }

      next();
    };
  }

  /**
   * CORS配置
   */
  static cors() {
    return (req, res, next) => {
      const allowedOrigins = [
        'http://localhost:3333',
        'http://127.0.0.1:3333',
        'https://your-domain.com' // 生产环境域名
      ];

      const origin = req.headers.origin;
      
      if (!origin || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24小时

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * 安全日志记录
   */
  static securityLogger() {
    return (req, res, next) => {
      // 记录所有请求的基本信息
      logger.info('请求接收', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        timestamp: new Date().toISOString()
      });

      // 记录敏感操作
      const sensitiveRoutes = ['/api/auth', '/api/analysis', '/admin'];
      if (sensitiveRoutes.some(route => req.url.startsWith(route))) {
        logger.security('敏感操作访问', {
          ip: req.ip,
          url: req.url,
          method: req.method,
          userAgent: req.get('User-Agent'),
          body: req.method === 'POST' ? { ...req.body } : undefined
        });
      }

      next();
    };
  }
}

module.exports = SecurityMiddleware;