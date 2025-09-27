const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 用户模型类
 * 生产级用户管理系统
 */
class User {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.username = data.username;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.role = data.role || 'user';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLoginAt = data.lastLoginAt || null;
    this.loginAttempts = data.loginAttempts || 0;
    this.lockUntil = data.lockUntil || null;
    this.emailVerified = data.emailVerified || false;
    this.profile = data.profile || {
      displayName: data.username,
      avatar: null,
      preferences: {
        theme: 'light',
        language: 'zh-CN',
        notifications: true
      }
    };
  }

  /**
   * 设置密码
   */
  async setPassword(password) {
    // 密码强度验证
    if (!this.validatePasswordStrength(password)) {
      throw new Error('密码不满足安全要求：至少8位，包含大小写字母、数字和特殊字符');
    }

    const saltRounds = 12; // 高安全级别
    this.passwordHash = await bcrypt.hash(password, saltRounds);
    this.updatedAt = new Date().toISOString();
    
    logger.security('用户密码已更新', {
      userId: this.id,
      username: this.username
    });
  }

  /**
   * 验证密码
   */
  async verifyPassword(password) {
    if (!this.passwordHash) {
      return false;
    }

    try {
      const isValid = await bcrypt.compare(password, this.passwordHash);
      
      if (isValid) {
        // 登录成功，重置失败计数
        this.loginAttempts = 0;
        this.lockUntil = null;
        this.lastLoginAt = new Date().toISOString();
        
        logger.security('用户登录成功', {
          userId: this.id,
          username: this.username,
          ip: this.currentIP
        });
      } else {
        // 登录失败，增加计数
        this.loginAttempts += 1;
        
        // 5次失败后锁定账户30分钟
        if (this.loginAttempts >= 5) {
          this.lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          
          logger.security('用户账户已锁定', {
            userId: this.id,
            username: this.username,
            attempts: this.loginAttempts,
            lockUntil: this.lockUntil
          });
        }
        
        logger.security('用户登录失败', {
          userId: this.id,
          username: this.username,
          attempts: this.loginAttempts,
          ip: this.currentIP
        });
      }

      return isValid;
    } catch (error) {
      logger.error('密码验证失败', { error: error.message, userId: this.id });
      return false;
    }
  }

  /**
   * 生成JWT令牌
   */
  generateToken() {
    const payload = {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时过期
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET环境变量未设置');
    }

    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      issuer: 'chatlog-webui',
      audience: 'chatlog-webui-users'
    });
  }

  /**
   * 验证JWT令牌
   */
  static verifyToken(token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET环境变量未设置');
      }

      return jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'chatlog-webui',
        audience: 'chatlog-webui-users'
      });
    } catch (error) {
      logger.security('JWT令牌验证失败', { 
        error: error.message,
        token: token ? token.substring(0, 20) + '...' : null
      });
      return null;
    }
  }

  /**
   * 检查账户是否被锁定
   */
  isLocked() {
    if (!this.lockUntil) {
      return false;
    }

    const now = new Date();
    const lockTime = new Date(this.lockUntil);

    if (now < lockTime) {
      return true;
    }

    // 锁定时间已过，清除锁定状态
    this.lockUntil = null;
    this.loginAttempts = 0;
    return false;
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password) {
    if (password.length < 8) return false;
    if (!/[a-z]/.test(password)) return false; // 小写字母
    if (!/[A-Z]/.test(password)) return false; // 大写字母
    if (!/\d/.test(password)) return false; // 数字
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false; // 特殊字符
    return true;
  }

  /**
   * 序列化用户数据（不包含敏感信息）
   */
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      emailVerified: this.emailVerified,
      profile: this.profile
    };
  }

  /**
   * 序列化用户数据（包含所有字段，用于存储）
   */
  toStorage() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      loginAttempts: this.loginAttempts,
      lockUntil: this.lockUntil,
      emailVerified: this.emailVerified,
      profile: this.profile
    };
  }

  /**
   * 从存储数据创建用户实例
   */
  static fromStorage(data) {
    return new User(data);
  }

  /**
   * 获取数据文件路径
   */
  static getDataPath() {
    return path.join(process.cwd(), 'data', 'users.json');
  }

  /**
   * 确保数据目录存在
   */
  static async ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  /**
   * 加载所有用户
   */
  static async loadUsers() {
    try {
      await this.ensureDataDirectory();
      const dataPath = this.getDataPath();
      
      try {
        const data = await fs.readFile(dataPath, 'utf8');
        const usersData = JSON.parse(data);
        return usersData.map(userData => User.fromStorage(userData));
      } catch (error) {
        if (error.code === 'ENOENT') {
          // 文件不存在，返回空数组
          return [];
        }
        throw error;
      }
    } catch (error) {
      logger.error('加载用户数据失败', { error: error.message });
      return [];
    }
  }

  /**
   * 保存所有用户
   */
  static async saveUsers(users) {
    try {
      await this.ensureDataDirectory();
      const dataPath = this.getDataPath();
      const usersData = users.map(user => user.toStorage());
      
      await fs.writeFile(dataPath, JSON.stringify(usersData, null, 2), 'utf8');
      
      logger.business('用户数据已保存', { userCount: users.length });
    } catch (error) {
      logger.error('保存用户数据失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 通过用户名查找用户
   */
  static async findByUsername(username) {
    const users = await this.loadUsers();
    return users.find(user => user.username === username);
  }

  /**
   * 通过邮箱查找用户
   */
  static async findByEmail(email) {
    const users = await this.loadUsers();
    return users.find(user => user.email === email);
  }

  /**
   * 通过ID查找用户
   */
  static async findById(id) {
    const users = await this.loadUsers();
    return users.find(user => user.id === id);
  }

  /**
   * 创建新用户
   */
  static async create(userData) {
    // 验证用户名唯一性
    const existingUser = await this.findByUsername(userData.username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    // 验证邮箱唯一性
    if (userData.email) {
      const existingEmail = await this.findByEmail(userData.email);
      if (existingEmail) {
        throw new Error('邮箱已存在');
      }
    }

    // 创建新用户
    const user = new User(userData);
    
    if (userData.password) {
      await user.setPassword(userData.password);
    }

    // 加载现有用户并添加新用户
    const users = await this.loadUsers();
    users.push(user);
    
    // 保存所有用户
    await this.saveUsers(users);

    logger.business('新用户已创建', {
      userId: user.id,
      username: user.username,
      email: user.email
    });

    return user;
  }

  /**
   * 更新用户
   */
  async save() {
    const users = await User.loadUsers();
    const index = users.findIndex(user => user.id === this.id);
    
    if (index === -1) {
      throw new Error('用户不存在');
    }

    this.updatedAt = new Date().toISOString();
    users[index] = this;
    
    await User.saveUsers(users);

    logger.business('用户信息已更新', {
      userId: this.id,
      username: this.username
    });

    return this;
  }

  /**
   * 删除用户
   */
  async delete() {
    const users = await User.loadUsers();
    const filteredUsers = users.filter(user => user.id !== this.id);
    
    await User.saveUsers(filteredUsers);

    logger.business('用户已删除', {
      userId: this.id,
      username: this.username
    });
  }

  /**
   * 创建默认管理员用户
   */
  static async createDefaultAdmin() {
    const adminUser = await this.findByUsername('admin');
    if (adminUser) {
      return adminUser;
    }

    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!@#';
    
    const admin = await this.create({
      username: 'admin',
      email: 'admin@chatlog-webui.local',
      password: defaultPassword,
      role: 'admin',
      emailVerified: true,
      profile: {
        displayName: '系统管理员',
        avatar: null,
        preferences: {
          theme: 'dark',
          language: 'zh-CN',
          notifications: true
        }
      }
    });

    logger.business('默认管理员用户已创建', {
      username: 'admin',
      password: defaultPassword === 'Admin123!@#' ? '请在首次登录后修改密码' : '使用环境变量密码'
    });

    return admin;
  }
}

module.exports = User;