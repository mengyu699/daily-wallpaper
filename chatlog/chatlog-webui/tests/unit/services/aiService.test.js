const axios = require('axios');
const aiService = require('../../../src/services/aiService');
const { AuthenticationError, ValidationError, AIServiceError } = require('../../../src/utils/errors');

// 模拟axios
jest.mock('axios');
const mockedAxios = axios;

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置服务状态
    aiService.isHealthy = true;
    // 重置API密钥
    process.env.DEEPSEEK_API_KEY = 'test-api-key';
  });

  describe('ultrathinkAnalysis', () => {
    it('应该成功执行UltraThink超级分析', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      const mockAiResponse = {
        choices: [{
          message: {
            content: testUtils.createMockAiResponse('ultrathink')
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500
        }
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: mockAiResponse
      });

      const result = await aiService.ultrathinkAnalysis(mockMessages);

      // 验证结果结构
      expect(result).toMatchObject({
        success: true,
        analysisType: 'ultrathink',
        ultrathink: expect.stringContaining('🧠 UltraThink超级分析'),
        messageCount: 5,
        complexity: expect.any(String),
        processingTime: expect.stringMatching(/^\d+ms$/),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        tokenUsage: expect.objectContaining({
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500
        })
      });

      // 验证API调用
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('deepseek.com'),
        expect.objectContaining({
          model: 'deepseek-chat',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('UltraThink超级分析专家')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('请进行UltraThink超级分析')
            })
          ]),
          temperature: expect.any(Number),
          max_tokens: expect.any(Number)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          timeout: expect.any(Number)
        })
      );
    });

    it('应该处理大量消息的UltraThink分析', async () => {
      const largeMessageSet = testUtils.createMockMessages(100);
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          choices: [{ message: { content: testUtils.createMockAiResponse('ultrathink') } }],
          usage: { prompt_tokens: 5000, completion_tokens: 1000, total_tokens: 6000 }
        }
      });

      const result = await aiService.ultrathinkAnalysis(largeMessageSet);

      expect(result.success).toBe(true);
      expect(result.messageCount).toBe(100);
      expect(result.complexity).toBe('high');
    });

    it('应该处理不同复杂度的分析场景', async () => {
      const testCases = [
        { messageCount: 5, expectedComplexity: 'low' },
        { messageCount: 25, expectedComplexity: 'medium' },
        { messageCount: 75, expectedComplexity: 'high' }
      ];

      for (const testCase of testCases) {
        const messages = testUtils.createMockMessages(testCase.messageCount);
        
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: {
            choices: [{ message: { content: testUtils.createMockAiResponse('ultrathink') } }],
            usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }
          }
        });

        const result = await aiService.ultrathinkAnalysis(messages);

        expect(result.complexity).toBe(testCase.expectedComplexity);
      }
    });
  });

  describe('analyzeMessages', () => {
    it('应该成功分析聊天摘要', async () => {
      const mockMessages = testUtils.createMockMessages(3);
      const mockResponse = {
        choices: [{
          message: {
            content: testUtils.createMockAiResponse('summary')
          }
        }],
        usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: mockResponse
      });

      const result = await aiService.analyzeMessages(mockMessages, 'summary');

      expect(result).toMatchObject({
        success: true,
        analysisType: 'summary',
        summary: expect.stringContaining('测试摘要'),
        messageCount: 3,
        processingTime: expect.stringMatching(/^\d+ms$/),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    it('应该支持所有分析类型', async () => {
      const analysisTypes = ['summary', 'sentiment', 'keywords', 'topics', 'statistics'];
      const mockMessages = testUtils.createMockMessages(3);

      for (const type of analysisTypes) {
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: {
            choices: [{ message: { content: testUtils.createMockAiResponse(type) } }],
            usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
          }
        });

        const result = await aiService.analyzeMessages(mockMessages, type);

        expect(result.success).toBe(true);
        expect(result.analysisType).toBe(type);
        expect(result[type]).toBeDefined();
      }
    });

    it('应该处理自定义分析', async () => {
      const mockMessages = testUtils.createMockMessages(3);
      const customPrompt = '请分析聊天中的技术讨论内容';

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          choices: [{ message: { content: '技术讨论分析结果' } }],
          usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
        }
      });

      const result = await aiService.analyzeMessages(mockMessages, 'custom', { customPrompt });

      expect(result.success).toBe(true);
      expect(result.analysisType).toBe('custom');
      expect(result.custom).toContain('技术讨论分析结果');
    });

    it('应该验证分析参数', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      // 测试无效的分析类型
      await expect(aiService.analyzeMessages(mockMessages, 'invalid-type'))
        .rejects
        .toThrow(ValidationError);

      // 测试空消息数组
      await expect(aiService.analyzeMessages([], 'summary'))
        .rejects
        .toThrow(ValidationError);

      // 测试自定义分析缺少prompt
      await expect(aiService.analyzeMessages(mockMessages, 'custom'))
        .rejects
        .toThrow(ValidationError);
    });

    it('应该处理API认证错误', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } }
        }
      });

      await expect(aiService.analyzeMessages(mockMessages, 'summary'))
        .rejects
        .toThrow(AuthenticationError);
    });

    it('应该处理API配额错误', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } }
        }
      });

      await expect(aiService.analyzeMessages(mockMessages, 'summary'))
        .rejects
        .toThrow('API调用频率超限');
    });

    it('应该处理网络超时', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      mockedAxios.post.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Timeout'
      });

      await expect(aiService.analyzeMessages(mockMessages, 'summary'))
        .rejects
        .toThrow('AI服务响应超时');
    });

    it('应该重试失败的请求', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      // 第一次调用失败，第二次成功
      mockedAxios.post
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            choices: [{ message: { content: testUtils.createMockAiResponse('summary') } }],
            usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
          }
        });

      const result = await aiService.analyzeMessages(mockMessages, 'summary');

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('healthCheck', () => {
    it('应该正确检查AI服务健康状态', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          choices: [{ message: { content: '健康检查响应' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        }
      });

      const result = await aiService.healthCheck();

      expect(result).toMatchObject({
        status: 'healthy',
        responseTime: expect.any(Number),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        apiEndpoint: expect.any(String),
        model: 'deepseek-chat'
      });

      expect(aiService.isHealthy).toBe(true);
    });

    it('应该处理健康检查失败', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));

      const result = await aiService.healthCheck();

      expect(result).toMatchObject({
        status: 'unhealthy',
        error: 'Service unavailable',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });

      expect(aiService.isHealthy).toBe(false);
    });
  });

  describe('formatMessagesForAnalysis', () => {
    it('应该正确格式化聊天消息', () => {
      const mockMessages = [
        {
          id: 1,
          content: '测试消息1',
          sender: 'wxid_test_1',
          senderName: '测试用户1',
          timestamp: '2025-07-16T10:00:00.000Z',
          type: 'text'
        },
        {
          id: 2,
          content: '[图片]',
          sender: 'wxid_test_2',
          senderName: '测试用户2',
          timestamp: '2025-07-16T10:01:00.000Z',
          type: 'image'
        }
      ];

      const result = aiService.formatMessagesForAnalysis(mockMessages);

      expect(result).toContain('测试用户1: 测试消息1');
      expect(result).toContain('测试用户2: [图片]');
      expect(result).toContain('时间: 2025-07-16T10:00:00.000Z');
    });

    it('应该过滤敏感信息', () => {
      const mockMessages = [
        {
          id: 1,
          content: '我的手机号是13812345678',
          sender: 'wxid_test_1',
          senderName: '测试用户1',
          timestamp: '2025-07-16T10:00:00.000Z',
          type: 'text'
        }
      ];

      const result = aiService.formatMessagesForAnalysis(mockMessages);

      // 应该过滤掉手机号
      expect(result).not.toContain('13812345678');
      expect(result).toContain('[手机号]');
    });

    it('应该限制消息长度', () => {
      const longMessage = 'a'.repeat(5000);
      const mockMessages = [
        {
          id: 1,
          content: longMessage,
          sender: 'wxid_test_1',
          senderName: '测试用户1',
          timestamp: '2025-07-16T10:00:00.000Z',
          type: 'text'
        }
      ];

      const result = aiService.formatMessagesForAnalysis(mockMessages);

      expect(result.length).toBeLessThan(4000); // 应该被截断
    });
  });

  describe('getAnalysisPrompt', () => {
    it('应该返回正确的分析提示词', () => {
      const analysisTypes = ['summary', 'sentiment', 'keywords', 'topics', 'statistics', 'ultrathink'];

      analysisTypes.forEach(type => {
        const prompt = aiService.getAnalysisPrompt(type);
        expect(prompt).toBeDefined();
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt).toContain(type === 'ultrathink' ? 'UltraThink' : type);
      });
    });

    it('应该处理自定义分析提示词', () => {
      const customPrompt = '请分析技术讨论';
      const prompt = aiService.getAnalysisPrompt('custom', { customPrompt });

      expect(prompt).toContain(customPrompt);
    });

    it('应该处理无效的分析类型', () => {
      expect(() => aiService.getAnalysisPrompt('invalid'))
        .toThrow(ValidationError);
    });
  });

  describe('sanitizeContent', () => {
    it('应该移除敏感信息', () => {
      const testCases = [
        { input: '我的手机号是13812345678', expected: '我的手机号是[手机号]' },
        { input: '身份证号：123456789012345678', expected: '身份证号：[身份证号]' },
        { input: 'QQ号：12345678', expected: 'QQ号：[QQ号]' },
        { input: '邮箱: test@example.com', expected: '邮箱: [邮箱]' },
        { input: '银行卡号：6222123456789012', expected: '银行卡号：[银行卡号]' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = aiService.sanitizeContent(input);
        expect(result).toBe(expected);
      });
    });

    it('应该保留正常内容', () => {
      const normalContent = '今天天气很好，我们去公园散步吧！';
      const result = aiService.sanitizeContent(normalContent);
      expect(result).toBe(normalContent);
    });
  });

  describe('getServiceStatus', () => {
    it('应该返回服务状态', () => {
      const status = aiService.getServiceStatus();

      expect(status).toMatchObject({
        isHealthy: expect.any(Boolean),
        lastHealthCheck: expect.any(String),
        apiEndpoint: expect.any(String),
        model: 'deepseek-chat',
        supportedAnalysisTypes: expect.arrayContaining([
          'ultrathink', 'summary', 'sentiment', 'keywords', 'topics', 'statistics', 'custom'
        ])
      });
    });
  });

  describe('API密钥管理', () => {
    it('应该验证API密钥存在', () => {
      delete process.env.DEEPSEEK_API_KEY;

      expect(() => aiService.validateApiKey())
        .toThrow(AuthenticationError);
    });

    it('应该验证API密钥格式', () => {
      process.env.DEEPSEEK_API_KEY = 'invalid-key';

      expect(() => aiService.validateApiKey())
        .toThrow(ValidationError);
    });

    it('应该接受有效的API密钥', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-1234567890abcdef1234567890abcdef';

      expect(() => aiService.validateApiKey()).not.toThrow();
    });
  });

  describe('错误恢复', () => {
    it('应该在网络错误后恢复服务', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      // 模拟网络错误
      mockedAxios.post.mockRejectedValueOnce({ code: 'ECONNRESET' });
      
      // 设置服务为不健康
      aiService.isHealthy = false;

      // 下一次调用成功
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          choices: [{ message: { content: testUtils.createMockAiResponse('summary') } }],
          usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
        }
      });

      const result = await aiService.analyzeMessages(mockMessages, 'summary');

      expect(result.success).toBe(true);
      expect(aiService.isHealthy).toBe(true);
    });
  });

  describe('性能监控', () => {
    it('应该记录处理时间', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      mockedAxios.post.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              status: 200,
              data: {
                choices: [{ message: { content: testUtils.createMockAiResponse('summary') } }],
                usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
              }
            });
          }, 100);
        });
      });

      const result = await aiService.analyzeMessages(mockMessages, 'summary');

      expect(result.processingTime).toMatch(/^\d+ms$/);
      const processingTimeMs = parseInt(result.processingTime);
      expect(processingTimeMs).toBeGreaterThanOrEqual(100);
    });

    it('应该记录token使用情况', async () => {
      const mockMessages = testUtils.createMockMessages(3);

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          choices: [{ message: { content: testUtils.createMockAiResponse('summary') } }],
          usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }
        }
      });

      const result = await aiService.analyzeMessages(mockMessages, 'summary');

      expect(result.tokenUsage).toMatchObject({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      });
    });
  });
});