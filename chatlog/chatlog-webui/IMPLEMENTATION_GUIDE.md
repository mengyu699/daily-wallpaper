const axios = require('axios');
const config = require('../../config/api');
const logger = require('../utils/logger');

class ChatlogService {
  constructor() {
    this.apiBase = config.chatlog.apiBase;
    this.timeout = config.chatlog.timeout;
    this.retryAttempts = config.chatlog.retryAttempts;
    this.retryDelay = config.chatlog.retryDelay;
  }

  async searchMessages(params) {
    const startTime = Date.now();
    
    try {
      logger.info('开始搜索消息', { params });
      
      // 构建搜索参数
      const searchParams = this.buildSearchParams(params);
      
      // 调用Chatlog API
      const response = await this.makeApiCall('/chatlog', searchParams);
      
      // 解析响应数据
      const messages = this.parseChatlogResponse(response.data);
      
      const duration = Date.now() - startTime;
      logger.info('消息搜索完成', { 
        messageCount: messages.length,
        duration,
        params: searchParams
      });
      
      return {
        success: true,
        messages,
        total: messages.length,
        timestamp: new Date().toISOString(),
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('消息搜索失败', { 
        error: error.message,
        duration,
        params
      });
      
      // 🚨 重要：绝对不返回模拟数据
      throw new Error(`获取聊天记录失败: ${error.message}`);
    }
  }

  buildSearchParams(params) {
    const { query, startDate, endDate, talker, limit = 50 } = params;
    
    // 基础参数验证
    if (!startDate && !talker) {
      throw new Error('必须提供开始日期或联系人信息');
    }
    
    const searchParams = {
      limit: Math.min(parseInt(limit) || 50, 100),
      time: startDate || new Date().toISOString().split('T')[0]
    };

    if (talker) {
      searchParams.talker = talker;
    }
    
    if (query && query.trim()) {
      searchParams.q = query.trim();
    }
    
    if (endDate) {
      searchParams.endDate = endDate;
    }

    return searchParams;
  }

  async makeApiCall(endpoint, params, attempt = 1) {
    try {
      logger.debug('API调用开始', { endpoint, params, attempt });
      
      const response = await axios.get(`${this.apiBase}${endpoint}`, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'ChatlogWebUI/2.0.0',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      if (response.status !== 200) {
        throw new Error(`API返回状态码: ${response.status}`);
      }

      return response;
      
    } catch (error) {
      logger.error('API调用失败', { 
        endpoint, 
        params, 
        attempt,
        error: error.message 
      });
      
      // 处理不同类型的错误
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Chatlog服务未启动，请检查服务是否运行在端口8080');
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw new Error('Chatlog服务响应超时，请检查网络连接');
      }
      
      // 重试逻辑
      if (attempt < this.retryAttempts) {
        logger.info(`重试API调用 (${attempt}/${this.retryAttempts})`, { endpoint });
        await this.delay(this.retryDelay);
        return this.makeApiCall(endpoint, params, attempt + 1);
      }
      
      throw error;
    }
  }

  parseChatlogResponse(data) {
    if (!data) {
      throw new Error('Chatlog返回空数据');
    }

    if (typeof data !== 'string') {
      throw new Error('Chatlog返回数据格式错误，期望字符串格式');
    }

    const lines = data.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      logger.warn('Chatlog返回空结果');
      return [];
    }

    const messages = [];
    let messageId = 1;

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      
      // 解析发送者信息：发送者昵称(wxid) 时间
      const senderTimeMatch = line.match(/^(.+?)\\((.+?)\\)\\s+(.+)$/);
      
      if (senderTimeMatch) {
        const [, senderName, senderId, timeStr] = senderTimeMatch;
        const content = lines[i + 1]?.trim() || '';

        if (content) {
          const message = {
            id: messageId++,
            content,
            sender: senderId,
            senderName: senderName.trim(),
            timestamp: this.parseTimestamp(timeStr),
            type: this.detectMessageType(content),
            raw: {
              senderLine: line,
              contentLine: content
            }
          };

          messages.push(message);
        }
        
        i++; // 跳过内容行
      }
    }

    logger.debug('消息解析完成', { 
      totalLines: lines.length,
      parsedMessages: messages.length
    });

    return messages;
  }

  parseTimestamp(timeStr) {
    try {
      // 尝试解析不同的时间格式
      const patterns = [
        /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/,
        /(\d{4})\/(\d{1,2})\/(\d{1,2})/
      ];

      for (const pattern of patterns) {
        const match = timeStr.match(pattern);
        if (match) {
          const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
          const date = new Date(year, month - 1, day, hour, minute, second);
          
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }
      }

      // 如果无法解析，返回当前时间
      logger.warn('无法解析时间戳', { timeStr });
      return new Date().toISOString();
      
    } catch (error) {
      logger.error('时间戳解析错误', { timeStr, error: error.message });
      return new Date().toISOString();
    }
  }

  detectMessageType(content) {
    if (!content) return 'text';
    
    const typePatterns = {
      image: /\\[图片\\]|\\[Image\\]|!\\[.*\\]\\(.*\\)|<img/i,
      link: /\\[链接\\]|\\[Link\\]|https?:\\/\\/|www\\./i,
      file: /\\[文件\\]|\\[File\\]|\\[.*\\.(pdf|doc|docx|txt|zip|rar)\\]/i,
      video: /\\[视频\\]|\\[Video\\]|\\[.*\\.(mp4|avi|mov|wmv)\\]/i,
      audio: /\\[语音\\]|\\[Audio\\]|\\[.*\\.(mp3|wav|m4a)\\]/i,
      sticker: /\\[表情\\]|\\[Sticker\\]|\\[.*emoji.*\\]/i,
      system: /\\[系统消息\\]|\\[System\\]|撤回了一条消息|joined|left/i
    };

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(content)) {
        return type;
      }
    }

    return 'text';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 健康检查
  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiBase}/session`, {
        timeout: 5000
      });
      
      return {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 获取联系人列表
  async getContacts() {
    try {
      const response = await this.makeApiCall('/contact');
      return response.data;
    } catch (error) {
      logger.error('获取联系人失败', { error: error.message });
      throw error;
    }
  }

  // 获取群聊列表
  async getChatrooms() {
    try {
      const response = await this.makeApiCall('/chatroom');
      return response.data;
    } catch (error) {
      logger.error('获取群聊失败', { error: error.message });
      throw error;
    }
  }
}

module.exports = new ChatlogService();