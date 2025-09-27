const express = require('express');
const router = express.Router();

const chatRoutes = require('./chat');
const analysisRoutes = require('./analysis');
const SecurityMiddleware = require('../../middleware/security');
const logger = require('../../utils/logger');

/**
 * API路由主入口
 * 基础路径: /api
 */

// 全局API中间件
router.use(SecurityMiddleware.securityLogger());
router.use(SecurityMiddleware.userAgentValidation());

// API信息端点
router.get('/', (req, res) => {
  res.json({
    success: true,
    api: 'Chatlog WebUI API',
    version: '2.0.0',
    description: '微信聊天记录分析系统API',
    timestamp: new Date().toISOString(),
    endpoints: {
      chat: {
        search: 'GET|POST /api/chat/search',
        contacts: 'GET /api/chat/contacts',
        chatrooms: 'GET /api/chat/chatrooms',
        export: 'POST /api/chat/export',
        status: 'GET /api/chat/status'
      },
      analysis: {
        run: 'POST /api/analysis/run',
        types: 'GET /api/analysis/types',
        history: 'GET /api/analysis/history',
        save: 'POST /api/analysis/save',
        status: 'GET /api/analysis/status'
      }
    },
    documentation: '/api/docs'
  });
});

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0',
    services: {
      api: 'healthy',
      // 实际实现中应该检查各个服务的状态
      chatlog: 'unknown',
      deepseek: 'unknown'
    }
  });
});

// API文档端点（简单版本）
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    title: 'Chatlog WebUI API 文档',
    version: '2.0.0',
    description: '微信聊天记录分析系统API文档',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      '/chat/search': {
        method: 'GET|POST',
        description: '搜索聊天消息',
        parameters: {
          q: '搜索关键词（可选）',
          startDate: '开始日期 YYYY-MM-DD（可选）',
          endDate: '结束日期 YYYY-MM-DD（可选）',
          talker: '联系人ID（可选）',
          limit: '返回数量限制 1-100（可选，默认50）',
          type: '消息类型过滤（可选）'
        },
        example: '/api/chat/search?q=AI&startDate=2025-07-16&limit=20'
      },
      '/chat/contacts': {
        method: 'GET',
        description: '获取联系人列表',
        parameters: {},
        example: '/api/chat/contacts'
      },
      '/chat/chatrooms': {
        method: 'GET',
        description: '获取群聊列表',
        parameters: {},
        example: '/api/chat/chatrooms'
      },
      '/chat/export': {
        method: 'POST',
        description: '导出聊天数据',
        parameters: {
          format: '导出格式（json|csv|txt）',
          dateRange: '日期范围（可选）',
          contacts: '联系人列表（可选）',
          includeImages: '是否包含图片（可选）'
        },
        example: '{"format": "json", "dateRange": "2025-07-16 - 2025-07-16"}'
      },
      '/analysis/run': {
        method: 'POST',
        description: '执行AI分析',
        parameters: {
          analysisType: '分析类型（ultrathink|summary|sentiment|keywords|topics|statistics|custom）',
          dateRange: '日期范围（可选）',
          contacts: '联系人列表（可选）',
          customPrompt: '自定义分析要求（custom类型必需）'
        },
        example: '{"analysisType": "ultrathink", "dateRange": "2025-07-16 - 2025-07-16"}'
      },
      '/analysis/types': {
        method: 'GET',
        description: '获取支持的分析类型',
        parameters: {},
        example: '/api/analysis/types'
      }
    },
    rateLimit: {
      global: '1000 requests per 15 minutes per IP',
      api: '200 requests per 15 minutes per IP',
      analysis: '20 requests per 15 minutes per IP'
    },
    errorCodes: {
      400: 'Bad Request - 请求参数错误',
      401: 'Unauthorized - 身份验证失败',
      403: 'Forbidden - 访问被拒绝',
      404: 'Not Found - 资源不存在',
      429: 'Too Many Requests - 请求过于频繁',
      500: 'Internal Server Error - 服务器内部错误',
      503: 'Service Unavailable - 服务不可用'
    }
  });
});

// 挂载子路由
router.use('/chat', chatRoutes);
router.use('/analysis', analysisRoutes);

// API 404处理
router.use('*', (req, res) => {
  logger.warn('API 404', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: `API端点不存在: ${req.method} ${req.originalUrl}`,
    code: 'ENDPOINT_NOT_FOUND',
    availableEndpoints: [
      'GET /api/',
      'GET /api/health',
      'GET /api/docs',
      'GET|POST /api/chat/search',
      'GET /api/chat/contacts',
      'GET /api/chat/chatrooms',
      'POST /api/chat/export',
      'POST /api/analysis/run',
      'GET /api/analysis/types'
    ]
  });
});

module.exports = router;