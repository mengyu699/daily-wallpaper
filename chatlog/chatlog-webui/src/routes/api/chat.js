const express = require('express');
const router = express.Router();

const chatController = require('../../controllers/chatController');
const SecurityMiddleware = require('../../middleware/security');
const { 
  validateSearchParams, 
  validateExportParams 
} = require('../../utils/validators');

/**
 * 聊天API路由
 * 基础路径: /api/chat
 */

// 应用安全中间件
router.use(SecurityMiddleware.apiRateLimit());
router.use(SecurityMiddleware.requestSizeLimit());
router.use(SecurityMiddleware.suspiciousActivityDetection());

/**
 * @route   GET /api/chat/search
 * @desc    搜索聊天消息
 * @access  Public
 * @example /api/chat/search?q=AI&startDate=2025-07-16&limit=20
 */
router.get('/search', 
  validateSearchParams,
  chatController.searchMessages
);

/**
 * @route   POST /api/chat/search
 * @desc    搜索聊天消息（POST方式，支持复杂参数）
 * @access  Public
 */
router.post('/search',
  validateSearchParams,
  chatController.searchMessages
);

/**
 * @route   GET /api/chat/contacts
 * @desc    获取联系人列表
 * @access  Public
 */
router.get('/contacts', 
  chatController.getContacts
);

/**
 * @route   GET /api/chat/chatrooms
 * @desc    获取群聊列表
 * @access  Public
 */
router.get('/chatrooms', 
  chatController.getChatrooms
);

/**
 * @route   POST /api/chat/export
 * @desc    导出聊天数据
 * @access  Public
 */
router.post('/export',
  validateExportParams,
  chatController.exportMessages
);

/**
 * @route   GET /api/chat/status
 * @desc    获取聊天服务状态
 * @access  Public
 */
router.get('/status', 
  chatController.getServiceStatus
);

/**
 * @route   GET /api/chat/health
 * @desc    健康检查接口
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'chat-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

module.exports = router;