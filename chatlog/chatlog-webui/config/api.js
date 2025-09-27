require('dotenv').config();

const validateEnvVar = (name, defaultValue = null) => {
    const value = process.env[name];
    if (!value) {
        if (defaultValue !== null) {
            console.warn(`警告: 环境变量 ${name} 未设置，使用默认值: ${defaultValue}`);
            return defaultValue;
        }
        throw new Error(`必需的环境变量 ${name} 未设置`);
    }
    return value;
};

module.exports = {
    deepseek: {
        apiKey: validateEnvVar('DEEPSEEK_API_KEY'),
        baseUrl: validateEnvVar('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
        model: validateEnvVar('DEEPSEEK_MODEL', 'deepseek-chat'),
        maxTokens: parseInt(validateEnvVar('DEEPSEEK_MAX_TOKENS', '1500')),
        temperature: parseFloat(validateEnvVar('DEEPSEEK_TEMPERATURE', '0.7')),
        timeout: parseInt(validateEnvVar('DEEPSEEK_TIMEOUT', '45000'))
    },
    
    chatlog: {
        apiBase: validateEnvVar('CHATLOG_API_BASE', 'http://localhost:8080/api/v1'),
        timeout: parseInt(validateEnvVar('CHATLOG_TIMEOUT', '15000')),
        retryAttempts: parseInt(validateEnvVar('CHATLOG_RETRY_ATTEMPTS', '1')),
        retryDelay: parseInt(validateEnvVar('CHATLOG_RETRY_DELAY', '2000'))
    },
    
    rateLimit: {
        windowMs: parseInt(validateEnvVar('RATE_LIMIT_WINDOW_MS', '900000')),
        max: parseInt(validateEnvVar('RATE_LIMIT_MAX', '100')),
        message: validateEnvVar('RATE_LIMIT_MESSAGE', '请求过于频繁，请稍后再试')
    },
    
    analysis: {
        batchSize: parseInt(validateEnvVar('ANALYSIS_BATCH_SIZE', '20')),
        maxAnalysisLength: parseInt(validateEnvVar('ANALYSIS_MAX_LENGTH', '5000')),
        summaryLength: parseInt(validateEnvVar('ANALYSIS_SUMMARY_LENGTH', '300')),
        keywordLimit: parseInt(validateEnvVar('ANALYSIS_KEYWORD_LIMIT', '15'))
    },
    
    security: {
        sessionSecret: validateEnvVar('SESSION_SECRET'),
        jwtSecret: validateEnvVar('JWT_SECRET'),
        saltRounds: parseInt(validateEnvVar('BCRYPT_SALT_ROUNDS', '12'))
    },
    
    auth: {
        tokenExpiry: validateEnvVar('AUTH_TOKEN_EXPIRY', '24h'),
        sessionTimeout: validateEnvVar('AUTH_SESSION_TIMEOUT', '8h'),
        maxLoginAttempts: parseInt(validateEnvVar('AUTH_MAX_LOGIN_ATTEMPTS', '5')),
        lockoutDuration: validateEnvVar('AUTH_LOCKOUT_DURATION', '30m'),
        allowRegistration: validateEnvVar('ALLOW_REGISTRATION', 'true') === 'true',
        requireEmailVerification: validateEnvVar('REQUIRE_EMAIL_VERIFICATION', 'false') === 'true',
        passwordMinLength: parseInt(validateEnvVar('PASSWORD_MIN_LENGTH', '8')),
        defaultAdminPassword: validateEnvVar('DEFAULT_ADMIN_PASSWORD', 'Admin123!@#')
    },
    
    server: {
        port: parseInt(validateEnvVar('PORT', '3000')),
        nodeEnv: validateEnvVar('NODE_ENV', 'development'),
        host: validateEnvVar('SERVER_HOST', '0.0.0.0'),
        requestTimeout: parseInt(validateEnvVar('REQUEST_TIMEOUT', '30000')),
        sessionSecret: validateEnvVar('SESSION_SECRET')
    },
    
    logging: {
        level: validateEnvVar('LOG_LEVEL', 'info'),
        file: validateEnvVar('LOG_FILE', 'logs/app.log')
    }
};