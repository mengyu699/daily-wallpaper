#!/bin/bash

# Chatlog最终修正版 - 基于实际参数
# 解决启动超时问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
CHATLOG_DIR="/Users/mengyu/Desktop/Cursor/chatlog_renew/chatlogwebUI-main"
CHATLOG_PORT=5030
WEB_PORT=3000
WORK_DIR="$CHATLOG_DIR"
DATA_DIR="$CHATLOG_DIR/data"
LOG_FILE="chatlog-startup.log"

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
echo "   Chatlog最终修正版 - 基于实际参数"
echo "=========================================="

# 清理日志
echo "" > "$LOG_FILE"

# 1. 环境检查
check_environment() {
    log "检查环境..."
    
    # 检查文件存在
    if [[ ! -f "$CHATLOG_DIR/chatlog" ]]; then
        error "chatlog可执行文件不存在: $CHATLOG_DIR/chatlog"
        exit 1
    fi
    
    # 检查数据目录
    if [[ ! -d "$DATA_DIR" ]]; then
        error "数据目录不存在: $DATA_DIR"
        exit 1
    fi
    
    # 检查权限
    chmod +x "$CHATLOG_DIR/chatlog"
    
    log "环境检查通过"
}

# 2. 清理残留进程
cleanup() {
    log "清理残留进程..."
    
    # 停止chatlog服务
    pkill -f "chatlog server" 2>/dev/null || true
    
    # 停止Web服务
    pkill -f "node.*server" 2>/dev/null || true
    
    # 等待清理完成
    sleep 2
    
    # 确认清理完成
    if ! pgrep -f "chatlog\|node.*server" >/dev/null; then
        success "残留进程已清理"
    else
        warning "仍有进程运行，强制清理中..."
        pkill -9 -f "chatlog\|node.*server" 2>/dev/null || true
        sleep 1
    fi
}

# 3. 检查资源
check_resources() {
    log "检查系统资源..."
    
    # 检查端口
    if lsof -i :$CHATLOG_PORT >/dev/null 2>&1; then
        log "端口$CHATLOG_PORT被占用，正在释放..."
        lsof -ti :$CHATLOG_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    if lsof -i :$WEB_PORT >/dev/null 2>&1; then
        log "端口$WEB_PORT被占用，正在释放..."
        lsof -ti :$WEB_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    success "端口检查完成"
}

# 4. 启动chatlog服务（使用正确参数）
start_chatlog() {
    log "启动chatlog服务..."
    cd "$CHATLOG_DIR"
    
    # 使用正确的参数
    log "启动命令: ./chatlog server --addr 127.0.0.1:$CHATLOG_PORT --work-dir $WORK_DIR --data-dir $DATA_DIR --platform darwin --version 3"
    
    nohup ./chatlog server \
        --addr "127.0.0.1:$CHATLOG_PORT" \
        --work-dir "$WORK_DIR" \
        --data-dir "$DATA_DIR" \
        --platform "darwin" \
        --version 3 \
        > chatlog-service.log 2>&1 &
c    
    CHATLOG_PID=$!
    
    log "chatlog服务PID: $CHATLOG_PID"
    
    # 等待服务启动（最多90秒）
    log "等待chatlog服务启动..."
    for i in {1..90}; do
        if curl -s http://127.0.0.1:$CHATLOG_PORT/api/v1/session >/dev/null 2>&1; then
            success "chatlog服务启动成功！"
            return 0
        fi
        
        # 检查进程是否还在
        if ! kill -0 $CHATLOG_PID 2>/dev/null; then
            error "chatlog进程已退出"
            echo ""
            echo "错误日志:"
            cat chatlog-service.log
            return 1
        fi
        
        if [[ $i -eq 90 ]]; then
            error "chatlog服务启动超时（90秒）"
            echo ""
            echo "错误日志:"
            cat chatlog-service.log
            return 1
        fi
        
        if [[ $((i % 10)) -eq 0 ]]; then
            printf " %d" $i
        else
            printf "."
        fi
        sleep 1
    done
    echo ""
}

# 5. 启动Web服务
start_web() {
    log "启动Web服务..."
    cd "$CHATLOG_DIR"
    
    log "启动Web服务..."
    if [[ -f "package.json" ]]; then
        nohup npm start > web-service.log 2>&1 &
    else
        nohup node server.js > web-service.log 2>&1 &
    fi
    
    WEB_PID=$!
    
    log "Web服务PID: $WEB_PID"
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
        printf "."
    done
    echo ""
}

# 6. 验证服务状态
verify_status() {
    log "验证服务状态..."
    
    # 检查进程
    if pgrep -f "chatlog server" >/dev/null; then
        success "chatlog进程运行正常"
    else
        error "chatlog进程未运行"
        return 1
    fi
    
    # 检查API
    if curl -s http://127.0.0.1:$CHATLOG_PORT/api/v1/session >/dev/null 2>&1; then
        success "API接口响应正常"
    else
        error "API接口无响应"
        return 1
    fi
    
    # 检查Web服务
    if pgrep -f "node" >/dev/null; then
        success "Web服务进程运行正常"
    else
        error "Web服务进程未运行"
        return 1
    fi
    
    success "所有服务验证通过！"
}

# 7. 显示使用信息
show_info() {
    echo ""
    echo "=========================================="
    echo "         🎉 服务启动成功！"
    echo "=========================================="
    echo ""
    echo "📱 访问地址："
    echo "   Web界面：http://localhost:$WEB_PORT"
    echo "   Chatlog API：http://localhost:$CHATLOG_PORT"
    echo "   API测试：http://localhost:$CHATLOG_PORT/api/v1/session"
    echo ""
    echo "📊 管理命令："
    echo "   停止服务：$0 stop"
    echo "   重启服务：$0 restart"
    echo "   查看状态：$0 status"
    echo "   查看日志：$0 logs"
    echo ""
    echo "🔍 故障排查："
    echo "   chatlog日志：tail -f $CHATLOG_DIR/chatlog-service.log"
    echo "   Web日志：tail -f $CHATLOG_DIR/web-service.log"
    echo "=========================================="
}

# 8. 主程序
main() {
    log "开始启动Chatlog服务..."
    
    check_environment
    cleanup
    check_resources
    
    if start_chatlog; then
        sleep 2
        if start_web; then
            verify_status
            show_info
        else
            error "Web服务启动失败"
            exit 1
        fi
    else
        error "chatlog服务启动失败"
        exit 1
    fi
}

# 9. 命令处理
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        log "停止所有服务..."
        cleanup
        success "服务已停止"
        ;;
    restart)
        log "重启服务..."
        cleanup
        sleep 3
        main
        ;;
    status)
        echo "服务状态："
        if pgrep -f "chatlog server" >/dev/null; then
            echo "✅ chatlog服务: 运行中"
        else
            echo "❌ chatlog服务: 未运行"
        fi
        
        if pgrep -f "node" >/dev/null; then
            echo "✅ Web服务: 运行中"
        else
            echo "❌ Web服务: 未运行"
        fi
        
        echo ""
        echo "访问测试："
        curl -s http://localhost:5030/api/v1/session >/dev/null && echo "✅ API正常" || echo "❌ API异常"
        ;;
    logs)
        echo "查看日志："
        echo "   chatlog日志：tail -f $CHATLOG_DIR/chatlog-service.log"
        echo "   Web日志：tail -f $CHATLOG_DIR/web-service.log"
        ;;
    debug)
        log "调试模式启动..."
        cd "$CHATLOG_DIR"
        echo "启动命令："
        echo "./chatlog server --addr 127.0.0.1:5030 --work-dir $WORK_DIR --data-dir $DATA_DIR --platform darwin --version 3"
        ./chatlog server --addr "127.0.0.1:5030" --work-dir "$WORK_DIR" --data-dir "$DATA_DIR" --platform "darwin" --version 3
        ;;
    *)
        echo "用法: $0 [start|stop|restart|status|logs|debug]"
        echo ""
        echo "命令说明："
        echo "  start   - 启动服务（默认）"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  status  - 查看状态"
        echo "  logs    - 日志查看命令"
        echo "  debug   - 调试模式启动"
        ;;
esac