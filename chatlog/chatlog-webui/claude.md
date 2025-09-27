# 微信聊天记录WebUI分析系统

## 项目概述
基于Chatlog工具的微信聊天记录查询与AI分析系统，支持多维度搜索、数据可视化和智能分析功能。

## 技术栈
- **后端**: Node.js + Express
- **前端**: EJS模板引擎 + Bootstrap
- **AI集成**: DeepSeek API
- **数据源**: Chatlog工具导出的微信聊天记录
- **运行环境**: macOS (M1/M2原生支持)

## 项目结构
```
chatlog-webui/
├── claude.md              # 项目文档
├── conversation-log.md    # 开发对话记录
├── app.js                # 应用入口文件
├── package.json          # 项目依赖配置
├── config/
│   ├── database.js       # 数据库配置
│   └── api.js           # API配置
├── routes/
│   ├── index.js         # 主路由
│   ├── chat.js          # 聊天记录路由
│   └── analysis.js      # AI分析路由
├── views/
│   ├── layout.ejs       # 页面布局
│   ├── index.ejs        # 首页
│   ├── search.ejs       # 搜索页面
│   └── analysis.ejs     # 分析页面
├── public/
│   ├── css/            # 样式文件
│   ├── js/             # 前端JavaScript
│   └── images/         # 图片资源
├── utils/
│   ├── chatlog.js      # Chatlog工具集成
│   ├── ai.js           # AI分析工具
│   └── helpers.js      # 辅助函数
└── data/
    └── chatlogs/       # 聊天记录存储
```

## 环境配置

### 必需软件
- Node.js 18+ (ARM64版本)
- npm 8+
- 微信Mac客户端
- Chatlog工具

### API配置
- DeepSeek API Key: `sk-13949fb30e37413bbb811083bbd58c82`

## 安装步骤

### 1. 安装Chatlog工具
```bash
# 下载Chatlog (需要从GitHub releases下载)
# https://github.com/sjzar/chatlog/releases

# 解压并移动到系统路径
sudo mv chatlog /usr/local/bin/
chmod +x /usr/local/bin/chatlog
```

### 2. 微信数据提取
```bash
# 获取微信解密密钥
chatlog key

# 解密微信聊天记录
chatlog decrypt

# 启动Chatlog HTTP服务
chatlog server --port 8080
```

### 3. 项目安装运行
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产环境运行
npm start
```

## 功能特性

### 核心功能
- 多维度聊天记录搜索
- 关键词高亮显示
- 时间范围筛选
- 联系人/群聊分类
- 消息类型过滤

### AI分析功能
- 聊天内容智能摘要
- 情感分析
- 关键词提取
- 话题分类
- 统计分析

### 数据可视化
- 聊天频率统计图表
- 活跃时间分布
- 关键词云图
- 情感趋势分析

## 定时更新

### 手动更新流程
```bash
# 每日更新聊天记录
cd /path/to/wechat/data
chatlog decrypt --update

# 重启Chatlog服务
chatlog server restart
```

### 自动化脚本
```bash
# 创建定时任务
crontab -e

# 添加每日凌晨2点更新
0 2 * * * /usr/local/bin/chatlog decrypt --update && /usr/local/bin/chatlog server restart
```

## 安全注意事项

### 数据安全
- 所有数据本地处理，不上传到第三方服务器
- API调用仅发送脱敏后的分析请求
- 定期备份重要聊天记录
- 及时删除临时文件

### 合规使用
- 仅处理个人聊天记录
- 群聊分析需获得相关人员同意
- 遵守相关法律法规
- 不用于商业用途

## 故障排除

### 常见问题
1. **Chatlog工具无法获取密钥**
   - 确保微信客户端已登录
   - 检查微信版本兼容性
   - 重启微信客户端

2. **聊天记录解密失败**
   - 确认密钥正确性
   - 检查数据库文件权限
   - 尝试重新获取密钥

3. **AI分析功能异常**
   - 检查DeepSeek API密钥
   - 确认网络连接正常
   - 查看API调用频率限制

## 版本信息
- 项目版本: 1.0.0
- 创建时间: 2025-07-15
- 最后更新: 2025-07-15
- 开发环境: macOS M1, Node.js 18+

## 技术支持
如遇技术问题，请检查：
1. 系统日志输出
2. Chatlog工具状态
3. API服务连接情况
4. 数据文件完整性