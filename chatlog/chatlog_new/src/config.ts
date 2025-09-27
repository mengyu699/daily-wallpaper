export const CONFIG = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat',
  PORT: process.env.PORT || 3000,
} as const;