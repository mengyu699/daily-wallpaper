#!/usr/bin/env python3
"""
关键代码提取器 v1.0
用途：从项目中提取关键代码片段，生成AI可用的代码分析文件
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime
import argparse

class CodeExtractor:
    def __init__(self, project_path):
        self.project_path = Path(project_path)
        self.results = {
            'metadata': {
                'extracted_at': datetime.now().isoformat(),
                'project_path': str(self.project_path),
                'total_files': 0,
                'extracted_files': 0
            },
            'files': {}
        }
    
    def extract_key_files(self):
        """提取关键文件"""
        key_patterns = [
            r'(app|server|index|main)\.(js|ts|py)$',
            r'config.*\.(js|ts|json)$',
            r'package\.json$',
            r'requirements\.txt$',
            r'\.env\.example$',
            r'README\.md$'
        ]
        
        for pattern in key_patterns:
            self._extract_by_pattern(pattern)
    
    def extract_by_directory(self, directories):
        """按目录提取"""
        for directory in directories:
            dir_path = self.project_path / directory
            if dir_path.exists():
                self._extract_directory(dir_path)
    
    def _extract_by_pattern(self, pattern):
        """按模式提取文件"""
        for root, dirs, files in os.walk(self.project_path):
            # 跳过常见的无关目录
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', 'build', '__pycache__']]
            
            for file in files:
                if re.search(pattern, file):
                    file_path = Path(root) / file
                    self._extract_file(file_path)
    
    def _extract_directory(self, dir_path):
        """提取目录下的所有相关文件"""
        for file_path in dir_path.rglob('*.js'):
            if file_path.is_file():
                self._extract_file(file_path)
        for file_path in dir_path.rglob('*.ts'):
            if file_path.is_file():
                self._extract_file(file_path)
        for file_path in dir_path.rglob('*.py'):
            if file_path.is_file():
                self._extract_file(file_path)
    
    def _extract_file(self, file_path):
        """提取单个文件"""
        try:
            relative_path = file_path.relative_to(self.project_path)
            
            # 检查文件大小，避免过大的文件
            if file_path.stat().st_size > 100 * 1024:  # 100KB
                self.results['files'][str(relative_path)] = {
                    'type': 'large_file',
                    'size': file_path.stat().st_size,
                    'message': '文件过大，请手动检查'
                }
                return
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            # 分析文件内容
            analysis = self._analyze_content(content, file_path.suffix)
            
            self.results['files'][str(relative_path)] = {
                'type': 'code_file',
                'size': len(content),
                'lines': len(content.splitlines()),
                'content': content,
                'analysis': analysis
            }
            
            self.results['metadata']['extracted_files'] += 1
            
        except Exception as e:
            self.results['files'][str(relative_path)] = {
                'type': 'error',
                'error': str(e)
            }
    
    def _analyze_content(self, content, file_ext):
        """分析文件内容"""
        analysis = {
            'security_issues': [],
            'quality_issues': [],
            'todos': [],
            'dependencies': []
        }
        
        # 安全问题检查
        security_patterns = [
            (r'api.*key.*[=:].*["\'][^"\']*["\']', '可能的API密钥硬编码'),
            (r'password.*[=:].*["\'][^"\']*["\']', '可能的密码硬编码'),
            (r'secret.*[=:].*["\'][^"\']*["\']', '可能的密钥硬编码'),
            (r'SELECT.*\+', '可能的SQL注入风险'),
            (r'eval\s*\(', '危险的eval调用'),
            (r'innerHTML\s*=', '可能的XSS风险')
        ]
        
        for pattern, description in security_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                analysis['security_issues'].append({
                    'type': description,
                    'matches': len(matches),
                    'examples': matches[:3]  # 只显示前3个例子
                })
        
        # 质量问题检查
        quality_patterns = [
            (r'console\.log\s*\(', '调试日志未清理'),
            (r'debugger\s*;', '调试语句未清理'),
            (r'TODO|FIXME|HACK|XXX', '待办事项标记')
        ]
        
        for pattern, description in quality_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                analysis['quality_issues'].append({
                    'type': description,
                    'count': len(matches)
                })
        
        # TODO标记提取
        todo_matches = re.findall(r'(TODO|FIXME|HACK|XXX):?\s*(.+)', content, re.IGNORECASE)
        analysis['todos'] = [{'type': match[0], 'content': match[1].strip()} for match in todo_matches]
        
        # 依赖分析（针对package.json）
        if file_ext == '.json' and 'package.json' in content:
            try:
                package_data = json.loads(content)
                if 'dependencies' in package_data:
                    analysis['dependencies'] = list(package_data['dependencies'].keys())
            except:
                pass
        
        return analysis
    
    def generate_ai_prompt(self, output_file):
        """生成AI分析提示"""
        prompt = f"""# 开源项目代码分析请求

## 项目信息
- 提取时间: {self.results['metadata']['extracted_at']}
- 项目路径: {self.results['metadata']['project_path']}
- 已提取文件: {self.results['metadata']['extracted_files']}

## 请帮我分析以下代码并提供改进建议：

### 分析要求：
1. **安全性评估**: 识别潜在的安全漏洞和风险
2. **代码质量**: 评估代码结构、可维护性和最佳实践
3. **架构分析**: 理解整体架构设计和模块化程度
4. **改进建议**: 提供具体的、可操作的改进建议

### 关键问题：
1. 是否有硬编码的敏感信息？
2. 错误处理是否完善？
3. 代码是否遵循最佳实践？
4. 架构是否合理和可扩展？

---

"""
        
        for file_path, file_info in self.results['files'].items():
            if file_info['type'] == 'code_file':
                prompt += f"\n## 文件: {file_path}\n"
                prompt += f"- 大小: {file_info['size']} 字节\n"
                prompt += f"- 行数: {file_info['lines']}\n"
                
                # 添加分析结果
                if file_info['analysis']['security_issues']:
                    prompt += "\n### 🚨 发现的安全问题:\n"
                    for issue in file_info['analysis']['security_issues']:
                        prompt += f"- {issue['type']}: {issue['matches']} 处\n"
                
                if file_info['analysis']['quality_issues']:
                    prompt += "\n### ⚠️ 代码质量问题:\n"
                    for issue in file_info['analysis']['quality_issues']:
                        prompt += f"- {issue['type']}: {issue['count']} 处\n"
                
                if file_info['analysis']['todos']:
                    prompt += "\n### 📝 待办事项:\n"
                    for todo in file_info['analysis']['todos']:
                        prompt += f"- {todo['type']}: {todo['content']}\n"
                
                prompt += "\n### 📄 代码内容:\n"
                prompt += "```" + file_path.split('.')[-1] + "\n"
                prompt += file_info['content']
                prompt += "\n```\n"
                prompt += "\n---\n"
        
        prompt += """

## 请提供以下格式的分析报告：

### 1. 🔴 CRITICAL 问题（必须立即修复）
- 问题描述
- 影响范围
- 修复建议

### 2. 🟡 MAJOR 问题（重要改进）
- 问题描述
- 改进建议

### 3. 🟢 MINOR 问题（优化建议）
- 优化点
- 最佳实践建议

### 4. 📋 重构计划
- 分阶段的改进计划
- 优先级排序
- 实施建议

请为每个问题提供具体的代码示例和解决方案。
"""
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        return prompt

def main():
    parser = argparse.ArgumentParser(description='提取项目关键代码用于AI分析')
    parser.add_argument('project_path', help='项目路径')
    parser.add_argument('--output', '-o', default='ai-analysis-prompt.md', help='输出文件名')
    parser.add_argument('--dirs', '-d', nargs='+', help='额外要分析的目录')
    
    args = parser.parse_args()
    
    extractor = CodeExtractor(args.project_path)
    
    print("🔍 正在提取关键文件...")
    extractor.extract_key_files()
    
    if args.dirs:
        print(f"📁 正在分析指定目录: {', '.join(args.dirs)}")
        extractor.extract_by_directory(args.dirs)
    
    print("📝 正在生成AI分析提示...")
    extractor.generate_ai_prompt(args.output)
    
    print(f"✅ 完成！已生成 {extractor.results['metadata']['extracted_files']} 个文件的分析")
    print(f"📄 AI分析提示已保存到: {args.output}")
    
    # 保存原始数据
    json_output = args.output.replace('.md', '.json')
    with open(json_output, 'w', encoding='utf-8') as f:
        json.dump(extractor.results, f, indent=2, ensure_ascii=False)
    print(f"📊 原始数据已保存到: {json_output}")

if __name__ == '__main__':
    main()