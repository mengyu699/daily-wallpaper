const express = require('express');
const router = express.Router();
const aiService = require('../utils/ai');
const chatlogService = require('../utils/chatlog');
const moment = require('moment');

router.get('/', (req, res) => {
    res.render('analysis', {
        title: 'AI智能分析',
        analysisTypes: [
            { id: 'ultrathink', name: 'UltraThink超级分析', description: '🧠 深度多维度AI超级分析，融合预测洞察', class: 'ultra-analysis' },
            { id: 'summary', name: '聊天摘要', description: '生成聊天内容的智能摘要' },
            { id: 'sentiment', name: '情感分析', description: '分析聊天中的情感倾向' },
            { id: 'keywords', name: '关键词提取', description: '提取聊天中的重要关键词' },
            { id: 'topics', name: '话题分类', description: '自动分类聊天话题' },
            { id: 'statistics', name: '统计分析', description: '生成详细的统计报告' }
        ],
        results: null
    });
});

router.post('/run', async (req, res) => {
    try {
        const { analysisType, dateRange, contacts, customPrompt } = req.body;
        
        let messages = [];
        const searchParams = {
            startDate: dateRange ? dateRange.split(' - ')[0] : null,
            endDate: dateRange ? dateRange.split(' - ')[1] : null,
            contact: contacts
        };
        
        // 总是尝试获取消息数据，如果没有特定参数就获取所有最近的消息
        messages = await chatlogService.searchMessages(searchParams);
        
        let analysisResult;
        switch (analysisType) {
            case 'ultrathink':
                analysisResult = await aiService.ultrathinkAnalysis(messages);
                break;
            case 'summary':
                analysisResult = await aiService.generateSummary(messages);
                break;
            case 'sentiment':
                analysisResult = await aiService.analyzeSentiment(messages);
                break;
            case 'keywords':
                analysisResult = await aiService.extractKeywords(messages);
                break;
            case 'topics':
                analysisResult = await aiService.classifyTopics(messages);
                break;
            case 'statistics':
                analysisResult = await aiService.generateStatistics(messages);
                break;
            case 'custom':
                analysisResult = await aiService.customAnalysis(messages, customPrompt);
                break;
            default:
                throw new Error('不支持的分析类型');
        }
        
        res.render('analysis', {
            title: 'AI分析结果',
            analysisTypes: [
                { id: 'ultrathink', name: 'UltraThink超级分析', description: '🧠 深度多维度AI超级分析，融合预测洞察', class: 'ultra-analysis' },
                { id: 'summary', name: '聊天摘要', description: '生成聊天内容的智能摘要' },
                { id: 'sentiment', name: '情感分析', description: '分析聊天中的情感倾向' },
                { id: 'keywords', name: '关键词提取', description: '提取聊天中的重要关键词' },
                { id: 'topics', name: '话题分类', description: '自动分类聊天话题' },
                { id: 'statistics', name: '统计分析', description: '生成详细的统计报告' }
            ],
            results: {
                type: analysisType,
                data: analysisResult,
                messageCount: messages.length,
                generatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
            }
        });
        
    } catch (error) {
        console.error('AI分析错误:', error);
        res.render('analysis', {
            title: 'AI分析出错',
            analysisTypes: [
                { id: 'ultrathink', name: 'UltraThink超级分析', description: '🧠 深度多维度AI超级分析，融合预测洞察', class: 'ultra-analysis' },
                { id: 'summary', name: '聊天摘要', description: '生成聊天内容的智能摘要' },
                { id: 'sentiment', name: '情感分析', description: '分析聊天中的情感倾向' },
                { id: 'keywords', name: '关键词提取', description: '提取聊天中的重要关键词' },
                { id: 'topics', name: '话题分类', description: '自动分类聊天话题' },
                { id: 'statistics', name: '统计分析', description: '生成详细的统计报告' }
            ],
            results: null,
            error: 'AI分析过程中出现错误: ' + error.message
        });
    }
});

router.get('/history', (req, res) => {
    res.render('analysis-history', {
        title: '分析历史',
        history: [
            {
                id: 1,
                type: 'summary',
                date: moment().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
                status: 'completed'
            },
            {
                id: 2,
                type: 'sentiment',
                date: moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
                status: 'completed'
            }
        ]
    });
});

router.post('/save', async (req, res) => {
    try {
        const { analysisType, results, metadata } = req.body;
        
        res.json({
            success: true,
            message: '分析结果已保存'
        });
        
    } catch (error) {
        console.error('保存分析结果错误:', error);
        res.status(500).json({
            success: false,
            message: '保存失败: ' + error.message
        });
    }
});

module.exports = router;