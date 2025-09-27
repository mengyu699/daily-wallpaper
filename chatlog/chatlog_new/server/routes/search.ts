import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { validateQuery, sanitizeQuery } from '../middleware/errorHandler';

const router = express.Router();

interface Message {
  _id: string;
  msgId: string;
  content: string;
  sender: string;
  receiver: string;
  timestamp: number;
  chatId: string;
  type: number;
}

// 获取MongoDB客户端（带连接池）
let client: MongoClient | null = null;

async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat';
    client = new MongoClient(uri);
    await client.connect();
  }
  return client;
}

// 构建安全查询条件
function buildQuery(query: string, from?: string, to?: string, chatId?: string) {
  const searchQuery: any = {};

  if (query) {
    searchQuery.$or = [
      { content: { $regex: sanitizeQuery(query), $options: 'i' } },
      { sender: { $regex: sanitizeQuery(query), $options: 'i' } },
      { receiver: { $regex: sanitizeQuery(query), $options: 'i' } }
    ];
  }

  if (from || to) {
    searchQuery.timestamp = {};
    if (from) {
      searchQuery.timestamp.$gte = new Date(from).getTime();
    }
    if (to) {
      searchQuery.timestamp.$lte = new Date(to).getTime();
    }
  }

  if (chatId) {
    searchQuery.chatId = chatId;
  }

  return searchQuery;
}

// GET /api/search?query=关键词&limit=20
router.get('/', validateQuery, async (req, res) => {
  try {
    const client = await getMongoClient();
    const db = client.db();
    const messages = db.collection<Message>('messages');

    const { query, from, to, chatId, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * pageSize;

    // 构建安全查询条件
    const searchQuery = buildQuery(query as string, from as string, to as string, chatId as string);

    // 执行查询
    const [results, totalCount] = await Promise.all([
      messages
        .find(searchQuery)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      messages.countDocuments(searchQuery)
    ]);

    res.json({
      success: true,
      data: {
        messages: results,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: totalCount,
          pages: Math.ceil(totalCount / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({
      success: false,
      error: '搜索失败'
    });
  }
});

export default router;