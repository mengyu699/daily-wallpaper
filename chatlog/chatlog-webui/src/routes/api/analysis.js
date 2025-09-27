const express = require('express');
const router = express.Router();

const analysisController = require('../../controllers/analysisController');
const SecurityMiddleware = require('../../middleware/security');
const { 
  validateAnalysisParams
} = require('../../utils/validators');

/**
 * 分析API路由
 * 基础路径: /api/analysis
 */

// 应用安全中间件
router.use(SecurityMiddleware.apiRateLimit());
router.use(SecurityMiddleware.requestSizeLimit());
router.use(SecurityMiddleware.suspiciousActivityDetection());

/**
 * @route   POST /api/analysis/run
 * @desc    执行AI分析
 * @access  Public
 * @rateLimit 更严格的限流（AI分析成本较高）
 */
router.post('/run',
  SecurityMiddleware.aiAnalysisRateLimit(),
  validateAnalysisParams,
  analysisController.runAnalysis
);

/**
 * @route   GET /api/analysis/types
 * @desc    获取支持的分析类型列表
 * @access  Public
 */
router.get('/types',
  analysisController.getAnalysisTypes
);

/**
 * @route   GET /api/analysis/history
 * @desc    获取分析历史记录
 * @access  Public
 */
router.get('/history',
  analysisController.getAnalysisHistory
);

/**
 * @route   POST /api/analysis/save
 * @desc    保存分析结果
 * @access  Public
 */
router.post('/save',
  analysisController.saveAnalysisResult
);

/**
 * @route   GET /api/analysis/status
 * @desc    获取AI服务状态
 * @access  Public
 */
router.get('/status',
  analysisController.getAiServiceStatus
);

/**
 * @route   GET /api/analysis/health
 * @desc    分析服务健康检查
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'analysis-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    supportedTypes: [
      'ultrathink',
      'summary', 
      'sentiment', 
      'keywords', 
      'topics', 
      'statistics', 
      'custom'
    ]
  });
});

module.exports = router;