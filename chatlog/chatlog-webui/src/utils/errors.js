const logger = require('./logger');

/**
 * 基础错误类
 */
class BaseError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Chatlog服务相关错误
 */
class ChatlogError extends BaseError {
  constructor(message, originalError = null) {
    super(message, 503);
    this.originalError = originalError;
    this.service = 'chatlog';
  }
}

/**
 * API连接错误
 */
class ApiConnectionError extends BaseError {
  constructor(message, service) {
    super(message, 503);
    this.service = service;
  }
}

/**
 * 数据验证错误
 */
class ValidationError extends BaseError {
  constructor(message, field = null, value = null) {
    super(message, 400);
    this.field = field;
    this.value = value;
  }
}

/**
 * 身份验证错误
 */
class AuthenticationError extends BaseError {
  constructor(message = '身份验证失败') {
    super(message, 401);
  }
}

/**
 * 授权错误
 */
class AuthorizationError extends BaseError {
  constructor(message = '访问权限不足') {
    super(message, 403);
  }
}

/**
 * 数据不存在错误
 */
class NotFoundError extends BaseError {
  constructor(message = '请求的资源不存在') {
    super(message, 404);
  }
}

/**
 * 业务逻辑错误
 */
class BusinessError extends BaseError {
  constructor(message, code = 'BUSINESS_ERROR') {
    super(message, 422);
    this.code = code;
  }
}

/**
 * 限流错误
 */
class RateLimitError extends BaseError {
  constructor(message = '请求过于频繁，请稍后再试') {
    super(message, 429);
  }
}

/**
 * 配置错误
 */
class ConfigurationError extends BaseError {
  constructor(message) {
    super(message, 500);
    this.isOperational = false; // 这是系统级错误
  }
}

/**
 * 错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 记录错误
  if (err.isOperational) {
    logger.warn('Operational Error', {
      error: err.toJSON ? err.toJSON() : err.message,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.error('System Error', {
      error: err.toJSON ? err.toJSON() : err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
  }

  // 如果响应已经发送，传递给默认错误处理器
  if (res.headersSent) {
    return next(err);
  }

  // 确定错误状态码
  const statusCode = err.statusCode || 500;
  
  // 构建错误响应
  const errorResponse = {
    success: false,
    error: {
      message: err.message || '服务器内部错误',
      code: err.code || err.name || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  };

  // 在开发环境中包含堆栈信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = err.toJSON ? err.toJSON() : {};
  }

  // 根据错误类型添加特定信息
  if (err instanceof ValidationError) {
    errorResponse.error.field = err.field;
    errorResponse.error.value = err.value;
  }

  if (err instanceof ChatlogError) {
    errorResponse.error.service = 'chatlog';
    errorResponse.error.suggestion = '请检查Chatlog服务是否正常运行';
  }

  if (err instanceof ApiConnectionError) {
    errorResponse.error.service = err.service;
    errorResponse.error.suggestion = `请检查${err.service}服务连接`;
  }

  // 发送错误响应
  res.status(statusCode).json(errorResponse);
};

/**
 * 异步错误包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404错误处理
 */
const notFoundHandler = (req, res, next) => {
  const err = new NotFoundError(`路径 ${req.originalUrl} 不存在`);
  next(err);
};

/**
 * 错误报告器 - 用于监控系统
 */
class ErrorReporter {
  static report(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context,
      severity: error.statusCode >= 500 ? 'high' : 'medium'
    };

    // 记录到日志
    logger.error('Error Report', errorData);

    // 这里可以集成第三方错误监控服务
    // 如 Sentry, Bugsnag 等
  }
}

/**
 * 创建标准化错误的工厂函数
 */
const createError = {
  chatlogUnavailable: () => new ChatlogError('Chatlog服务不可用，请稍后重试'),
  invalidSearchParams: (field) => new ValidationError(`搜索参数 ${field} 无效`, field),
  noDataFound: () => new NotFoundError('未找到匹配的聊天记录'),
  apiTimeout: (service) => new ApiConnectionError(`${service}服务响应超时`, service),
  rateLimitExceeded: () => new RateLimitError('请求频率超限，请稍后重试'),
  invalidToken: () => new AuthenticationError('无效的访问令牌'),
  insufficientPermissions: () => new AuthorizationError('权限不足'),
  configMissing: (key) => new ConfigurationError(`缺少配置项: ${key}`)
};

module.exports = {
  BaseError,
  ChatlogError,
  ApiConnectionError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BusinessError,
  RateLimitError,
  ConfigurationError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  ErrorReporter,
  createError
};