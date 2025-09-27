const axios = require('axios');
const config = require('../../config/api');
const logger = require('../utils/logger');
const { ChatlogError, ApiConnectionError, ValidationError, createError } = require('../utils/errors');
const { sanitizeData, customValidators } = require('../utils/validators');

/**
 * Chatlog服务类 - 完全基于真实数据，无任何模拟数据
 */
class ChatlogService {
  constructor() {
    this.apiBase = config.chatlog.apiBase;
    this.timeout = config.chatlog.timeout;
    this.retryAttempts = config.chatlog.retryAttempts;
    this.retryDelay = config.chatlog.retryDelay;
    this.isHealthy = false;
    this.lastHealthCheck = null;
    
    // 初始化健康检查
    this.initializeHealthCheck();
  }

  /**
   * 初始化健康检查
   */
  async initializeHealthCheck() {
    try {
      await this.healthCheck();
      logger.info('Chatlog服务初始化健康检查完成', { 
        apiBase: this.apiBase,
        healthy: this.isHealthy 
      });
    } catch (error) {
      logger.error('Chatlog服务初始化失败', { 
        error: error.message,
        apiBase: this.apiBase 
      });
    }
  }

  /**
   * 搜索消息 - 核心功能，只处理真实数据
   */
  async searchMessages(params) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      logger.info('开始搜索消息', { 
        requestId,
        params: this.sanitizeParamsForLog(params)
      });
      
      // 严格验证参数
      this.validateSearchParams(params);
      
      // 构建搜索参数
      const searchParams = this.buildSearchParams(params);
      
      // 🚨 关键：检查服务健康状态
      if (!this.isHealthy) {
        await this.healthCheck();
        if (!this.isHealthy) {
          throw createError.chatlogUnavailable();
        }
      }
      
      // 调用Chatlog API
      const response = await this.makeApiCall('/chatlog', searchParams, requestId);
      
      // 🚨 严格验证响应数据
      if (!response.data) {
        throw new ChatlogError('Chatlog返回空响应');
      }
      
      // 解析响应数据
      const messages = this.parseChatlogResponse(response.data);
      
      const duration = Date.now() - startTime;
      const result = {
        success: true,
        messages,
        total: messages.length,
        timestamp: new Date().toISOString(),
        duration,
        requestId,
        source: 'chatlog-api' // 明确标识数据源
      };
      
      logger.business('搜索完成', {
        requestId,
        messageCount: messages.length,
        duration,
        params: searchParams
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('消息搜索失败', {
        requestId,
        error: error.message,
        duration,
        params: this.sanitizeParamsForLog(params)
      });
      
      // 🚨 绝对不返回模拟数据 - 这是关键改进
      if (error instanceof ChatlogError || error instanceof ApiConnectionError) {
        throw error;
      }
      
      throw new ChatlogError(`搜索失败: ${error.message}`, error);
    }
  }

  /**
   * 严格验证搜索参数
   */
  validateSearchParams(params) {
    const { query, startDate, endDate, talker, limit } = params;
    
    // 必须提供至少一个有效的搜索条件
    if (!startDate && !talker && !query) {
      throw new ValidationError('必须提供至少一个搜索条件（日期、联系人或关键词）');
    }
    
    // 验证日期范围
    if (startDate && endDate && !customValidators.isValidDateRange(startDate, endDate)) {
      throw new ValidationError('无效的日期范围');
    }
    
    // 验证联系人ID
    if (talker && !customValidators.isValidContactId(talker)) {
      throw new ValidationError('无效的联系人标识', 'talker', talker);
    }
    
    // 验证限制数量
    if (limit && (limit < 1 || limit > 100)) {
      throw new ValidationError('限制数量必须在1-100之间', 'limit', limit);
    }
  }

  /**
   * 构建搜索参数
   */
  buildSearchParams(params) {
    const { query, startDate, endDate, talker, limit = 50, type } = params;
    
    const searchParams = {
      limit: Math.min(parseInt(limit) || 50, 100)
    };

    // 日期参数（必需）
    if (startDate) {
      searchParams.time = startDate;
    } else {
      // 如果没有提供开始日期，默认使用今天
      searchParams.time = new Date().toISOString().split('T')[0];
    }

    // 联系人参数
    if (talker) {
      searchParams.talker = sanitizeData.contactId(talker);
    }
    
    // 搜索关键词
    if (query && query.trim()) {
      searchParams.q = sanitizeData.searchQuery(query);
    }
    
    // 结束日期
    if (endDate) {
      searchParams.endDate = endDate;
    }
    
    // 消息类型过滤
    if (type) {
      searchParams.type = type;
    }

    return searchParams;
  }

  /**
   * 执行API调用 - 增强错误处理和重试机制
   */
  async makeApiCall(endpoint, params, requestId, attempt = 1) {
    try {
      logger.debug('API调用开始', { 
        endpoint, 
        params, 
        requestId,
        attempt,
        apiBase: this.apiBase
      });
      
      const response = await axios.get(`${this.apiBase}${endpoint}`, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'ChatlogWebUI/2.0.0',
          'Accept': 'text/plain, application/json, */*',
          'X-Request-ID': requestId
        },
        validateStatus: (status) => status < 500 // 只有5xx错误才重试
      });

      // 检查响应状态
      if (response.status === 400) {
        throw new ValidationError('API请求参数错误', null, params);
      }
      
      if (response.status === 404) {
        throw new ChatlogError('请求的端点不存在');
      }
      
      if (response.status !== 200) {
        throw new ChatlogError(`API返回错误状态: ${response.status}`);
      }

      logger.debug('API调用成功', {
        endpoint,
        requestId,
        attempt,
        responseSize: response.data?.length || 0
      });

      return response;
      
    } catch (error) {
      logger.error('API调用失败', { 
        endpoint, 
        params, 
        requestId,
        attempt,
        error: error.message,
        code: error.code,
        response: error.response?.status
      });
      
      // 处理不同类型的错误
      if (error.code === 'ECONNREFUSED') {
        this.isHealthy = false;
        throw createError.chatlogUnavailable();
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw createError.apiTimeout('Chatlog');
      }
      
      if (error.response?.status === 400) {
        throw new ValidationError('Chatlog API参数错误');
      }
      
      // 重试逻辑（只对5xx错误重试）
      if (attempt < this.retryAttempts && (!error.response || error.response.status >= 500)) {
        logger.info(`重试API调用 (${attempt}/${this.retryAttempts})`, { 
          endpoint, 
          requestId 
        });
        
        await this.delay(this.retryDelay);
        return this.makeApiCall(endpoint, params, requestId, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * 解析Chatlog响应 - 完全重写，移除所有模拟数据逻辑
   */
  parseChatlogResponse(data) {
    if (!data) {
      throw new ChatlogError('Chatlog返回空数据');
    }

    if (typeof data !== 'string') {
      throw new ChatlogError('Chatlog返回数据格式错误，期望字符串格式');
    }

    const lines = data.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      logger.info('Chatlog返回空结果 - 可能没有匹配的聊天记录');
      return [];
    }

    const messages = [];
    let messageId = 1;

    try {
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        
        // 解析发送者信息：发送者昵称(wxid) 时间
        const senderTimeMatch = line.match(/^(.+?)\((.+?)\)\s+(.+)$/);
        
        if (senderTimeMatch) {
          const [, senderName, senderId, timeStr] = senderTimeMatch;
          const content = lines[i + 1]?.trim() || '';

          if (content) {
            const message = {
              id: messageId++,
              content: this.sanitizeMessageContent(content),
              sender: senderId.trim(),
              senderName: senderName.trim(),
              timestamp: this.parseTimestamp(timeStr),
              type: this.detectMessageType(content),
              metadata: {
                rawSenderLine: line,
                rawContent: content,
                lineNumber: i + 1
              }
            };

            messages.push(message);
          }
          
          i++; // 跳过内容行
        } else {
          // 记录无法解析的行
          logger.debug('无法解析的数据行', { 
            line, 
            lineNumber: i + 1 
          });
        }
      }
    } catch (parseError) {
      logger.error('解析Chatlog数据时出错', {
        error: parseError.message,
        dataLength: data.length,
        linesCount: lines.length
      });
      
      throw new ChatlogError(`数据解析失败: ${parseError.message}`);
    }

    logger.debug('消息解析完成', { 
      totalLines: lines.length,
      parsedMessages: messages.length
    });

    return messages;
  }

  /**
   * 清理消息内容
   */
  sanitizeMessageContent(content) {
    if (!content || typeof content !== 'string') return '';
    
    return content
      .trim()
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 移除控制字符
      .substring(0, 2000); // 限制长度
  }

  /**
   * 解析时间戳
   */
  parseTimestamp(timeStr) {
    try {
      // 支持多种时间格式
      const patterns = [
        // 2025/7/16 00:00:21
        /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/,
        // 2025-07-16 00:00:21
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/,
        // 2025/7/16
        /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
        // 2025-07-16
        /(\d{4})-(\d{1,2})-(\d{1,2})/
      ];

      for (const pattern of patterns) {
        const match = timeStr.match(pattern);
        if (match) {
          const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
          const date = new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hour), 
            parseInt(minute), 
            parseInt(second)
          );
          
          if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
            return date.toISOString();
          }
        }
      }

      // 如果无法解析，记录警告但不抛出错误
      logger.warn('无法解析时间戳，使用当前时间', { timeStr });
      return new Date().toISOString();
      
    } catch (error) {
      logger.error('时间戳解析错误', { timeStr, error: error.message });
      return new Date().toISOString();
    }
  }

  /**
   * 检测消息类型
   */
  detectMessageType(content) {
    if (!content || typeof content !== 'string') return 'text';
    
    const typePatterns = {
      image: /\[图片\]|\[Image\]|!\[.*\]\(.*\)|<img/i,
      link: /\[链接\]|\[Link\]|https?:\/\/|www\./i,
      file: /\[文件\]|\[File\]|\[.*\.(pdf|doc|docx|txt|zip|rar)\]/i,
      video: /\[视频\]|\[Video\]|\[.*\.(mp4|avi|mov|wmv)\]/i,
      audio: /\[语音\]|\[Audio\]|\[.*\.(mp3|wav|m4a)\]/i,
      sticker: /\[表情\]|\[Sticker\]|\[.*emoji.*\]/i,
      system: /\[系统消息\]|\[System\]|撤回了一条消息|joined|left|加入了群聊|退出了群聊/i,
      location: /\[位置\]|\[Location\]/i,
      transfer: /\[转账\]|\[Transfer\]/i,
      redpacket: /\[红包\]|\[RedPacket\]/i
    };

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(content)) {
        return type;
      }
    }

    return 'text';
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(`${this.apiBase}/session`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'ChatlogWebUI/2.0.0'
        }
      });
      
      const duration = Date.now() - startTime;
      this.isHealthy = response.status === 200;
      this.lastHealthCheck = new Date().toISOString();
      
      const healthData = {
        status: this.isHealthy ? 'healthy' : 'unhealthy',
        responseTime: duration,
        timestamp: this.lastHealthCheck,
        apiBase: this.apiBase
      };
      
      if (this.isHealthy) {
        logger.info('Chatlog健康检查通过', healthData);
      } else {
        logger.warn('Chatlog健康检查失败', healthData);
      }
      
      return healthData;
      
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date().toISOString();
      
      const healthData = {
        status: 'unhealthy',
        error: error.message,
        timestamp: this.lastHealthCheck,
        apiBase: this.apiBase
      };
      
      logger.error('Chatlog健康检查失败', healthData);
      return healthData;
    }
  }

  /**
   * 获取联系人列表
   */
  async getContacts() {
    try {
      const response = await this.makeApiCall('/contact', {}, this.generateRequestId());
      return response.data;
    } catch (error) {
      logger.error('获取联系人失败', { error: error.message });
      throw new ChatlogError('获取联系人列表失败', error);
    }
  }

  /**
   * 获取群聊列表
   */
  async getChatrooms() {
    try {
      const response = await this.makeApiCall('/chatroom', {}, this.generateRequestId());
      return response.data;
    } catch (error) {
      logger.error('获取群聊失败', { error: error.message });
      throw new ChatlogError('获取群聊列表失败', error);
    }
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      apiBase: this.apiBase,
      timeout: this.timeout
    };
  }

  /**
   * 工具方法
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sanitizeParamsForLog(params) {
    const sanitized = { ...params };
    // 移除敏感信息用于日志记录
    return sanitized;
  }
}

// 创建单例实例
const chatlogService = new ChatlogService();

module.exports = chatlogService;