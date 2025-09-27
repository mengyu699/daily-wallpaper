const chatlogService = require('../services/chatlogService');
const aiService = require('../services/aiService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errors');
const { ValidationError } = require('../utils/errors');

/**
 * 分析控制器 - 处理所有AI分析相关的HTTP请求
 */
class AnalysisController {
  /**
   * 执行AI分析
   */
  runAnalysis = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      logger.info('收到AI分析请求', {
        requestId,
        body: req.body,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '分析参数无效',
          errors: errors.array(),
          requestId
        });
      }

      const { 
        analysisType, 
        dateRange, 
        contacts, 
        customPrompt,
        startDate,
        endDate
      } = req.body;

      // 构建消息搜索参数
      const searchParams = this.buildAnalysisSearchParams({
        dateRange,
        contacts,
        startDate,
        endDate,
        limit: 100 // 分析时限制消息数量以控制成本
      });

      // 获取消息数据
      logger.info('获取分析数据', { requestId, searchParams });
      const messageResult = await chatlogService.searchMessages(searchParams);

      if (!messageResult.messages || messageResult.messages.length === 0) {
        return res.status(404).json({
          success: false,
          message: '未找到匹配的聊天记录进行分析',
          requestId,
          searchParams
        });
      }

      // 执行AI分析
      logger.info('开始AI分析', {
        requestId,
        analysisType,
        messageCount: messageResult.messages.length
      });

      let analysisResult;
      switch (analysisType) {
        case 'ultrathink':
          analysisResult = await aiService.ultrathinkAnalysis(messageResult.messages);
          break;
        case 'summary':
          analysisResult = await aiService.generateSummary(messageResult.messages);
          break;
        case 'sentiment':
          analysisResult = await aiService.analyzeSentiment(messageResult.messages);
          break;
        case 'keywords':
          analysisResult = await aiService.extractKeywords(messageResult.messages);
          break;
        case 'topics':
          analysisResult = await aiService.classifyTopics(messageResult.messages);
          break;
        case 'statistics':
          analysisResult = await aiService.generateStatistics(messageResult.messages);
          break;
        case 'custom':
          if (!customPrompt || customPrompt.trim().length === 0) {
            throw new ValidationError('自定义分析类型必须提供分析要求');
          }
          analysisResult = await aiService.customAnalysis(messageResult.messages, customPrompt);
          break;
        default:
          throw new ValidationError(`不支持的分析类型: ${analysisType}`);
      }

      const duration = Date.now() - startTime;

      // 构建响应结果
      const result = {
        type: analysisType,
        data: analysisResult,
        messageCount: messageResult.messages.length,
        generatedAt: new Date().toISOString(),
        duration,
        searchParams,
        requestId
      };

      logger.business('AI分析完成', {
        requestId,
        analysisType,
        messageCount: messageResult.messages.length,
        duration,
        resultLength: JSON.stringify(analysisResult).length
      });

      // 返回成功响应
      res.json({
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('AI分析失败', {
        requestId,
        error: error.message,
        duration,
        body: req.body
      });

      throw error;
    }
  });

  /**
   * 获取分析历史（模拟实现，实际应该连接数据库）
   */
  getAnalysisHistory = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      logger.info('获取分析历史', { requestId });

      // 模拟分析历史数据
      // 实际实现中应该从数据库获取
      const history = this.getMockAnalysisHistory();

      logger.business('获取分析历史成功', {
        requestId,
        historyCount: history.length
      });

      res.json({
        success: true,
        data: {
          history,
          total: history.length
        },
        requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取分析历史失败', {
        requestId,
        error: error.message
      });

      throw error;
    }
  });

  /**
   * 保存分析结果
   */
  saveAnalysisResult = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      logger.info('保存分析结果', {
        requestId,
        body: req.body
      });

      const { type, data, messageCount, generatedAt, title } = req.body;

      // 验证必需字段
      if (!type || !data) {
        throw new ValidationError('缺少必需的保存参数');
      }

      // 构建保存数据
      const saveData = {
        id: this.generateAnalysisId(),
        type,
        data,
        messageCount,
        generatedAt: generatedAt || new Date().toISOString(),
        title: title || this.generateAnalysisTitle(type),
        savedAt: new Date().toISOString(),
        requestId
      };

      // 实际实现中应该保存到数据库
      // 这里模拟保存成功
      logger.business('分析结果保存成功', {
        requestId,
        analysisId: saveData.id,
        type,
        messageCount
      });

      res.json({
        success: true,
        message: '分析结果已保存',
        data: {
          id: saveData.id,
          savedAt: saveData.savedAt
        },
        requestId
      });

    } catch (error) {
      logger.error('保存分析结果失败', {
        requestId,
        error: error.message,
        body: req.body
      });

      throw error;
    }
  });

  /**
   * 获取AI服务状态
   */
  getAiServiceStatus = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      const aiStatus = await aiService.healthCheck();
      const serviceStatus = aiService.getServiceStatus();

      const status = {
        ai: {
          ...aiStatus,
          ...serviceStatus
        },
        timestamp: new Date().toISOString(),
        requestId
      };

      logger.info('AI服务状态检查', { requestId, status });

      res.json({
        success: true,
        data: status,
        requestId
      });

    } catch (error) {
      logger.error('AI服务状态检查失败', {
        requestId,
        error: error.message
      });

      throw error;
    }
  });

  /**
   * 获取分析类型列表
   */
  getAnalysisTypes = asyncHandler(async (req, res) => {
    const analysisTypes = [
      {
        id: 'ultrathink',
        name: 'UltraThink超级分析',
        description: '🧠 深度多维度AI超级分析，融合预测洞察',
        category: 'advanced',
        estimatedTime: '30-60秒',
        features: ['10维度分析', '预测洞察', '行动建议']
      },
      {
        id: 'summary',
        name: '聊天摘要',
        description: '生成聊天内容的智能摘要',
        category: 'basic',
        estimatedTime: '10-20秒',
        features: ['核心内容提取', '关键信息汇总']
      },
      {
        id: 'sentiment',
        name: '情感分析',
        description: '分析聊天中的情感倾向和氛围',
        category: 'basic',
        estimatedTime: '15-25秒',
        features: ['情感倾向', '情感强度', '情感变化']
      },
      {
        id: 'keywords',
        name: '关键词提取',
        description: '提取聊天中的重要关键词和热点',
        category: 'basic',
        estimatedTime: '10-15秒',
        features: ['关键词排序', '频次统计', '重要性评分']
      },
      {
        id: 'topics',
        name: '话题分类',
        description: '自动识别和分类聊天话题',
        category: 'intermediate',
        estimatedTime: '20-30秒',
        features: ['话题识别', '内容分类', '关联分析']
      },
      {
        id: 'statistics',
        name: '统计分析',
        description: '生成详细的数据统计报告',
        category: 'intermediate',
        estimatedTime: '25-35秒',
        features: ['活跃度统计', '互动分析', '趋势图表']
      },
      {
        id: 'custom',
        name: '自定义分析',
        description: '根据您的具体需求进行定制化分析',
        category: 'advanced',
        estimatedTime: '20-40秒',
        features: ['自定义问题', '灵活分析', '专业洞察']
      }
    ];

    res.json({
      success: true,
      data: {
        types: analysisTypes,
        total: analysisTypes.length
      },
      timestamp: new Date().toISOString()
    });
  });

  /**
   * 构建分析搜索参数
   */
  buildAnalysisSearchParams({ dateRange, contacts, startDate, endDate, limit = 100 }) {
    const params = {
      limit: Math.min(limit, 200) // 限制分析的消息数量
    };

    // 优先使用独立的日期参数
    if (startDate) {
      params.startDate = startDate;
    } else if (dateRange && dateRange.includes(' - ')) {
      const [start] = dateRange.split(' - ').map(d => d.trim());
      params.startDate = start;
    } else {
      // 如果没有指定日期，默认使用今天
      params.startDate = new Date().toISOString().split('T')[0];
    }

    if (endDate) {
      params.endDate = endDate;
    } else if (dateRange && dateRange.includes(' - ')) {
      const [, end] = dateRange.split(' - ').map(d => d.trim());
      params.endDate = end;
    }

    // 处理联系人
    if (contacts && contacts.trim()) {
      // 取第一个联系人进行分析
      params.talker = contacts.trim().split(',')[0].trim();
    }

    return params;
  }

  /**
   * 生成分析ID
   */
  generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成分析标题
   */
  generateAnalysisTitle(type) {
    const typeNames = {
      ultrathink: 'UltraThink超级分析',
      summary: '聊天摘要',
      sentiment: '情感分析',
      keywords: '关键词提取',
      topics: '话题分类',
      statistics: '统计分析',
      custom: '自定义分析'
    };

    const typeName = typeNames[type] || '未知分析';
    const date = new Date().toLocaleDateString('zh-CN');
    
    return `${typeName} - ${date}`;
  }

  /**
   * 获取模拟分析历史
   */
  getMockAnalysisHistory() {
    const now = new Date();
    return [
      {
        id: 'analysis_001',
        type: 'ultrathink',
        title: 'UltraThink超级分析 - 2025/7/16',
        messageCount: 50,
        generatedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        summary: '深度分析了AI编程工具相关讨论...'
      },
      {
        id: 'analysis_002',
        type: 'sentiment',
        title: '情感分析 - 2025/7/15',
        messageCount: 30,
        generatedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        summary: '整体情感倾向积极，讨论氛围良好...'
      },
      {
        id: 'analysis_003',
        type: 'keywords',
        title: '关键词提取 - 2025/7/14',
        messageCount: 75,
        generatedAt: new Date(now - 72 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        summary: '主要关键词：AI、编程、工具、效率...'
      }
    ];
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new AnalysisController();