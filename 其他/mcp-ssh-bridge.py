#!/usr/bin/env python3
"""
MCP SSH Bridge - 通过SSH连接提供MCP服务
允许Claude Code通过SSH远程控制服务器
"""
import json
import subprocess
import sys
import asyncio
from typing import Any, Dict, List

class MCPSSHBridge:
    def __init__(self, host: str, user: str = "root"):
        self.host = host
        self.user = user
        
    def ssh_command(self, command: str) -> str:
        """通过SSH执行命令"""
        try:
            result = subprocess.run(
                ["ssh", f"{self.user}@{self.host}", command],
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return "Command timeout"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def read_file(self, path: str) -> str:
        """读取远程文件"""
        command = f"cat {path}"
        return self.ssh_command(command)
    
    def write_file(self, path: str, content: str) -> str:
        """写入远程文件"""
        # 使用here-doc避免引号问题
        command = f"""cat > {path} << 'EOF'
{content}
EOF"""
        return self.ssh_command(command)
    
    def list_directory(self, path: str) -> str:
        """列出目录内容"""
        command = f"ls -la {path}"
        return self.ssh_command(command)
    
    def execute_command(self, command: str) -> str:
        """执行任意命令"""
        return self.ssh_command(command)

def main():
    if len(sys.argv) != 2:
        print("Usage: mcp-ssh-bridge.py <host>")
        sys.exit(1)
    
    host = sys.argv[1]
    bridge = MCPSSHBridge(host)
    
    print(f"MCP SSH Bridge connected to {host}")
    print("Available commands:")
    print("- read <path>")
    print("- write <path> <content>")
    print("- ls <path>")
    print("- exec <command>")
    print("- quit")
    
    while True:
        try:
            line = input("> ").strip()
            if not line:
                continue
            
            parts = line.split(" ", 2)
            cmd = parts[0]
            
            if cmd == "quit":
                break
            elif cmd == "read" and len(parts) >= 2:
                result = bridge.read_file(parts[1])
                print(result)
            elif cmd == "write" and len(parts) >= 3:
                result = bridge.write_file(parts[1], parts[2])
                print(result if result else "File written successfully")
            elif cmd == "ls" and len(parts) >= 2:
                result = bridge.list_directory(parts[1])
                print(result)
            elif cmd == "exec" and len(parts) >= 2:
                result = bridge.execute_command(" ".join(parts[1:]))
                print(result)
            else:
                print("Invalid command")
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()