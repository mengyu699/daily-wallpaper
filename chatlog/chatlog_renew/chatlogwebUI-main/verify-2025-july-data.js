#!/usr/bin/env node

/**
 * 验证2025年7月1日后的聊天记录数据
 */

const axios = require('axios');

async function verifyJulyData() {
    console.log('🔍 验证2025年7月1日后的聊天记录数据...');
    
    try {
        // 1. 验证chatlog服务状态
        console.log('📡 检查chatlog服务...');
        const sessionResponse = await axios.get('http://localhost:5030/api/v1/session');
        console.log('✅ chatlog服务正常运行');
        
        // 2. 验证Web服务状态
        console.log('🌐 检查Web服务...');
        const webResponse = await axios.get('http://localhost:3000');
        console.log('✅ Web服务正常运行');
        
        // 3. 获取所有聊天记录并过滤2025-07-01后的数据
        console.log('📊 获取2025年7月1日后的聊天记录...');
        
        // 获取会话列表
        const sessions = sessionResponse.data;
        let julyChatsCount = 0;
        const julyTimestamp = 1751328000; // 2025-07-01 00:00:00 UTC
        
        // 检查每个会话的最新消息时间
        for (const session of sessions.split('\n').filter(line => line.trim())) {
            const match = session.match(/(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
            if (match) {
                const dateStr = match[1];
                const messageTime = new Date(dateStr).getTime() / 1000;
                
                if (messageTime >= julyTimestamp) {
                    julyChatsCount++;
                    console.log(`📱 ${session.trim()}`);
                }
            }
        }
        
        console.log(`\n🎯 验证结果:`);
        console.log(`✅ 2025年7月1日后的聊天记录数量: ${julyChatsCount}`);
        console.log(`🔗 访问地址: http://localhost:3000`);
        console.log(`📋 过滤时间戳: ${julyTimestamp} (2025-07-01 00:00:00 UTC)`);
        
        if (julyChatsCount > 0) {
            console.log('\n🎉 系统验证完成！2025年7月1日后的聊天记录已成功过滤。');
        } else {
            console.log('\n⚠️  未找到2025年7月1日后的聊天记录。');
        }
        
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        console.log('\n🔧 故障排查:');
        console.log('   1. 检查chatlog服务: curl http://localhost:5030/api/v1/session');
        console.log('   2. 检查Web服务: curl http://localhost:3000');
        console.log('   3. 查看进程: ps aux | grep -E "(chatlog|node)"');
    }
}

if (require.main === module) {
    verifyJulyData();
}

module.exports = { verifyJulyData };