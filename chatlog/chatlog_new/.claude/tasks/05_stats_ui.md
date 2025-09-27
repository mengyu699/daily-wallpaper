# 统计图表 UI

背景
展示活跃度折线图、关键词云。

修改
    1.    /server/routes/stats.ts
    •    GET /api/stats/daily?from=&to=
    2.    /webapp/src/pages/Stats.tsx
    •    折线图
    3.    /webapp/src/components/WordCloud.tsx
    •    20 词关键词云

验收
    •    横轴缺失日期补 0
    •    选择时间范围 → 图表刷新