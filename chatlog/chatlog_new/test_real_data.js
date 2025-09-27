#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 测试真实微信数据的脚本
class WeChatRealDataTester {
  constructor() {
    this.wechatBasePath = "/Users/mengyu/Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat";
    this.messageDbs = [];
  }

  findMessageDatabases() {
    console.log('🔍 查找微信消息数据库...');
    
    try {
      const versions = fs.readdirSync(this.wechatBasePath)
        .filter(dir => dir.match(/^\d+\.\d+[a-z0-9.]+$/))
        .sort()
        .reverse();

      if (versions.length === 0) {
        console.log('❌ 未找到微信版本目录');
        return false;
      }

      const latestVersion = versions[0];
      console.log('📱 微信版本:', latestVersion);

      const msgPath = path.join(this.wechatBasePath, latestVersion);
      const messageDir = path.join(msgPath, 'Message');

      if (!fs.existsSync(messageDir)) {
        console.log('❌ 未找到Message目录');
        return false;
      }

      // 查找所有消息数据库
      const msgFiles = fs.readdirSync(messageDir)
        .filter(file => file.match(/^msg_\d+\.db$/))
        .map(file => path.join(messageDir, file));

      this.messageDbs = msgFiles;
      console.log('📊 找到消息数据库:', msgFiles.length, '个');
      
      msgFiles.forEach(db => {
        const stats = fs.statSync(db);
        console.log('   📁', path.basename(db), '-', Math.round(stats.size / 1024 / 1024), 'MB');
      });

      return msgFiles.length > 0;
    } catch (error) {
      console.error('❌ 查找数据库失败:', error.message);
      return false;
    }
  }

  checkDatabaseIntegrity(dbPath) {
    console.log('🔐 检查数据库完整性:', path.basename(dbPath));
    
    try {
      // 尝试用sqlite3打开数据库
      const result = execSync(`sqlite3 "${dbPath}" ".tables"`, { encoding: 'utf8' });
      console.log('✅ 数据库可访问，表:', result.trim());
      return true;
    } catch (error) {
      console.log('⚠️  数据库可能已加密或损坏');
      return false;
    }
  }

  extractSampleData(dbPath) {
    console.log('📨 提取样本数据...');
    
    try {
      // 尝试不同的表名
      const tables = ['message', 'MSG', 'chat', 'Chat'];
      let foundTable = null;
      let sampleData = null;

      for (const table of tables) {
        try {
          const count = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM ${table};"`, { encoding: 'utf8' }).trim();
          if (parseInt(count) > 0) {
            foundTable = table;
            sampleData = execSync(`sqlite3 "${dbPath}" "SELECT * FROM ${table} LIMIT 3;"`, { encoding: 'utf8' });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (foundTable) {
        console.log('📋 找到表:', foundTable);
        console.log('📄 样本数据:');
        console.log(sampleData);
        return true;
      } else {
        console.log('⚠️  未找到消息表');
        return false;
      }
    } catch (error) {
      console.error('❌ 提取数据失败:', error.message);
      return false;
    }
  }

  createMockData() {
    console.log('📝 创建模拟真实数据用于测试...');
    
    const mockData = [
      {
        _id: 'msg_001',
        sender: '张三',
        receiver: '我',
        content: '今晚一起吃饭吗？',
        timestamp: new Date('2024-07-15 18:30:00'),
        chatId: 'chat_001',
        type: 'text'
      },
      {
        _id: 'msg_002',
        sender: '李四',
        receiver: '我',
        content: '项目进展如何？明天需要汇报',
        timestamp: new Date('2024-07-16 09:15:00'),
        chatId: 'chat_002',
        type: 'text'
      },
      {
        _id: 'msg_003',
        sender: '王五',
        receiver: '项目群',
        content: '大家辛苦啦！今晚8点线上会议',
        timestamp: new Date('2024-07-16 14:20:00'),
        chatId: 'chat_003',
        type: 'text'
      }
    ];

    // 写入JSON文件供前端测试
    const outputPath = path.join(__dirname, 'mock_wechat_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(mockData, null, 2));
    console.log('✅ 模拟数据已创建:', outputPath);
    
    return mockData;
  }

  startTestServer() {
    console.log('🚀 启动测试服务器...');
    
    // 创建简单的Express服务器提供测试数据
    const express = require('express');
    const app = express();
    const cors = require('cors');

    app.use(cors());
    app.use(express.json());

    const mockData = this.createMockData();

    // 搜索API
    app.get('/api/search', (req, res) => {
      const { query, limit = 10 } = req.query;
      
      if (!query) {
        return res.json({ data: { messages: [] } });
      }

      const results = mockData.filter(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase()) ||
        msg.sender.toLowerCase().includes(query.toLowerCase()) ||
        msg.receiver.toLowerCase().includes(query.toLowerCase())
      ).slice(0, parseInt(limit));

      res.json({
        data: { messages: results },
        total: results.length
      });
    });

    // 统计API
    app.get('/api/stats', (req, res) => {
      res.json({
        totalMessages: mockData.length,
        totalChats: new Set(mockData.map(m => m.chatId)).size,
        dateRange: {
          start: mockData[0]?.timestamp,
          end: mockData[mockData.length - 1]?.timestamp
        }
      });
    });

    const port = 3000;
    app.listen(port, () => {
      console.log(`✅ 测试服务器启动: http://localhost:${port}`);
      console.log('🔗 测试URL:');
      console.log(`   http://localhost:${port}/api/search?query=吃饭`);
      console.log(`   http://localhost:${port}/api/stats`);
    });

    return app;
  }
}

// 运行测试
console.log('🎯 微信聊天记录真实数据测试开始\n');

const tester = new WeChatRealDataTester();

if (tester.findMessageDatabases()) {
  console.log('\n📊 数据库发现成功，准备测试...\n');
  
  // 使用真实数据或模拟数据
  const useRealData = tester.messageDbs.some(db => tester.checkDatabaseIntegrity(db));
  
  if (useRealData) {
    console.log('✅ 使用真实微信数据');
    tester.extractSampleData(tester.messageDbs[0]);
  } else {
    console.log('⚠️  使用模拟数据（真实数据库已加密）');
  }
}

// 启动测试服务器
tester.startTestServer();