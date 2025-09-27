#!/usr/bin/env ts-node

import { WeChatSyncService } from '../scripts/sync_wechat';
import * as cron from 'node-cron';

console.log('🔄 Starting WeChat sync scheduler...');

// 每10分钟执行一次同步
cron.schedule('*/10 * * * *', async () => {
  console.log(`⏰ Running scheduled sync at ${new Date().toISOString()}`);
  
  const syncService = new WeChatSyncService();
  try {
    const result = await syncService.runSync();
    console.log(`✅ Scheduled sync completed: ${result.insertedCount} new messages`);
  } catch (error) {
    console.error('❌ Scheduled sync failed:', error);
  }
});

console.log('📅 Sync scheduler started. Will run every 10 minutes.');