#!/bin/bash

echo "🚀 微信聊天记录分析系统 - 一键启动"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查并下载 chatlog（如果不存在）
if ! command -v chatlog &> /dev/null; then
    echo -e "${YELLOW}📥 首次使用，正在自动下载 chatlog 工具...${NC}"
    
    # 创建临时目录
    mkdir -p ~/chatlog-temp
    cd ~/chatlog-temp
    
    # 检测系统架构
    if [[ $(uname -m) == "arm64" ]]; then
        ARCH="arm64"
        echo -e "${BLUE}检测到 Apple M1/M2 芯片${NC}"
    else
        ARCH="amd64" 
        echo -e "${BLUE}检测到 Intel 芯片${NC}"
    fi
    
    # 下载 chatlog
    echo -e "${YELLOW}正在下载 chatlog...${NC}"
    curl -L -o chatlog "https://github.com/sjzar/chatlog/releases/latest/download/chatlog_darwin_${ARCH}"
    
    if [ $? -eq 0 ]; then
        chmod +x chatlog
        sudo mv chatlog /usr/local/bin/
        echo -e "${GREEN}✅ chatlog 下载安装成功！${NC}"
        cd - > /dev/null
        rm -rf ~/chatlog-temp
    else
        echo -e "${RED}❌ 下载失败，请检查网络连接${NC}"
        exit 1
    fi
fi

# 检查微信是否运行
echo -e "${BLUE}🔍 检查微信状态...${NC}"
if ! pgrep -f "WeChat" > /dev/null; then
    echo -e "${YELLOW}⚠️  微信未运行，正在启动微信...${NC}"
    open /Applications/WeChat.app
    echo -e "${YELLOW}请在微信中登录您的账号，然后按任意键继续...${NC}"
    read -n 1 -s
fi

# 获取微信密钥（如果没有）
if [ ! -f ~/.chatlog/config.json ]; then
    echo -e "${YELLOW}🔑 获取微信解密密钥...${NC}"
    chatlog key
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 获取微信密钥失败！${NC}"
        echo -e "${YELLOW}请确保：${NC}"
        echo "1. 微信已经登录"
        echo "2. 在系统偏好设置->安全性与隐私->隐私->完全磁盘访问权限中添加终端应用"
        exit 1
    fi
fi

# 解密微信数据
echo -e "${YELLOW}🔓 解密微信聊天数据...${NC}"
chatlog decrypt
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 解密失败！${NC}"
    exit 1
fi

# 启动 chatlog 服务（后台运行）
echo -e "${YELLOW}🌐 启动 Chatlog API 服务...${NC}"
chatlog server --port 8080 > /dev/null 2>&1 &
CHATLOG_PID=$!

# 等待服务启动
sleep 3

# 测试 chatlog 服务
if curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo -e "${GREEN}✅ Chatlog 服务启动成功！${NC}"
else
    echo -e "${RED}❌ Chatlog 服务启动失败${NC}"
    exit 1
fi

# 启动 WebUI
echo -e "${YELLOW}🎨 启动 WebUI 界面...${NC}"
npm start > /dev/null 2>&1 &
WEBUI_PID=$!

# 等待 WebUI 启动
sleep 5

# 测试 WebUI 服务
if curl -s http://localhost:3001 > /dev/null; then
    echo -e "${GREEN}✅ WebUI 启动成功！${NC}"
else
    echo -e "${RED}❌ WebUI 启动失败${NC}"
    kill $CHATLOG_PID $WEBUI_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 系统启动完成！${NC}"
echo "=================================="
echo -e "${BLUE}📱 访问地址: http://localhost:3001${NC}"
echo -e "${BLUE}👤 用户名: admin${NC}"
echo -e "${BLUE}🔑 密码: Admin123@${NC}"
echo ""
echo -e "${YELLOW}💡 使用提示：${NC}"
echo "• 在浏览器中打开上述地址"
echo "• 使用提供的账号密码登录"
echo "• 即可开始分析微信聊天记录"
echo ""
echo -e "${GREEN}按 Ctrl+C 停止所有服务${NC}"

# 自动打开浏览器
sleep 2
open http://localhost:3001

# 保持脚本运行，按 Ctrl+C 时清理进程
trap "echo -e '\n${YELLOW}🛑 正在停止服务...${NC}'; kill $CHATLOG_PID $WEBUI_PID 2>/dev/null; echo -e '${GREEN}✅ 服务已停止${NC}'; exit 0" INT

# 等待用户中断
while true; do
    sleep 1
done