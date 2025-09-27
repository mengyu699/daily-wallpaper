/**
 * Chatlog健康检查器：实时监控和自动恢复
 * 解决"未链接"状态的持续监控方案
 */

const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');

class ChatlogHealthChecker {
    constructor() {
        this.config = {
            checkInterval: 5000,      // 5秒检查一次
            alertThreshold: 3,        // 连续3次失败触发修复
            restartDelay: 2000,       // 2秒后重启
            logFile: 'chatlog-health.log'
        };
        
        this.state = {
            consecutiveFailures: 0,
            lastCheck: null,
            isHealthy: false,
            restartCount: 0
        };
        
        this.timer = null;
    }

    async checkHealth() {
        const timestamp = new Date().toISOString();
        
        try {
            // 检查服务状态
            const isRunning = await this.isServiceRunning();
            const isResponsive = await this.isServiceResponsive();
            
            const isHealthy = isRunning && isResponsive;
            
            if (isHealthy) {
                this.state.consecutiveFailures = 0;
                this.state.isHealthy = true;
                this.log(`✅ 服务正常 - ${timestamp}`);
            } else {
                this.state.consecutiveFailures++;
                this.state.isHealthy = false;
                this.log(`❌ 服务异常 - ${timestamp} - 连续失败: ${this.state.consecutiveFailures}`);
                
                if (this.state.consecutiveFailures >= this.config.alertThreshold) {
                    await this.handleFailure();
                }
            }
            
            this.state.lastCheck = timestamp;
            
        } catch (error) {
            this.log(`❌ 检查失败: ${error.message} - ${timestamp}`);
            this.state.consecutiveFailures++;
        }
    }

    async isServiceRunning() {
        return new Promise((resolve) => {
            exec('ps aux | grep "chatlog http-server" | grep -v grep', (error, stdout) => {
                resolve(stdout.trim().length > 0);
            });
        });
    }

    async isServiceResponsive() {
        return new Promise((resolve) => {
            const req = http.get('http://127.0.0.1:5030/api/v1/session', (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    async handleFailure() {
        this.log('🔧 检测到服务故障，开始自动修复...');
        
        try {
            // 1. 停止残留进程
            await this.stopService();
            
            // 2. 等待清理
            await this.sleep(this.config.restartDelay);
            
            // 3. 重启服务
            await this.startService();
            
            // 4. 验证恢复
            await this.sleep(3000);
            const isHealthy = await this.isServiceResponsive();
            
            if (isHealthy) {
                this.state.restartCount++;
                this.log(`✅ 服务已自动恢复 - 重启次数: ${this.state.restartCount}`);
                this.state.consecutiveFailures = 0;
            } else {
                this.log('❌ 自动修复失败');
            }
            
        } catch (error) {
            this.log(`❌ 修复失败: ${error.message}`);
        }
    }

    async stopService() {
        return new Promise((resolve) => {
            exec('pkill -f "chatlog http-server" || true', () => {
                resolve();
            });
        });
    }

    async startService() {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const service = spawn('./chatlog', ['http-server', '--port', '5030'], {
                stdio: 'ignore',
                detached: true
            });
            
            service.on('spawn', () => {
                service.unref();
                resolve();
            });
            
            service.on('error', reject);
            
            setTimeout(() => reject(new Error('启动超时')), 10000);
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(message) {
        const logEntry = `${new Date().toISOString()} - ${message}\n`;
        console.log(message);
        fs.appendFileSync(this.config.logFile, logEntry);
    }

    start() {
        console.log('🚀 启动Chatlog健康检查器...');
        console.log(`📊 检查间隔: ${this.config.checkInterval/1000}秒`);
        console.log(`⚠️  故障阈值: ${this.config.alertThreshold}次连续失败`);
        console.log(`📝 日志文件: ${this.config.logFile}`);
        
        // 立即执行一次检查
        this.checkHealth();
        
        // 设置定时检查
        this.timer = setInterval(() => {
            this.checkHealth();
        }, this.config.checkInterval);
        
        console.log('✅ 健康检查器已启动');
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('🛑 健康检查器已停止');
        }
    }

    getStatus() {
        return {
            ...this.state,
            config: this.config
        };
    }
}

// CLI接口
if (require.main === module) {
    const checker = new ChatlogHealthChecker();
    const action = process.argv[2] || 'start';
    
    switch (action) {
        case 'start':
            checker.start();
            // 保持进程运行
            process.on('SIGINT', () => {
                checker.stop();
                process.exit(0);
            });
            break;
        case 'stop':
            checker.stop();
            break;
        case 'status':
            console.log(checker.getStatus());
            break;
        case 'check':
            checker.checkHealth();
            break;
        default:
            console.log('用法: node chatlog-health-checker.js [start|stop|status|check]');
    }
}

module.exports = ChatlogHealthChecker;