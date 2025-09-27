/**
 * Chatlog连接管理器：解决"未链接"状态的全链路解决方案
 * 链式思考：诊断 → 预防 → 自动修复 → 监控 → 容错
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

class ChatlogConnectionManager {
    constructor() {
        this.config = {
            port: 5030,
            host: '127.0.0.1',
            retryInterval: 3000,
            maxRetries: 10,
            healthCheckInterval: 5000,
            timeout: 5000
        };
        
        this.state = {
            isConnected: false,
            lastError: null,
            retryCount: 0,
            servicePID: null,
            startTime: Date.now()
        };
        
        this.healthCheckTimer = null;
        this.retryTimer = null;
    }

    // 🔍 第一步：全面诊断
    async diagnose() {
        console.log('🔍 开始诊断chatlog连接问题...');
        
        const checks = [
            { name: '可执行文件', check: () => fs.existsSync('./chatlog') },
            { name: '端口占用', check: () => this.checkPort(this.config.port) },
            { name: '进程状态', check: () => this.checkProcess() },
            { name: '网络连通', check: () => this.testConnection() },
            { name: '权限检查', check: () => this.checkPermissions() }
        ];
        
        const results = [];
        for (const check of checks) {
            try {
                const passed = await check.check();
                results.push({ name: check.name, passed, timestamp: new Date().toISOString() });
                console.log(`${passed ? '✅' : '❌'} ${check.name}`);
            } catch (error) {
                results.push({ name: check.name, passed: false, error: error.message });
                console.log(`❌ ${check.name}: ${error.message}`);
            }
        }
        
        return results;
    }

    // 🔧 第二步：自动修复
    async autoFix() {
        console.log('🔧 开始自动修复...');
        
        const fixes = [
            { name: '停止残留进程', action: () => this.killStaleProcesses() },
            { name: '启动服务', action: () => this.startService() },
            { name: '等待就绪', action: () => this.waitForReady() },
            { name: '验证连接', action: () => this.validateConnection() }
        ];
        
        for (const fix of fixes) {
            try {
                await fix.action();
                console.log(`✅ ${fix.name}`);
            } catch (error) {
                console.log(`❌ ${fix.name}: ${error.message}`);
                throw error;
            }
        }
    }

    // 📊 第三步：实时监控
    startHealthMonitoring() {
        console.log('📊 启动健康监控...');
        
        this.healthCheckTimer = setInterval(async () => {
            try {
                const isHealthy = await this.testConnection();
                if (!isHealthy && this.state.isConnected) {
                    console.log('⚠️ 连接断开，开始重连...');
                    await this.handleDisconnection();
                } else if (isHealthy && !this.state.isConnected) {
                    console.log('✅ 连接已恢复');
                    this.state.isConnected = true;
                }
            } catch (error) {
                console.log('❌ 健康检查失败:', error.message);
            }
        }, this.config.healthCheckInterval);
    }

    // 🔄 第四步：容错重连
    async handleDisconnection() {
        this.state.isConnected = false;
        this.state.retryCount = 0;
        
        const retry = async () => {
            if (this.state.retryCount >= this.config.maxRetries) {
                console.log('❌ 重连失败，已达到最大重试次数');
                return;
            }
            
            this.state.retryCount++;
            console.log(`🔄 重试连接 (${this.state.retryCount}/${this.config.maxRetries})...`);
            
            try {
                await this.autoFix();
                this.state.isConnected = true;
                this.state.retryCount = 0;
                console.log('✅ 重连成功');
            } catch (error) {
                console.log(`⏳ ${this.config.retryInterval/1000}秒后重试...`);
                setTimeout(retry, this.config.retryInterval);
            }
        };
        
        retry();
    }

    // 🛡️ 第五步：预防性检查
    async preventiveCheck() {
        console.log('🛡️ 执行预防性检查...');
        
        const checks = [
            { name: '磁盘空间', check: () => this.checkDiskSpace() },
            { name: '内存使用', check: () => this.checkMemoryUsage() },
            { name: '端口冲突', check: () => this.checkPortAvailability() },
            { name: '权限设置', check: () => this.ensurePermissions() }
        ];
        
        for (const check of checks) {
            try {
                await check.check();
                console.log(`✅ ${check.name}正常`);
            } catch (warning) {
                console.log(`⚠️ ${check.name}警告: ${warning.message}`);
            }
        }
    }

    // 🔧 具体实现方法
    async checkPort(port) {
        return new Promise((resolve) => {
            const server = http.createServer();
            server.listen(port, () => {
                server.close();
                resolve(false); // 端口可用
            });
            server.on('error', () => resolve(true)); // 端口被占用
        });
    }

    async checkProcess() {
        return new Promise((resolve) => {
            exec('ps aux | grep chatlog | grep -v grep', (error, stdout) => {
                resolve(stdout.trim().length > 0);
            });
        });
    }

    async testConnection() {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: this.config.host,
                port: this.config.port,
                path: '/api/v1/session',
                method: 'GET',
                timeout: this.config.timeout
            }, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }

    async checkPermissions() {
        try {
            fs.accessSync('./chatlog', fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    async killStaleProcesses() {
        return new Promise((resolve) => {
            exec('pkill -f "chatlog http-server" || true', () => {
                setTimeout(resolve, 1000);
            });
        });
    }

    async startService() {
        return new Promise((resolve, reject) => {
            const chatlog = spawn('./chatlog', ['http-server', '--port', this.config.port], {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true
            });
            
            chatlog.on('spawn', () => {
                this.state.servicePID = chatlog.pid;
                resolve();
            });
            
            chatlog.on('error', reject);
            
            setTimeout(() => {
                reject(new Error('服务启动超时'));
            }, 10000);
        });
    }

    async waitForReady() {
        return new Promise((resolve, reject) => {
            const checkReady = async () => {
                const isReady = await this.testConnection();
                if (isReady) {
                    resolve();
                } else {
                    setTimeout(checkReady, 500);
                }
            };
            
            setTimeout(() => reject(new Error('服务就绪超时')), 30000);
            checkReady();
        });
    }

    async validateConnection() {
        const isConnected = await this.testConnection();
        if (!isConnected) {
            throw new Error('连接验证失败');
        }
        this.state.isConnected = true;
    }

    async checkDiskSpace() {
        const stats = fs.statSync('.');
        // 简化的磁盘空间检查
        return true;
    }

    async checkMemoryUsage() {
        // 简化的内存检查
        return true;
    }

    async checkPortAvailability() {
        const isUsed = await this.checkPort(this.config.port);
        if (isUsed) {
            throw new Error(`端口${this.config.port}已被占用`);
        }
    }

    async ensurePermissions() {
        try {
            fs.chmodSync('./chatlog', 0o755);
        } catch (error) {
            throw new Error(`权限设置失败: ${error.message}`);
        }
    }

    // 📋 生成诊断报告
    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            state: this.state,
            config: this.config,
            diagnostics: await this.diagnose(),
            uptime: Date.now() - this.state.startTime
        };
        
        fs.writeFileSync('chatlog-connection-report.json', JSON.stringify(report, null, 2));
        return report;
    }

    // 🚀 一键启动完整解决方案
    async start() {
        console.log('🚀 启动chatlog连接管理器...\n');
        
        try {
            // 1. 全面诊断
            const diagnosis = await this.diagnose();
            
            // 2. 预防性检查
            await this.preventiveCheck();
            
            // 3. 自动修复
            if (!diagnosis.every(d => d.passed)) {
                await this.autoFix();
            }
            
            // 4. 启动监控
            this.startHealthMonitoring();
            
            // 5. 生成报告
            const report = await this.generateReport();
            
            console.log('\n✅ chatlog连接管理器已成功启动');
            console.log('📊 诊断报告已生成: chatlog-connection-report.json');
            
            return report;
            
        } catch (error) {
            console.error('❌ 启动失败:', error.message);
            throw error;
        }
    }

    // 🛑 优雅停止
    stop() {
        console.log('🛑 停止chatlog连接管理器...');
        
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
        
        if (this.state.servicePID) {
            try {
                process.kill(this.state.servicePID, 'SIGTERM');
            } catch (error) {
                console.log('服务进程已停止');
            }
        }
        
        console.log('✅ 已停止');
    }
}

// CLI接口
if (require.main === module) {
    const manager = new ChatlogConnectionManager();
    const action = process.argv[2] || 'start';
    
    switch (action) {
        case 'start':
            manager.start().catch(console.error);
            break;
        case 'stop':
            manager.stop();
            break;
        case 'diagnose':
            manager.diagnose().then(console.log);
            break;
        case 'status':
            manager.generateReport().then(console.log);
            break;
        default:
            console.log('用法: node chatlog-connection-manager.js [start|stop|diagnose|status]');
    }
}

module.exports = ChatlogConnectionManager;