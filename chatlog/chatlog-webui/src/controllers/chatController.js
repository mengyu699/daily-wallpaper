const chatlogService = require('../services/chatlogService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errors');
const { sanitizeData } = require('../utils/validators');

/**
 * 聊天控制器 - 处理所有聊天相关的HTTP请求
 */
class ChatController {
  /**
   * 搜索聊天消息
   */
  searchMessages = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      logger.info('收到消息搜索请求', {
        requestId,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array(),
          requestId
        });
      }

      // 构建搜索参数
      const searchParams = this.buildSearchParams(req.query);

      // 调用服务层搜索消息
      const result = await chatlogService.searchMessages(searchParams);

      const duration = Date.now() - startTime;

      // 记录成功日志
      logger.business('消息搜索成功', {
        requestId,
        messageCount: result.messages.length,
        duration,
        searchParams
      });

      // 返回成功响应
      res.json({
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('消息搜索失败', {
        requestId,
        error: error.message,
        duration,
        query: req.query
      });

      throw error; // 由错误处理中间件处理
    }
  });

  /**
   * 获取联系人列表
   */
  getContacts = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      logger.info('获取联系人列表', { requestId });

      const contacts = await chatlogService.getContacts();

      logger.business('获取联系人成功', {
        requestId,
        contactCount: Array.isArray(contacts) ? contacts.length : 0
      });

      res.json({
        success: true,
        data: contacts,
        requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取联系人失败', {
        requestId,
        error: error.message
      });

      throw error;
    }
  });

  /**
   * 获取群聊列表
   */
  getChatrooms = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      logger.info('获取群聊列表', { requestId });

      const chatrooms = await chatlogService.getChatrooms();

      logger.business('获取群聊成功', {
        requestId,
        chatroomCount: Array.isArray(chatrooms) ? chatrooms.length : 0
      });

      res.json({
        success: true,
        data: chatrooms,
        requestId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取群聊失败', {
        requestId,
        error: error.message
      });

      throw error;
    }
  });

  /**
   * 导出聊天数据
   */
  exportMessages = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      logger.info('收到数据导出请求', {
        requestId,
        body: req.body,
        ip: req.ip
      });

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '导出参数无效',
          errors: errors.array(),
          requestId
        });
      }

      const { format, dateRange, contacts, includeImages = false } = req.body;

      // 构建搜索参数
      const searchParams = this.buildExportSearchParams({
        dateRange,
        contacts,
        limit: 1000 // 导出时允许更多数据
      });

      // 获取消息数据
      const result = await chatlogService.searchMessages(searchParams);

      // 根据格式处理数据
      const exportData = this.formatExportData(result.messages, format, includeImages);

      logger.business('数据导出成功', {
        requestId,
        format,
        messageCount: result.messages.length,
        exportSize: JSON.stringify(exportData).length
      });

      // 设置响应头
      const filename = this.generateExportFilename(format, searchParams);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.json({
          success: true,
          data: {
            messages: exportData,
            metadata: {
              exportTime: new Date().toISOString(),
              totalCount: result.messages.length,
              searchParams,
              format
            }
          },
          requestId
        });
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.send(exportData);
      } else if (format === 'txt') {
        res.setHeader('Content-Type', 'text/plain');
        res.send(exportData);
      }

    } catch (error) {
      logger.error('数据导出失败', {
        requestId,
        error: error.message,
        body: req.body
      });

      throw error;
    }
  });

  /**
   * 获取服务状态
   */
  getServiceStatus = asyncHandler(async (req, res) => {
    const requestId = this.generateRequestId();

    try {
      const chatlogStatus = await chatlogService.healthCheck();
      const serviceStatus = chatlogService.getServiceStatus();

      const status = {
        chatlog: {
          ...chatlogStatus,
          ...serviceStatus
        },
        timestamp: new Date().toISOString(),
        requestId
      };

      logger.info('服务状态检查', { requestId, status });

      res.json({
        success: true,
        data: status,
        requestId
      });

    } catch (error) {
      logger.error('服务状态检查失败', {
        requestId,
        error: error.message
      });

      throw error;
    }
  });

  /**
   * 构建搜索参数
   */
  buildSearchParams(query) {
    const {
      q,
      startDate,
      endDate,
      talker,
      limit = 50,
      type
    } = query;

    return {
      query: q ? sanitizeData.searchQuery(q) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      talker: talker ? sanitizeData.contactId(talker) : undefined,
      limit: Math.min(parseInt(limit) || 50, 100),
      type: type || undefined
    };
  }

  /**
   * 构建导出搜索参数
   */
  buildExportSearchParams({ dateRange, contacts, limit = 1000 }) {
    const params = {
      limit: Math.min(limit, 2000) // 导出限制更高
    };

    // 解析日期范围
    if (dateRange && dateRange.includes(' - ')) {
      const [startDate, endDate] = dateRange.split(' - ').map(d => d.trim());
      params.startDate = startDate;
      params.endDate = endDate;
    }

    // 处理联系人
    if (contacts && contacts.trim()) {
      // 假设只有一个联系人，实际使用中可能需要支持多个
      params.talker = sanitizeData.contactId(contacts.trim().split(',')[0]);
    }

    return params;
  }

  /**
   * 格式化导出数据
   */
  formatExportData(messages, format, includeImages) {
    if (!messages || messages.length === 0) {
      return format === 'json' ? [] : '';
    }

    switch (format) {
      case 'json':
        return messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          senderName: msg.senderName,
          timestamp: msg.timestamp,
          type: msg.type,
          ...(includeImages && msg.type === 'image' && { imageData: msg.content })
        }));

      case 'csv':
        const csvHeader = 'ID,发送者,发送者昵称,时间,类型,内容\n';
        const csvRows = messages.map(msg => {
          const content = msg.content.replace(/"/g, '""').replace(/\n/g, ' ');
          return `${msg.id},"${msg.sender}","${msg.senderName}","${msg.timestamp}","${msg.type}","${content}"`;
        }).join('\n');
        return csvHeader + csvRows;

      case 'txt':
        return messages.map(msg => {
          const time = new Date(msg.timestamp).toLocaleString('zh-CN');
          return `[${time}] ${msg.senderName}: ${msg.content}`;
        }).join('\n');

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 生成导出文件名
   */
  generateExportFilename(format, searchParams) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const baseFilename = `chatlog_export_${timestamp}`;
    
    return `${baseFilename}.${format}`;
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new ChatController();