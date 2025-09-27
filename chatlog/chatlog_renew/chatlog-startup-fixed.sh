#!/bin/bash

# Chatlog启动修复版 - 解决启动超时问题
# 针对M1 Mac优化，使用正确参数

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
CHATLOG_DIR="/Users/mengyu/Desktop/Cursor/chatlog_renew/chatlogwebUI-main"
WEB_PORT=3000
LOG_FILE="chatlog-startup-debug.log"

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✅ $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ❌ $1" | tee -a "$LOG_FILE"
}

echo "=========================================="
echo "   Chatlog启动修复版 - M1 Mac专用"
echo "=========================================="

# 1. 检查chatlog文件
if [[ ! -f "$CHATLOG_DIR/chatlog" ]]; then
    error "chatlog文件不存在: $CHATLOG_DIR/chatlog"
    exit 1
fi

# 2. 设置权限
chmod +x "$CHATLOG_DIR/chatlog"
success "chatlog权限已设置"

# 3. 清理残留进程
cleanup() {
    log "清理残留进程..."
    pkill -f "chatlog http-server" 2>/dev/null || true
    pkill -f "node.*server" 2>/dev/null || true
    sleep 2
    success "残留进程已清理"
}

# 4. 检查系统资源
check_resources() {
    log "检查系统资源..."
    
    # 检查磁盘空间
    disk_space=$(df -h . | awk 'NR==2 {print $4}')
    log "可用磁盘空间: $disk_space"
    
    # 检查内存
    memory=$(top -l 1 | grep "PhysMem" | awk '{print $2}')
    log "可用内存: $memory"
    
    # 检查端口
    if lsof -i :5030 >/dev/null 2>&1; then
        warning "端口5030被占用，正在释放..."
        lsof -ti :5030 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 5. 启动chatlog服务（修正参数）
start_chatlog() {
    log "启动chatlog服务..."
    cd "$CHATLOG_DIR"
    
    # 使用正确的启动参数
    nohup ./chatlog http-server --platform darwin --version 3 > chatlog-service.log 2>&1 &
c    CHATLOG_PID=$!
    
    log "等待chatlog服务启动 (PID: $CHATLOG_PID)..."
    
    # 等待服务启动（最多60秒）
    for i in {1..60}; do
        if curl -s http://127.0.0.1:5030/api/v1/session >/dev/null 2>&1; then
            success "chatlog服务启动成功！"
            return 0
        fi
        
        if [[ $i -eq 60 ]]; then
            error "chatlog服务启动超时（60秒）"
            echo ""
            echo "可能原因："
            echo "1. 数据文件损坏"
            echo "2. 权限问题"
            echo "3. 系统资源不足"
            echo ""
            echo "检查日志: cat $CHATLOG_DIR/chatlog-service.log"
            return 1
        fi
        
        sleep 1
        printf "."
    done
    echo ""
}

# 6. 启动Web服务
start_web() {
    log "启动Web服务..."
    cd "$CHATLOG_DIR"
    
    if [[ -f "package.json" ]]; then
        npm start > web-service.log 2>&1 &
    else
        node server.js > web-service.log 2>&1 &
    fi
    
    log "等待Web服务启动..."
    
    for i in {1..30}; do
        if curl -s http://127.0.0.1:$WEB_PORT >/dev/null 2>&1; then
            success "Web服务启动成功！"
            return 0
        fi
        
        if [[ $i -eq 30 ]]; then
            error "Web服务启动超时"
            return 1
        fi
        
        sleep 1
    done
}

# 7. 验证服务
verify_services() {
    log "验证服务状态..."
    
    # 检查chatlog服务
    if pgrep -f "chatlog http-server" >/dev/null; then
        success "chatlog服务运行正常"
    else
        error "chatlog服务未运行"
        return 1
    fi
    
    # 检查Web服务
    if pgrep -f "node" >/dev/null; then
        success "Web服务运行正常"
    else
        error "Web服务未运行"
        return 1
    fi
    
    # 测试API连接
    if curl -s http://127.0.0.1:5030/api/v1/session >/dev/null 2>&1; then
        success "API连接正常"
    else
        warning "API连接异常"
    fi
}

# 8. 显示使用说明
show_usage() {
    echo ""
    echo "=========================================="
    echo "         Chatlog服务已启动"
    echo "=========================================="
    echo ""
    echo "📱 访问地址："
    echo "   Web界面：http://localhost:3000"
    echo "   API接口：http://localhost:5030/api/v1/session"
    echo ""
    echo "📋 管理命令："
    echo "   查看日志：tail -f $CHATLOG_DIR/chatlog-service.log"
    echo "   查看Web日志：tail -f $CHATLOG_DIR/web-service.log"
    echo "   停止服务：pkill -f chatlog && pkill -f node"
    echo ""
    echo "🔧 故障排查："
    echo "   检查端口：lsof -i :5030"
    echo "   检查进程：ps aux | grep chatlog"
    echo "   检查日志：cat $CHATLOG_DIR/chatlog-service.log"
    echo "=========================================="
}

# 9. 主程序
main() {
    log "开始启动Chatlog服务..."
    
    cleanup
    check_resources
    
    if start_chatlog; then
        sleep 2
        if start_web; then
            verify_services
            show_usage
        else
            error "Web服务启动失败"
            exit 1
        fi
    else
        error "chatlog服务启动失败"
        exit 1
    fi
}

# 10. 命令处理
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        cleanup
        log "服务已停止"
        ;;
    restart)
        cleanup
        sleep 3
        main
        ;;
    status)
        echo "服务状态："
        pgrep -f "chatlog" && echo "✅ chatlog运行中" || echo "❌ chatlog未运行"
        pgrep -f "node.*server" && echo "✅ Web服务运行中" || echo "❌ Web服务未运行"
        ;;
    logs)
        echo "查看日志："
        echo "chatlog: tail -f $CHATLOG_DIR/chatlog-service.log"
        echo "Web服务: tail -f $CHATLOG_DIR/web-service.log"
        ;;
    *)
        echo "用法: $0 [start|stop|restart|status|logs]"
        echo ""
        echo "命令说明："
        echo "  start   - 启动服务（默认）"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  status  - 查看状态"
        echo "  logs    - 日志查看命令"
        ;;
esac