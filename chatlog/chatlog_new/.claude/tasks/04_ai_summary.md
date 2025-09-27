# AI 摘要

背景

对选中消息生成 TL;DR。

修改
    1.    /server/services/ai.ts
    •    summary(texts: string[]): Promise<string>
    2.    /server/routes/ai.ts
    •    POST /api/ai/summary body { ids: string[] }
    3.    前端抽屉展示

验收
    •    单测 mock AI 调用
    •    前端 3 秒内出现摘要
    •    不泄漏 API Key