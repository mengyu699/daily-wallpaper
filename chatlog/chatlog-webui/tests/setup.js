/**
 * Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DEEPSEEK_API_KEY = 'test-api-key';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.JWT_SECRET = 'test-jwt-secret';

// 全局测试配置
global.console = {
  ...console,
  // 在测试中静默日志输出
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 设置测试超时
jest.setTimeout(30000);

// 全局测试前设置
beforeAll(() => {
  // 可以在这里进行全局测试前的设置
});

// 全局测试后清理
afterAll(() => {
  // 可以在这里进行全局测试后的清理
});

// 每个测试前的设置
beforeEach(() => {
  // 清除所有模拟调用
  jest.clearAllMocks();
});

// 测试工具函数
global.testUtils = {
  /**
   * 创建模拟的聊天消息
   */
  createMockMessages: (count = 5) => {
    const messages = [];
    for (let i = 1; i <= count; i++) {
      messages.push({
        id: i,
        content: `测试消息内容 ${i}`,
        sender: `wxid_test_${i}`,
        senderName: `测试用户${i}`,
        timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
        type: 'text',
        metadata: {
          rawSenderLine: `测试用户${i}(wxid_test_${i}) 2025/7/16 10:${String(i).padStart(2, '0')}:00`,
          rawContent: `测试消息内容 ${i}`,
          lineNumber: i * 2
        }
      });
    }
    return messages;
  },

  /**
   * 创建模拟的搜索参数
   */
  createMockSearchParams: () => ({
    query: '测试',
    startDate: '2025-07-16',
    endDate: '2025-07-16',
    talker: 'wxid_test_1',
    limit: 50
  }),

  /**
   * 创建模拟的Chatlog响应
   */
  createMockChatlogResponse: () => {
    return `测试用户1(wxid_test_1) 2025/7/16 10:01:00
测试消息内容 1
测试用户2(wxid_test_2) 2025/7/16 10:02:00
测试消息内容 2
测试用户3(wxid_test_3) 2025/7/16 10:03:00
测试消息内容 3`;
  },

  /**
   * 创建模拟的AI响应
   */
  createMockAiResponse: (type = 'summary') => {
    const responses = {
      summary: '这是一个测试摘要，包含了聊天的主要内容和关键信息。',
      sentiment: '整体情感倾向：积极（8/10）\n主要情感：开心、满意\n情感变化：稳定向上',
      keywords: '关键词分析：\n1. 测试 (3次)\n2. 消息 (3次)\n3. 内容 (3次)',
      topics: '话题分类：\n1. 测试相关 (100%)\n2. 技术讨论 (0%)',
      statistics: '统计分析：\n总消息数：3\n参与人数：3\n平均消息长度：8字',
      ultrathink: '🧠 UltraThink超级分析：\n\n1. 🎯 核心话题识别\n- 主要讨论测试相关内容\n\n2. 💭 情感氛围分析\n- 整体氛围积极向上'
    };
    return responses[type] || responses.summary;
  },

  /**
   * 创建Express请求模拟
   */
  createMockRequest: (overrides = {}) => ({
    query: {},
    body: {},
    params: {},
    headers: {},
    ip: '127.0.0.1',
    method: 'GET',
    url: '/test',
    get: jest.fn().mockReturnValue('test-user-agent'),
    ...overrides
  }),

  /**
   * 创建Express响应模拟
   */
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      headersSent: false
    };
    return res;
  },

  /**
   * 等待指定时间
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 创建错误对象
   */
  createError: (message, code = 'TEST_ERROR') => {
    const error = new Error(message);
    error.code = code;
    return error;
  }
};

// 模拟外部依赖
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn()
  }))
}));

// 模拟winston logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  business: jest.fn(),
  security: jest.fn(),
  performance: jest.fn(),
  requestMiddleware: jest.fn((req, res, next) => next())
}));

module.exports = {};