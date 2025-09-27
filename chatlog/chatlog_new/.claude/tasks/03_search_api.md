# 搜索 API

背景

前端需要按关键词、时间段、联系人过滤聊天记录。

修改
    1.    /server/routes/search.ts
    •    GET /api/search?query=&from=&to=&chatId= 返回分页结果
    2.    /webapp/src/hooks/useSearch.ts
    •    SWR 调用
    3.    Dashboard 注入结果列表

验收
    •    单元测试：关键词、日期边界、空结果
    •    E2E：输入"早上好" → 返回含该词消息
    •    覆盖率 ≥ 90 %