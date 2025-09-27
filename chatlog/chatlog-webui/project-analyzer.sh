#!/bin/bash

# 项目分析助手脚本 v1.0
# 用途：自动分析开源项目并生成AI可用的项目报告

set -e

PROJECT_DIR=${1:-.}
OUTPUT_FILE="project-analysis-$(date +%Y%m%d-%H%M%S).md"

echo "🔍 正在分析项目: $PROJECT_DIR"
echo "📝 输出文件: $OUTPUT_FILE"

# 创建分析报告
cat > "$OUTPUT_FILE" << 'EOF'
# 项目自动化分析报告

生成时间: $(date)
项目路径: $(pwd)

## 1. 项目基本信息
EOF

# 项目基本信息
echo "" >> "$OUTPUT_FILE"
echo "### 项目结构概览" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
tree -L 3 -I 'node_modules|.git|dist|build' "$PROJECT_DIR" | head -30 >> "$OUTPUT_FILE" 2>/dev/null || \
find "$PROJECT_DIR" -type f -name "*.js" -o -name "*.ts" -o -name "*.py" | head -20 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

# 文件统计
echo "" >> "$OUTPUT_FILE"
echo "### 文件统计" >> "$OUTPUT_FILE"
echo "- JavaScript/TypeScript文件: $(find "$PROJECT_DIR" -name "*.js" -o -name "*.ts" | wc -l)" >> "$OUTPUT_FILE"
echo "- Python文件: $(find "$PROJECT_DIR" -name "*.py" | wc -l)" >> "$OUTPUT_FILE"
echo "- 配置文件: $(find "$PROJECT_DIR" -name "*.json" -o -name "*.yml" -o -name "*.yaml" | wc -l)" >> "$OUTPUT_FILE"
echo "- 总代码行数: $(find "$PROJECT_DIR" -name "*.js" -o -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "无法计算")" >> "$OUTPUT_FILE"

# 依赖分析
if [ -f "$PROJECT_DIR/package.json" ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "### Node.js 依赖分析" >> "$OUTPUT_FILE"
    echo '```json' >> "$OUTPUT_FILE"
    cat "$PROJECT_DIR/package.json" | jq '.dependencies, .devDependencies' 2>/dev/null >> "$OUTPUT_FILE" || \
    echo "依赖解析失败，请手动检查package.json" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
fi

# Git信息
if [ -d "$PROJECT_DIR/.git" ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "### Git 提交历史" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    cd "$PROJECT_DIR" && git log --oneline -10 >> "../$OUTPUT_FILE" 2>/dev/null || echo "无法获取Git历史" >> "../$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
fi

# 关键文件识别
echo "" >> "$OUTPUT_FILE"
echo "## 2. 关键文件识别" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "### 入口文件" >> "$OUTPUT_FILE"
find "$PROJECT_DIR" -maxdepth 2 -name "app.js" -o -name "server.js" -o -name "index.js" -o -name "main.py" | while read file; do
    echo "- \`$file\`" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "### 配置文件" >> "$OUTPUT_FILE"
find "$PROJECT_DIR" -name "config" -type d -exec find {} -name "*.js" \; | while read file; do
    echo "- \`$file\`" >> "$OUTPUT_FILE"
done

# 安全扫描
echo "" >> "$OUTPUT_FILE"
echo "## 3. 安全问题初步扫描" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "### 潜在的硬编码敏感信息" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
grep -r -n "api.*key\|password\|secret\|token" --include="*.js" --include="*.ts" "$PROJECT_DIR" | head -10 >> "$OUTPUT_FILE" 2>/dev/null || echo "未发现明显的硬编码敏感信息" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "### SQL注入风险点" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
grep -r -n "SELECT.*+\|INSERT.*+\|UPDATE.*+" --include="*.js" --include="*.ts" "$PROJECT_DIR" | head -5 >> "$OUTPUT_FILE" 2>/dev/null || echo "未发现明显的SQL注入风险" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

# 代码质量问题
echo "" >> "$OUTPUT_FILE"
echo "## 4. 代码质量问题" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "### TODO/FIXME标记" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
grep -r -n "TODO\|FIXME\|HACK\|XXX" --include="*.js" --include="*.ts" --include="*.py" "$PROJECT_DIR" | head -10 >> "$OUTPUT_FILE" 2>/dev/null || echo "未发现TODO/FIXME标记" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

# 建议的分析步骤
cat >> "$OUTPUT_FILE" << 'EOF'

## 5. 建议的AI分析步骤

基于以上自动化分析，建议按以下顺序向AI提供代码：

### 第一轮：架构理解
1. 提供入口文件代码
2. 提供主要配置文件
3. 要求AI分析整体架构

### 第二轮：核心功能分析
1. 提供核心业务逻辑文件
2. 提供数据处理相关代码
3. 要求AI识别功能模块

### 第三轮：问题诊断
1. 提供发现问题的具体代码段
2. 要求AI进行安全和质量分析
3. 获取改进建议

### 第四轮：优化实施
1. 基于AI建议进行代码重构
2. 实施安全加固措施
3. 进行测试验证

## 6. AI对话模板

可以使用以下模板向AI发起分析请求：

```markdown
# 开源项目代码分析请求

我需要分析一个开源项目，以下是自动化分析报告：

[粘贴本报告内容]

基于这些信息，请帮我：
1. 评估项目的整体代码质量
2. 识别主要的安全和架构问题  
3. 提供具体的改进建议
4. 制定分步骤的重构计划

我将会分批次提供具体的代码文件，请先基于这个概览给出初步建议。
```

EOF

echo "✅ 项目分析完成！"
echo "📄 分析报告已保存到: $OUTPUT_FILE"
echo ""
echo "🤖 下一步：将生成的报告提供给AI进行详细分析"

# 如果有jq，尝试生成JSON格式的结构化数据
if command -v jq >/dev/null; then
    JSON_FILE="project-data-$(date +%Y%m%d-%H%M%S).json"
    cat > "$JSON_FILE" << EOF
{
  "project": {
    "path": "$(pwd)",
    "analyzedAt": "$(date -Iseconds)",
    "files": {
      "javascript": $(find "$PROJECT_DIR" -name "*.js" | wc -l),
      "typescript": $(find "$PROJECT_DIR" -name "*.ts" | wc -l),
      "python": $(find "$PROJECT_DIR" -name "*.py" | wc -l)
    },
    "entryPoints": [
      $(find "$PROJECT_DIR" -maxdepth 2 -name "app.js" -o -name "server.js" -o -name "index.js" | sed 's/.*/"&"/' | paste -sd,)
    ],
    "hasPackageJson": $([ -f "$PROJECT_DIR/package.json" ] && echo "true" || echo "false"),
    "hasGit": $([ -d "$PROJECT_DIR/.git" ] && echo "true" || echo "false")
  }
}
EOF
    echo "📊 结构化数据已保存到: $JSON_FILE"
fi