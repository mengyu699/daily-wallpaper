#!/bin/bash

# 快速启动脚本 - 一键启动chatlog服务

echo "🚀 启动Chatlog服务..."

# 停止已有服务
pkill -f "chatlog server" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
sleep 2

# 启动chatlog服务
./chatlog server --addr 127.0.0.1:5030 --work-dir ./data/fd02426f1b42ddcff5eae77cb4a8534e --data-dir ./data/fd02426f1b42ddcff5eae77cb4a8534e --platform darwin --version 3 > chatlog.log 2>&1 &

# 启动Web服务
cd chatlogwebUI-main
node server.js > web.log 2>&1 &

echo "✅ Chatlog服务已启动: http://localhost:5030"
echo "✅ Web服务已启动: http://localhost:3000"
echo ""
echo "📱 访问: http://localhost:3000"
echo "📊 验证: curl http://localhost:5030/api/v1/session"