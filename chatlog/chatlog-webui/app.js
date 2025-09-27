const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment');

// 设置生产环境模式
process.env.CHATLOG_MODE = 'production';
console.log('运行模式: 生产环境 (Production Mode)');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.locals.moment = moment;

const indexRouter = require('./routes/index');
const chatRouter = require('./routes/chat');
const analysisRouter = require('./routes/analysis');

app.use('/', indexRouter);
app.use('/chat', chatRouter);
app.use('/analysis', analysisRouter);

const chatlogService = require('./utils/chatlog');
const aiService = require('./utils/ai');

app.get('/api/status', async (req, res) => {
    try {
        const status = await chatlogService.testConnection();
        const memoryUsage = aiService.checkMemoryUsage();
        res.json({
            webServer: 'running',
            chatlog: status.connected,
            ai: 'ready',
            memory: memoryUsage,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const memoryUsage = aiService.checkMemoryUsage();
        res.json({
            webServer: 'running',
            chatlog: false,
            ai: 'ready',
            memory: memoryUsage,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// 内存监控端点
app.get('/api/memory', (req, res) => {
    try {
        const memoryUsage = aiService.checkMemoryUsage();
        const shouldClean = aiService.shouldCleanMemory();
        
        res.json({
            usage: memoryUsage,
            shouldCleanMemory: shouldClean,
            recommendation: shouldClean ? '建议进行内存清理' : '内存使用正常',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: '获取内存信息失败',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 手动内存清理端点
app.post('/api/memory/clean', (req, res) => {
    try {
        const beforeUsage = aiService.checkMemoryUsage();
        const cleaned = aiService.forceGarbageCollection();
        const afterUsage = aiService.checkMemoryUsage();
        
        res.json({
            success: true,
            cleaned: cleaned,
            before: beforeUsage,
            after: afterUsage,
            saved: beforeUsage.heapUsed - afterUsage.heapUsed,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '内存清理失败',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/chatlog/status', async (req, res) => {
    try {
        const status = await chatlogService.testConnection();
        res.json(status);
    } catch (error) {
        res.status(500).json({
            connected: false,
            message: 'Chatlog服务检测失败: ' + error.message
        });
    }
});

app.use((req, res, next) => {
    res.status(404).render('error', { 
        title: '页面未找到',
        message: '请求的页面不存在',
        error: { status: 404 }
    });
});

app.use((err, req, res, next) => {
    console.error('应用错误:', err);
    res.status(err.status || 500).render('error', {
        title: '服务器错误',
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const PORT = process.env.PORT || 3000;

// 定期内存监控
const memoryMonitorInterval = setInterval(() => {
    try {
        const memoryUsage = aiService.checkMemoryUsage();
        const shouldClean = aiService.shouldCleanMemory();
        
        console.log(`[内存监控] 堆内存使用: ${memoryUsage.heapUsed}MB/${memoryUsage.heapTotal}MB`);
        
        if (shouldClean) {
            console.warn(`[内存警告] 内存使用过高，建议清理`);
            // 自动触发垃圾回收
            if (aiService.forceGarbageCollection()) {
                console.log(`[内存清理] 自动垃圾回收完成`);
            }
        }
        
        // 如果内存使用超过150MB，强制警告
        if (memoryUsage.heapUsed > 150) {
            console.error(`[严重警告] 内存使用过高: ${memoryUsage.heapUsed}MB`);
        }
    } catch (error) {
        console.error('[内存监控错误]', error.message);
    }
}, 30000); // 每30秒检查一次

// 优雅关闭时清理定时器
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    clearInterval(memoryMonitorInterval);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    clearInterval(memoryMonitorInterval);
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`微信聊天记录WebUI系统已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`内存监控已启动，每30秒检查一次`);
    
    // 显示初始内存状态
    const initialMemory = aiService.checkMemoryUsage();
    console.log(`初始内存使用: ${initialMemory.heapUsed}MB/${initialMemory.heapTotal}MB`);
});