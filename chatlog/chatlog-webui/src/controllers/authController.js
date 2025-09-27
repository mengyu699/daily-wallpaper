const User = require('../models/User');
const logger = require('../utils/logger');
const { ValidationError, AuthenticationError } = require('../utils/errors');

/**
 * 身份验证控制器
 * 处理登录、注册、令牌管理等功能
 */
class AuthController {
  /**
   * 用户登录
   */
  static async login(req, res) {
    try {
      const { username, password, rememberMe } = req.body;

      // 参数验证
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: '用户名和密码不能为空',
          code: 'MISSING_CREDENTIALS'
        });
      }

      // 查找用户
      const user = await User.findByUsername(username);
      if (!user) {
        logger.security('登录失败：用户不存在', {
          username,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // 检查账户状态
      if (!user.isActive) {
        logger.security('登录失败：账户已禁用', {
          userId: user.id,
          username: user.username,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          message: '账户已被禁用',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // 检查账户锁定状态
      if (user.isLocked()) {
        const lockTime = new Date(user.lockUntil);
        const remainingTime = Math.ceil((lockTime.getTime() - Date.now()) / 1000 / 60);

        logger.security('登录失败：账户已锁定', {
          userId: user.id,
          username: user.username,
          lockUntil: user.lockUntil,
          remainingMinutes: remainingTime,
          ip: req.ip
        });

        return res.status(423).json({
          success: false,
          message: `账户已被锁定，请${remainingTime}分钟后重试`,
          code: 'ACCOUNT_LOCKED',
          retryAfter: remainingTime * 60
        });
      }

      // 设置当前IP用于日志记录
      user.currentIP = req.ip;

      // 验证密码
      const isValidPassword = await user.verifyPassword(password);
      if (!isValidPassword) {
        // 密码错误，保存失败尝试次数
        await user.save();

        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
          code: 'INVALID_CREDENTIALS',
          remainingAttempts: Math.max(0, 5 - user.loginAttempts)
        });
      }

      // 登录成功，保存用户状态
      await user.save();

      // 清除IP限制（如果使用了rateLimitLogin中间件）
      if (req.clearLoginAttempts) {
        req.clearLoginAttempts();
      }

      // 生成JWT令牌
      const token = user.generateToken();

      // 设置会话（用于Web页面）
      if (req.session) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.loginTime = Date.now();
        req.session.lastActivity = Date.now();

        // 记住我功能
        if (rememberMe) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
        }
      }

      const responseData = {
        success: true,
        message: '登录成功',
        data: {
          user: user.toJSON(),
          token,
          tokenType: 'Bearer',
          expiresIn: 24 * 60 * 60, // 24小时，秒为单位
          loginTime: new Date().toISOString()
        }
      };

      logger.business('用户登录成功', {
        userId: user.id,
        username: user.username,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        rememberMe: !!rememberMe
      });

      res.json(responseData);

    } catch (error) {
      logger.error('登录处理失败', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        body: { username: req.body?.username } // 不记录密码
      });

      res.status(500).json({
        success: false,
        message: '登录处理失败，请稍后重试',
        code: 'LOGIN_ERROR'
      });
    }
  }

  /**
   * 用户注册
   */
  static async register(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // 基础验证
      if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: '所有字段都是必需的',
          code: 'MISSING_FIELDS'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: '密码和确认密码不匹配',
          code: 'PASSWORD_MISMATCH'
        });
      }

      // 用户名格式验证
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({
          success: false,
          message: '用户名必须是3-20位字母、数字或下划线',
          code: 'INVALID_USERNAME'
        });
      }

      // 邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: '邮箱格式不正确',
          code: 'INVALID_EMAIL'
        });
      }

      // 检查用户名是否已存在
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: '用户名已存在',
          code: 'USERNAME_EXISTS'
        });
      }

      // 检查邮箱是否已存在
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: '邮箱已存在',
          code: 'EMAIL_EXISTS'
        });
      }

      // 创建新用户
      const user = await User.create({
        username,
        email,
        password,
        role: 'user', // 默认普通用户权限
        profile: {
          displayName: username,
          avatar: null,
          preferences: {
            theme: 'light',
            language: 'zh-CN',
            notifications: true
          }
        }
      });

      logger.business('新用户注册成功', {
        userId: user.id,
        username: user.username,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      logger.error('用户注册失败', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        body: {
          username: req.body?.username,
          email: req.body?.email
        }
      });

      res.status(500).json({
        success: false,
        message: '注册失败，请稍后重试',
        code: 'REGISTRATION_ERROR'
      });
    }
  }

  /**
   * 用户登出
   */
  static async logout(req, res) {
    try {
      const userId = req.userId || req.session?.userId;
      const username = req.user?.username || req.session?.username;

      // 销毁会话
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            logger.error('会话销毁失败', {
              error: err.message,
              userId,
              sessionId: req.sessionID
            });
          }
        });
      }

      logger.business('用户登出', {
        userId,
        username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '登出成功'
      });

    } catch (error) {
      logger.error('登出处理失败', {
        error: error.message,
        userId: req.userId,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: '登出失败',
        code: 'LOGOUT_ERROR'
      });
    }
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(req, res) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: '未登录',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      logger.error('获取用户信息失败', {
        error: error.message,
        userId: req.userId,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: '获取用户信息失败',
        code: 'GET_USER_ERROR'
      });
    }
  }

  /**
   * 修改密码
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: '所有密码字段都是必需的',
          code: 'MISSING_PASSWORD_FIELDS'
        });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: '新密码和确认密码不匹配',
          code: 'NEW_PASSWORD_MISMATCH'
        });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 'USER_NOT_FOUND'
        });
      }

      // 验证当前密码
      const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        logger.security('修改密码失败：当前密码错误', {
          userId: user.id,
          username: user.username,
          ip: req.ip
        });

        return res.status(400).json({
          success: false,
          message: '当前密码错误',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // 设置新密码
      await user.setPassword(newPassword);
      await user.save();

      logger.security('用户密码已修改', {
        userId: user.id,
        username: user.username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '密码修改成功'
      });

    } catch (error) {
      if (error.message.includes('密码不满足安全要求')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: 'WEAK_PASSWORD'
        });
      }

      logger.error('修改密码失败', {
        error: error.message,
        userId: req.userId,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: '修改密码失败',
        code: 'CHANGE_PASSWORD_ERROR'
      });
    }
  }

  /**
   * 更新用户资料
   */
  static async updateProfile(req, res) {
    try {
      const { displayName, email, preferences } = req.body;

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 'USER_NOT_FOUND'
        });
      }

      // 更新显示名称
      if (displayName !== undefined) {
        if (displayName.length < 1 || displayName.length > 50) {
          return res.status(400).json({
            success: false,
            message: '显示名称长度必须在1-50字符之间',
            code: 'INVALID_DISPLAY_NAME'
          });
        }
        user.profile.displayName = displayName;
      }

      // 更新邮箱
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: '邮箱格式不正确',
            code: 'INVALID_EMAIL'
          });
        }

        // 检查邮箱是否已被其他用户使用
        const existingEmail = await User.findByEmail(email);
        if (existingEmail && existingEmail.id !== user.id) {
          return res.status(409).json({
            success: false,
            message: '邮箱已被其他用户使用',
            code: 'EMAIL_EXISTS'
          });
        }

        user.email = email;
        user.emailVerified = false; // 邮箱变更需要重新验证
      }

      // 更新偏好设置
      if (preferences) {
        if (preferences.theme && ['light', 'dark', 'auto'].includes(preferences.theme)) {
          user.profile.preferences.theme = preferences.theme;
        }
        if (preferences.language && ['zh-CN', 'en-US'].includes(preferences.language)) {
          user.profile.preferences.language = preferences.language;
        }
        if (preferences.notifications !== undefined) {
          user.profile.preferences.notifications = !!preferences.notifications;
        }
      }

      await user.save();

      logger.business('用户资料已更新', {
        userId: user.id,
        username: user.username,
        updates: { displayName, email: !!email, preferences: !!preferences },
        ip: req.ip
      });

      res.json({
        success: true,
        message: '资料更新成功',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      logger.error('更新用户资料失败', {
        error: error.message,
        userId: req.userId,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: '更新资料失败',
        code: 'UPDATE_PROFILE_ERROR'
      });
    }
  }

  /**
   * 刷新JWT令牌
   */
  static async refreshToken(req, res) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: '需要身份验证',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const user = await User.findById(req.userId);
      if (!user || !user.isActive || user.isLocked()) {
        return res.status(403).json({
          success: false,
          message: '用户状态异常，无法刷新令牌',
          code: 'INVALID_USER_STATUS'
        });
      }

      // 生成新令牌
      const newToken = user.generateToken();

      logger.business('JWT令牌已刷新', {
        userId: user.id,
        username: user.username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '令牌刷新成功',
        data: {
          token: newToken,
          tokenType: 'Bearer',
          expiresIn: 24 * 60 * 60
        }
      });

    } catch (error) {
      logger.error('刷新令牌失败', {
        error: error.message,
        userId: req.userId,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: '刷新令牌失败',
        code: 'REFRESH_TOKEN_ERROR'
      });
    }
  }

  /**
   * 验证令牌有效性
   */
  static async verifyToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: '缺少令牌',
          code: 'MISSING_TOKEN'
        });
      }

      const decoded = User.verifyToken(token);
      
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: '无效的令牌',
          code: 'INVALID_TOKEN'
        });
      }

      // 检查用户是否仍然存在且活跃
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive || user.isLocked()) {
        return res.status(403).json({
          success: false,
          message: '用户状态异常',
          code: 'INVALID_USER_STATUS'
        });
      }

      res.json({
        success: true,
        message: '令牌有效',
        data: {
          valid: true,
          user: user.toJSON(),
          expiresAt: new Date(decoded.exp * 1000).toISOString()
        }
      });

    } catch (error) {
      logger.error('令牌验证失败', {
        error: error.message,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: '令牌验证失败',
        code: 'TOKEN_VERIFICATION_ERROR'
      });
    }
  }
}

module.exports = AuthController;