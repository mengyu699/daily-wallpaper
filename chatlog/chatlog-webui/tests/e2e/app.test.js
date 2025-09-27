const request = require('supertest');
const App = require('../../app-new');

// 模拟外部依赖
jest.mock('../../src/services/chatlogService');
jest.mock('../../src/services/aiService');
jest.mock('../../src/utils/logger');

const chatlogService = require('../../src/services/chatlogService');
const aiService = require('../../src/services/aiService');

describe('End-to-End Application Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // 创建应用实例
    app = new App();
    
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.DEEPSEEK_API_KEY = 'test-api-key';
    process.env.SESSION_SECRET = 'test-session-secret';
    
    // 启动服务器
    server = await app.start();
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('应用启动和健康检查', () => {
    it('应用应该成功启动', () => {
      expect(server).toBeDefined();
      expect(server.listening).toBe(true);
    });

    it('健康检查端点应该正常响应', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.any(Object),
        version: '2.0.0',
        environment: 'test'
      });
    });

    it('API健康检查应该正常响应', async () => {
      const response = await request(app.app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
        services: expect.any(Object)
      });
    });
  });

  describe('Web页面路由', () => {
    it('根路径应该重定向到dashboard', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
    });

    it('dashboard页面应该正常渲染', async () => {
      const response = await request(app.app)
        .get('/dashboard')
        .expect(200);

      expect(response.text).toContain('数据面板');
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('chat页面应该正常渲染', async () => {
      const response = await request(app.app)
        .get('/chat')
        .expect(200);

      expect(response.text).toContain('消息搜索');
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('analysis页面应该正常渲染', async () => {
      const response = await request(app.app)
        .get('/analysis')
        .expect(200);

      expect(response.text).toContain('AI智能分析');
      expect(response.text).toContain('UltraThink超级分析');
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('status页面应该正常渲染', async () => {
      // 模拟状态检查
      chatlogService.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 120
      });

      aiService.healthCheck.mockResolvedValue({
        status: 'healthy',
        responseTime: 150
      });

      const response = await request(app.app)
        .get('/status')
        .expect(200);

      expect(response.text).toContain('系统状态');
      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('完整的聊天搜索流程', () => {
    it('应该完成完整的Web搜索流程', async () => {
      const mockMessages = testUtils.createMockMessages(10);
      
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 10,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      });

      // Web搜索请求
      const response = await request(app.app)
        .post('/chat/search')
        .send({
          query: '测试关键词',
          startDate: '2025-07-16',
          endDate: '2025-07-16',
          limit: 20
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            content: expect.any(String),
            sender: expect.any(String),
            senderName: expect.any(String)
          })
        ]),
        total: 10
      });

      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        query: '测试关键词',
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        limit: 20
      });
    });

    it('应该完成完整的API搜索流程', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 5
      });

      const response = await request(app.app)
        .get('/api/chat/search')
        .query({
          q: 'API测试',
          startDate: '2025-07-16',
          limit: '15'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '搜索完成',
        data: {
          success: true,
          messages: expect.any(Array),
          total: 5
        }
      });
    });

    it('应该处理搜索无结果的情况', async () => {
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: [],
        total: 0
      });

      const response = await request(app.app)
        .post('/chat/search')
        .send({
          query: '不存在的关键词'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        messages: [],
        total: 0
      });
    });

    it('应该处理搜索服务错误', async () => {
      chatlogService.searchMessages.mockRejectedValue(
        new Error('Chatlog服务不可用')
      );

      const response = await request(app.app)
        .post('/chat/search')
        .send({
          query: '测试'
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('搜索失败')
      });
    });
  });

  describe('完整的AI分析流程', () => {
    it('应该完成完整的Web UltraThink分析流程', async () => {
      const mockMessages = testUtils.createMockMessages(8);
      const mockAnalysisResult = {
        success: true,
        analysisType: 'ultrathink',
        ultrathink: testUtils.createMockAiResponse('ultrathink'),
        messageCount: 8,
        complexity: 'medium',
        processingTime: '2000ms',
        timestamp: new Date().toISOString()
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 8
      });

      aiService.ultrathinkAnalysis.mockResolvedValue(mockAnalysisResult);

      const response = await request(app.app)
        .post('/analysis/run')
        .send({
          analysisType: 'ultrathink',
          dateRange: '2025-07-16 - 2025-07-16',
          contacts: ['wxid_test_1']
        })
        .expect(200);

      expect(response.text).toContain('AI分析结果');
      expect(response.text).toContain('UltraThink超级分析');
      expect(response.text).toContain('🧠');

      expect(chatlogService.searchMessages).toHaveBeenCalled();
      expect(aiService.ultrathinkAnalysis).toHaveBeenCalledWith(mockMessages);
    });

    it('应该完成完整的API分析流程', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      const mockAnalysisResult = {
        success: true,
        analysisType: 'summary',
        summary: testUtils.createMockAiResponse('summary'),
        messageCount: 5,
        processingTime: '1000ms',
        timestamp: new Date().toISOString()
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 5
      });

      aiService.analyzeMessages.mockResolvedValue(mockAnalysisResult);

      const response = await request(app.app)
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
    });

    it('应该处理自定义分析流程', async () => {
      const mockMessages = testUtils.createMockMessages(3);
      const customPrompt = '请分析聊天中的技术讨论内容';
      const mockAnalysisResult = {
        success: true,
        analysisType: 'custom',
        custom: '技术讨论分析结果：主要讨论了AI技术的发展趋势',
        messageCount: 3
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 3
      });

      aiService.analyzeMessages.mockResolvedValue(mockAnalysisResult);

      const response = await request(app.app)
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

    it('应该处理分析错误情况', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 3
      });

      aiService.analyzeMessages.mockRejectedValue(
        new Error('AI服务响应超时')
      );

      const response = await request(app.app)
        .post('/analysis/run')
        .send({
          analysisType: 'summary',
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(200);

      expect(response.text).toContain('分析失败');
      expect(response.text).toContain('AI服务响应超时');
    });
  });

  describe('完整的数据导出流程', () => {
    it('应该完成完整的JSON导出流程', async () => {
      const mockMessages = testUtils.createMockMessages(20);

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 20
      });

      const response = await request(app.app)
        .post('/chat/export')
        .send({
          format: 'json',
          dateRange: '2025-07-16 - 2025-07-16',
          contacts: ['wxid_test_1', 'wxid_test_2']
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('导出成功')
      });
    });

    it('应该完成完整的CSV导出流程', async () => {
      const mockMessages = testUtils.createMockMessages(10);

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 10
      });

      const response = await request(app.app)
        .post('/api/chat/export')
        .send({
          format: 'csv',
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toMatch(/attachment/);
    });

    it('应该处理导出无数据的情况', async () => {
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: [],
        total: 0
      });

      const response = await request(app.app)
        .post('/api/chat/export')
        .send({
          format: 'json',
          dateRange: '2025-01-01 - 2025-01-01'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('没有找到可导出的数据'),
        code: 'NO_DATA_TO_EXPORT'
      });
    });
  });

  describe('系统状态和监控', () => {
    it('应该正确显示系统整体状态', async () => {
      const mockChatlogStatus = {
        status: 'healthy',
        responseTime: 120,
        timestamp: new Date().toISOString()
      };

      const mockAiStatus = {
        status: 'healthy',
        responseTime: 180,
        timestamp: new Date().toISOString()
      };

      chatlogService.healthCheck.mockResolvedValue(mockChatlogStatus);
      aiService.healthCheck.mockResolvedValue(mockAiStatus);

      const response = await request(app.app)
        .get('/api/chat/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          healthCheck: mockChatlogStatus
        }
      });

      const aiResponse = await request(app.app)
        .get('/api/analysis/status')
        .expect(200);

      expect(aiResponse.body).toMatchObject({
        success: true,
        data: {
          healthCheck: mockAiStatus
        }
      });
    });

    it('应该处理服务不可用状态', async () => {
      chatlogService.healthCheck.mockRejectedValue(
        new Error('连接被拒绝')
      );

      const response = await request(app.app)
        .get('/api/chat/status')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('状态检查失败')
      });
    });
  });

  describe('安全和中间件测试', () => {
    it('应该设置安全头', async () => {
      const response = await request(app.app)
        .get('/api/')
        .expect(200);

      // 验证基本安全头
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('应该处理CORS请求', async () => {
      const response = await request(app.app)
        .options('/api/')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('应该压缩响应', async () => {
      const response = await request(app.app)
        .get('/api/docs')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // 大的响应应该被压缩
      if (response.body && JSON.stringify(response.body).length > 1000) {
        expect(response.headers['content-encoding']).toBe('gzip');
      }
    });

    it('应该处理请求体大小限制', async () => {
      const largePayload = {
        data: 'x'.repeat(11 * 1024 * 1024) // 超过10MB
      };

      await request(app.app)
        .post('/api/chat/search')
        .send(largePayload)
        .expect(413);
    });
  });

  describe('错误处理和恢复', () => {
    it('应该优雅处理未捕获异常', async () => {
      // 模拟控制器抛出异常
      jest.spyOn(chatlogService, 'searchMessages').mockImplementation(() => {
        throw new Error('意外错误');
      });

      const response = await request(app.app)
        .get('/api/chat/search')
        .query({ q: '测试' })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('搜索失败')
      });

      jest.restoreAllMocks();
    });

    it('应该正确记录和报告错误', async () => {
      jest.spyOn(aiService, 'analyzeMessages').mockRejectedValue(
        new Error('模拟AI服务错误')
      );

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: testUtils.createMockMessages(3),
        total: 3
      });

      await request(app.app)
        .post('/api/analysis/run')
        .send({
          analysisType: 'summary',
          dateRange: '2025-07-16 - 2025-07-16'
        })
        .expect(500);

      jest.restoreAllMocks();
    });

    it('应该处理无效的路由', async () => {
      const response = await request(app.app)
        .get('/invalid-path')
        .expect(404);

      expect(response.text).toContain('404');
    });

    it('应该处理API 404错误', async () => {
      const response = await request(app.app)
        .get('/api/invalid-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('API端点不存在'),
        code: 'ENDPOINT_NOT_FOUND'
      });
    });
  });

  describe('性能和负载测试', () => {
    it('应该在合理时间内响应', async () => {
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: testUtils.createMockMessages(50),
        total: 50
      });

      const startTime = Date.now();

      await request(app.app)
        .get('/api/chat/search')
        .query({ q: '性能测试', limit: '50' })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000);
    });

    it('应该处理并发请求', async () => {
      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: testUtils.createMockMessages(10),
        total: 10
      });

      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app.app)
          .get('/api/chat/search')
          .query({ q: `并发测试${i}` })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('内存使用应该保持稳定', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行多次请求
      for (let i = 0; i < 20; i++) {
        chatlogService.searchMessages.mockResolvedValue({
          success: true,
          messages: testUtils.createMockMessages(20),
          total: 20
        });

        await request(app.app)
          .get('/api/chat/search')
          .query({ q: `内存测试${i}` });
      }

      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该在合理范围内（小于50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});