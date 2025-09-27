const express = require('express');
const router = express.Router();
const chatlogService = require('../utils/chatlog');
const moment = require('moment');

router.get('/', (req, res) => {
    res.render('search', { 
        title: '聊天记录搜索',
        query: '',
        results: [],
        filters: {
            dateRange: '',
            contact: '',
            messageType: ''
        }
    });
});

router.post('/search', async (req, res) => {
    try {
        const { query, startDate, endDate, contact, messageType } = req.body;
        
        const searchParams = {
            query,
            startDate: startDate ? moment(startDate).format('YYYY-MM-DD') : null,
            endDate: endDate ? moment(endDate).format('YYYY-MM-DD') : null,
            contact,
            messageType
        };
        
        const results = await chatlogService.searchMessages(searchParams);
        
        res.render('search', {
            title: '搜索结果',
            query,
            results: results || [],
            filters: searchParams,
            total: results ? results.length : 0
        });
        
    } catch (error) {
        console.error('搜索错误:', error);
        res.render('search', {
            title: '搜索出错',
            query: req.body.query || '',
            results: [],
            filters: req.body,
            error: '搜索过程中出现错误，请检查Chatlog服务状态'
        });
    }
});

router.get('/contacts', async (req, res) => {
    try {
        const contacts = await chatlogService.getContacts();
        res.render('contacts', {
            title: '联系人列表',
            contacts: contacts || [],
            total: contacts ? contacts.length : 0
        });
    } catch (error) {
        console.error('获取联系人错误:', error);
        res.render('contacts', {
            title: '联系人列表',
            contacts: [],
            total: 0,
            error: '无法获取联系人列表，请检查Chatlog服务状态'
        });
    }
});

router.get('/groups', async (req, res) => {
    try {
        const groups = await chatlogService.getGroups();
        res.render('groups', {
            title: '群聊列表',
            groups: groups || [],
            total: groups ? groups.length : 0
        });
    } catch (error) {
        console.error('获取群聊错误:', error);
        res.render('groups', {
            title: '群聊列表',
            groups: [],
            total: 0,
            error: '无法获取群聊列表，请检查Chatlog服务状态'
        });
    }
});

router.get('/export', (req, res) => {
    res.render('export', {
        title: '数据导出',
        formats: ['JSON', 'CSV', 'TXT'],
        status: 'ready'
    });
});

router.post('/export', async (req, res) => {
    try {
        const { format, dateRange, contacts } = req.body;
        
        const exportData = await chatlogService.exportData({
            format,
            dateRange,
            contacts: contacts ? contacts.split(',') : []
        });
        
        res.json({
            success: true,
            data: exportData,
            message: '数据导出成功'
        });
        
    } catch (error) {
        console.error('导出错误:', error);
        res.status(500).json({
            success: false,
            message: '数据导出失败: ' + error.message
        });
    }
});

module.exports = router;