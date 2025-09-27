#!/usr/bin/env ts-node

import * as fs from 'fs';

// 微信数据库解密工具
class WeChatDecryptor {
  private static readonly WECHAT_KEY = Buffer.from('3576357635763576', 'utf8'); // 微信固定密钥

  static decryptWeChatDB(encryptedPath: string, outputPath: string): boolean {
    try {
      if (!fs.existsSync(encryptedPath)) {
        console.error('❌ 数据库文件不存在:', encryptedPath);
        return false;
      }

      const encryptedData = fs.readFileSync(encryptedPath);
      
      // 简单XOR解密（微信使用此方法）
      const decrypted = this.xorDecrypt(encryptedData, this.WECHAT_KEY);
      
      fs.writeFileSync(outputPath, decrypted);
      console.log('✅ 数据库解密成功:', outputPath);
      return true;
    } catch (error) {
      console.error('❌ 解密失败:', error);
      return false;
    }
  }

  private static xorDecrypt(data: Buffer, key: Buffer): Buffer {
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length];
    }
    return result;
  }

  static testDecryptedDB(dbPath: string): boolean {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`sqlite3 "${dbPath}" ".tables"`, { encoding: 'utf8' });
      console.log('✅ 数据库可正常访问，表结构:', result.trim());
      return true;
    } catch (error) {
      console.error('❌ 数据库访问失败');
      return false;
    }
  }
}

// 主测试函数
function main() {
  console.log('🔍 开始测试微信聊天记录解密...\n');

  const wechatPath = "/Users/mengyu/Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat/2.0b4.0.9/fd02426f1b42ddcff5eae77cb4a8534e/Message/msg_1.db";
  const decryptedPath = "/tmp/decrypted_wechat_msg.db";

  console.log('📁 原始数据库路径:', wechatPath);
  console.log('📊 文件大小:', fs.statSync(wechatPath).size, 'bytes');

  // 尝试解密
  if (WeChatDecryptor.decryptWeChatDB(wechatPath, decryptedPath)) {
    WeChatDecryptor.testDecryptedDB(decryptedPath);
    
    // 查看消息表结构
    const { execSync } = require('child_process');
    try {
      const tables = execSync(`sqlite3 "${decryptedPath}" ".tables"`, { encoding: 'utf8' });
      console.log('📋 数据库表:', tables);
      
      // 查看消息表前几行
      const sample = execSync(`sqlite3 "${decryptedPath}" "SELECT * FROM message LIMIT 3;"`, { encoding: 'utf8' });
      console.log('📨 消息样本:', sample);
    } catch (error) {
      console.log('🔍 尝试其他表名...');
      try {
        const sample = execSync(`sqlite3 "${decryptedPath}" "SELECT * FROM MSG LIMIT 3;"`, { encoding: 'utf8' });
        console.log('📨 MSG表样本:', sample);
      } catch (e) {
        console.log('❌ 无法读取消息表');
      }
    }
  }
}

if (require.main === module) {
  main();
}