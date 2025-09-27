const analysisController = require('../../../src/controllers/analysisController');
const aiService = require('../../../src/services/aiService');
const chatlogService = require('../../../src/services/chatlogService');
const logger = require('../../../src/utils/logger');

// 模拟依赖
jest.mock('../../../src/services/aiService');
jest.mock('../../../src/services/chatlogService');
jest.mock('../../../src/utils/logger');

describe('AnalysisController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = testUtils.createMockRequest();
    mockRes = testUtils.createMockResponse();
  });

  describe('runAnalysis', () => {
    it('应该成功执行UltraThink分析', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      const mockAnalysisResult = {
        success: true,
        analysisType: 'ultrathink',
        ultrathink: testUtils.createMockAiResponse('ultrathink'),
        messageCount: 5,
        complexity: 'medium',
        processingTime: '1500ms',
        timestamp: new Date().toISOString(),
        tokenUsage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500
        }
      };

      mockReq.body = {
        analysisType: 'ultrathink',
        dateRange: '2025-07-16 - 2025-07-16',
        contacts: ['wxid_test_1']
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 5
      });

      aiService.ultrathinkAnalysis.mockResolvedValue(mockAnalysisResult);

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'UltraThink分析完成',
        data: mockAnalysisResult
      });

      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        talker: 'wxid_test_1'
      });

      expect(aiService.ultrathinkAnalysis).toHaveBeenCalledWith(mockMessages);

      expect(logger.business).toHaveBeenCalledWith('AI分析请求', {
        analysisType: 'ultrathink',
        messageCount: 5,
        processingTime: '1500ms',
        ip: mockReq.ip
      });
    });

    it('应该成功执行标准分析类型', async () => {
      const analysisTypes = ['summary', 'sentiment', 'keywords', 'topics', 'statistics'];
      const mockMessages = testUtils.createMockMessages(3);

      for (const analysisType of analysisTypes) {
        jest.clearAllMocks();

        mockReq.body = {
          analysisType,
          dateRange: '2025-07-16 - 2025-07-16'
        };

        const mockAnalysisResult = {
          success: true,
          analysisType,
          [analysisType]: testUtils.createMockAiResponse(analysisType),
          messageCount: 3,
          processingTime: '800ms',
          timestamp: new Date().toISOString()
        };

        chatlogService.searchMessages.mockResolvedValue({
          success: true,
          messages: mockMessages,
          total: 3
        });

        aiService.analyzeMessages.mockResolvedValue(mockAnalysisResult);

        await analysisController.runAnalysis(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: `${analysisType}分析完成`,
          data: mockAnalysisResult
        });

        expect(aiService.analyzeMessages).toHaveBeenCalledWith(mockMessages, analysisType, undefined);
      }
    });

    it('应该处理自定义分析', async () => {
      const mockMessages = testUtils.createMockMessages(3);
      const customPrompt = '请分析技术讨论内容';

      mockReq.body = {
        analysisType: 'custom',
        customPrompt,
        dateRange: '2025-07-16 - 2025-07-16'
      };

      const mockAnalysisResult = {
        success: true,
        analysisType: 'custom',
        custom: '技术讨论分析结果',
        messageCount: 3,
        processingTime: '1200ms',
        timestamp: new Date().toISOString()
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 3
      });

      aiService.analyzeMessages.mockResolvedValue(mockAnalysisResult);

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(aiService.analyzeMessages).toHaveBeenCalledWith(
        mockMessages, 
        'custom', 
        { customPrompt }
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'custom分析完成',
        data: mockAnalysisResult
      });
    });

    it('应该处理多个联系人的分析', async () => {
      const mockMessages = testUtils.createMockMessages(10);

      mockReq.body = {
        analysisType: 'summary',
        contacts: ['wxid_test_1', 'wxid_test_2'],
        dateRange: '2025-07-16 - 2025-07-16'
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 10
      });

      aiService.analyzeMessages.mockResolvedValue({
        success: true,
        analysisType: 'summary',
        summary: '多联系人摘要',
        messageCount: 10
      });

      await analysisController.runAnalysis(mockReq, mockRes);

      // 应该为每个联系人调用搜索
      expect(chatlogService.searchMessages).toHaveBeenCalledTimes(2);
      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        talker: 'wxid_test_1'
      });
      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        talker: 'wxid_test_2'
      });
    });

    it('应该验证必需的参数', async () => {
      // 缺少分析类型
      mockReq.body = {};

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少必需的参数: analysisType',
        code: 'MISSING_PARAMETER'
      });

      // 自定义分析缺少prompt
      jest.clearAllMocks();
      mockReq.body = { analysisType: 'custom' };

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '自定义分析需要提供customPrompt参数',
        code: 'MISSING_CUSTOM_PROMPT'
      });
    });

    it('应该处理无搜索结果的情况', async () => {
      mockReq.body = {
        analysisType: 'summary',
        dateRange: '2025-07-16 - 2025-07-16'
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: [],
        total: 0
      });

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '未找到符合条件的聊天记录',
        code: 'NO_MESSAGES_FOUND'
      });
    });

    it('应该处理聊天记录搜索错误', async () => {
      mockReq.body = {
        analysisType: 'summary',
        dateRange: '2025-07-16 - 2025-07-16'
      };

      const searchError = new Error('Chatlog服务不可用');
      chatlogService.searchMessages.mockRejectedValue(searchError);

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '获取聊天记录失败: Chatlog服务不可用',
        code: 'CHATLOG_ERROR'
      });

      expect(logger.error).toHaveBeenCalledWith('聊天记录搜索失败', {
        error: searchError.message,
        params: { startDate: '2025-07-16', endDate: '2025-07-16' },
        ip: mockReq.ip
      });
    });

    it('应该处理AI分析错误', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      mockReq.body = {
        analysisType: 'summary',
        dateRange: '2025-07-16 - 2025-07-16'
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 3
      });

      const aiError = new Error('AI服务响应超时');
      aiService.analyzeMessages.mockRejectedValue(aiError);

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'AI分析失败: AI服务响应超时',
        code: 'AI_ANALYSIS_ERROR'
      });

      expect(logger.error).toHaveBeenCalledWith('AI分析失败', {
        error: aiError.message,
        analysisType: 'summary',
        messageCount: 3,
        ip: mockReq.ip
      });
    });
  });

  describe('getAnalysisTypes', () => {
    it('应该返回支持的分析类型列表', async () => {
      await analysisController.getAnalysisTypes(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          analysisTypes: [
            {
              id: 'ultrathink',
              name: 'UltraThink超级分析',
              description: '🧠 深度多维度AI超级分析，融合预测洞察',
              category: 'advanced',
              processingTime: 'high'
            },
            {
              id: 'summary',
              name: '聊天摘要',
              description: '生成聊天内容的智能摘要',
              category: 'basic',
              processingTime: 'medium'
            },
            {
              id: 'sentiment',
              name: '情感分析',
              description: '分析聊天中的情感倾向',
              category: 'basic',
              processingTime: 'medium'
            },
            {
              id: 'keywords',
              name: '关键词提取',
              description: '提取聊天中的重要关键词',
              category: 'basic',
              processingTime: 'low'
            },
            {
              id: 'topics',
              name: '话题分类',
              description: '自动分类聊天话题',
              category: 'basic',
              processingTime: 'medium'
            },
            {
              id: 'statistics',
              name: '统计分析',
              description: '生成详细的统计报告',
              category: 'basic',
              processingTime: 'low'
            },
            {
              id: 'custom',
              name: '自定义分析',
              description: '根据自定义要求进行分析',
              category: 'advanced',
              processingTime: 'variable'
            }
          ]
        }
      });
    });
  });

  describe('getAnalysisHistory', () => {
    it('应该返回分析历史记录', async () => {
      await analysisController.getAnalysisHistory(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '分析历史功能开发中',
        data: {
          history: [],
          totalCount: 0,
          note: '历史记录功能将在后续版本中实现'
        }
      });
    });
  });

  describe('saveAnalysisResult', () => {
    it('应该保存分析结果', async () => {
      mockReq.body = {
        analysisType: 'summary',
        result: {
          summary: '测试摘要',
          messageCount: 5
        },
        timestamp: new Date().toISOString()
      };

      await analysisController.saveAnalysisResult(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '分析结果保存功能开发中',
        data: {
          saved: false,
          note: '结果保存功能将在后续版本中实现'
        }
      });

      expect(logger.business).toHaveBeenCalledWith('分析结果保存请求', {
        analysisType: 'summary',
        resultSize: expect.any(Number),
        ip: mockReq.ip
      });
    });

    it('应该验证保存参数', async () => {
      mockReq.body = {};

      await analysisController.saveAnalysisResult(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少必需的参数: analysisType, result',
        code: 'MISSING_PARAMETERS'
      });
    });
  });

  describe('getAiServiceStatus', () => {
    it('应该返回AI服务状态', async () => {
      const mockStatus = {
        status: 'healthy',
        responseTime: 150,
        timestamp: new Date().toISOString(),
        apiEndpoint: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      };

      aiService.healthCheck.mockResolvedValue(mockStatus);
      aiService.getServiceStatus.mockReturnValue({
        isHealthy: true,
        lastHealthCheck: new Date().toISOString(),
        apiEndpoint: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        supportedAnalysisTypes: ['ultrathink', 'summary', 'sentiment', 'keywords', 'topics', 'statistics', 'custom']
      });

      await analysisController.getAiServiceStatus(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          healthCheck: mockStatus,
          serviceStatus: {
            isHealthy: true,
            lastHealthCheck: expect.any(String),
            apiEndpoint: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            supportedAnalysisTypes: ['ultrathink', 'summary', 'sentiment', 'keywords', 'topics', 'statistics', 'custom']
          }
        }
      });

      expect(aiService.healthCheck).toHaveBeenCalled();
      expect(aiService.getServiceStatus).toHaveBeenCalled();
    });

    it('应该处理AI服务健康检查失败', async () => {
      const mockError = new Error('AI服务不可用');
      aiService.healthCheck.mockRejectedValue(mockError);
      aiService.getServiceStatus.mockReturnValue({
        isHealthy: false,
        lastHealthCheck: new Date().toISOString()
      });

      await analysisController.getAiServiceStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'AI服务状态检查失败: AI服务不可用',
        data: {
          serviceStatus: {
            isHealthy: false,
            lastHealthCheck: expect.any(String)
          }
        }
      });

      expect(logger.error).toHaveBeenCalledWith('AI服务状态检查失败', {
        error: mockError.message,
        ip: mockReq.ip
      });
    });
  });

  describe('日期范围解析', () => {
    it('应该正确解析日期范围字符串', () => {
      const testCases = [
        {
          input: '2025-07-16 - 2025-07-17',
          expected: { startDate: '2025-07-16', endDate: '2025-07-17' }
        },
        {
          input: '2025-07-16',
          expected: { startDate: '2025-07-16', endDate: '2025-07-16' }
        },
        {
          input: '',
          expected: { startDate: undefined, endDate: undefined }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = analysisController.parseDateRange(input);
        expect(result).toEqual(expected);
      });
    });

    it('应该处理无效的日期范围', () => {
      const invalidInputs = ['invalid-date', '2025-07-32', '2025-13-01'];

      invalidInputs.forEach(input => {
        expect(() => analysisController.parseDateRange(input))
          .toThrow('无效的日期格式');
      });
    });
  });

  describe('错误处理中间件集成', () => {
    it('应该正确处理验证错误', async () => {
      mockReq.body = { analysisType: 'invalid-type' };

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('不支持的分析类型'),
        code: 'INVALID_ANALYSIS_TYPE'
      });
    });

    it('应该记录所有错误到日志', async () => {
      const testError = new Error('测试错误');
      chatlogService.searchMessages.mockRejectedValue(testError);

      mockReq.body = {
        analysisType: 'summary',
        dateRange: '2025-07-16 - 2025-07-16'
      };

      await analysisController.runAnalysis(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('聊天记录搜索失败', {
        error: testError.message,
        params: { startDate: '2025-07-16', endDate: '2025-07-16' },
        ip: mockReq.ip
      });
    });
  });
});