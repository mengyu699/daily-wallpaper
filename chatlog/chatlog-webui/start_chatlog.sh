#!/bin/bash

echo "🚀 启动Chatlog服务..."

# 检查并停止现有的chatlog进程
if pgrep -f "chatlog server" > /dev/null; then
    echo "⏹️  停止现有的chatlog进程..."
    pkill -f "chatlog server"
    sleep 2
fi

# 启动chatlog服务
echo "▶️  启动chatlog HTTP服务器..."
./chatlog server -a 127.0.0.1:8080 -w ./data/decrypted > chatlog_server.log 2>&1 &

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if pgrep -f "chatlog server" > /dev/null; then
    echo "✅ Chatlog服务启动成功！"
    echo "📍 服务地址: http://localhost:8080"
    echo "📊 包含数据: 3,828个联系人 + 1,205个群聊"
    echo ""
    echo "🌐 现在可以访问Web界面: http://localhost:3000"
else
    echo "❌ Chatlog服务启动失败"
fi