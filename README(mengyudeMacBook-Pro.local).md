# CLAUDE.md · v0.3 (2025‑07‑15)

> **目的**  
> 为 Claude Code 提供最小可用协作说明书，告诉它 **该做什么、不该做什么、常用指令在哪里**。  
> 全文保持 **≤ 400 行**，每月回顾一次并删除过时内容。

---

## 0 · 术语表
| 关键词 | 含义 |
| ------ | ---- |
| **CC** | Claude Code |
| **PM** | 产品/项目负责人 |
| **PRD** | 产品需求文档 |
| **DSR** | 调试状态报告 |
| **ILR** | 事故与经验记录 |

---

## 1 · 快速参考
### 1.1 常用命令
- `npm run dev` 启动本地开发服务  
- `npm run build` 生成生产环境构建包  
- `npm run test` 执行 Jest 全量测试  
- `npm run lint` 运行 ESLint + Prettier  
- `pytest -q` 运行 Python 单元测试  

### 1.2 代码风格
- **缩进**：2 空格；单行最长 120 字符  
- **导入**：统一使用 ES Module (`import … from`)，**禁止** `require`  
- **命名**：变量/函数用 camelCase；React 组件文件用 PascalCase  
- **Lint**：提交前执行 `npm run lint -- --fix` 自动修复  

### 1.3 仓库协作礼仪
- **分支命名**：`feat/<ticket>`、`fix/<ticket>`、`hotfix/<ticket>`  
- **提交信息**：Conventional Commits 格式，示例 `feat: add login`  
- **PR 流程**：Squash Merge；至少 1 名人工审阅后合并  

### 1.4 工具权限
- **默认允许**：`Read`、`Search`、`Bash(cat, ls)`、`Edit`  
- **需要询问**：`Bash(git commit:*)`、`Bash(rm -rf*)`、任何网络访问  
- **危险跳过权限**：仅可在名为 `cc-safe` 的 Docker 镜像内启用  

---

## 2 · 工作流总览
Clarify → Design → Build & Unit‑Test → Verify & Debug‑Loop → Performance & Observability → UI/UX Review → Release & Scenario‑Test → Improve & Learn  

> 详细步骤见 `docs/workflow.md`

---

## 3 · 项目目录结构
```text
project/
├─ docs/             PRD、设计文档、CLAUDE.md*
├─ src/              业务代码
├─ tests/            单元测试 + 端到端测试
├─ scripts/          构建 / 部署 / perf-test.sh
├─ .claude/commands/ 常用 Slash 命令
│   ├─ fix-lint.md
│   └─ gen-pr.md
├─ logs/             DSR、性能日志
├─ incidents/        ILR
└─ README.md         项目概览
```

---

## 4 · Debug‑Loop 备忘卡
1. **微观定位**（≤ 3 次）：复现 → 假设 → patch → 单测  
2. **视角上浮**：元回顾 → 依赖/环境 → 新假设 → 实验  
3. **二阶诊断**：缺失信息 → 回退/对比运行 → 定位  
4. **外部求助**：输出完整报告 → 提交 Issue / 社区  

---

## 5 · 经验与迭代
1. **日常追加**：在 Claude 会话中输入 `# <内容>`，Claude 会把该行附加到本文件  
2. **月度梳理**：删除过时条目，拆分过长段落，确保全文 ≤ 400 行  

---

维护者：Tim + Claude Code  
最后更新：2025‑07‑15
