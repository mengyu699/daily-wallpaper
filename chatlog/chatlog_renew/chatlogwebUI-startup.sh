#!/bin/bash

# Chatlog服务一键启动脚本 - 修正版
# 路径修正：chatlog位于当前目录

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
CHATLOG_PORT=5030
WEB_PORT=3000
LOG_FILE="chatlog-startup.log"
CHATLOG_DIR="/Users/mengyu/Desktop/Cursor/chatlog_renew/chatlogwebUI-main"

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

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠️  $1" | tee -a "$LOG_FILE"
}

# 清理日志
echo "" > "$LOG_FILE"

echo "=========================================="
echo "   Chatlog服务启动器 - 修正版"
echo "=========================================="
log "当前目录: $(pwd)"
log "chatlog路径: $CHATLOG_DIR"

# 检查chatlog文件
if [[ ! -f "$CHATLOG_DIR/chatlog" ]]; then
    error "chatlog文件不存在: $CHATLOG_DIR/chatlog"
    exit 1
fi

# 赋予执行权限
chmod +x "$CHATLOG_DIR/chatlog"
success "chatlog权限已设置"

# 清理残留进程
cleanup_processes() {
    log "清理残留进程..."
    pkill -f "chatlog http-server" 2>/dev/null || true
    pkill -f "node.*server" 2>/dev/null || true
    sleep 2
    success "残留进程已清理"
}

# 启动chatlog服务
start_chatlog() {
    log "启动chatlog服务..."
    cd "$CHATLOG_DIR"
    
    nohup ./chatlog http-server --port $CHATLOG_PORT > chatlog-service.log 2>&1 &
    CHATLOG_PID=$!
    
    # 等待服务启动
    for i in {1..30}; do
        if curl -s http://127.0.0.1:$CHATLOG_PORT/api/v1/session >/dev/null 2>&1; then
            success "chatlog服务启动成功 (PID: $CHATLOG_PID)"
            return 0
        fi
        if [[ $i -eq 30 ]]; then
            error "chatlog服务启动超时"
            return 1
        fi
        sleep 1
    done
}

# 启动Web服务
start_web() {
    log "启动Web服务..."
    cd "$CHATLOG_DIR"
    
    if [[ -f "package.json" ]]; then
        npm start > web-service.log 2>&1 &
    else
        node server.js > web-service.log 2>&1 &
    fi
    WEB_PID=$!
    success "Web服务已启动"
    
    # 等待服务启动
    for i in {1..30}; do
        if curl -s http://127.0.0.1:$WEB_PORT >/dev/null 2>&1; then
            success "Web服务响应正常"
            return 0
        fi
        if [[ $i -eq 30 ]]; then
            error "Web服务启动超时"
            return 1
        fi
        sleep 1
    done
}

# 显示状态
show_status() {
    echo ""
    echo "=========================================="
    echo "              服务状态"
    echo "=========================================="
    
    if pgrep -f "chatlog http-server" >/dev/null; then
        success "chatlog服务: 运行中"
    else
        error "chatlog服务: 未运行"
    fi
    
    if pgrep -f "node.*server" >/dev/null; then
        success "Web服务: 运行中"
    else
        error "Web服务: 未运行"
    fi
    
    echo ""
    echo "访问地址:"
    echo "  Web界面: http://localhost:$WEB_PORT"
    echo "  API接口: http://localhost:$CHATLOG_PORT/api/v1/session"
    echo ""
    echo "日志文件位于: $CHATLOG_DIR"
    echo "=========================================="
}

# 主程序
main() {
    log "开始启动流程..."
    
    cleanup_processes
    start_chatlog
    sleep 2
    start_web
    show_status
    
    log "启动完成！访问 http://localhost:$WEB_PORT"
}

# 处理命令
action="${1:-start}"

case "$action" in
    start)
        main
        ;;
    stop)
        log "停止所有服务..."
        cleanup_processes
        success "服务已停止"
        ;;
    restart)
        log "重启服务..."
        cleanup_processes
        sleep 2
        main
        ;;
    status)
        show_status
        ;;
    *)
        echo "用法: $0 [start|stop|restart|status]"
        ;;
esac