import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 模拟微信数据
const mockMessages = [
  {
    _id: new ObjectId(),
    sender: '张三',
    receiver: '我',
    content: '今晚一起吃饭吗？我在公司楼下等你',
    timestamp: new Date('2024-07-15T18:30:00Z'),
    chatId: 'chat_001'
  },
  {
    _id: new ObjectId(),
    sender: '李四',
    receiver: '我',
    content: '项目进展如何？明天需要向老板汇报进度',
    timestamp: new Date('2024-07-16T09:15:00Z'),
    chatId: 'chat_002'
  },
  {
    _id: new ObjectId(),
    sender: '王五',
    receiver: '项目群',
    content: '大家辛苦啦！今晚8点线上会议讨论技术方案',
    timestamp: new Date('2024-07-16T14:20:00Z'),
    chatId: 'chat_003'
  },
  {
    _id: new ObjectId(),
    sender: '妈妈',
    receiver: '我',
    content: '周末回家吃饭吗？我给你做了你最爱吃的红烧肉',
    timestamp: new Date('2024-07-14T11:30:00Z'),
    chatId: 'chat_004'
  },
  {
    _id: new ObjectId(),
    sender: '老板',
    receiver: '我',
    content: '明天早上9点来我办公室，讨论下季度计划',
    timestamp: new Date('2024-07-15T20:45:00Z'),
    chatId: 'chat_005'
  }
];

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 搜索API
app.get('/api/search', (req, res) => {
  const { query, limit = '20' } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.json({
      success: true,
      data: { messages: [] }
    });
  }

  const results = mockMessages.filter(msg => 
    msg.content.toLowerCase().includes(query.toLowerCase()) ||
    msg.sender.toLowerCase().includes(query.toLowerCase()) ||
    msg.receiver.toLowerCase().includes(query.toLowerCase())
  ).slice(0, parseInt(limit as string));

  res.json({
    success: true,
    data: { messages: results },
    total: results.length
  });
});

// 统计API
app.get('/api/stats', (_req, res) => {
  const totalMessages = mockMessages.length;
  const totalChats = new Set(mockMessages.map(m => m.chatId)).size;
  
  res.json({
    success: true,
    data: {
      totalMessages,
      totalChats,
      dateRange: {
        start: mockMessages[0]?.timestamp,
        end: mockMessages[mockMessages.length - 1]?.timestamp
      }
    }
  });
});

// 404处理
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📡 搜索测试: http://localhost:3000/api/search?query=吃饭');
});

export default server;