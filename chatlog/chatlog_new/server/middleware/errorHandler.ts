import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // 处理未知错误
  console.error('❌ Unknown error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};

export const validateQuery = (req: Request, res: Response, next: NextFunction) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Query parameter is required and must be a string'
    });
  }

  // 防止正则表达式注入
  if (query.length > 100 || /[\${}()[\]|\\^]/g.test(query)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid query format'
    });
  }

  next();
};

export const sanitizeQuery = (query: string): string => {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};