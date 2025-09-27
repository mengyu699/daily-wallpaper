const express = require('express');
const path = require('path');
const compression = require('compression');
const session = require('express-session');

// 配置和工具
const config = require('./config/api');
const logger = require('./src/utils/logger');
const { errorHandler, notFoundHandler } = require('./src/utils/errors');

// 中间件
const SecurityMiddleware = require('./src/middleware/security');
const AuthMiddleware = require('./src/middleware/auth');

// 模型
const User = require('./src/models/User');

// 路由
const apiRoutes = require('./src/routes/api');
const authRoutes = require('./src/routes/api/auth');

/**
 * Chatlog WebUI 主应用
 * 版本: 2.0.0 - 生产级重构版本
 */
class App {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.nodeEnv = config.server.nodeEnv;
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * 初始化中间件
   */
  initializeMiddleware() {
    logger.info('初始化应用中间件...');

    // 信任代理（如果在反向代理后面）
    this.app.set('trust proxy', 1);

    // 安全中间件
    this.app.use(SecurityMiddleware.helmet());
    this.app.use(SecurityMiddleware.cors());
    this.app.use(SecurityMiddleware.globalRateLimit());
    this.app.use(SecurityMiddleware.securityLogger());

    // 会话管理
    this.app.use(session({
      secret: config.server.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: this.nodeEnv === 'production',
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8小时
        sameSite: 'strict'
      },
      name: 'chatlog.sid'
    }));

    // 基础中间件
    this.app.use(compression()); // 响应压缩
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // 请求日志中间件
    this.app.use(logger.requestMiddleware);

    // 静态文件服务
    this.app.use(express.static(path.join(__dirname, 'public'), {
      maxAge: this.nodeEnv === 'production' ? '1d' : 0,
      etag: true,
      lastModified: true
    }));

    // 视图引擎配置
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));

    logger.info('中间件初始化完成');
  }

  /**
   * 初始化路由
   */
  initializeRoutes() {
    logger.info('初始化应用路由...');

    // 身份验证API路由（公开访问）
    this.app.use('/api/auth', authRoutes);

    // 其他API路由（需要身份验证）
    this.app.use('/api', AuthMiddleware.authenticateToken, apiRoutes);

    // 身份验证Web路由
    this.initializeAuthRoutes();

    // 受保护的Web路由
    this.initializeProtectedWebRoutes();

    // 公开的Web路由
    this.initializePublicWebRoutes();

    logger.info('路由初始化完成');
  }

  /**
   * 初始化身份验证Web路由
   */
  initializeAuthRoutes() {
    // 登录页面
    this.app.get('/login', (req, res) => {
      if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
      }
      
      res.render('login', {
        title: '登录',
        message: req.query.message,
        messageType: req.query.type,
        showDefaultCredentials: !process.env.DEFAULT_ADMIN_PASSWORD
      });
    });

    // 注册页面
    this.app.get('/register', (req, res) => {
      if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
      }
      
      res.render('register', {
        title: '注册',
        message: req.query.message,
        messageType: req.query.type
      });
    });

    // 登录处理
    this.app.post('/login', async (req, res) => {
      try {
        const axios = require('axios');
        const apiUrl = `${req.protocol}://${req.get('host')}/api/auth/login`;
        const response = await axios.post(apiUrl, req.body);

        if (response.data.success) {
          // 设置会话
          req.session.userId = response.data.data.user.id;
          req.session.username = response.data.data.user.username;
          req.session.loginTime = Date.now();
          req.session.lastActivity = Date.now();

          res.redirect('/dashboard');
        } else {
          res.redirect(`/login?message=${encodeURIComponent(response.data.message)}&type=danger`);
        }
      } catch (error) {
        const message = error.response?.data?.message || '登录失败，请稍后重试';
        res.redirect(`/login?message=${encodeURIComponent(message)}&type=danger`);
      }
    });

    // 注册处理
    this.app.post('/register', async (req, res) => {
      try {
        const axios = require('axios');
        const apiUrl = `${req.protocol}://${req.get('host')}/api/auth/register`;
        const response = await axios.post(apiUrl, req.body);

        if (response.data.success) {
          res.redirect(`/login?message=${encodeURIComponent('注册成功，请登录')}&type=success&username=${encodeURIComponent(req.body.username)}`);
        } else {
          res.redirect(`/register?message=${encodeURIComponent(response.data.message)}&type=danger`);
        }
      } catch (error) {
        const message = error.response?.data?.message || '注册失败，请稍后重试';
        res.redirect(`/register?message=${encodeURIComponent(message)}&type=danger`);
      }
    });

    // 登出处理
    this.app.post('/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          logger.error('会话销毁失败', { error: err.message });
        }
        res.redirect('/login');
      });
    });

    // 用户名可用性检查
    this.app.post('/api/auth/check-username', async (req, res) => {
      try {
        const { username } = req.body;
        const user = await User.findByUsername(username);
        
        res.json({
          available: !user,
          username
        });
      } catch (error) {
        res.status(500).json({
          available: false,
          error: '检查失败'
        });
      }
    });
  }

  /**
   * 初始化受保护的Web路由
   */
  initializeProtectedWebRoutes() {
    // 应用会话验证中间件到所有受保护路由
    this.app.use(['/dashboard', '/chat', '/analysis', '/profile'], 
      AuthMiddleware.checkSessionTimeout,
      AuthMiddleware.authenticateSession
    );

    // 仪表板
    this.app.get('/dashboard', (req, res) => {
      res.render('index', {
        title: '数据面板',
        page: 'dashboard',
        user: req.user
      });
    });

    // 聊天搜索页面
    this.app.get('/chat', (req, res) => {
      res.render('search', {
        title: '消息搜索',
        page: 'chat',
        user: req.user
      });
    });

    // AI分析页面
    this.app.get('/analysis', (req, res) => {
      res.render('analysis', {
        title: 'AI智能分析',
        page: 'analysis',
        user: req.user,
        analysisTypes: [
          { id: 'ultrathink', name: 'UltraThink超级分析', description: '🧠 深度多维度AI超级分析，融合预测洞察' },
          { id: 'summary', name: '聊天摘要', description: '生成聊天内容的智能摘要' },
          { id: 'sentiment', name: '情感分析', description: '分析聊天中的情感倾向' },
          { id: 'keywords', name: '关键词提取', description: '提取聊天中的重要关键词' },
          { id: 'topics', name: '话题分类', description: '自动分类聊天话题' },
          { id: 'statistics', name: '统计分析', description: '生成详细的统计报告' }
        ],
        results: null
      });
    });

    // 用户资料页面
    this.app.get('/profile', (req, res) => {
      res.render('profile', {
        title: '用户资料',
        page: 'profile',
        user: req.user
      });
    });

    // 受保护的POST路由需要额外的令牌验证
    this.app.post(['/analysis/run', '/chat/search', '/chat/export'], 
      AuthMiddleware.optionalAuth, // 尝试获取令牌
      async (req, res, next) => {
        // 如果没有API令牌，使用会话信息
        if (!req.user && req.session?.userId) {
          try {
            const user = await User.findById(req.session.userId);
            if (user && user.isActive && !user.isLocked()) {
              req.user = user.toJSON();
              req.userId = user.id;
            }
          } catch (error) {
            logger.error('会话用户验证失败', { error: error.message });
          }
        }
        next();
      }
    );

    // AI分析执行（POST）
    this.app.post('/analysis/run', async (req, res) => {
      try {
        if (!req.userId) {
          return res.status(401).json({ success: false, message: '需要身份验证' });
        }

        const axios = require('axios');
        const apiUrl = `${req.protocol}://${req.get('host')}/api/analysis/run`;
        const response = await axios.post(apiUrl, req.body, {
          headers: {
            'Authorization': `Bearer ${req.headers.authorization?.split(' ')[1] || ''}`
          }
        });
        
        res.render('analysis', {
          title: 'AI分析结果',
          page: 'analysis',
          user: req.user,
          analysisTypes: [
            { id: 'ultrathink', name: 'UltraThink超级分析', description: '🧠 深度多维度AI超级分析，融合预测洞察' },
            { id: 'summary', name: '聊天摘要', description: '生成聊天内容的智能摘要' },
            { id: 'sentiment', name: '情感分析', description: '分析聊天中的情感倾向' },
            { id: 'keywords', name: '关键词提取', description: '提取聊天中的重要关键词' },
            { id: 'topics', name: '话题分类', description: '自动分类聊天话题' },
            { id: 'statistics', name: '统计分析', description: '生成详细的统计报告' }
          ],
          results: response.data.data
        });
      } catch (error) {
        logger.error('Web分析请求失败', { error: error.message });
        res.render('analysis', {
          title: 'AI分析出错',
          page: 'analysis',
          user: req.user,
          analysisTypes: [],
          results: null,
          error: `分析失败: ${error.message}`
        });
      }
    });

    // 聊天搜索执行（POST）
    this.app.post('/chat/search', async (req, res) => {
      try {
        if (!req.userId) {
          return res.status(401).json({ success: false, message: '需要身份验证' });
        }

        const axios = require('axios');
        const apiUrl = `${req.protocol}://${req.get('host')}/api/chat/search`;
        const response = await axios.post(apiUrl, req.body, {
          headers: {
            'Authorization': `Bearer ${req.headers.authorization?.split(' ')[1] || ''}`
          }
        });
        
        res.json(response.data);
      } catch (error) {
        logger.error('Web搜索请求失败', { error: error.message });
        res.status(500).json({
          success: false,
          message: `搜索失败: ${error.message}`
        });
      }
    });

    // 导出功能
    this.app.post('/chat/export', async (req, res) => {
      try {
        if (!req.userId) {
          return res.status(401).json({ success: false, message: '需要身份验证' });
        }

        const axios = require('axios');
        const apiUrl = `${req.protocol}://${req.get('host')}/api/chat/export`;
        const response = await axios.post(apiUrl, req.body, {
          headers: {
            'Authorization': `Bearer ${req.headers.authorization?.split(' ')[1] || ''}`
          }
        });
        
        res.json(response.data);
      } catch (error) {
        logger.error('Web导出请求失败', { error: error.message });
        res.status(500).json({
          success: false,
          message: `导出失败: ${error.message}`
        });
      }
    });
  }

  /**
   * 初始化公开Web路由
   */
  initializePublicWebRoutes() {
    // 根路径处理
    this.app.get('/', (req, res) => {
      if (req.session && req.session.userId) {
        res.redirect('/dashboard');
      } else {
        res.redirect('/login');
      }
    });

    // 系统状态页面（公开访问）
    this.app.get('/status', async (req, res) => {
      try {
        const [chatStatus, aiStatus] = await Promise.allSettled([
          require('axios').get(`${req.protocol}://${req.get('host')}/api/chat/status`),
          require('axios').get(`${req.protocol}://${req.get('host')}/api/analysis/status`)
        ]);

        res.render('status', {
          title: '系统状态',
          page: 'status',
          user: null,
          chatStatus: chatStatus.status === 'fulfilled' ? chatStatus.value.data : null,
          aiStatus: aiStatus.status === 'fulfilled' ? aiStatus.value.data : null
        });
      } catch (error) {
        res.render('status', {
          title: '系统状态',
          page: 'status',
          user: null,
          error: error.message
        });
      }
    });

    // 健康检查页面（公开访问）
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0',
        environment: this.nodeEnv,
        authentication: 'enabled'
      });
    });

    // 服务条款页面
    this.app.get('/terms', (req, res) => {
      res.render('terms', {
        title: '服务条款',
        page: 'terms',
        user: null
      });
    });

    // 隐私政策页面
    this.app.get('/privacy', (req, res) => {
      res.render('privacy', {
        title: '隐私政策',
        page: 'privacy',
        user: null
      });
    });
  }

  /**
   * 初始化错误处理
   */
  initializeErrorHandling() {
    logger.info('初始化错误处理...');

    // 404处理
    this.app.use(notFoundHandler);

    // 全局错误处理
    this.app.use(errorHandler);

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('未捕获异常', { 
        error: error.message,
        stack: error.stack 
      });
      
      // 优雅关闭
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // 未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', { 
        reason: reason?.message || reason,
        promise: promise?.toString() 
      });
      
      // 优雅关闭
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // 进程信号处理
    process.on('SIGTERM', () => {
      logger.info('收到SIGTERM信号，开始优雅关闭...');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('收到SIGINT信号，开始优雅关闭...');
      this.gracefulShutdown('SIGINT');
    });

    logger.info('错误处理初始化完成');
  }

  /**
   * 启动服务器
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
          logger.info('🚀 服务器启动成功', {
            port: this.port,
            env: this.nodeEnv,
            pid: process.pid,
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            memory: process.memoryUsage(),
            uptime: process.uptime()
          });

          // 启动后验证服务
          this.postStartupValidation();

          resolve(this.server);
        });

        this.server.on('error', (error) => {
          logger.error('服务器启动失败', { 
            error: error.message,
            code: error.code,
            port: this.port 
          });
          reject(error);
        });

      } catch (error) {
        logger.error('应用启动失败', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * 启动后验证
   */
  async postStartupValidation() {
    try {
      logger.info('执行启动后验证...');

      // 创建默认管理员用户
      try {
        const defaultAdmin = await User.createDefaultAdmin();
        logger.info('默认管理员用户检查完成', {
          username: defaultAdmin.username,
          created: defaultAdmin.createdAt === defaultAdmin.updatedAt
        });
      } catch (error) {
        logger.error('默认管理员用户创建失败', { error: error.message });
      }

      // 验证关键服务
      const chatlogService = require('./src/services/chatlogService');
      const aiService = require('./src/services/aiService');

      const [chatlogHealth, aiHealth] = await Promise.allSettled([
        chatlogService.healthCheck(),
        aiService.healthCheck()
      ]);

      logger.info('服务健康检查完成', {
        chatlog: chatlogHealth.status === 'fulfilled' ? chatlogHealth.value : 'failed',
        ai: aiHealth.status === 'fulfilled' ? aiHealth.value : 'failed'
      });

      // 内存监控启动
      this.startMemoryMonitoring();

    } catch (error) {
      logger.error('启动后验证失败', { error: error.message });
    }
  }

  /**
   * 内存监控
   */
  startMemoryMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

      logger.info('内存使用情况', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
        uptime: Math.round(process.uptime())
      });

      // 内存使用超过阈值时警告
      if (heapUsedMB > 500) {
        logger.warn('内存使用过高', { heapUsedMB });
      }

      // 触发垃圾回收（仅开发环境）
      if (this.nodeEnv === 'development' && global.gc) {
        global.gc();
      }

    }, 30000); // 每30秒检查一次
  }

  /**
   * 优雅关闭
   */
  gracefulShutdown(signal) {
    logger.info(`开始优雅关闭 (${signal})...`);

    if (this.server) {
      this.server.close((error) => {
        if (error) {
          logger.error('服务器关闭失败', { error: error.message });
          process.exit(1);
        }

        logger.info('服务器已关闭');
        process.exit(0);
      });

      // 强制关闭超时
      setTimeout(() => {
        logger.error('强制关闭服务器（超时）');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  }
}

// 创建并启动应用
const app = new App();

if (require.main === module) {
  app.start().catch((error) => {
    console.error('应用启动失败:', error);
    process.exit(1);
  });
}

module.exports = app;