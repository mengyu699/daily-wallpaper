#!/bin/bash

# Chatlog服务正确启动脚本
# 修复了启动参数错误的问题

set -e

echo "======================================"
echo "   Chatlog服务启动脚本 (修复版)"
echo "======================================"
echo ""

# 检查chatlog可执行文件是否存在
if [[ ! -f "./chatlog" ]]; then
    echo "❌ 错误: chatlog可执行文件不存在"
    exit 1
fi

# 检查执行权限
if [[ ! -x "./chatlog" ]]; then
    echo "⚠️  警告: chatlog没有执行权限，正在设置..."
    chmod +x ./chatlog
fi

# 检查数据目录
DATA_DIR="./data"
USER_DATA_DIR=""

# 查找用户特定的数据目录
for dir in $DATA_DIR/*/; do
    if [[ -d "$dir" && "$dir" != *"/*/" ]]; then
        USER_DATA_DIR="$dir"
        break
    fi
done

if [[ -z "$USER_DATA_DIR" ]]; then
    echo "❌ 错误: 未找到用户数据目录"
    echo "请确保数据目录结构正确"
    exit 1
fi

echo "📁 数据目录: $USER_DATA_DIR"

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        echo "⚠️  端口 $port 已被占用"
        return 1
    fi
    return 0
}

# 停止已有服务
stop_services() {
    echo "🛑 停止已有服务..."
    pkill -f "chatlog server" || true
    sleep 2
}

# 启动chatlog服务
start_chatlog() {
    echo "🚀 启动chatlog服务..."
    
    # 使用正确的参数启动chatlog server
    ./chatlog server \
        --addr "127.0.0.1:5030" \
        --work-dir "$USER_DATA_DIR" \
        --data-dir "$USER_DATA_DIR" \
        --platform "darwin" \
        --version 3 \
        > chatlog-server.log 2>&1 &
    
    CHATLOG_PID=$!
    echo "📋 chatlog服务PID: $CHATLOG_PID"
    
    # 等待服务启动
    echo "⏳ 等待chatlog服务启动..."
    for i in {1..30}; do
        if curl -s http://localhost:5030/api/v1/session >/dev/null 2>&1; then
            echo "✅ chatlog服务启动成功"
            return 0
        fi
        sleep 1
    done
    
    echo "❌ chatlog服务启动超时"
    return 1
}

# 启动Web服务
start_web() {
    echo "🌐 启动Web服务..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ 错误: 未检测到 Node.js"
        exit 1
    fi
    
    # 检查依赖
    if [[ ! -d "node_modules" ]]; then
        echo "📦 安装依赖..."
        npm install
    fi
    
    # 启动Node.js服务
    npm start > web-server.log 2>&1 &
    WEB_PID=$!
    echo "📋 Web服务PID: $WEB_PID"
    
    # 等待服务启动
    echo "⏳ 等待Web服务启动..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            echo "✅ Web服务启动成功"
            return 0
        fi
        sleep 1
    done
    
    echo "❌ Web服务启动超时"
    return 1
}

# 检查服务状态
check_services() {
    echo ""
    echo "🔍 检查服务状态..."
    
    if pgrep -f "chatlog server" >/dev/null; then
        echo "✅ chatlog服务运行正常"
    else
        echo "❌ chatlog服务未运行"
    fi
    
    if pgrep -f "node.*server.js" >/dev/null; then
        echo "✅ Web服务运行正常"
    else
        echo "❌ Web服务未运行"
    fi
}

# 显示访问信息
show_info() {
    echo ""
    echo "======================================"
    echo "🎉 服务启动完成！"
    echo "======================================"
    echo "📱 访问地址: http://localhost:3000"
    echo "🔗 Chatlog API: http://localhost:5030"
    echo "📊 日志文件:"
    echo "   - chatlog-server.log"
    echo "   - web-server.log"
    echo ""
    echo "💡 管理命令:"
    echo "   - 停止服务: ./chatlog-startup-fixed.sh stop"
    echo "   - 重启服务: ./chatlog-startup-fixed.sh restart"
    echo "   - 查看状态: ./chatlog-startup-fixed.sh status"
    echo ""
}

# 停止服务
stop_all() {
    echo "🛑 停止所有服务..."
    pkill -f "chatlog server" || true
    pkill -f "node.*server.js" || true
    echo "✅ 所有服务已停止"
}

# 主逻辑
case "${1:-start}" in
    start)
        stop_services
        check_port 5030 || exit 1
        check_port 3000 || exit 1
        start_chatlog
        start_web
        check_services
        show_info
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        $0 start
        ;;
    status)
        check_services
        ;;
    *)
        echo "使用方法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac