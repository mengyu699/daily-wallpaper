#!/bin/bash

# Chatlog最终修复版启动脚本
# 解决所有启动问题，M1 Mac优化

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "   Chatlog最终修复版 - M1 Mac专用"
echo "======================================"
echo ""

# 1. 检查chatlog文件
if [[ ! -f "./chatlog" ]]; then
    echo -e "${RED}❌ 错误: chatlog可执行文件不存在${NC}"
    exit 1
fi

# 2. 设置权限
chmod +x ./chatlog
echo -e "${GREEN}✅ chatlog权限已设置${NC}"

# 3. 查找用户数据目录
DATA_DIR="./data"
USER_DATA_DIR=""

for dir in $DATA_DIR/*/; do
    if [[ -d "$dir" && "$dir" != *"/*" ]]; then
        USER_DATA_DIR="$dir"
        break
    fi
done

if [[ -z "$USER_DATA_DIR" ]]; then
    echo -e "${RED}❌ 错误: 未找到用户数据目录${NC}"
    exit 1
fi

echo -e "${BLUE}📁 数据目录: $USER_DATA_DIR${NC}"

# 4. 清理残留进程
echo -e "${BLUE}🧹 清理残留进程...${NC}"
pkill -f "chatlog server" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ 残留进程已清理${NC}"

# 5. 检查端口
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  端口 $port 被占用，正在释放...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

check_port 5030
check_port 3000

# 6. 启动chatlog服务
echo -e "${BLUE}🚀 启动chatlog服务...${NC}"

# 使用正确的参数启动
./chatlog server \
    --addr "127.0.0.1:5030" \
    --work-dir "$USER_DATA_DIR" \
    --data-dir "$USER_DATA_DIR" \
    --platform "darwin" \
    --version 3 \
    > chatlog-server.log 2>&1 &

CHATLOG_PID=$!
echo -e "${BLUE}📋 chatlog服务PID: $CHATLOG_PID${NC}"

# 7. 等待chatlog服务启动
echo -e "${BLUE}⏳ 等待chatlog服务启动...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:5030/api/v1/session >/dev/null 2>&1; then
        echo -e "${GREEN}✅ chatlog服务启动成功${NC}"
        break
    fi
    
    if [[ $i -eq 30 ]]; then
        echo -e "${RED}❌ chatlog服务启动超时${NC}"
        echo "错误日志:"
        tail -10 chatlog-server.log
        exit 1
    fi
    
    sleep 1
    printf "."
done
echo ""

# 8. 启动Web服务
echo -e "${BLUE}🌐 启动Web服务...${NC}"

if [[ -f "package.json" ]]; then
    npm start > web-server.log 2>&1 &
else
    node server.js > web-server.log 2>&1 &
fi

WEB_PID=$!
echo -e "${BLUE}📋 Web服务PID: $WEB_PID${NC}"

# 9. 等待Web服务启动
echo -e "${BLUE}⏳ 等待Web服务启动...${NC}"
for i in {1..20}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Web服务启动成功${NC}"
        break
    fi
    
    if [[ $i -eq 20 ]]; then
        echo -e "${RED}❌ Web服务启动超时${NC}"
        echo "错误日志:"
        tail -10 web-server.log
        exit 1
    fi
    
    sleep 1
    printf "."
done
echo ""

# 10. 最终验证
echo -e "${BLUE}🔍 验证服务状态...${NC}"

if pgrep -f "chatlog server" >/dev/null; then
    echo -e "${GREEN}✅ chatlog服务运行中${NC}"
else
    echo -e "${RED}❌ chatlog服务未运行${NC}"
fi

if pgrep -f "node.*server" >/dev/null; then
    echo -e "${GREEN}✅ Web服务运行中${NC}"
else
    echo -e "${RED}❌ Web服务未运行${NC}"
fi

# 11. 显示使用信息
echo ""
echo "======================================"
echo -e "         ${GREEN}🎉 服务启动成功！${NC}"
echo "======================================"
echo ""
echo -e "📱 ${BLUE}访问地址：${NC}"
echo -e "   Web界面：${GREEN}http://localhost:3000${NC}"
echo -e "   Chatlog API：${GREEN}http://localhost:5030/api/v1/session${NC}"
echo ""
echo -e "📋 ${BLUE}管理命令：${NC}"
echo -e "   查看日志：${YELLOW}tail -f chatlog-server.log${NC}"
echo -e "   查看Web日志：${YELLOW}tail -f web-server.log${NC}"
echo -e "   停止服务：${YELLOW}pkill -f chatlog && pkill -f node${NC}"
echo ""
echo -e "🔍 ${BLUE}验证数据：${NC}"
echo -e "   ${YELLOW}node verify-2025-july-data.js${NC}"
echo "======================================"