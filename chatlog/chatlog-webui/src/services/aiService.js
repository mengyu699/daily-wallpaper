const axios = require('axios');
const config = require('../../config/api');
const logger = require('../utils/logger');
const { ApiConnectionError, ValidationError, createError } = require('../utils/errors');

/**
 * AI服务类 - DeepSeek API集成，完全基于真实API
 */
class AiService {
  constructor() {
    this.apiKey = config.deepseek.apiKey;
    this.baseUrl = config.deepseek.baseUrl;
    this.model = config.deepseek.model;
    this.maxTokens = config.deepseek.maxTokens;
    this.temperature = config.deepseek.temperature;
    this.timeout = config.deepseek.timeout;
    
    this.isHealthy = false;
    this.lastHealthCheck = null;
    
    // 验证API配置
    this.validateConfiguration();
  }

  /**
   * 验证API配置
   */
  validateConfiguration() {
    if (!this.apiKey) {
      throw createError.configMissing('DEEPSEEK_API_KEY');
    }
    
    if (!this.baseUrl) {
      throw createError.configMissing('DEEPSEEK_BASE_URL');
    }
    
    logger.info('DeepSeek AI服务配置验证通过', {
      baseUrl: this.baseUrl,
      model: this.model,
      maxTokens: this.maxTokens
    });
  }

  /**
   * UltraThink超级分析 - 多维度深度分析
   */
  async ultrathinkAnalysis(messages) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    const prompt = this.buildUltraThinkPrompt(messages);
    
    try {
      const result = await this.callDeepSeekAPI(prompt, 'ultrathink');
      
      logger.business('UltraThink分析完成', {
        messageCount: messages.length,
        analysisLength: result.length
      });
      
      return {
        analysis: result,
        type: 'ultrathink',
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('UltraThink分析失败', { 
        error: error.message,
        messageCount: messages.length 
      });
      throw error;
    }
  }

  /**
   * 构建UltraThink分析提示词
   */
  buildUltraThinkPrompt(messages) {
    const messageText = this.extractMessageText(messages);
    const participants = this.extractParticipants(messages);
    const timeRange = this.extractTimeRange(messages);
    
    return `
作为UltraThink AI分析师，请对以下聊天记录进行深度多维度分析：

【聊天数据概览】
- 消息数量：${messages.length}条
- 参与人数：${participants.length}人
- 时间范围：${timeRange}
- 主要参与者：${participants.slice(0, 5).join(', ')}

【聊天内容】
${messageText}

【分析要求】
请从以下10个维度进行深度分析：

1. 🎯 核心话题识别
2. 💭 情感氛围分析  
3. 🗣️ 参与者画像
4. 🔥 热点讨论点
5. 📈 话题演进趋势
6. 🤝 社交关系网络
7. 💡 关键洞察发现
8. 🔮 趋势预测分析
9. 📊 数据量化指标
10. 🎪 行动建议

每个维度请提供：
- 核心发现（2-3个关键点）
- 支撑数据和具体例证
- 深层洞察和推理
- 可执行的建议

请确保分析结果：
✓ 基于真实数据
✓ 逻辑清晰
✓ 洞察深刻
✓ 具有预测性
✓ 可操作性强

开始你的UltraThink分析：`;
  }

  /**
   * 生成聊天摘要
   */
  async generateSummary(messages) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    const prompt = this.buildSummaryPrompt(messages);
    
    try {
      const result = await this.callDeepSeekAPI(prompt, 'summary');
      
      return {
        summary: result,
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('摘要生成失败', { 
        error: error.message,
        messageCount: messages.length 
      });
      throw error;
    }
  }

  /**
   * 情感分析
   */
  async analyzeSentiment(messages) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    const prompt = this.buildSentimentPrompt(messages);
    
    try {
      const result = await this.callDeepSeekAPI(prompt, 'sentiment');
      
      return {
        sentiment: result,
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('情感分析失败', { 
        error: error.message,
        messageCount: messages.length 
      });
      throw error;
    }
  }

  /**
   * 关键词提取
   */
  async extractKeywords(messages) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    const prompt = this.buildKeywordsPrompt(messages);
    
    try {
      const result = await this.callDeepSeekAPI(prompt, 'keywords');
      
      return {
        keywords: result,
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('关键词提取失败', { 
        error: error.message,
        messageCount: messages.length 
      });
      throw error;
    }
  }

  /**
   * 话题分类
   */
  async classifyTopics(messages) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    const prompt = this.buildTopicsPrompt(messages);
    
    try {
      const result = await this.callDeepSeekAPI(prompt, 'topics');
      
      return {
        topics: result,
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('话题分类失败', { 
        error: error.message,
        messageCount: messages.length 
      });
      throw error;
    }
  }

  /**
   * 统计分析
   */
  async generateStatistics(messages) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    try {
      // 生成基础统计数据
      const rawStats = this.calculateRawStatistics(messages);
      
      // 使用AI进行深度统计分析
      const prompt = this.buildStatisticsPrompt(messages, rawStats);
      const aiAnalysis = await this.callDeepSeekAPI(prompt, 'statistics');
      
      return {
        statistics: aiAnalysis,
        rawStats,
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('统计分析失败', { 
        error: error.message,
        messageCount: messages.length 
      });
      throw error;
    }
  }

  /**
   * 自定义分析
   */
  async customAnalysis(messages, customPrompt) {
    if (!messages || messages.length === 0) {
      throw new ValidationError('分析消息列表不能为空');
    }

    if (!customPrompt || customPrompt.trim().length === 0) {
      throw new ValidationError('自定义分析要求不能为空');
    }

    const prompt = this.buildCustomPrompt(messages, customPrompt);
    
    try {
      const result = await this.callDeepSeekAPI(prompt, 'custom');
      
      return {
        analysis: result,
        customPrompt,
        messageCount: messages.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('自定义分析失败', { 
        error: error.message,
        messageCount: messages.length,
        customPrompt: customPrompt.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * 调用DeepSeek API
   */
  async callDeepSeekAPI(prompt, analysisType) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      logger.debug('DeepSeek API调用开始', {
        requestId,
        analysisType,
        promptLength: prompt.length
      });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的聊天记录分析专家，能够深入分析聊天内容并提供有价值的洞察。请始终基于提供的真实数据进行分析，不要编造信息。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ChatlogWebUI/2.0.0',
            'X-Request-ID': requestId
          },
          timeout: this.timeout
        }
      );

      const duration = Date.now() - startTime;

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new ApiConnectionError('DeepSeek API返回无效响应');
      }

      const result = response.data.choices[0].message.content.trim();

      logger.info('DeepSeek API调用成功', {
        requestId,
        analysisType,
        duration,
        promptLength: prompt.length,
        responseLength: result.length,
        tokensUsed: response.data.usage?.total_tokens || 0
      });

      this.isHealthy = true;
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.isHealthy = false;

      logger.error('DeepSeek API调用失败', {
        requestId,
        analysisType,
        duration,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw createError.apiTimeout('DeepSeek');
      }

      if (error.response?.status === 401) {
        throw new ApiConnectionError('DeepSeek API密钥无效');
      }

      if (error.response?.status === 429) {
        throw createError.rateLimitExceeded();
      }

      if (error.response?.status >= 500) {
        throw new ApiConnectionError('DeepSeek服务暂时不可用');
      }

      throw new ApiConnectionError(`DeepSeek API调用失败: ${error.message}`);
    }
  }

  /**
   * 构建各种分析提示词
   */
  buildSummaryPrompt(messages) {
    const messageText = this.extractMessageText(messages);
    const participants = this.extractParticipants(messages);
    
    return `
请对以下聊天记录生成简洁的摘要（200-300字）：

参与人员：${participants.join(', ')}
消息数量：${messages.length}条

聊天内容：
${messageText}

摘要要求：
1. 概括主要讨论的话题
2. 突出重要的观点或决定
3. 提及关键的参与者
4. 保持客观中性的语调
5. 控制在300字以内

请开始生成摘要：`;
  }

  buildSentimentPrompt(messages) {
    const messageText = this.extractMessageText(messages);
    
    return `
请分析以下聊天记录的整体情感倾向：

聊天内容：
${messageText}

分析维度：
1. 整体情感倾向（积极/中性/消极）
2. 情感强度（1-10分）
3. 主要情感类型（开心、愤怒、担忧、兴奋等）
4. 情感变化趋势
5. 影响情感的关键事件或话题

请提供详细的情感分析报告：`;
  }

  buildKeywordsPrompt(messages) {
    const messageText = this.extractMessageText(messages);
    
    return `
请从以下聊天记录中提取关键词：

聊天内容：
${messageText}

提取要求：
1. 提取10-15个最重要的关键词
2. 按重要性排序
3. 标注每个关键词的出现频次
4. 包含人名、地名、专业术语等
5. 排除常用的停用词

输出格式：
关键词 (出现次数)

开始提取关键词：`;
  }

  buildTopicsPrompt(messages) {
    const messageText = this.extractMessageText(messages);
    
    return `
请对以下聊天记录进行话题分类：

聊天内容：
${messageText}

分类要求：
1. 识别3-5个主要话题
2. 为每个话题命名
3. 描述每个话题的主要内容
4. 统计每个话题相关的消息数量
5. 分析话题之间的关联性

请开始话题分类分析：`;
  }

  buildStatisticsPrompt(messages, rawStats) {
    const messageText = this.extractMessageText(messages);
    
    return `
请基于以下聊天记录和基础统计数据进行深度统计分析：

基础统计：
- 总消息数：${rawStats.totalMessages}
- 参与人数：${Object.keys(rawStats.topSenders).length}
- 时间跨度：${rawStats.timeRange}
- 最活跃用户：${Object.entries(rawStats.topSenders).slice(0, 3).map(([name, count]) => `${name}(${count}条)`).join(', ')}
- 平均消息长度：${rawStats.wordCount.averageLength}字

聊天内容：
${messageText}

请进行以下统计分析：
1. 活跃度分析（时间段、用户活跃度）
2. 消息类型分布
3. 互动模式分析
4. 响应速度统计
5. 话题集中度分析

提供详细的统计分析报告：`;
  }

  buildCustomPrompt(messages, customPrompt) {
    const messageText = this.extractMessageText(messages);
    
    return `
用户自定义分析要求：${customPrompt}

聊天记录：
${messageText}

请根据用户的具体要求进行分析，确保：
1. 严格按照用户要求进行分析
2. 基于提供的聊天记录数据
3. 提供详细和有价值的分析结果
4. 保持客观和专业的分析态度

开始自定义分析：`;
  }

  /**
   * 工具方法
   */
  extractMessageText(messages) {
    return messages
      .filter(msg => msg.type === 'text' && msg.content?.trim())
      .slice(0, config.analysis.batchSize) // 限制分析数量
      .map(msg => `${msg.senderName}: ${msg.content}`)
      .join('\n');
  }

  extractParticipants(messages) {
    const participants = new Set();
    messages.forEach(msg => {
      if (msg.senderName) {
        participants.add(msg.senderName);
      }
    });
    return Array.from(participants);
  }

  extractTimeRange(messages) {
    if (messages.length === 0) return '未知';
    
    const timestamps = messages
      .map(msg => new Date(msg.timestamp))
      .filter(date => !isNaN(date.getTime()))
      .sort();
    
    if (timestamps.length === 0) return '未知';
    
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString();
    }
    
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }

  calculateRawStatistics(messages) {
    const stats = {
      totalMessages: messages.length,
      topSenders: {},
      messageTypes: {},
      wordCount: {
        total: 0,
        averageLength: 0
      },
      timeRange: this.extractTimeRange(messages)
    };

    let totalChars = 0;
    let textMessages = 0;

    messages.forEach(msg => {
      // 发送者统计
      stats.topSenders[msg.senderName] = (stats.topSenders[msg.senderName] || 0) + 1;
      
      // 消息类型统计
      stats.messageTypes[msg.type] = (stats.messageTypes[msg.type] || 0) + 1;
      
      // 字数统计
      if (msg.type === 'text' && msg.content) {
        totalChars += msg.content.length;
        textMessages++;
      }
    });

    stats.wordCount.total = totalChars;
    stats.wordCount.averageLength = textMessages > 0 ? Math.round(totalChars / textMessages) : 0;

    return stats;
  }

  generateRequestId() {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const testPrompt = "测试连接";
      await this.callDeepSeekAPI(testPrompt, 'health');
      
      this.isHealthy = true;
      this.lastHealthCheck = new Date().toISOString();
      
      return {
        status: 'healthy',
        timestamp: this.lastHealthCheck
      };
      
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date().toISOString();
      
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: this.lastHealthCheck
      };
    }
  }

  getServiceStatus() {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      model: this.model,
      maxTokens: this.maxTokens
    };
  }
}

// 创建单例实例
const aiService = new AiService();

module.exports = aiService;