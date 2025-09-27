const request = require('supertest');
const express = require('express');
const apiRoutes = require('../../src/routes/api');
const SecurityMiddleware = require('../../src/middleware/security');
const { errorHandler } = require('../../src/utils/errors');

// 模拟服务
jest.mock('../../src/services/chatlogService');
jest.mock('../../src/services/aiService');
jest.mock('../../src/utils/logger');

const chatlogService = require('../../src/services/chatlogService');
const aiService = require('../../src/services/aiService');

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    // 创建测试应用
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // 基础安全中间件（简化版用于测试）
    app.use((req, res, next) => {
      req.ip = '127.0.0.1';
      next();
    });
    
    app.use('/api', apiRoutes);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API基础端点', () => {
    it('GET /api/ 应该返回API信息', async () => {
      const response = await request(app)
        .get('/api/')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        api: 'Chatlog WebUI API',
        version: '2.0.0',
        description: '微信聊天记录分析系统API',
        endpoints: expect.any(Object)
      });
    });

    it('GET /api/health 应该返回健康状态', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        uptime: expect.any(Number),
        memory: expect.any(Object),
        version: '2.0.0'
      });
    });

    it('GET /api/docs 应该返回API文档', async () => {
      const response = await request(app)
        .get('/api/docs')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        title: 'Chatlog WebUI API 文档',
        version: '2.0.0',
        endpoints: expect.any(Object),
        rateLimit: expect.any(Object),
        errorCodes: expect.any(Object)
      });
    });
  });

  describe('聊天记录API集成测试', () => {
    it('GET /api/chat/search 应该成功搜索消息', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      const mockResult = {
        success: true,
        messages: mockMessages,
        total: 5,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      };

      chatlogService.searchMessages.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/chat/search')
        .query({
          q: '测试关键词',
          startDate: '2025-07-16',
          limit: '10'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '搜索完成',
        data: mockResult
      });

      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        query: '测试关键词',
        startDate: '2025-07-16',
        limit: 10
      });
    });

    it('POST /api/chat/search 应该支持复杂搜索参数', async () => {
      const mockMessages = testUtils.createMockMessages(20);
      const mockResult = {
        success: true,
        messages: mockMessages,
        total: 20,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      };

      chatlogService.searchMessages.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/chat/search')
        .send({
          query: 'AI分析',
          startDate: '2025-07-16',
          endDate: '2025-07-16',
          contacts: ['wxid_test_1', 'wxid_test_2'],
          type: 'text',
          limit: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        query: 'AI分析',
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        talker: 'wxid_test_1,wxid_test_2',
        type: 'text',
        limit: 50
      });
    });

    it('GET /api/chat/contacts 应该返回联系人列表', async () => {
      const mockContacts = [
        { id: 'wxid_test_1', name: '测试用户1' },
        { id: 'wxid_test_2', name: '测试用户2' }
      ];

      chatlogService.getContacts.mockResolvedValue(mockContacts);

      const response = await request(app)
        .get('/api/chat/contacts')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '联系人列表获取成功',
        data: {
          contacts: mockContacts,
          total: 2
        }
      });
    });

    it('GET /api/chat/chatrooms 应该返回群聊列表', async () => {
      const mockChatrooms = [
        { id: 'chatroom_1', name: '技术讨论群', memberCount: 15 },
        { id: 'chatroom_2', name: '项目开发群', memberCount: 8 }
      ];

      chatlogService.getChatrooms.mockResolvedValue(mockChatrooms);

      const response = await request(app)
        .get('/api/chat/chatrooms')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '群聊列表获取成功',
        data: {
          chatrooms: mockChatrooms,
          total: 2
        }
      });
    });

    it('POST /api/chat/export 应该导出聊天数据', async () => {
      const mockMessages = testUtils.createMockMessages(10);

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 10
      });

      const response = await request(app)
        .post('/api/chat/export')
        .send({
          format: 'json',
          dateRange: '2025-07-16 - 2025-07-16',
          contacts: ['wxid_test_1']
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="chatlog-export-/);
      expect(response.body.export_info).toMatchObject({
        format: 'json',
        total_messages: 10,
        date_range: '2025-07-16 - 2025-07-16'
      });
    });

    it('GET /api/chat/status 应该返回Chatlog服务状态', async () => {
      const mockHealthCheck = {
        status: 'healthy',
        responseTime: 120,
        timestamp: new Date().toISOString()
      };

      const mockServiceStatus = {
        isHealthy: true,
        lastHealthCheck: new Date().toISOString(),
        apiBase: 'http://localhost:8080'
      };

      chatlogService.healthCheck.mockResolvedValue(mockHealthCheck);
      chatlogService.getServiceStatus.mockReturnValue(mockServiceStatus);

      const response = await request(app)
        .get('/api/chat/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          healthCheck: mockHealthCheck,
          serviceStatus: mockServiceStatus
        }
      });
    });
  });

  describe('AI分析API集成测试', () => {
    it('POST /api/analysis/run 应该执行UltraThink分析', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      const mockAnalysisResult = {
        success: true,
        analysisType: 'ultrathink',
        ultrathink: testUtils.createMockAiResponse('ultrathink'),
        messageCount: 5,
        complexity: 'medium',
        processingTime: '1500ms',
        timestamp: new Date().toISOString()
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 5
      });

      aiService.ultrathinkAnalysis.mockResolvedValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'ultrathink',
          dateRange: '2025-07-16 - 2025-07-16',
          contacts: ['wxid_test_1']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'UltraThink分析完成',
        data: mockAnalysisResult
      });

      expect(aiService.ultrathinkAnalysis).toHaveBeenCalledWith(mockMessages);
    });

    it('POST /api/analysis/run 应该执行标准分析', async () => {
      const mockMessages = testUtils.createMockMessages(3);
      const mockAnalysisResult = {
        success: true,
        analysisType: 'summary',
        summary: testUtils.createMockAiResponse('summary'),
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

      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'summary',
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'summary分析完成',
        data: mockAnalysisResult
      });

      expect(aiService.analyzeMessages).toHaveBeenCalledWith(mockMessages, 'summary', undefined);
    });

    it('POST /api/analysis/run 应该处理自定义分析', async () => {
      const mockMessages = testUtils.createMockMessages(3);
      const customPrompt = '请分析技术讨论内容';
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

      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'custom',
          customPrompt,
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(200);

      expect(aiService.analyzeMessages).toHaveBeenCalledWith(
        mockMessages,
        'custom',
        { customPrompt }
      );
    });

    it('GET /api/analysis/types 应该返回分析类型列表', async () => {
      const response = await request(app)
        .get('/api/analysis/types')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          analysisTypes: expect.arrayContaining([
            expect.objectContaining({
              id: 'ultrathink',
              name: 'UltraThink超级分析'
            }),
            expect.objectContaining({
              id: 'summary',
              name: '聊天摘要'
            })
          ])
        }
      });
    });

    it('GET /api/analysis/status 应该返回AI服务状态', async () => {
      const mockHealthCheck = {
        status: 'healthy',
        responseTime: 150,
        timestamp: new Date().toISOString()
      };

      const mockServiceStatus = {
        isHealthy: true,
        lastHealthCheck: new Date().toISOString(),
        supportedAnalysisTypes: ['ultrathink', 'summary', 'sentiment']
      };

      aiService.healthCheck.mockResolvedValue(mockHealthCheck);
      aiService.getServiceStatus.mockReturnValue(mockServiceStatus);

      const response = await request(app)
        .get('/api/analysis/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          healthCheck: mockHealthCheck,
          serviceStatus: mockServiceStatus
        }
      });
    });
  });

  describe('错误处理集成测试', () => {
    it('应该处理无效的API端点', async () => {
      const response = await request(app)
        .get('/api/invalid-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('API端点不存在'),
        code: 'ENDPOINT_NOT_FOUND',
        availableEndpoints: expect.any(Array)
      });
    });

    it('应该处理请求体过大的错误', async () => {
      const largePayload = {
        data: 'x'.repeat(11 * 1024 * 1024) // 11MB, 超过10MB限制
      };

      const response = await request(app)
        .post('/api/chat/search')
        .send(largePayload)
        .expect(413);
    });

    it('应该处理JSON格式错误', async () => {
      const response = await request(app)
        .post('/api/chat/search')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('应该处理Chatlog服务错误', async () => {
      chatlogService.searchMessages.mockRejectedValue(new Error('Chatlog服务不可用'));

      const response = await request(app)
        .get('/api/chat/search')
        .query({ q: '测试' })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('搜索失败'),
        code: 'CHATLOG_SERVICE_ERROR'
      });
    });

    it('应该处理AI服务错误', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 3
      });

      aiService.analyzeMessages.mockRejectedValue(new Error('AI服务响应超时'));

      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'summary',
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('AI分析失败'),
        code: 'AI_ANALYSIS_ERROR'
      });
    });

    it('应该处理参数验证错误', async () => {
      // 测试缺少必需参数
      const response = await request(app)
        .post('/api/analysis/run')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('缺少必需的参数'),
        code: 'MISSING_PARAMETER'
      });
    });

    it('应该处理无效的分析类型', async () => {
      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'invalid-type',
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('不支持的分析类型'),
        code: 'INVALID_ANALYSIS_TYPE'
      });
    });
  });

  describe('跨服务协作测试', () => {
    it('应该正确协调搜索和分析流程', async () => {
      const mockMessages = testUtils.createMockMessages(10);
      const mockSearchResult = {
        success: true,
        messages: mockMessages,
        total: 10
      };
      const mockAnalysisResult = {
        success: true,
        analysisType: 'ultrathink',
        ultrathink: testUtils.createMockAiResponse('ultrathink'),
        messageCount: 10,
        complexity: 'medium'
      };

      // 设置服务模拟
      chatlogService.searchMessages.mockResolvedValue(mockSearchResult);
      aiService.ultrathinkAnalysis.mockResolvedValue(mockAnalysisResult);

      // 执行完整的分析流程
      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'ultrathink',
          dateRange: '2025-07-16 - 2025-07-16',
          contacts: ['wxid_test_1', 'wxid_test_2']
        })
        .expect(200);

      // 验证搜索服务被正确调用
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

      // 验证AI服务被正确调用
      expect(aiService.ultrathinkAnalysis).toHaveBeenCalledWith(
        expect.arrayContaining(mockMessages)
      );

      // 验证最终响应
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageCount).toBeGreaterThan(0);
    });

    it('应该处理部分服务失败的情况', async () => {
      const mockMessages = testUtils.createMockMessages(5);

      // 第一个联系人搜索成功，第二个失败
      chatlogService.searchMessages
        .mockResolvedValueOnce({
          success: true,
          messages: mockMessages,
          total: 5
        })
        .mockRejectedValueOnce(new Error('联系人2数据不可用'));

      const response = await request(app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'summary',
          contacts: ['wxid_test_1', 'wxid_test_2']
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(chatlogService.searchMessages).toHaveBeenCalledTimes(2);
    });
  });

  describe('性能和并发测试', () => {
    it('应该处理并发请求', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 5
      });

      // 创建多个并发请求
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/chat/search')
          .query({ q: '测试' })
      );

      const responses = await Promise.all(promises);

      // 验证所有请求都成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // 验证服务被调用了正确的次数
      expect(chatlogService.searchMessages).toHaveBeenCalledTimes(5);
    });

    it('应该在合理时间内响应', async () => {
      const mockMessages = testUtils.createMockMessages(50);
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 50
      });

      const startTime = Date.now();
      
      await request(app)
        .get('/api/chat/search')
        .query({ q: '测试', limit: '50' })
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      // API响应时间应该在合理范围内（考虑到模拟环境）
      expect(responseTime).toBeLessThan(5000);
    });
  });
});