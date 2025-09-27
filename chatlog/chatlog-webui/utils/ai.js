const axios = require('axios');
const config = require('../config/api');

class AIService {
    constructor() {
        this.apiKey = config.deepseek.apiKey;
        this.baseUrl = config.deepseek.baseUrl;
        this.model = config.deepseek.model;
        this.timeout = config.deepseek.timeout;
    }

    async callDeepSeekAPI(messages, systemPrompt = '') {
        let requestMessages = null;
        try {
            // 内存优化：限制请求内容大小
            const truncatedMessages = messages.length > 8000 ? messages.substring(0, 8000) + '...(内容已截断)' : messages;
            const truncatedPrompt = systemPrompt.length > 2000 ? systemPrompt.substring(0, 2000) + '...' : systemPrompt;
            
            requestMessages = [
                { role: 'system', content: truncatedPrompt },
                { role: 'user', content: truncatedMessages }
            ];

            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: requestMessages,
                    max_tokens: Math.min(config.deepseek.maxTokens, 2000), // 限制响应长度
                    temperature: config.deepseek.temperature
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            const result = response.data.choices[0].message.content;
            
            // 内存清理
            requestMessages = null;
            
            return result;
        } catch (error) {
            // 清理内存
            requestMessages = null;
            console.error('DeepSeek API调用错误:', error.response?.data || error.message);
            throw new Error('AI服务暂时不可用，请稍后重试');
        }
    }

    formatMessages(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return '暂无聊天记录';
        }

        // 内存优化：限制处理数量和内容长度
        const maxMessages = Math.min(messages.length, config.analysis.batchSize);
        const maxContentLength = 200; // 单条消息最大长度
        const formattedMessages = [];
        let totalLength = 0;
        const maxTotalLength = 10000; // 总长度限制

        for (let i = 0; i < maxMessages; i++) {
            const msg = messages[i];
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '未知时间';
            const sender = (msg.sender || '未知').substring(0, 20); // 限制发送者名称长度
            let content = (msg.content || '').substring(0, maxContentLength); // 限制内容长度
            
            // 如果内容被截断，添加省略号
            if (msg.content && msg.content.length > maxContentLength) {
                content += '...';
            }
            
            const formatted = `[${time}] ${sender}: ${content}`;
            
            // 检查总长度限制
            if (totalLength + formatted.length > maxTotalLength) {
                formattedMessages.push('...(内容过长，已截断)');
                break;
            }
            
            formattedMessages.push(formatted);
            totalLength += formatted.length;
        }

        return formattedMessages.join('\n');
    }

    async generateSummary(messages) {
        const formattedMessages = this.formatMessages(messages);
        const systemPrompt = `你是一个专业的聊天记录分析助手。请分析以下微信聊天记录，生成一个简洁的摘要。
        摘要应该包括：
        1. 主要话题和讨论内容
        2. 参与者的关键观点
        3. 重要决定或结论
        4. 时间跨度和活跃度
        
        请用中文回复，控制在${config.analysis.summaryLength}字以内。`;

        try {
            const result = await this.callDeepSeekAPI(formattedMessages, systemPrompt);
            return {
                summary: result,
                messageCount: messages.length,
                analysis: '智能摘要分析完成'
            };
        } catch (error) {
            throw error;
        }
    }

    async analyzeSentiment(messages) {
        const formattedMessages = this.formatMessages(messages);
        const systemPrompt = `你是一个情感分析专家。请分析以下微信聊天记录的整体情感倾向。
        
        请按以下格式回复：
        1. 整体情感倾向（积极/中性/消极）
        2. 情感强度（1-10分）
        3. 主要情感类型（开心、愤怒、悲伤、兴奋等）
        4. 情感变化趋势
        5. 具体分析说明
        
        请用中文回复，提供客观的分析结果。`;

        try {
            const result = await this.callDeepSeekAPI(formattedMessages, systemPrompt);
            return {
                sentiment: result,
                messageCount: messages.length,
                analysis: '情感分析完成'
            };
        } catch (error) {
            throw error;
        }
    }

    async extractKeywords(messages) {
        const formattedMessages = this.formatMessages(messages);
        const systemPrompt = `你是一个关键词提取专家。请从以下微信聊天记录中提取重要的关键词。
        
        请按以下格式回复：
        1. 核心关键词（${config.analysis.keywordLimit}个以内）
        2. 人物关键词
        3. 地点关键词
        4. 事件关键词
        5. 情感关键词
        
        每个关键词后面标注出现频次，按重要性排序。用中文回复。`;

        try {
            const result = await this.callDeepSeekAPI(formattedMessages, systemPrompt);
            return {
                keywords: result,
                messageCount: messages.length,
                analysis: '关键词提取完成'
            };
        } catch (error) {
            throw error;
        }
    }

    async classifyTopics(messages) {
        const formattedMessages = this.formatMessages(messages);
        const systemPrompt = `你是一个话题分类专家。请将以下微信聊天记录按话题进行分类整理。
        
        请按以下格式回复：
        1. 主要话题分类（工作、生活、娱乐、学习等）
        2. 每个话题的具体内容摘要
        3. 话题讨论的活跃度
        4. 话题之间的关联性
        5. 未分类的其他内容
        
        用中文回复，提供清晰的分类结构。`;

        try {
            const result = await this.callDeepSeekAPI(formattedMessages, systemPrompt);
            return {
                topics: result,
                messageCount: messages.length,
                analysis: '话题分类完成'
            };
        } catch (error) {
            throw error;
        }
    }

    async generateStatistics(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return {
                statistics: '无聊天记录可分析',
                messageCount: 0,
                analysis: '统计分析无法进行'
            };
        }

        const stats = {
            totalMessages: messages.length,
            timeRange: this.getTimeRange(messages),
            topSenders: this.getTopSenders(messages),
            messageTypes: this.getMessageTypes(messages),
            timeDistribution: this.getTimeDistribution(messages),
            wordCount: this.getWordCount(messages)
        };

        const formattedMessages = this.formatMessages(messages.slice(0, 20));
        const systemPrompt = `基于以下聊天记录样本和统计数据，生成一个详细的统计分析报告：
        
        统计数据：
        - 总消息数：${stats.totalMessages}
        - 时间跨度：${stats.timeRange}
        - 消息类型分布：${JSON.stringify(stats.messageTypes)}
        
        请分析：
        1. 聊天活跃度模式
        2. 参与者互动特点
        3. 内容特征分析
        4. 时间分布规律
        5. 其他有趣的发现
        
        用中文回复，提供有见地的分析。`;

        try {
            const aiAnalysis = await this.callDeepSeekAPI(formattedMessages, systemPrompt);
            return {
                statistics: aiAnalysis,
                rawStats: stats,
                messageCount: messages.length,
                analysis: '统计分析完成'
            };
        } catch (error) {
            return {
                statistics: '自动分析失败，但基础统计数据可用',
                rawStats: stats,
                messageCount: messages.length,
                analysis: '基础统计完成，AI分析失败'
            };
        }
    }

    async customAnalysis(messages, customPrompt) {
        const formattedMessages = this.formatMessages(messages);
        const systemPrompt = `你是一个智能的聊天记录分析助手。用户提供了自定义的分析要求，请根据用户的要求分析以下聊天记录。
        
        用户要求：${customPrompt}
        
        请根据用户的具体要求进行分析，用中文回复，提供有价值的洞察。`;

        try {
            const result = await this.callDeepSeekAPI(formattedMessages, systemPrompt);
            return {
                analysis: result,
                messageCount: messages.length,
                customPrompt: customPrompt,
                analysisType: '自定义分析完成'
            };
        } catch (error) {
            throw error;
        }
    }

    async ultrathinkAnalysis(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return {
                ultrathink: '无聊天记录可分析',
                messageCount: 0,
                analysis: 'UltraThink超级分析无法进行'
            };
        }

        try {
            // 限制分析数据量以避免超时
            const sampleMessages = messages.slice(0, Math.min(20, messages.length));
            
            // 先快速生成基础分析
            const [summary, statistics] = await Promise.all([
                this.generateSummary(sampleMessages),
                this.generateStatistics(messages)
            ]);

            // UltraThink深度分析（使用更少的数据）
            const formattedMessages = this.formatMessages(sampleMessages.slice(0, 10));
            const systemPrompt = `你是一个具有超级思维能力的AI分析师，名为UltraThink。请对以下微信聊天记录进行深度、多维度的超级分析。

基础信息：
- 智能摘要：${summary.summary || '无数据'}
- 总消息数：${statistics.messageCount}条

请进行UltraThink超级分析，包含以下高级维度：

🧠 **认知深度分析**
- 深层沟通模式和心理状态
- 隐含的情感需求和动机

🔮 **预测性洞察**
- 基于当前模式的发展趋势预测
- 潜在的冲突或机会点

🌐 **系统性关联**
- 人际关系网络和影响力分析
- 话题间的深层连接

🎯 **战略性建议**
- 沟通优化建议
- 关系维护策略

⚡ **创新性发现**
- 意想不到的行为模式
- 独特的价值洞察

请用中文回复，提供简洁但深度的分析报告（控制在800字以内）。`;

            const ultrathinkResult = await this.callDeepSeekAPI(formattedMessages, systemPrompt);

            return {
                ultrathink: ultrathinkResult,
                baseAnalysis: {
                    summary: summary.summary,
                    statistics: statistics.rawStats
                },
                messageCount: messages.length,
                analysis: 'UltraThink超级分析完成',
                processingTime: new Date().toISOString(),
                complexity: 'ULTRA_HIGH'
            };
        } catch (error) {
            console.error('UltraThink分析错误:', error);
            throw new Error('UltraThink超级分析暂时不可用，请稍后重试');
        }
    }

    getTimeRange(messages) {
        if (messages.length === 0) return '无数据';
        
        const timestamps = messages
            .filter(msg => msg.timestamp)
            .map(msg => new Date(msg.timestamp))
            .sort((a, b) => a - b);
            
        if (timestamps.length === 0) return '时间信息不可用';
        
        const start = timestamps[0].toLocaleDateString();
        const end = timestamps[timestamps.length - 1].toLocaleDateString();
        return `${start} 至 ${end}`;
    }

    getTopSenders(messages) {
        const senderCount = {};
        messages.forEach(msg => {
            const sender = msg.sender || '未知';
            senderCount[sender] = (senderCount[sender] || 0) + 1;
        });
        
        return Object.entries(senderCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([sender, count]) => ({ sender, count }));
    }

    getMessageTypes(messages) {
        const types = {};
        messages.forEach(msg => {
            const type = msg.type || 'text';
            types[type] = (types[type] || 0) + 1;
        });
        return types;
    }

    getTimeDistribution(messages) {
        const hours = {};
        messages.forEach(msg => {
            if (msg.timestamp) {
                const hour = new Date(msg.timestamp).getHours();
                hours[hour] = (hours[hour] || 0) + 1;
            }
        });
        return hours;
    }

    getWordCount(messages) {
        const totalChars = messages
            .filter(msg => msg.content)
            .reduce((sum, msg) => sum + msg.content.length, 0);
        return {
            totalCharacters: totalChars,
            averageLength: messages.length > 0 ? Math.round(totalChars / messages.length) : 0
        };
    }

    // 内存监控方法
    checkMemoryUsage() {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
        
        return {
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            external: Math.round(usage.external / 1024 / 1024),
            arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
            timestamp: new Date().toISOString()
        };
    }

    // 内存清理方法
    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }

    // 检查是否需要内存清理
    shouldCleanMemory() {
        const usage = this.checkMemoryUsage();
        return usage.heapUsed > 100; // 超过100MB时建议清理
    }
}

module.exports = new AIService();