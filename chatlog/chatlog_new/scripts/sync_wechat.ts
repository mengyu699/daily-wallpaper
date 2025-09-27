#!/usr/bin/env ts-node

import axios from 'axios';
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

interface Message {
  msgId: string;
  content: string;
  sender: string;
  receiver: string;
  timestamp: number;
  chatId: string;
  type: number;
}

interface SyncResult {
  insertedCount: number;
  latestTimestamp: number;
}

class WeChatSyncService {
  private chatlogServerUrl = 'http://localhost:3030';
  private mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat';
  private client: MongoClient;

  constructor() {
    this.client = new MongoClient(this.mongoUri);
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Connected to MongoDB');
    
    // 创建索引
    const db = this.client.db();
    await db.collection('messages').createIndex({ msgId: 1 }, { unique: true });
    await db.collection('messages').createIndex({ timestamp: 1 });
    await db.collection('messages').createIndex({ chatId: 1 });
  }

  async disconnect() {
    await this.client.close();
  }

  async getLastSyncTime(): Promise<number> {
    const db = this.client.db();
    const lastSync = await db.collection('sync_status').findOne({ _id: 'last_sync' as any });
    return lastSync?.timestamp || 0;
  }

  async updateLastSyncTime(timestamp: number) {
    const db = this.client.db();
    await db.collection('sync_status').updateOne(
      { _id: 'last_sync' as any },
      { $set: { timestamp, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async fetchMessages(since: number): Promise<Message[]> {
    try {
      console.log(`📥 Fetching messages since ${new Date(since).toISOString()}...`);
      
      const response = await axios.get(`${this.chatlogServerUrl}/messages`, {
        params: {
          since: new Date(since).toISOString(),
          limit: 1000
        }
      });

      return response.data.messages || [];
    } catch (error: unknown) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }
  }

  async syncMessages(lastSyncTime?: number): Promise<SyncResult> {
    const since = lastSyncTime || await this.getLastSyncTime();
    
    try {
      const messages = await this.fetchMessages(since);
      
      if (messages.length === 0) {
        console.log('✅ No new messages to sync');
        return { insertedCount: 0, latestTimestamp: since };
      }

      const db = this.client.db();
      const messagesCollection = db.collection<Message>('messages');

      // 批量插入，忽略重复消息
      const result = await messagesCollection.insertMany(
        messages.map(msg => ({
          ...msg,
          _id: new ObjectId(),
          syncedAt: new Date()
        })),
        { ordered: false }
      );

      const latestTimestamp = Math.max(...messages.map(m => m.timestamp));
      await this.updateLastSyncTime(latestTimestamp);

      console.log(`✅ Synced ${result.insertedCount} messages`);
      return {
        insertedCount: result.insertedCount,
        latestTimestamp
      };

    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err.code === 11000) {
        // 处理重复键错误
        console.log('⚠️  Some messages already exist, skipping duplicates');
        const messages = await this.fetchMessages(since);
        const latestTimestamp = Math.max(...messages.map(m => m.timestamp));
        return { insertedCount: 0, latestTimestamp };
      }
      throw error;
    }
  }

  async runSync() {
    try {
      await this.connect();
      const result = await this.syncMessages();
      console.log(`🎉 Sync completed: ${result.insertedCount} new messages, latest timestamp: ${new Date(result.latestTimestamp).toISOString()}`);
      return result;
    } catch (error: unknown) {
      console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// CLI入口
async function main() {
  const lastSyncTime = process.argv[2] ? parseInt(process.argv[2]) : undefined;
  console.log('Syncing from timestamp:', lastSyncTime);
  
  const syncService = new WeChatSyncService();
  try {
    const result = await syncService.runSync();
    console.log(JSON.stringify(result));
  } catch (error: unknown) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { WeChatSyncService };