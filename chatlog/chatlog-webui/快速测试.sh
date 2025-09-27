#!/bin/bash

echo "🧪 快速测试系统功能"
echo "==================="

# 启动服务器
echo "启动服务器..."
npm start &
SERVER_PID=$!

# 等待服务器启动
sleep 8

# 测试登录
echo "测试登录功能..."
LOGIN_RESULT=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123@"}')

echo "登录结果: $LOGIN_RESULT"

if echo "$LOGIN_RESULT" | grep -q "success.*true"; then
    echo "✅ 登录测试成功！"
else
    echo "❌ 登录测试失败！"
fi

# 测试主页
echo "测试主页访问..."
if curl -s http://localhost:3001 | grep -q "微信聊天"; then
    echo "✅ 主页访问成功！"
else
    echo "❌ 主页访问失败！"
fi

# 停止服务器
kill $SERVER_PID 2>/dev/null

echo "测试完成！"