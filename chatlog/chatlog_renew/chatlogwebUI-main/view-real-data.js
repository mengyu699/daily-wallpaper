/**
 * M1 Mac专用：直接查看真实2025年7月1日后聊天记录
 * 无需启动完整服务，直接访问SQLite数据库
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// M1 Mac专用路径
const MESSAGE_DB_PATH = path.join(__dirname, 'data/7c82c870cf2a23cf433493cc01dec098/Message/msg2.db');
const CONTACT_DB_PATH = path.join(__dirname, 'data/7c82c870cf2a23cf433493cc01dec098/Contact/wccontact_new2.db');

// 2025-07-01时间戳
const JULY_1_2025 = 1751328000;

// 脱敏函数
function maskSensitiveData(text) {
  if (!text) return text;
  
  // 手机号
  text = text.replace(/1[3-9]\d{9}/g, '1**********');
  // 微信号
  text = text.replace(/wxid_[a-zA-Z0-9]+/g, 'wxid_***');
  // 邮箱
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
  // 身份证号
  text = text.replace(/\d{17}[\dXx]/g, '******************');
  
  return text;
}

// 获取真实聊天记录
function getRealChatData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(MESSAGE_DB_PATH);
    
    const query = `
      SELECT 
        m.createTime,
        m.content,
        m.type,
        m.talker,
        c.nickname,
        c.conRemark
      FROM message m
      LEFT JOIN rcontact c ON m.talker = c.username
      WHERE m.createTime >= ${JULY_1_2025}
      ORDER BY m.createTime ASC
      LIMIT 100
    `;

    db.all(query, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const results = rows.map(row => ({
          time: new Date(row.createTime * 1000).toLocaleString('zh-CN'),
          content: maskSensitiveData(row.content),
          type: row.type,
          talker: maskSensitiveData(row.nickname || row.conRemark || row.talker),
          rawTime: row.createTime
        }));
        resolve(results);
      }
      db.close();
    });
  });
}

// 执行查询
console.log('🔍 M1 Mac专用：查询2025年7月1日后的真实聊天记录...\n');

getRealChatData()
  .then(data => {
    console.log(`✅ 找到 ${data.length} 条真实聊天记录（2025年7月1日后）：\n`);
    
    data.forEach((record, index) => {
      console.log(`${index + 1}. [${record.time}] ${record.talker}:`);
      console.log(`   ${record.content || '[图片/语音消息]'}`);
      console.log('');
    });
    
    if (data.length === 0) {
      console.log('📅 当前没有2025年7月1日后的聊天记录');
      console.log('可以调整时间范围查看更早的记录');
    }
  })
  .catch(err => {
    console.error('❌ 数据库访问错误:', err.message);
    console.log('💡 提示：确保Chatlog已解密数据');
  });

// 导出为JSON文件
function exportToJSON() {
  getRealChatData().then(data => {
    const fs = require('fs');
    fs.writeFileSync('real-chat-data-2025-july.json', JSON.stringify(data, null, 2));
    console.log('📁 数据已导出到 real-chat-data-2025-july.json');
  });
}

// 如果直接运行此脚本，执行导出
if (require.main === module) {
  exportToJSON();
}