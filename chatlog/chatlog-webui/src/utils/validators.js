const { body, query, param, validationResult } = require('express-validator');
const { ValidationError } = require('./errors');

/**
 * 验证结果处理中间件
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    throw new ValidationError(
      firstError.msg,
      firstError.param,
      firstError.value
    );
  }
  
  next();
};

/**
 * 聊天搜索参数验证
 */
const validateSearchParams = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('搜索关键词长度必须在1-200字符之间')
    .trim()
    .escape(),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('开始日期格式无效，请使用YYYY-MM-DD格式')
    .toDate(),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('结束日期格式无效，请使用YYYY-MM-DD格式')
    .toDate()
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('结束日期不能早于开始日期');
      }
      return true;
    }),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('限制数量必须在1-100之间')
    .toInt(),
    
  query('talker')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('联系人标识长度必须在1-100字符之间')
    .trim(),
    
  query('type')
    .optional()
    .isIn(['text', 'image', 'link', 'file', 'video', 'audio', 'sticker', 'system'])
    .withMessage('消息类型无效'),
    
  handleValidationErrors
];

/**
 * AI分析参数验证
 */
const validateAnalysisParams = [
  body('analysisType')
    .isIn(['summary', 'sentiment', 'keywords', 'topics', 'statistics', 'custom', 'ultrathink'])
    .withMessage('分析类型无效'),
    
  body('dateRange')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('日期范围长度无效')
    .trim(),
    
  body('contacts')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('联系人列表过长')
    .trim(),
    
  body('customPrompt')
    .if(body('analysisType').equals('custom'))
    .notEmpty()
    .withMessage('自定义分析类型必须提供分析要求')
    .isLength({ min: 5, max: 1000 })
    .withMessage('自定义分析要求长度必须在5-1000字符之间')
    .trim(),
    
  body('customPrompt')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('自定义分析要求不能超过1000字符')
    .trim(),
    
  handleValidationErrors
];

/**
 * 导出参数验证
 */
const validateExportParams = [
  body('format')
    .isIn(['json', 'csv', 'txt'])
    .withMessage('导出格式无效，支持json、csv、txt'),
    
  body('dateRange')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('日期范围长度无效')
    .trim(),
    
  body('contacts')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('联系人列表过长')
    .trim(),
    
  body('includeImages')
    .optional()
    .isBoolean()
    .withMessage('包含图片参数必须是布尔值')
    .toBoolean(),
    
  handleValidationErrors
];

/**
 * 登录参数验证
 */
const validateLoginParams = [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 1, max: 50 })
    .withMessage('用户名长度无效')
    .trim(),
    
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 1, max: 128 })
    .withMessage('密码长度无效'),
    
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('记住我参数必须是布尔值')
    .toBoolean(),
    
  handleValidationErrors
];

/**
 * 注册参数验证
 */
const validateRegisterParams = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度必须在3-20字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线')
    .trim(),
    
  body('email')
    .isEmail()
    .withMessage('邮箱格式无效')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('邮箱长度不能超过255字符'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('密码长度必须在8-128字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('密码必须包含大小写字母、数字和特殊字符'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('密码和确认密码不匹配');
      }
      return true;
    }),
    
  body('agreeTerms')
    .equals('true')
    .withMessage('必须同意服务条款'),
    
  handleValidationErrors
];

/**
 * 修改密码参数验证
 */
const validateChangePasswordParams = [
  body('currentPassword')
    .notEmpty()
    .withMessage('当前密码不能为空'),
    
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('新密码长度必须在8-128字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('新密码必须包含大小写字母、数字和特殊字符'),
    
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('新密码和确认密码不匹配');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * 更新用户资料参数验证
 */
const validateProfileParams = [
  body('displayName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('显示名称长度必须在1-50字符之间')
    .trim(),
    
  body('email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式无效')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('邮箱长度不能超过255字符'),
    
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('主题选择无效'),
    
  body('preferences.language')
    .optional()
    .isIn(['zh-CN', 'en-US'])
    .withMessage('语言选择无效'),
    
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('通知设置必须是布尔值')
    .toBoolean(),
    
  handleValidationErrors
];

/**
 * API密钥验证
 */
const validateApiKey = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('API密钥名称长度必须在1-100字符之间')
    .trim(),
    
  body('permissions')
    .isArray()
    .withMessage('权限必须是数组')
    .custom((permissions) => {
      const validPermissions = ['read', 'write', 'admin'];
      for (const permission of permissions) {
        if (!validPermissions.includes(permission)) {
          throw new Error(`无效的权限: ${permission}`);
        }
      }
      return true;
    }),
    
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('过期时间格式无效')
    .toDate()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('过期时间必须是未来时间');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * 文件上传验证
 */
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      throw new ValidationError('未提供文件');
    }
    
    // 检查文件类型
    if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
      throw new ValidationError(
        `不支持的文件类型: ${req.file.mimetype}`,
        'file',
        req.file.mimetype
      );
    }
    
    // 检查文件大小
    if (req.file.size > maxSize) {
      throw new ValidationError(
        `文件大小超出限制: ${Math.round(req.file.size / 1024 / 1024)}MB`,
        'file',
        req.file.size
      );
    }
    
    next();
  };
};

/**
 * 通用数据清理函数
 */
const sanitizeData = {
  /**
   * 清理搜索查询
   */
  searchQuery: (query) => {
    if (!query || typeof query !== 'string') return '';
    
    return query
      .trim()
      .replace(/[<>]/g, '') // 移除HTML标签符号
      .replace(/javascript:/gi, '') // 移除JavaScript协议
      .replace(/on\w+=/gi, '') // 移除事件处理器
      .substring(0, 200); // 限制长度
  },
  
  /**
   * 清理联系人标识
   */
  contactId: (id) => {
    if (!id || typeof id !== 'string') return '';
    
    return id
      .trim()
      .replace(/[^\w@.-]/g, '') // 只保留字母、数字、@、.、-
      .substring(0, 100);
  },
  
  /**
   * 清理文件名
   */
  filename: (filename) => {
    if (!filename || typeof filename !== 'string') return '';
    
    return filename
      .trim()
      .replace(/[^\w.-]/g, '_') // 替换特殊字符为下划线
      .replace(/\.{2,}/g, '.') // 移除连续的点
      .substring(0, 255);
  }
};

/**
 * 自定义验证器
 */
const customValidators = {
  /**
   * 验证日期范围
   */
  isValidDateRange: (startDate, endDate) => {
    if (!startDate || !endDate) return true; // 可选参数
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    
    if (end < start) {
      return false;
    }
    
    // 限制日期范围不超过1年
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (end - start > oneYear) {
      return false;
    }
    
    return true;
  },
  
  /**
   * 验证联系人ID格式
   */
  isValidContactId: (id) => {
    if (!id || typeof id !== 'string') return false;
    
    // 微信ID格式验证
    const wechatPattern = /^[a-zA-Z0-9_@.-]+$/;
    return wechatPattern.test(id) && id.length >= 1 && id.length <= 100;
  },
  
  /**
   * 验证分析类型
   */
  isValidAnalysisType: (type) => {
    const validTypes = ['summary', 'sentiment', 'keywords', 'topics', 'statistics', 'custom', 'ultrathink'];
    return validTypes.includes(type);
  }
};

module.exports = {
  validateSearchParams,
  validateAnalysisParams,
  validateExportParams,
  validateLoginParams,
  validateRegisterParams,
  validateChangePasswordParams,
  validateProfileParams,
  validateApiKey,
  validateFileUpload,
  handleValidationErrors,
  sanitizeData,
  customValidators
};