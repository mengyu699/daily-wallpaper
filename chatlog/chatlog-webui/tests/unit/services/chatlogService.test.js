const axios = require('axios');
const chatlogService = require('../../../src/services/chatlogService');
const { ChatlogError, ValidationError } = require('../../../src/utils/errors');

// 模拟axios
jest.mock('axios');
const mockedAxios = axios;

describe('ChatlogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置服务状态
    chatlogService.isHealthy = true;
  });

  describe('searchMessages', () => {
    it('应该成功搜索并解析真实chatlog数据', async () => {
      const mockResponse = testUtils.createMockChatlogResponse();
      const expectedMessages = testUtils.createMockMessages(3);

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockResponse
      });

      const params = {
        startDate: '2025-07-16',
        query: '测试',
        limit: 50
      };

      const result = await chatlogService.searchMessages(params);

      // 验证结果结构
      expect(result).toMatchObject({
        success: true,
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            content: expect.any(String),
            sender: expect.stringMatching(/^wxid_/),
            senderName: expect.any(String),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            type: 'text'
          })
        ]),
        total: expect.any(Number),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        source: 'chatlog-api'
      });

      // 验证消息数量
      expect(result.messages).toHaveLength(3);

      // 验证API调用参数
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/chatlog'),
        expect.objectContaining({
          params: expect.objectContaining({
            time: '2025-07-16',
            q: '测试',
            limit: 50
          }),
          timeout: expect.any(Number),
          headers: expect.objectContaining({
            'User-Agent': 'ChatlogWebUI/2.0.0'
          })
        })
      );
    });

    it('应该验证必需的搜索参数', async () => {
      // 测试没有提供任何搜索条件
      await expect(chatlogService.searchMessages({}))
        .rejects
        .toThrow(ValidationError);

      // 测试无效的联系人ID
      await expect(chatlogService.searchMessages({
        talker: 'invalid<>id',
        startDate: '2025-07-16'
      }))
        .rejects
        .toThrow(ValidationError);

      // 测试无效的日期范围
      await expect(chatlogService.searchMessages({
        startDate: '2025-07-17',
        endDate: '2025-07-16' // 结束日期早于开始日期
      }))
        .rejects
        .toThrow(ValidationError);
    });

    it('应该处理Chatlog服务不可用的情况', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      await expect(chatlogService.searchMessages({
        startDate: '2025-07-16'
      }))
        .rejects
        .toThrow(ChatlogError);

      expect(chatlogService.isHealthy).toBe(false);
    });

    it('应该处理API超时', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Timeout'
      });

      await expect(chatlogService.searchMessages({
        startDate: '2025-07-16'
      }))
        .rejects
        .toThrow('Chatlog服务响应超时');
    });

    it('应该重试失败的请求', async () => {
      // 第一次调用失败，第二次成功
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          status: 200,
          data: testUtils.createMockChatlogResponse()
        });

      const result = await chatlogService.searchMessages({
        startDate: '2025-07-16'
      });

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('应该正确解析不同的消息类型', async () => {
      const mockResponse = `测试用户1(wxid_test_1) 2025/7/16 10:01:00
[图片]
测试用户2(wxid_test_2) 2025/7/16 10:02:00
https://example.com
测试用户3(wxid_test_3) 2025/7/16 10:03:00
[文件]测试文档.pdf`;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockResponse
      });

      const result = await chatlogService.searchMessages({
        startDate: '2025-07-16'
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].type).toBe('image');
      expect(result.messages[1].type).toBe('link');
      expect(result.messages[2].type).toBe('file');
    });

    it('应该处理空的API响应', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: ''
      });

      const result = await chatlogService.searchMessages({
        startDate: '2025-07-16'
      });

      expect(result.messages).toHaveLength(0);
      expect(result.success).toBe(true);
    });

    it('应该清理和验证消息内容', async () => {
      const mockResponse = `测试用户1(wxid_test_1) 2025/7/16 10:01:00
包含\x00控制字符的消息内容`;

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockResponse
      });

      const result = await chatlogService.searchMessages({
        startDate: '2025-07-16'
      });

      expect(result.messages[0].content).toBe('包含控制字符的消息内容');
    });

    it('应该限制请求参数的值', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: testUtils.createMockChatlogResponse()
      });

      await chatlogService.searchMessages({
        startDate: '2025-07-16',
        limit: 200 // 超过限制
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 100 // 应该被限制到100
          })
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('应该正确检查服务健康状态', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        headers: { 'x-response-time': '10ms' }
      });

      const result = await chatlogService.healthCheck();

      expect(result).toMatchObject({
        status: 'healthy',
        responseTime: expect.any(Number),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        apiBase: expect.any(String)
      });

      expect(chatlogService.isHealthy).toBe(true);
    });

    it('应该处理健康检查失败', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Service unavailable'));

      const result = await chatlogService.healthCheck();

      expect(result).toMatchObject({
        status: 'unhealthy',
        error: 'Service unavailable',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });

      expect(chatlogService.isHealthy).toBe(false);
    });
  });

  describe('getContacts', () => {
    it('应该获取联系人列表', async () => {
      const mockContacts = ['联系人1', '联系人2', '联系人3'];
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockContacts
      });

      const result = await chatlogService.getContacts();

      expect(result).toEqual(mockContacts);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/contact'),
        expect.any(Object)
      );
    });

    it('应该处理获取联系人失败', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(chatlogService.getContacts())
        .rejects
        .toThrow(ChatlogError);
    });
  });

  describe('getChatrooms', () => {
    it('应该获取群聊列表', async () => {
      const mockChatrooms = ['群聊1', '群聊2', '群聊3'];
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockChatrooms
      });

      const result = await chatlogService.getChatrooms();

      expect(result).toEqual(mockChatrooms);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/chatroom'),
        expect.any(Object)
      );
    });
  });

  describe('parseTimestamp', () => {
    it('应该解析不同格式的时间戳', () => {
      const testCases = [
        '2025/7/16 10:30:45',
        '2025-07-16 10:30:45',
        '2025/7/16',
        '2025-07-16'
      ];

      testCases.forEach(timeStr => {
        const result = chatlogService.parseTimestamp(timeStr);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });

    it('应该处理无效的时间戳', () => {
      const invalidTimestamps = ['invalid', '', null, undefined];

      invalidTimestamps.forEach(timeStr => {
        const result = chatlogService.parseTimestamp(timeStr);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/); // 应该返回当前时间
      });
    });
  });

  describe('detectMessageType', () => {
    it('应该正确检测消息类型', () => {
      const testCases = [
        { content: '[图片]', expected: 'image' },
        { content: 'https://example.com', expected: 'link' },
        { content: '[文件]document.pdf', expected: 'file' },
        { content: '[视频]video.mp4', expected: 'video' },
        { content: '[语音]', expected: 'audio' },
        { content: '[表情]', expected: 'sticker' },
        { content: '撤回了一条消息', expected: 'system' },
        { content: '普通文本消息', expected: 'text' }
      ];

      testCases.forEach(({ content, expected }) => {
        const result = chatlogService.detectMessageType(content);
        expect(result).toBe(expected);
      });
    });
  });

  describe('buildSearchParams', () => {
    it('应该正确构建搜索参数', () => {
      const params = {
        query: '  测试查询  ',
        startDate: '2025-07-16',
        endDate: '2025-07-17',
        talker: 'wxid_test_user',
        limit: 25,
        type: 'text'
      };

      const result = chatlogService.buildSearchParams(params);

      expect(result).toMatchObject({
        limit: 25,
        time: '2025-07-16',
        talker: 'wxid_test_user',
        q: '测试查询',
        endDate: '2025-07-17',
        type: 'text'
      });
    });

    it('应该提供默认值', () => {
      const result = chatlogService.buildSearchParams({});

      expect(result).toMatchObject({
        limit: 50,
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      });
    });
  });

  describe('sanitizeMessageContent', () => {
    it('应该清理消息内容', () => {
      const testContent = '  测试内容\x00\x01包含控制字符  ';
      const result = chatlogService.sanitizeMessageContent(testContent);
      
      expect(result).toBe('测试内容包含控制字符');
    });

    it('应该处理空内容', () => {
      expect(chatlogService.sanitizeMessageContent('')).toBe('');
      expect(chatlogService.sanitizeMessageContent(null)).toBe('');
      expect(chatlogService.sanitizeMessageContent(undefined)).toBe('');
    });

    it('应该限制内容长度', () => {
      const longContent = 'a'.repeat(3000);
      const result = chatlogService.sanitizeMessageContent(longContent);
      
      expect(result.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('getServiceStatus', () => {
    it('应该返回服务状态', () => {
      const status = chatlogService.getServiceStatus();

      expect(status).toMatchObject({
        isHealthy: expect.any(Boolean),
        lastHealthCheck: expect.any(String),
        apiBase: expect.any(String),
        timeout: expect.any(Number)
      });
    });
  });
});