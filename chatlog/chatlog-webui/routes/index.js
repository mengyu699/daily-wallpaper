const express = require('express');
const router = express.Router();
const moment = require('moment');

router.get('/', (req, res) => {
    res.render('index', { 
        title: '微信聊天记录分析系统',
        currentTime: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

router.get('/dashboard', async (req, res) => {
    try {
        const chatlogService = require('../utils/chatlog');
        
        // 获取真实统计数据
        const stats = await chatlogService.getStatistics();
        
        res.render('dashboard', { 
            title: '数据面板',
            stats: {
                totalMessages: stats.totalMessages,
                totalContacts: stats.totalContacts,
                totalGroups: stats.totalGroups,
                lastUpdate: stats.lastUpdate || moment().format('YYYY-MM-DD HH:mm:ss')
            }
        });
    } catch (error) {
        console.error('Dashboard 错误:', error);
        res.render('dashboard', { 
            title: '数据面板',
            stats: {
                totalMessages: 0,
                totalContacts: 0,
                totalGroups: 0,
                lastUpdate: moment().format('YYYY-MM-DD HH:mm:ss')
            },
            error: 'Chatlog服务不可用，请启动Chatlog服务后刷新页面'
        });
    }
});

router.get('/settings', async (req, res) => {
    try {
        const chatlogService = require('../utils/chatlog');
        const connectionStatus = await chatlogService.testConnection();
        
        res.render('settings', { 
            title: '系统设置',
            config: {
                chatlogStatus: connectionStatus.connected ? 'connected' : 'disconnected',
                chatlogMessage: connectionStatus.message,
                aiStatus: 'ready',
                dataPath: '/data/chatlogs'
            }
        });
    } catch (error) {
        res.render('settings', { 
            title: '系统设置',
            config: {
                chatlogStatus: 'error',
                chatlogMessage: 'Chatlog服务检测失败',
                aiStatus: 'ready',
                dataPath: '/data/chatlogs'
            }
        });
    }
});

router.get('/about', (req, res) => {
    res.render('about', { 
        title: '关于系统',
        version: '1.0.0',
        buildTime: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

module.exports = router;