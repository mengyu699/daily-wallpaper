const chatController = require('../../../src/controllers/chatController');
const chatlogService = require('../../../src/services/chatlogService');
const logger = require('../../../src/utils/logger');

// 模拟依赖
jest.mock('../../../src/services/chatlogService');
jest.mock('../../../src/utils/logger');

describe('ChatController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = testUtils.createMockRequest();
    mockRes = testUtils.createMockResponse();
  });

  describe('searchMessages', () => {
    it('应该成功搜索聊天消息 (GET请求)', async () => {
      const mockMessages = testUtils.createMockMessages(10);
      const mockSearchResult = {
        success: true,
        messages: mockMessages,
        total: 10,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      };

      mockReq.method = 'GET';
      mockReq.query = {
        q: '测试关键词',
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        talker: 'wxid_test_1',
        limit: '20'
      };

      chatlogService.searchMessages.mockResolvedValue(mockSearchResult);

      await chatController.searchMessages(mockReq, mockRes);

      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        query: '测试关键词',
        startDate: '2025-07-16',
        endDate: '2025-07-16',
        talker: 'wxid_test_1',
        limit: 20
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '搜索完成',
        data: mockSearchResult
      });

      expect(logger.business).toHaveBeenCalledWith('聊天记录搜索', {
        query: '测试关键词',
        params: expect.any(Object),
        resultCount: 10,
        ip: mockReq.ip
      });
    });

    it('应该成功搜索聊天消息 (POST请求)', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      const mockSearchResult = {
        success: true,
        messages: mockMessages,
        total: 5,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      };

      mockReq.method = 'POST';
      mockReq.body = {
        query: 'AI分析',
        startDate: '2025-07-16',
        contacts: ['wxid_test_1', 'wxid_test_2'],
        type: 'text',
        limit: 50
      };

      chatlogService.searchMessages.mockResolvedValue(mockSearchResult);

      await chatController.searchMessages(mockReq, mockRes);

      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        query: 'AI分析',
        startDate: '2025-07-16',
        talker: 'wxid_test_1,wxid_test_2',
        type: 'text',
        limit: 50
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '搜索完成',
        data: mockSearchResult
      });
    });

    it('应该处理空搜索结果', async () => {
      const mockSearchResult = {
        success: true,
        messages: [],
        total: 0,
        timestamp: new Date().toISOString(),
        source: 'chatlog-api'
      };

      mockReq.query = { q: '不存在的关键词' };

      chatlogService.searchMessages.mockResolvedValue(mockSearchResult);

      await chatController.searchMessages(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '未找到符合条件的聊天记录',
        data: mockSearchResult
      });
    });

    it('应该验证搜索参数', async () => {
      // 测试无效的限制数量
      mockReq.query = { limit: '200' }; // 超过最大限制

      await chatController.searchMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '参数limit超出范围，最大值为100',
        code: 'INVALID_LIMIT'
      });

      // 测试无效的日期格式
      jest.clearAllMocks();
      mockReq.query = { startDate: '2025-13-32' }; // 无效日期

      await chatController.searchMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '无效的日期格式',
        code: 'INVALID_DATE_FORMAT'
      });

      // 测试日期范围错误
      jest.clearAllMocks();
      mockReq.query = { 
        startDate: '2025-07-17',
        endDate: '2025-07-16' // 结束日期早于开始日期
      };

      await chatController.searchMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '结束日期不能早于开始日期',
        code: 'INVALID_DATE_RANGE'
      });
    });

    it('应该处理Chatlog服务错误', async () => {
      const serviceError = new Error('Chatlog服务不可用');
      mockReq.query = { q: '测试' };

      chatlogService.searchMessages.mockRejectedValue(serviceError);

      await chatController.searchMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '搜索失败: Chatlog服务不可用',
        code: 'CHATLOG_SERVICE_ERROR'
      });

      expect(logger.error).toHaveBeenCalledWith('聊天记录搜索失败', {
        error: serviceError.message,
        params: { query: '测试' },
        ip: mockReq.ip
      });
    });

    it('应该处理不同的消息类型过滤', async () => {
      const messageTypes = ['text', 'image', 'file', 'audio', 'video'];
      
      for (const type of messageTypes) {
        jest.clearAllMocks();
        
        mockReq.query = { 
          q: '测试',
          type 
        };

        chatlogService.searchMessages.mockResolvedValue({
          success: true,
          messages: testUtils.createMockMessages(3),
          total: 3
        });

        await chatController.searchMessages(mockReq, mockRes);

        expect(chatlogService.searchMessages).toHaveBeenCalledWith({
          query: '测试',
          type
        });
      }
    });

    it('应该正确处理联系人数组', async () => {
      // POST请求中的contacts数组
      mockReq.method = 'POST';
      mockReq.body = {
        contacts: ['wxid_test_1', 'wxid_test_2', 'wxid_test_3']
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: [],
        total: 0
      });

      await chatController.searchMessages(mockReq, mockRes);

      expect(chatlogService.searchMessages).toHaveBeenCalledWith({
        talker: 'wxid_test_1,wxid_test_2,wxid_test_3'
      });
    });
  });

  describe('getContacts', () => {
    it('应该成功获取联系人列表', async () => {
      const mockContacts = [
        { id: 'wxid_test_1', name: '测试用户1', avatar: 'avatar1.jpg' },
        { id: 'wxid_test_2', name: '测试用户2', avatar: 'avatar2.jpg' },
        { id: 'wxid_test_3', name: '测试用户3', avatar: 'avatar3.jpg' }
      ];

      chatlogService.getContacts.mockResolvedValue(mockContacts);

      await chatController.getContacts(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '联系人列表获取成功',
        data: {
          contacts: mockContacts,
          total: 3
        }
      });

      expect(logger.business).toHaveBeenCalledWith('获取联系人列表', {
        contactCount: 3,
        ip: mockReq.ip
      });
    });

    it('应该处理获取联系人失败', async () => {
      const serviceError = new Error('无法连接到Chatlog服务');
      
      chatlogService.getContacts.mockRejectedValue(serviceError);

      await chatController.getContacts(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '获取联系人列表失败: 无法连接到Chatlog服务',
        code: 'CONTACTS_FETCH_ERROR'
      });

      expect(logger.error).toHaveBeenCalledWith('获取联系人列表失败', {
        error: serviceError.message,
        ip: mockReq.ip
      });
    });

    it('应该处理空联系人列表', async () => {
      chatlogService.getContacts.mockResolvedValue([]);

      await chatController.getContacts(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '当前没有联系人',
        data: {
          contacts: [],
          total: 0
        }
      });
    });
  });

  describe('getChatrooms', () => {
    it('应该成功获取群聊列表', async () => {
      const mockChatrooms = [
        { id: 'chatroom_1', name: '技术讨论群', memberCount: 15 },
        { id: 'chatroom_2', name: '项目开发群', memberCount: 8 },
        { id: 'chatroom_3', name: '朋友聚会群', memberCount: 20 }
      ];

      chatlogService.getChatrooms.mockResolvedValue(mockChatrooms);

      await chatController.getChatrooms(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '群聊列表获取成功',
        data: {
          chatrooms: mockChatrooms,
          total: 3
        }
      });

      expect(logger.business).toHaveBeenCalledWith('获取群聊列表', {
        chatroomCount: 3,
        ip: mockReq.ip
      });
    });

    it('应该处理获取群聊失败', async () => {
      const serviceError = new Error('群聊数据读取失败');
      
      chatlogService.getChatrooms.mockRejectedValue(serviceError);

      await chatController.getChatrooms(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '获取群聊列表失败: 群聊数据读取失败',
        code: 'CHATROOMS_FETCH_ERROR'
      });
    });
  });

  describe('exportMessages', () => {
    it('应该支持JSON格式导出', async () => {
      const mockMessages = testUtils.createMockMessages(50);
      
      mockReq.body = {
        format: 'json',
        dateRange: '2025-07-16 - 2025-07-16',
        contacts: ['wxid_test_1']
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 50
      });

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        expect.stringMatching(/attachment; filename="chatlog-export-\d{8}-\d{6}\.json"/)
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        export_info: {
          format: 'json',
          total_messages: 50,
          date_range: '2025-07-16 - 2025-07-16',
          exported_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          source: 'chatlog-webui'
        },
        messages: mockMessages
      });

      expect(logger.business).toHaveBeenCalledWith('数据导出', {
        format: 'json',
        messageCount: 50,
        dateRange: '2025-07-16 - 2025-07-16',
        ip: mockReq.ip
      });
    });

    it('应该支持CSV格式导出', async () => {
      const mockMessages = testUtils.createMockMessages(10);
      
      mockReq.body = {
        format: 'csv',
        dateRange: '2025-07-16 - 2025-07-16'
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 10
      });

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        expect.stringMatching(/attachment; filename="chatlog-export-\d{8}-\d{6}\.csv"/)
      );

      const csvCall = mockRes.send.mock.calls[0][0];
      expect(csvCall).toContain('ID,发送者,发送者姓名,内容,时间,类型');
      expect(csvCall).toContain('测试用户1');
      expect(csvCall).toContain('测试消息内容');
    });

    it('应该支持TXT格式导出', async () => {
      const mockMessages = testUtils.createMockMessages(5);
      
      mockReq.body = {
        format: 'txt',
        contacts: ['wxid_test_1']
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
        total: 5
      });

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        expect.stringMatching(/attachment; filename="chatlog-export-\d{8}-\d{6}\.txt"/)
      );

      const txtCall = mockRes.send.mock.calls[0][0];
      expect(txtCall).toContain('微信聊天记录导出');
      expect(txtCall).toContain('测试用户1');
      expect(txtCall).toContain('测试消息内容');
    });

    it('应该验证导出参数', async () => {
      // 测试无效的导出格式
      mockReq.body = { format: 'invalid' };

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '不支持的导出格式: invalid',
        code: 'INVALID_EXPORT_FORMAT',
        supportedFormats: ['json', 'csv', 'txt']
      });

      // 测试缺少格式参数
      jest.clearAllMocks();
      mockReq.body = {};

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '缺少必需的参数: format',
        code: 'MISSING_FORMAT'
      });
    });

    it('应该处理导出数据为空的情况', async () => {
      mockReq.body = {
        format: 'json',
        dateRange: '2025-01-01 - 2025-01-01'
      };

      chatlogService.searchMessages.mockResolvedValue({
        success: true,
        messages: [],
        total: 0
      });

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '没有找到可导出的数据',
        code: 'NO_DATA_TO_EXPORT'
      });
    });

    it('应该处理导出过程中的错误', async () => {
      mockReq.body = {
        format: 'json',
        dateRange: '2025-07-16 - 2025-07-16'
      };

      const serviceError = new Error('数据查询失败');
      chatlogService.searchMessages.mockRejectedValue(serviceError);

      await chatController.exportMessages(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '导出失败: 数据查询失败',
        code: 'EXPORT_ERROR'
      });

      expect(logger.error).toHaveBeenCalledWith('数据导出失败', {
        error: serviceError.message,
        format: 'json',
        ip: mockReq.ip
      });
    });
  });

  describe('getChatlogStatus', () => {
    it('应该返回Chatlog服务状态', async () => {
      const mockStatus = {
        status: 'healthy',
        responseTime: 120,
        timestamp: new Date().toISOString(),
        apiBase: 'http://localhost:8080'
      };

      chatlogService.healthCheck.mockResolvedValue(mockStatus);
      chatlogService.getServiceStatus.mockReturnValue({
        isHealthy: true,
        lastHealthCheck: new Date().toISOString(),
        apiBase: 'http://localhost:8080',
        timeout: 10000
      });

      await chatController.getChatlogStatus(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          healthCheck: mockStatus,
          serviceStatus: {
            isHealthy: true,
            lastHealthCheck: expect.any(String),
            apiBase: 'http://localhost:8080',
            timeout: 10000
          }
        }
      });

      expect(chatlogService.healthCheck).toHaveBeenCalled();
      expect(chatlogService.getServiceStatus).toHaveBeenCalled();
    });

    it('应该处理Chatlog服务不可用', async () => {
      const serviceError = new Error('连接被拒绝');
      
      chatlogService.healthCheck.mockRejectedValue(serviceError);
      chatlogService.getServiceStatus.mockReturnValue({
        isHealthy: false,
        lastHealthCheck: new Date().toISOString()
      });

      await chatController.getChatlogStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Chatlog服务状态检查失败: 连接被拒绝',
        data: {
          serviceStatus: {
            isHealthy: false,
            lastHealthCheck: expect.any(String)
          }
        }
      });
    });
  });

  describe('参数处理工具函数', () => {
    it('应该正确解析查询参数', () => {
      const testCases = [
        {
          input: { limit: '50' },
          expected: { limit: 50 }
        },
        {
          input: { limit: 'invalid' },
          expected: { limit: 50 } // 默认值
        },
        {
          input: { startDate: '2025-07-16' },
          expected: { startDate: '2025-07-16' }
        },
        {
          input: {},
          expected: {}
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = chatController.parseSearchParams(input);
        expect(result).toMatchObject(expected);
      });
    });

    it('应该验证日期格式', () => {
      const validDates = ['2025-07-16', '2025-01-01', '2025-12-31'];
      const invalidDates = ['2025-13-01', '2025-07-32', 'invalid-date', ''];

      validDates.forEach(date => {
        expect(() => chatController.validateDateFormat(date)).not.toThrow();
      });

      invalidDates.forEach(date => {
        expect(() => chatController.validateDateFormat(date)).toThrow();
      });
    });

    it('应该生成正确的导出文件名', () => {
      const testCases = [
        { format: 'json', expected: /chatlog-export-\d{8}-\d{6}\.json/ },
        { format: 'csv', expected: /chatlog-export-\d{8}-\d{6}\.csv/ },
        { format: 'txt', expected: /chatlog-export-\d{8}-\d{6}\.txt/ }
      ];

      testCases.forEach(({ format, expected }) => {
        const filename = chatController.generateExportFilename(format);
        expect(filename).toMatch(expected);
      });
    });
  });
});