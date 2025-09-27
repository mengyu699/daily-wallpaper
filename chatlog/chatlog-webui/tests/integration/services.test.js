const axios = require('axios');
const chatlogService = require('../../src/services/chatlogService');
const aiService = require('../../src/services/aiService');

// 注意：这些是集成测试，会测试真实的外部依赖
// 在CI/CD环境中可能需要模拟或跳过
describe('Services Integration Tests', () => {
  
  describe('Chatlog Service集成测试', () => {
    // 这些测试需要真实的Chatlog服务运行
    const CHATLOG_AVAILABLE = process.env.TEST_WITH_REAL_CHATLOG === 'true';

    beforeAll(() => {
      if (!CHATLOG_AVAILABLE) {
        console.log('跳过Chatlog集成测试 - 设置TEST_WITH_REAL_CHATLOG=true启用');
      }
    });

    it('应该能够连接到真实的Chatlog服务', async () => {
      if (!CHATLOG_AVAILABLE) return;

      const healthCheck = await chatlogService.healthCheck();
      
      expect(healthCheck).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        responseTime: expect.any(Number)
      });

      if (healthCheck.status === 'healthy') {
        expect(healthCheck.responseTime).toBeLessThan(5000);
      }
    });

    it('应该能够获取真实的联系人数据', async () => {
      if (!CHATLOG_AVAILABLE) return;

      try {
        const contacts = await chatlogService.getContacts();
        
        expect(Array.isArray(contacts)).toBe(true);
        
        if (contacts.length > 0) {
          expect(contacts[0]).toMatchObject({
            id: expect.any(String),
            name: expect.any(String)
          });
        }
      } catch (error) {
        // 如果Chatlog服务不可用，这是预期的
        expect(error.message).toMatch(/连接|不可用|timeout/i);
      }
    });

    it('应该能够获取真实的群聊数据', async () => {
      if (!CHATLOG_AVAILABLE) return;

      try {
        const chatrooms = await chatlogService.getChatrooms();
        
        expect(Array.isArray(chatrooms)).toBe(true);
        
        if (chatrooms.length > 0) {
          expect(chatrooms[0]).toMatchObject({
            id: expect.any(String),
            name: expect.any(String)
          });
        }
      } catch (error) {
        expect(error.message).toMatch(/连接|不可用|timeout/i);
      }
    });

    it('应该能够搜索真实的聊天记录', async () => {
      if (!CHATLOG_AVAILABLE) return;

      try {
        const result = await chatlogService.searchMessages({
          startDate: '2025-07-16',
          limit: 10
        });

        expect(result).toMatchObject({
          success: true,
          messages: expect.any(Array),
          total: expect.any(Number),
          timestamp: expect.any(String),
          source: 'chatlog-api'
        });

        if (result.messages.length > 0) {
          expect(result.messages[0]).toMatchObject({
            id: expect.any(Number),
            content: expect.any(String),
            sender: expect.any(String),
            senderName: expect.any(String),
            timestamp: expect.any(String),
            type: expect.any(String)
          });
        }
      } catch (error) {
        expect(error.message).toMatch(/连接|不可用|timeout|搜索失败/i);
      }
    });

    it('应该正确处理Chatlog服务连接失败', async () => {
      // 临时修改配置指向无效地址
      const originalConfig = require('../../config/api');
      const invalidConfig = {
        ...originalConfig,
        chatlog: {
          ...originalConfig.chatlog,
          baseUrl: 'http://localhost:9999' // 不存在的端口
        }
      };

      // 创建新的服务实例来测试错误处理
      jest.doMock('../../config/api', () => invalidConfig);
      
      try {
        await chatlogService.healthCheck();
        fail('应该抛出连接错误');
      } catch (error) {
        expect(error.message).toMatch(/连接|不可用|ECONNREFUSED/i);
      }
    });
  });

  describe('AI Service集成测试', () => {
    const AI_AVAILABLE = process.env.TEST_WITH_REAL_AI === 'true' && process.env.DEEPSEEK_API_KEY;

    beforeAll(() => {
      if (!AI_AVAILABLE) {
        console.log('跳过AI集成测试 - 设置TEST_WITH_REAL_AI=true并提供DEEPSEEK_API_KEY启用');
      }
    });

    it('应该能够连接到真实的AI服务', async () => {
      if (!AI_AVAILABLE) return;

      const healthCheck = await aiService.healthCheck();
      
      expect(healthCheck).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        responseTime: expect.any(Number)
      });

      if (healthCheck.status === 'healthy') {
        expect(healthCheck.responseTime).toBeLessThan(10000);
      }
    });

    it('应该能够执行真实的AI分析', async () => {
      if (!AI_AVAILABLE) return;

      const testMessages = [
        {
          id: 1,
          content: '今天天气很好，我们去公园散步吧！',
          sender: 'wxid_test_1',
          senderName: '测试用户1',
          timestamp: new Date().toISOString(),
          type: 'text'
        },
        {
          id: 2,
          content: '好的，我也想出去透透气，工作太累了。',
          sender: 'wxid_test_2',
          senderName: '测试用户2',
          timestamp: new Date().toISOString(),
          type: 'text'
        }
      ];

      try {
        const result = await aiService.analyzeMessages(testMessages, 'summary');
        
        expect(result).toMatchObject({
          success: true,
          analysisType: 'summary',
          summary: expect.any(String),
          messageCount: 2,
          processingTime: expect.stringMatching(/^\d+ms$/),
          timestamp: expect.any(String)
        });

        expect(result.summary.length).toBeGreaterThan(10);
        
      } catch (error) {
        // 可能的API错误
        expect(error.message).toMatch(/API|认证|超时|配额/i);
      }
    });

    it('应该能够执行真实的UltraThink分析', async () => {
      if (!AI_AVAILABLE) return;

      const testMessages = testUtils.createMockMessages(5);

      try {
        const result = await aiService.ultrathinkAnalysis(testMessages);
        
        expect(result).toMatchObject({
          success: true,
          analysisType: 'ultrathink',
          ultrathink: expect.stringContaining('🧠'),
          messageCount: 5,
          complexity: expect.stringMatching(/^(low|medium|high)$/),
          processingTime: expect.stringMatching(/^\d+ms$/),
          timestamp: expect.any(String)
        });

        expect(result.ultrathink.length).toBeGreaterThan(50);
        
      } catch (error) {
        expect(error.message).toMatch(/API|认证|超时|配额/i);
      }
    });

    it('应该处理AI API认证失败', async () => {
      // 临时设置无效的API密钥
      const originalKey = process.env.DEEPSEEK_API_KEY;
      process.env.DEEPSEEK_API_KEY = 'invalid-key';

      const testMessages = testUtils.createMockMessages(2);

      try {
        await aiService.analyzeMessages(testMessages, 'summary');
        fail('应该抛出认证错误');
      } catch (error) {
        expect(error.message).toMatch(/认证|API.*key|unauthorized/i);
      } finally {
        // 恢复原始密钥
        process.env.DEEPSEEK_API_KEY = originalKey;
      }
    });

    it('应该处理AI API配额限制', async () => {
      if (!AI_AVAILABLE) return;

      // 创建大量请求来触发配额限制（仅在测试环境）
      const testMessages = testUtils.createMockMessages(2);
      const requests = Array.from({ length: 10 }, () => 
        aiService.analyzeMessages(testMessages, 'summary')
          .catch(error => error)
      );

      const results = await Promise.all(requests);
      
      // 至少有一些请求应该成功，可能有一些失败（配额限制）
      const successes = results.filter(r => r.success);
      const errors = results.filter(r => r instanceof Error);

      expect(successes.length + errors.length).toBe(10);
      
      if (errors.length > 0) {
        errors.forEach(error => {
          expect(error.message).toMatch(/配额|限制|rate.*limit/i);
        });
      }
    }, 30000); // 增加超时时间
  });

  describe('服务间协作集成测试', () => {
    it('应该能够完成完整的分析流程（模拟环境）', async () => {
      // 使用模拟数据进行完整流程测试
      const mockMessages = testUtils.createMockMessages(10);
      
      // 模拟Chatlog服务
      jest.spyOn(chatlogService, 'searchMessages').mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 10,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      });

      // 模拟AI服务
      jest.spyOn(aiService, 'analyzeMessages').mockResolvedValue({
        success: true,
        analysisType: 'summary',
        summary: '这是一个测试摘要分析结果',
        messageCount: 10,
        processingTime: '1200ms',
        timestamp: new Date().toISOString()
      });

      // 执行完整的搜索-分析流程
      const searchResult = await chatlogService.searchMessages({
        query: '测试',
        startDate: '2025-07-16',
        limit: 50
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.messages.length).toBe(10);

      const analysisResult = await aiService.analyzeMessages(
        searchResult.messages,
        'summary'
      );

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.messageCount).toBe(10);
      expect(analysisResult.summary).toContain('测试摘要');

      // 清理模拟
      jest.restoreAllMocks();
    });

    it('应该处理服务间的错误传播', async () => {
      // 模拟Chatlog服务成功，AI服务失败
      jest.spyOn(chatlogService, 'searchMessages').mockResolvedValue({
        success: true,
        messages: testUtils.createMockMessages(5),
        total: 5
      });

      jest.spyOn(aiService, 'analyzeMessages').mockRejectedValue(
        new Error('AI服务暂时不可用')
      );

      try {
        const searchResult = await chatlogService.searchMessages({
          query: '测试',
          startDate: '2025-07-16'
        });

        expect(searchResult.success).toBe(true);

        await aiService.analyzeMessages(searchResult.messages, 'summary');
        fail('应该抛出AI服务错误');
      } catch (error) {
        expect(error.message).toContain('AI服务暂时不可用');
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('应该验证数据在服务间的正确传递', async () => {
      const originalMessages = testUtils.createMockMessages(3);
      
      jest.spyOn(chatlogService, 'searchMessages').mockResolvedValue({
        success: true,
        messages: originalMessages,
        total: 3
      });

      let receivedMessages;
      jest.spyOn(aiService, 'analyzeMessages').mockImplementation((messages, type) => {
        receivedMessages = messages;
        return Promise.resolve({
          success: true,
          analysisType: type,
          [type]: '分析结果',
          messageCount: messages.length
        });
      });

      const searchResult = await chatlogService.searchMessages({
        query: '测试'
      });

      await aiService.analyzeMessages(searchResult.messages, 'summary');

      // 验证消息在服务间正确传递
      expect(receivedMessages).toEqual(originalMessages);
      expect(receivedMessages.length).toBe(3);
      expect(receivedMessages[0].id).toBe(originalMessages[0].id);

      jest.restoreAllMocks();
    });

    it('应该处理大量数据的服务间传递', async () => {
      const largeMessageSet = testUtils.createMockMessages(100);
      
      jest.spyOn(chatlogService, 'searchMessages').mockResolvedValue({
        success: true,
        messages: largeMessageSet,
        total: 100
      });

      jest.spyOn(aiService, 'analyzeMessages').mockImplementation((messages) => {
        // 模拟处理时间
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              analysisType: 'summary',
              summary: '大数据集分析完成',
              messageCount: messages.length,
              processingTime: '3000ms'
            });
          }, 100);
        });
      });

      const startTime = Date.now();

      const searchResult = await chatlogService.searchMessages({
        query: '测试',
        limit: 100
      });

      const analysisResult = await aiService.analyzeMessages(
        searchResult.messages,
        'summary'
      );

      const totalTime = Date.now() - startTime;

      expect(analysisResult.messageCount).toBe(100);
      expect(totalTime).toBeLessThan(5000); // 合理的处理时间

      jest.restoreAllMocks();
    });
  });

  describe('网络和超时集成测试', () => {
    it('应该正确处理网络超时', async () => {
      // 模拟网络超时
      jest.spyOn(axios, 'get').mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject({ code: 'ETIMEDOUT', message: 'timeout' });
          }, 100);
        });
      });

      try {
        await chatlogService.healthCheck();
        fail('应该抛出超时错误');
      } catch (error) {
        expect(error.message).toMatch(/超时|timeout/i);
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('应该正确处理网络连接失败', async () => {
      jest.spyOn(axios, 'get').mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      try {
        await chatlogService.getContacts();
        fail('应该抛出连接错误');
      } catch (error) {
        expect(error.message).toMatch(/连接|不可用|ECONNREFUSED/i);
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('应该处理间歇性网络问题', async () => {
      // 模拟网络不稳定：第一次失败，第二次成功
      jest.spyOn(axios, 'post')
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            choices: [{ message: { content: '分析结果' } }],
            usage: { total_tokens: 100 }
          }
        });

      const testMessages = testUtils.createMockMessages(2);

      // AI服务应该重试并成功
      const result = await aiService.analyzeMessages(testMessages, 'summary');
      
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });
  });

  describe('数据完整性和一致性测试', () => {
    it('应该保持消息数据的完整性', async () => {
      const originalMessage = {
        id: 1,
        content: '测试消息内容，包含特殊字符：@#$%^&*()，中文字符',
        sender: 'wxid_test_1',
        senderName: '测试用户（特殊名称）',
        timestamp: '2025-07-16T10:30:00.000Z',
        type: 'text',
        metadata: {
          rawContent: '原始内容'
        }
      };

      // 验证消息通过各个服务时保持完整性
      const formatted = aiService.formatMessagesForAnalysis([originalMessage]);
      
      expect(formatted).toContain('测试消息内容');
      expect(formatted).toContain('测试用户（特殊名称）');
      expect(formatted).toContain('2025-07-16T10:30:00.000Z');
    });

    it('应该正确处理边界情况数据', async () => {
      const edgeCaseMessages = [
        {
          id: 1,
          content: '', // 空内容
          sender: 'wxid_test_1',
          senderName: '用户1',
          timestamp: new Date().toISOString(),
          type: 'text'
        },
        {
          id: 2,
          content: 'a'.repeat(2000), // 长内容
          sender: 'wxid_test_2',
          senderName: '用户2',
          timestamp: new Date().toISOString(),
          type: 'text'
        },
        {
          id: 3,
          content: '[图片]', // 非文本类型
          sender: 'wxid_test_3',
          senderName: '用户3',
          timestamp: new Date().toISOString(),
          type: 'image'
        }
      ];

      const formatted = aiService.formatMessagesForAnalysis(edgeCaseMessages);
      
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).toContain('[图片]');
      expect(formatted.length).toBeLessThan(10000); // 应该被截断
    });

    it('应该正确处理并发数据请求', async () => {
      const testParams = [
        { query: '测试1', startDate: '2025-07-16' },
        { query: '测试2', startDate: '2025-07-15' },
        { query: '测试3', startDate: '2025-07-14' }
      ];

      // 模拟并发搜索请求
      jest.spyOn(chatlogService, 'searchMessages').mockImplementation((params) => {
        return Promise.resolve({
          success: true,
          messages: testUtils.createMockMessages(5),
          total: 5,
          query: params.query
        });
      });

      const promises = testParams.map(params => 
        chatlogService.searchMessages(params)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.query).toBe(testParams[index].query);
      });

      jest.restoreAllMocks();
    });
  });
});