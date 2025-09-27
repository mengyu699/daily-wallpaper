/**
 * Chatlog连接诊断工具 - 快速定位和解决"未链接"问题
 * 一键诊断所有可能的连接问题
 */

const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

class ConnectionDiagnostic {
    constructor() {
        this.results = [];
        this.config = {
            port: 5030,
            host: '127.0.0.1',
            timeout: 5000
        };
    }

    async run() {
        console.log('🔍 Chatlog连接诊断工具');
        console.log('='.repeat(50));
        
        const checks = [
            { name: '文件系统检查', fn: this.checkFileSystem },
            { name: '进程状态检查', fn: this.checkProcessStatus },
            { name: '网络端口检查', fn: this.checkNetworkPorts },
            { name: '服务响应检查', fn: this.checkServiceResponse },
            { name: '权限检查', fn: this.checkPermissions },
            { name: '依赖检查', fn: this.checkDependencies },
            { name: '配置检查', fn: this.checkConfiguration }
        ];

        for (const check of checks) {
            console.log(`\n📋 ${check.name}...`);
            try {
                const result = await check.fn.call(this);
                this.results.push({ name: check.name, ...result });
                
                if (result.status === 'PASS') {
                    console.log(`   ✅ ${result.message}`);
                } else if (result.status === 'WARNING') {
                    console.log(`   ⚠️  ${result.message}`);
                } else {
                    console.log(`   ❌ ${result.message}`);
                    if (result.suggestion) {
                        console.log(`      💡 ${result.suggestion}`);
                    }
                }
            } catch (error) {
                this.results.push({
                    name: check.name,
                    status: 'ERROR',
                    message: error.message
                });
                console.log(`   ❌ ${error.message}`);
            }
        }

        this.printSummary();
        this.generateReport();
    }

    async checkFileSystem() {
        const checks = [
            { file: './chatlog', type: 'executable' },
            { file: './package.json', type: 'config' },
            { file: './server.js', type: 'server' }
        ];

        let allExist = true;
        for (const check of checks) {
            if (!fs.existsSync(check.file)) {
                allExist = false;
                break;
            }
        }

        if (allExist) {
            return {
                status: 'PASS',
                message: '所有必需文件都存在'
            };
        } else {
            return {
                status: 'ERROR',
                message: '缺少必需文件',
                suggestion: '请确保chatlog可执行文件和配置文件都在当前目录'
            };
        }
    }

    async checkProcessStatus() {
        return new Promise((resolve) => {
            exec('ps aux | grep -E "(chatlog|node.*server)" | grep -v grep', (error, stdout) => {
                const processes = stdout.trim().split('\n').filter(p => p.length > 0);
                
                const chatlogProcess = processes.find(p => p.includes('chatlog'));
                const nodeProcess = processes.find(p => p.includes('node'));

                if (chatlogProcess && nodeProcess) {
                    resolve({
                        status: 'PASS',
                        message: 'chatlog服务和Web服务都在运行'
                    });
                } else if (chatlogProcess) {
                    resolve({
                        status: 'WARNING',
                        message: '只有chatlog服务在运行，缺少Web服务',
                        suggestion: '运行: node server.js 或 npm start'
                    });
                } else if (nodeProcess) {
                    resolve({
                        status: 'WARNING',
                        message: '只有Web服务在运行，缺少chatlog服务',
                        suggestion: '运行: ./chatlog http-server --port 5030'
                    });
                } else {
                    resolve({
                        status: 'ERROR',
                        message: '没有任何服务在运行',
                        suggestion: '运行一键启动脚本: ./chatlogwebUI-startup.sh'
                    });
                }
            });
        });
    }

    async checkNetworkPorts() {
        const ports = [5030, 3000];
        const results = [];

        for (const port of ports) {
            const isUsed = await this.isPortUsed(port);
            results.push({ port, used: isUsed });
        }

        const usedPorts = results.filter(r => r.used);
        const freePorts = results.filter(r => !r.used);

        if (usedPorts.length === 0) {
            return {
                status: 'ERROR',
                message: '所有端口都空闲，服务未启动',
                suggestion: '启动服务: ./chatlog http-server --port 5030'
            };
        } else if (usedPorts.length === 2) {
            return {
                status: 'PASS',
                message: '所有端口都在使用'
            };
        } else {
            return {
                status: 'WARNING',
                message: `部分端口空闲: ${freePorts.map(p => p.port).join(', ')}`,
                suggestion: '检查服务启动状态'
            };
        }
    }

    async checkServiceResponse() {
        try {
            const isResponsive = await this.testConnection(5030);
            if (isResponsive) {
                return {
                    status: 'PASS',
                    message: 'chatlog服务响应正常'
                };
            } else {
                return {
                    status: 'ERROR',
                    message: 'chatlog服务无响应',
                    suggestion: '重启服务: ./chatlogwebUI-startup.sh restart'
                };
            }
        } catch (error) {
            return {
                status: 'ERROR',
                message: `连接测试失败: ${error.message}`,
                suggestion: '检查服务状态和端口占用'
            };
        }
    }

    async checkPermissions() {
        try {
            fs.accessSync('./chatlog', fs.constants.X_OK);
            return {
                status: 'PASS',
                message: 'chatlog文件有执行权限'
            };
        } catch (error) {
            return {
                status: 'ERROR',
                message: 'chatlog文件没有执行权限',
                suggestion: '运行: chmod +x ./chatlog'
            };
        }
    }

    async checkDependencies() {
        const nodeVersion = await this.getCommandOutput('node --version');
        const npmVersion = await this.getCommandOutput('npm --version');

        if (nodeVersion && npmVersion) {
            return {
                status: 'PASS',
                message: `Node.js: ${nodeVersion}, npm: ${npmVersion}`
            };
        } else {
            return {
                status: 'ERROR',
                message: '缺少Node.js或npm',
                suggestion: '安装Node.js: brew install node'
            };
        }
    }

    async checkConfiguration() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            const serverExists = fs.existsSync('./server.js');

            if (serverExists) {
                return {
                    status: 'PASS',
                    message: '配置文件完整'
                };
            } else {
                return {
                    status: 'WARNING',
                    message: '缺少server.js文件',
                    suggestion: '检查项目文件完整性'
                };
            }
        } catch (error) {
            return {
                status: 'ERROR',
                message: '配置文件读取失败',
                suggestion: '检查package.json是否存在且格式正确'
            };
        }
    }

    async isPortUsed(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, () => {
                server.close();
                resolve(false);
            });
            
            server.on('error', () => {
                resolve(true);
            });
        });
    }

    async testConnection(port) {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/api/v1/session`, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    async getCommandOutput(command) {
        return new Promise((resolve) => {
            exec(command, (error, stdout) => {
                resolve(error ? null : stdout.trim());
            });
        });
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 诊断总结');
        console.log('='.repeat(50));

        const passCount = this.results.filter(r => r.status === 'PASS').length;
        const errorCount = this.results.filter(r => r.status === 'ERROR').length;
        const warningCount = this.results.filter(r => r.status === 'WARNING').length;

        console.log(`✅ 通过: ${passCount}`);
        console.log(`⚠️  警告: ${warningCount}`);
        console.log(`❌ 错误: ${errorCount}`);

        if (errorCount > 0) {
            console.log('\n🔧 修复建议:');
            this.results.filter(r => r.status === 'ERROR').forEach(r => {
                if (r.suggestion) {
                    console.log(`   - ${r.suggestion}`);
                }
            });
        }

        if (errorCount === 0 && warningCount === 0) {
            console.log('\n🎉 所有检查通过，服务运行正常！');
        } else if (errorCount > 0) {
            console.log('\n💡 运行一键修复: ./chatlogwebUI-startup.sh restart');
        }
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            results: this.results,
            summary: {
                total: this.results.length,
                pass: this.results.filter(r => r.status === 'PASS').length,
                warning: this.results.filter(r => r.status === 'WARNING').length,
                error: this.results.filter(r => r.status === 'ERROR').length
            }
        };

        fs.writeFileSync('connection-diagnostic-report.json', JSON.stringify(report, null, 2));
        console.log('\n📋 详细报告已保存: connection-diagnostic-report.json');
    }
}

// CLI接口
if (require.main === module) {
    const diagnostic = new ConnectionDiagnostic();
    
    // 支持快速修复模式
    const mode = process.argv[2];
    
    switch (mode) {
        case 'fix':
            console.log('🔧 快速修复模式');
            const { execSync } = require('child_process');
            try {
                execSync('./chatlogwebUI-startup.sh restart', { stdio: 'inherit' });
            } catch (error) {
                console.log('❌ 快速修复失败，请手动运行诊断');
                diagnostic.run();
            }
            break;
        case 'quick':
            console.log('⚡ 快速检查模式');
            diagnostic.run().then(() => {
                const errors = diagnostic.results.filter(r => r.status === 'ERROR');
                if (errors.length > 0) {
                    console.log('\n🚀 运行一键修复？');
                    console.log('运行: node connection-diagnostic.js fix');
                }
            });
            break;
        default:
            diagnostic.run();
    }
}

module.exports = ConnectionDiagnostic;