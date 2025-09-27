import express from 'express';
import { MongoClient } from 'mongodb';
import { AIService } from '../services/ai';

const router = express.Router();

interface AISummaryRequest {
  ids: string[];
  provider?: 'openai' | 'anthropic' | 'deepseek';
}

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

// 获取MongoDB客户端
function getMongoClient(): MongoClient {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat';
  return new MongoClient(uri);
}

// AI摘要接口
router.post('/api/ai/summary', async (req, res) => {
  const { ids, provider = 'openai' }: AISummaryRequest = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message IDs are required'
    });
  }

  if (ids.length > 20) {
    return res.status(400).json({
      success: false,
      error: 'Too many messages. Maximum 20 messages allowed'
    });
  }

  const client = getMongoClient();
  
  try {
    await client.connect();
    const db = client.db();
    const messages = db.collection<Message>('messages');

    // 获取消息内容
    const foundMessages = await messages
      .find({ _id: { $in: ids } })
      .sort({ timestamp: 1 })
      .toArray();

    if (foundMessages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Messages not found'
      });
    }

    // 获取API密钥
    let apiKey = '';
    switch (provider) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY || '';
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY || '';
        break;
      case 'deepseek':
        apiKey = process.env.DEEPSEEK_API_KEY || '';
        break;
    }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: `${provider} API key not configured`
      });
    }

    // 调用AI服务
    const aiService = new AIService({
      provider,
      apiKey
    });

    const texts = foundMessages.map(msg => msg.content);
    const summary = await aiService.summary(texts);

    res.json({
      success: true,
      data: {
        summary,
        messages: foundMessages.length,
        provider
      }
    });

  } catch (error) {
    console.error('AI summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary'
    });
  } finally {
    await client.close();
  }
});

export default router;