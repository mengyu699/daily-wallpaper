import { MongoClient } from 'mongodb';

interface Message {
  _id: string;
  content: string;
  sender: string;
  receiver: string;
  timestamp: Date;
  chatId: string;
  type: string;
}

class DatabaseManager {
  private client: MongoClient | null = null;
  private uri: string;

  constructor() {
    this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat';
  }

  async connect() {
    if (!this.client) {
      this.client = new MongoClient(this.uri);
      await this.client.connect();
      
      // 创建索引
      const db = this.client.db();
      await db.collection('messages').createIndex({ content: 'text', sender: 'text', receiver: 'text' });
      await db.collection('messages').createIndex({ timestamp: 1 });
      await db.collection('messages').createIndex({ chatId: 1 });
    }
    return this.client;
  }

  async getMessages(query: string, limit: number = 20) {
    const client = await this.connect();
    const db = client.db();
    
    return db.collection<Message>('messages')
      .find({
        $or: [
          { content: { $regex: query, $options: 'i' } },
          { sender: { $regex: query, $options: 'i' } },
          { receiver: { $regex: query, $options: 'i' } }
        ]
      })
      .limit(limit)
      .toArray();
  }

  async getStats() {
    const client = await this.connect();
    const db = client.db();
    
    const [totalMessages, totalChats] = await Promise.all([
      db.collection('messages').countDocuments(),
      db.collection('messages').distinct('chatId').then(chats => chats.length)
    ]);

    return { totalMessages, totalChats };
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

const dbManager = new DatabaseManager();

export { dbManager, Message };