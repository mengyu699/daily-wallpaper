#!/usr/bin/env node

/**
 * Safe MCP Server with Output Limiting
 * 避免长输出导致的字符串长度错误
 */

const { createServer } = require('http');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const MAX_OUTPUT_LENGTH = 8192; // 8KB limit per output
const ALLOWED_DIRECTORIES = ['/opt/wewe-rss'];
const PORT = process.env.MCP_PORT || 3000;

class SafeMCPServer {
    constructor() {
        this.server = null;
    }

    // 安全执行命令，限制输出长度
    async executeCommand(command, cwd = '/opt/wewe-rss') {
        return new Promise((resolve) => {
            const process = spawn('bash', ['-c', command], { 
                cwd,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            let outputLength = 0;
            
            process.stdout.on('data', (data) => {
                const chunk = data.toString();
                outputLength += chunk.length;
                
                if (outputLength > MAX_OUTPUT_LENGTH) {
                    stdout += chunk.substring(0, MAX_OUTPUT_LENGTH - stdout.length);
                    stdout += '\n... [输出被截断，避免字符串长度错误] ...';
                    process.kill();
                } else {
                    stdout += chunk;
                }
            });
            
            process.stderr.on('data', (data) => {
                const chunk = data.toString();
                if (outputLength + chunk.length < MAX_OUTPUT_LENGTH) {
                    stderr += chunk;
                }
            });
            
            process.on('close', (code) => {
                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    code,
                    truncated: outputLength > MAX_OUTPUT_LENGTH
                });
            });
            
            // 30秒超时
            setTimeout(() => {
                process.kill();
                resolve({
                    stdout: stdout.trim(),
                    stderr: 'Command timeout',
                    code: 124,
                    truncated: true
                });
            }, 30000);
        });
    }

    // 安全读取文件，支持分页
    async readFile(filePath, start = 0, length = MAX_OUTPUT_LENGTH) {
        try {
            // 安全检查路径
            const resolvedPath = path.resolve(filePath);
            const isAllowed = ALLOWED_DIRECTORIES.some(dir => 
                resolvedPath.startsWith(path.resolve(dir))
            );
            
            if (!isAllowed) {
                throw new Error('Access denied: Path not in allowed directories');
            }
            
            const stats = await fs.stat(resolvedPath);
            if (stats.size > MAX_OUTPUT_LENGTH && start === 0) {
                // 大文件，只读取前面部分
                const buffer = Buffer.alloc(Math.min(MAX_OUTPUT_LENGTH, stats.size));
                const fd = await fs.open(resolvedPath, 'r');
                await fd.read(buffer, 0, buffer.length, start);
                await fd.close();
                
                return {
                    content: buffer.toString('utf8'),
                    truncated: true,
                    totalSize: stats.size,
                    message: `文件太大 (${stats.size} bytes)，只显示前 ${buffer.length} bytes`
                };
            } else {
                const content = await fs.readFile(resolvedPath, 'utf8');
                return {
                    content: content.substring(start, start + length),
                    truncated: false,
                    totalSize: content.length
                };
            }
        } catch (error) {
            throw new Error(`读取文件失败: ${error.message}`);
        }
    }

    // 安全写入文件
    async writeFile(filePath, content) {
        try {
            const resolvedPath = path.resolve(filePath);
            const isAllowed = ALLOWED_DIRECTORIES.some(dir => 
                resolvedPath.startsWith(path.resolve(dir))
            );
            
            if (!isAllowed) {
                throw new Error('Access denied: Path not in allowed directories');
            }
            
            await fs.writeFile(resolvedPath, content, 'utf8');
            return { success: true, message: `文件已写入: ${filePath}` };
        } catch (error) {
            throw new Error(`写入文件失败: ${error.message}`);
        }
    }

    // 启动HTTP服务器
    start() {
        this.server = createServer(async (req, res) => {
            // 设置CORS头
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', 'application/json');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            try {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const request = JSON.parse(body || '{}');
                        const response = await this.handleRequest(request);
                        
                        res.writeHead(200);
                        res.end(JSON.stringify(response));
                    } catch (error) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ 
                            error: error.message,
                            type: 'request_error' 
                        }));
                    }
                });
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ 
                    error: error.message,
                    type: 'server_error' 
                }));
            }
        });

        this.server.listen(PORT, () => {
            console.log(`Safe MCP Server running on port ${PORT}`);
            console.log(`Allowed directories: ${ALLOWED_DIRECTORIES.join(', ')}`);
            console.log(`Max output length: ${MAX_OUTPUT_LENGTH} bytes`);
        });
    }

    async handleRequest(request) {
        const { action, params = {} } = request;

        switch (action) {
            case 'execute':
                return await this.executeCommand(params.command, params.cwd);
            
            case 'read_file':
                return await this.readFile(params.path, params.start, params.length);
            
            case 'write_file':
                return await this.writeFile(params.path, params.content);
            
            case 'list_directory':
                const result = await this.executeCommand(`ls -la "${params.path || '/opt/wewe-rss'}"`);
                return result;
            
            case 'status':
                return {
                    status: 'running',
                    allowed_directories: ALLOWED_DIRECTORIES,
                    max_output_length: MAX_OUTPUT_LENGTH,
                    port: PORT
                };
            
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
}

// 启动服务器
if (require.main === module) {
    const server = new SafeMCPServer();
    server.start();
    
    // 优雅关闭
    process.on('SIGTERM', () => {
        console.log('Shutting down Safe MCP Server...');
        if (server.server) {
            server.server.close();
        }
        process.exit(0);
    });
}

module.exports = SafeMCPServer;