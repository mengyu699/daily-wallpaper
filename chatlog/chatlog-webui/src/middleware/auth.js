const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * 身份验证中间件
 */
class AuthMiddleware {
  /**
   * JWT令牌验证中间件
   */
  static authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.security('访问被拒绝：缺少认证令牌', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      return res.status(401).json({
        success: false,
        message: '访问被拒绝：需要身份验证',
        code: 'MISSING_TOKEN'
      });
    }

    const decoded = User.verifyToken(token);
    if (!decoded) {
      logger.security('访问被拒绝：无效令牌', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        token: token.substring(0, 20) + '...'
      });

      return res.status(403).json({
        success: false,
        message: '访问被拒绝：无效的身份验证令牌',
        code: 'INVALID_TOKEN'
      });
    }

    // 检查令牌是否过期
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      logger.security('访问被拒绝：令牌已过期', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: decoded.id,
        expiredAt: new Date(decoded.exp * 1000).toISOString()
      });

      return res.status(401).json({
        success: false,
        message: '访问被拒绝：身份验证令牌已过期',
        code: 'TOKEN_EXPIRED'
      });
    }

    // 将用户信息添加到请求对象
    req.user = decoded;
    req.userId = decoded.id;

    logger.business('用户认证成功', {
      userId: decoded.id,
      username: decoded.username,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    next();
  }

  /**
   * 可选认证中间件（令牌存在时验证，不存在时继续）
   */
  static optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // 没有令牌，继续处理但不设置用户信息
      return next();
    }

    const decoded = User.verifyToken(token);
    if (decoded) {
      req.user = decoded;
      req.userId = decoded.id;
    }

    next();
  }

  /**
   * 角色验证中间件
   */
  static requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '需要身份验证',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (req.user.role !== requiredRole && req.user.role !== 'admin') {
        logger.security('访问被拒绝：权限不足', {
          userId: req.user.id,
          username: req.user.username,
          requiredRole,
          userRole: req.user.role,
          url: req.originalUrl,
          method: req.method,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          message: `访问被拒绝：需要${requiredRole}权限`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    };
  }

  /**
   * 管理员权限验证
   */
  static requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '需要身份验证',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (req.user.role !== 'admin') {
      logger.security('访问被拒绝：需要管理员权限', {
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        message: '访问被拒绝：需要管理员权限',
        code: 'ADMIN_REQUIRED'
      });
    }

    next();
  }

  /**
   * 会话验证中间件（用于Web页面）
   */
  static authenticateSession(req, res, next) {
    if (req.session && req.session.userId) {
      // 会话存在，获取用户信息
      User.findById(req.session.userId)
        .then(user => {
          if (user && user.isActive && !user.isLocked()) {
            req.user = user.toJSON();
            req.userId = user.id;
            
            // 更新会话活动时间
            req.session.lastActivity = Date.now();

            next();
          } else {
            // 用户不存在或被锁定，清除会话
            req.session.destroy((err) => {
              if (err) {
                logger.error('会话销毁失败', { error: err.message });
              }
            });

            res.redirect('/login');
          }
        })
        .catch(error => {
          logger.error('会话验证失败', { error: error.message, sessionId: req.sessionID });
          res.redirect('/login');
        });
    } else {
      // 没有会话，重定向到登录页
      res.redirect('/login');
    }
  }

  /**
   * 可选会话验证（已登录用户获取信息，未登录继续）
   */
  static optionalSession(req, res, next) {
    if (req.session && req.session.userId) {
      User.findById(req.session.userId)
        .then(user => {
          if (user && user.isActive && !user.isLocked()) {
            req.user = user.toJSON();
            req.userId = user.id;
            req.session.lastActivity = Date.now();
          }
          next();
        })
        .catch(error => {
          logger.error('可选会话验证失败', { error: error.message });
          next();
        });
    } else {
      next();
    }
  }

  /**
   * 会话超时检查
   */
  static checkSessionTimeout(req, res, next) {
    if (req.session && req.session.lastActivity) {
      const sessionTimeout = 8 * 60 * 60 * 1000; // 8小时
      const timeSinceLastActivity = Date.now() - req.session.lastActivity;

      if (timeSinceLastActivity > sessionTimeout) {
        logger.security('会话超时', {
          userId: req.session.userId,
          lastActivity: new Date(req.session.lastActivity).toISOString(),
          sessionId: req.sessionID
        });

        req.session.destroy((err) => {
          if (err) {
            logger.error('超时会话销毁失败', { error: err.message });
          }
        });

        return res.status(401).json({
          success: false,
          message: '会话已超时，请重新登录',
          code: 'SESSION_TIMEOUT'
        });
      }

      // 更新活动时间
      req.session.lastActivity = Date.now();
    }

    next();
  }

  /**
   * API密钥验证中间件（用于API访问）
   */
  static authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: '需要API密钥',
        code: 'MISSING_API_KEY'
      });
    }

    // 验证API密钥（这里简化处理，实际生产环境应该从数据库验证）
    const validApiKeys = [
      process.env.CHATLOG_API_KEY,
      process.env.DEEPSEEK_API_KEY
    ].filter(Boolean);

    if (!validApiKeys.includes(apiKey)) {
      logger.security('无效的API密钥', {
        apiKey: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: '无效的API密钥',
        code: 'INVALID_API_KEY'
      });
    }

    next();
  }

  /**
   * 限制登录尝试中间件
   */
  static rateLimitLogin(req, res, next) {
    const ip = req.ip;
    const key = `login_attempts_${ip}`;
    
    // 简化版限流（生产环境应使用Redis）
    if (!req.app.locals.loginAttempts) {
      req.app.locals.loginAttempts = new Map();
    }

    const attempts = req.app.locals.loginAttempts.get(key) || { count: 0, resetTime: Date.now() + 15 * 60 * 1000 };

    // 检查是否需要重置计数
    if (Date.now() > attempts.resetTime) {
      attempts.count = 0;
      attempts.resetTime = Date.now() + 15 * 60 * 1000;
    }

    // 检查是否超过限制
    if (attempts.count >= 5) {
      logger.security('登录尝试过于频繁', {
        ip,
        attempts: attempts.count,
        resetTime: new Date(attempts.resetTime).toISOString()
      });

      return res.status(429).json({
        success: false,
        message: '登录尝试过于频繁，请稍后重试',
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        retryAfter: Math.ceil((attempts.resetTime - Date.now()) / 1000)
      });
    }

    // 增加尝试计数
    attempts.count += 1;
    req.app.locals.loginAttempts.set(key, attempts);

    // 登录成功时清除计数的处理在登录成功回调中
    req.clearLoginAttempts = () => {
      req.app.locals.loginAttempts.delete(key);
    };

    next();
  }

  /**
   * 用户状态检查中间件
   */
  static async checkUserStatus(req, res, next) {
    if (!req.userId) {
      return next();
    }

    try {
      const user = await User.findById(req.userId);
      
      if (!user) {
        logger.security('用户不存在', { userId: req.userId });
        return res.status(401).json({
          success: false,
          message: '用户不存在',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.isActive) {
        logger.security('用户账户已禁用', { userId: req.userId, username: user.username });
        return res.status(403).json({
          success: false,
          message: '账户已被禁用',
          code: 'ACCOUNT_DISABLED'
        });
      }

      if (user.isLocked()) {
        logger.security('用户账户已锁定', { userId: req.userId, username: user.username });
        return res.status(423).json({
          success: false,
          message: '账户已被锁定，请稍后重试',
          code: 'ACCOUNT_LOCKED'
        });
      }

      // 更新用户信息到请求对象
      req.user = user.toJSON();
      next();
    } catch (error) {
      logger.error('用户状态检查失败', { error: error.message, userId: req.userId });
      return res.status(500).json({
        success: false,
        message: '用户状态检查失败',
        code: 'USER_STATUS_CHECK_ERROR'
      });
    }
  }
}

module.exports = AuthMiddleware;