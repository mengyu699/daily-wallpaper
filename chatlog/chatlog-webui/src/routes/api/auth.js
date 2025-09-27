const express = require('express');
const router = express.Router();

const authController = require('../../controllers/authController');
const AuthMiddleware = require('../../middleware/auth');
const SecurityMiddleware = require('../../middleware/security');
const { validateLoginParams, validateRegisterParams } = require('../../utils/validators');

/**
 * 身份验证API路由
 * 基础路径: /api/auth
 */

// 应用安全中间件
router.use(SecurityMiddleware.securityLogger());
router.use(SecurityMiddleware.requestSizeLimit());

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post('/login',
  AuthMiddleware.rateLimitLogin,
  validateLoginParams,
  authController.login
);

/**
 * @route   POST /api/auth/register
 * @desc    用户注册
 * @access  Public
 */
router.post('/register',
  SecurityMiddleware.apiRateLimit(),
  validateRegisterParams,
  authController.register
);

/**
 * @route   POST /api/auth/logout
 * @desc    用户登出
 * @access  Private
 */
router.post('/logout',
  AuthMiddleware.optionalAuth,
  authController.logout
);

/**
 * @route   GET /api/auth/me
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/me',
  AuthMiddleware.authenticateToken,
  AuthMiddleware.checkUserStatus,
  authController.getCurrentUser
);

/**
 * @route   PUT /api/auth/password
 * @desc    修改密码
 * @access  Private
 */
router.put('/password',
  AuthMiddleware.authenticateToken,
  AuthMiddleware.checkUserStatus,
  authController.changePassword
);

/**
 * @route   PUT /api/auth/profile
 * @desc    更新用户资料
 * @access  Private
 */
router.put('/profile',
  AuthMiddleware.authenticateToken,
  AuthMiddleware.checkUserStatus,
  authController.updateProfile
);

/**
 * @route   POST /api/auth/refresh
 * @desc    刷新JWT令牌
 * @access  Private
 */
router.post('/refresh',
  AuthMiddleware.authenticateToken,
  AuthMiddleware.checkUserStatus,
  authController.refreshToken
);

/**
 * @route   POST /api/auth/verify
 * @desc    验证JWT令牌
 * @access  Public
 */
router.post('/verify',
  SecurityMiddleware.apiRateLimit(),
  authController.verifyToken
);

/**
 * @route   GET /api/auth/status
 * @desc    获取认证系统状态
 * @access  Public
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    service: 'authentication',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      registration: true,
      login: true,
      jwt: true,
      sessions: true,
      passwordSecurity: true,
      rateLimiting: true,
      accountLocking: true
    },
    security: {
      passwordMinLength: 8,
      passwordRequirements: ['lowercase', 'uppercase', 'numbers', 'symbols'],
      maxLoginAttempts: 5,
      lockoutDuration: '30 minutes',
      tokenExpiry: '24 hours',
      sessionTimeout: '8 hours'
    }
  });
});

module.exports = router;