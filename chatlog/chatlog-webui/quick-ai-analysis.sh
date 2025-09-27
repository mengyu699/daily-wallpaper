#!/bin/bash

# 一键式AI分析启动器 v1.0
# 用途：一键生成项目分析报告，准备AI分析材料

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_DIR=${1:-.}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_DIR="ai-analysis-$TIMESTAMP"

echo -e "${BLUE}🚀 AI分析启动器 v1.0${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "项目路径: $PROJECT_DIR"
echo -e "输出目录: $OUTPUT_DIR"
echo

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 步骤1：项目概览分析
echo -e "${YELLOW}📊 步骤1: 生成项目概览分析...${NC}"
if [ -f "./project-analyzer.sh" ]; then
    ./project-analyzer.sh "$PROJECT_DIR" > "$OUTPUT_DIR/project-overview.log" 2>&1
    mv project-analysis-*.md "$OUTPUT_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✅ 项目概览分析完成${NC}"
else
    echo -e "${RED}❌ 未找到 project-analyzer.sh，跳过概览分析${NC}"
fi

# 步骤2：关键代码提取
echo -e "${YELLOW}📄 步骤2: 提取关键代码...${NC}"
if command -v python3 >/dev/null && [ -f "./code-extractor.py" ]; then
    cd "$PROJECT_DIR"
    python3 ../code-extractor.py . -o "../$OUTPUT_DIR/ai-analysis-prompt.md" --dirs config routes utils services > "../$OUTPUT_DIR/code-extraction.log" 2>&1
    mv ai-analysis-prompt.json "../$OUTPUT_DIR/" 2>/dev/null || true
    cd - > /dev/null
    echo -e "${GREEN}✅ 关键代码提取完成${NC}"
else
    echo -e "${RED}❌ 未找到 Python3 或 code-extractor.py，跳过代码提取${NC}"
fi

# 步骤3：安全扫描
echo -e "${YELLOW}🔒 步骤3: 安全问题扫描...${NC}"
cd "$PROJECT_DIR"
{
    echo "# 安全扫描报告"
    echo "生成时间: $(date)"
    echo
    echo "## 硬编码敏感信息检查"
    echo '```'
    grep -r -n "api.*key\|password\|secret\|token" --include="*.js" --include="*.ts" --include="*.py" . | head -20 || echo "未发现明显问题"
    echo '```'
    echo
    echo "## SQL注入风险检查"
    echo '```'
    grep -r -n "SELECT.*+\|INSERT.*+\|UPDATE.*+" --include="*.js" --include="*.ts" . | head -10 || echo "未发现明显问题"
    echo '```'
    echo
    echo "## XSS风险检查"
    echo '```'
    grep -r -n "innerHTML\|eval\|document.write" --include="*.js" --include="*.ts" . | head -10 || echo "未发现明显问题"
    echo '```'
} > "../$OUTPUT_DIR/security-scan.md"
cd - > /dev/null
echo -e "${GREEN}✅ 安全扫描完成${NC}"

# 步骤4：依赖分析
echo -e "${YELLOW}📦 步骤4: 依赖分析...${NC}"
cd "$PROJECT_DIR"
{
    echo "# 依赖分析报告"
    echo "生成时间: $(date)"
    echo
    
    if [ -f "package.json" ]; then
        echo "## Node.js 依赖"
        echo "### 生产依赖"
        echo '```json'
        cat package.json | jq '.dependencies' 2>/dev/null || echo "JSON解析失败"
        echo '```'
        echo
        echo "### 开发依赖"
        echo '```json'
        cat package.json | jq '.devDependencies' 2>/dev/null || echo "JSON解析失败"
        echo '```'
        echo
        
        if command -v npm >/dev/null; then
            echo "## npm audit 结果"
            echo '```'
            npm audit --audit-level=moderate 2>/dev/null || echo "npm audit 执行失败"
            echo '```'
        fi
    fi
    
    if [ -f "requirements.txt" ]; then
        echo "## Python 依赖"
        echo '```'
        cat requirements.txt
        echo '```'
    fi
} > "../$OUTPUT_DIR/dependency-analysis.md"
cd - > /dev/null
echo -e "${GREEN}✅ 依赖分析完成${NC}"

# 步骤5：生成AI对话模板
echo -e "${YELLOW}💬 步骤5: 生成AI对话模板...${NC}"
cat > "$OUTPUT_DIR/ai-conversation-template.md" << 'EOF'
# AI项目分析对话模板

## 阶段1：初步分析
```markdown
我需要对一个开源项目进行全面的代码质量和安全性分析。

项目概况：
[粘贴 project-overview.md 的内容]

请基于这些信息，帮我：
1. 评估项目的整体架构质量
2. 识别主要的技术债务
3. 判断项目的成熟度和可维护性
4. 提供初步的改进建议

我会在后续对话中提供具体的代码文件。
```

## 阶段2：详细代码分析
```markdown
基于之前的初步分析，现在我提供项目的详细代码：

[粘贴 ai-analysis-prompt.md 的内容]

请进行深度分析，特别关注：
1. 🔴 安全漏洞（硬编码密钥、注入攻击等）
2. 🟡 架构问题（耦合度、可扩展性等）
3. 🟢 代码质量（最佳实践、可维护性等）
4. 📋 优化建议（性能、结构改进等）

请为每个问题提供具体的解决方案和代码示例。
```

## 阶段3：安全专项分析
```markdown
我特别关注项目的安全性，以下是安全扫描报告：

[粘贴 security-scan.md 的内容]

请详细分析：
1. 每个安全问题的风险等级
2. 具体的利用场景和影响
3. 详细的修复方案和代码示例
4. 预防类似问题的最佳实践

请优先处理高风险问题。
```

## 阶段4：依赖和部署分析
```markdown
项目的依赖分析如下：

[粘贴 dependency-analysis.md 的内容]

请分析：
1. 依赖的安全性和稳定性
2. 过时或有漏洞的依赖包
3. 依赖优化建议
4. 生产环境部署的注意事项

请提供具体的升级和替换建议。
```

## 阶段5：重构方案制定
```markdown
基于之前的所有分析，请制定一个详细的项目重构方案：

要求：
1. 分阶段的重构计划（优先级排序）
2. 每个阶段的具体任务和预期结果
3. 风险评估和缓解措施
4. 测试和验证策略

请提供可执行的、具体的重构路线图。
```

## 使用说明
1. 按阶段顺序与AI对话
2. 每个阶段结束后，根据AI的反馈调整下一阶段的问题
3. 保存AI的分析结果，用于后续的具体实施
4. 对关键问题可以开启新的对话进行深入讨论
EOF

echo -e "${GREEN}✅ AI对话模板生成完成${NC}"

# 步骤6：生成执行总结
echo -e "${YELLOW}📋 步骤6: 生成执行总结...${NC}"
cat > "$OUTPUT_DIR/README.md" << EOF
# AI项目分析材料包

生成时间: $(date)
项目路径: $PROJECT_DIR

## 📁 文件说明

### 分析报告
- \`project-analysis-*.md\` - 项目概览和基本信息
- \`ai-analysis-prompt.md\` - 详细的代码分析请求（可直接复制给AI）
- \`security-scan.md\` - 安全问题扫描报告
- \`dependency-analysis.md\` - 依赖分析报告

### 对话模板
- \`ai-conversation-template.md\` - 与AI对话的标准模板

### 原始数据
- \`ai-analysis-prompt.json\` - 结构化的项目数据
- \`*.log\` - 执行日志

## 🚀 使用步骤

1. **开始分析**: 复制 \`ai-analysis-prompt.md\` 的内容到AI对话中
2. **按阶段进行**: 使用 \`ai-conversation-template.md\` 中的模板
3. **重点关注**: 查看 \`security-scan.md\` 中的安全问题
4. **依赖管理**: 参考 \`dependency-analysis.md\` 进行依赖优化

## 📊 项目统计

- 分析文件数: $(find "$PROJECT_DIR" -name "*.js" -o -name "*.ts" -o -name "*.py" | wc -l)
- 项目总代码行数: $(find "$PROJECT_DIR" -name "*.js" -o -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "无法计算")
- 配置文件数: $(find "$PROJECT_DIR" -name "*.json" -o -name "*.yml" -o -name "*.yaml" | wc -l)

## ⚠️ 注意事项

1. 请确保敏感信息已被移除或脱敏
2. 大型文件可能需要手动分割后提供给AI
3. 建议分批次进行分析，避免一次性提供过多内容
4. 保存AI的分析结果，用于后续的具体实施
EOF

echo -e "${GREEN}✅ 执行总结生成完成${NC}"

# 完成提示
echo
echo -e "${BLUE}🎉 分析材料准备完成！${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "📁 输出目录: $OUTPUT_DIR"
echo -e "📄 主要文件:"
echo -e "  - ai-analysis-prompt.md (复制此文件内容给AI)"
echo -e "  - ai-conversation-template.md (对话模板)"
echo -e "  - security-scan.md (安全问题)"
echo -e "  - README.md (使用说明)"
echo
echo -e "${GREEN}🚀 下一步：${NC}"
echo -e "1. 查看 $OUTPUT_DIR/README.md 了解使用方法"
echo -e "2. 复制 $OUTPUT_DIR/ai-analysis-prompt.md 的内容到AI对话中"
echo -e "3. 使用 $OUTPUT_DIR/ai-conversation-template.md 中的模板进行深度分析"
echo

# 自动打开结果目录（如果支持）
if command -v open >/dev/null; then
    echo -e "${YELLOW}💡 正在打开结果目录...${NC}"
    open "$OUTPUT_DIR"
elif command -v xdg-open >/dev/null; then
    echo -e "${YELLOW}💡 正在打开结果目录...${NC}"
    xdg-open "$OUTPUT_DIR"
fi