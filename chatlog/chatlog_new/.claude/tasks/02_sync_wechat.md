# 增量同步脚本 – 写入 MongoDB

背景

持续把新消息写进 MongoDB。

修改
    1.    scripts/sync_wechat.ts
    •    入参 lastSyncTime（ISO，默认 0）
    •    GET http://localhost:3030/messages?since=
    •    insertMany 写入 mongodb://localhost:27017/wechat.messages
    •    返回最新 syncTime
    2.    node-cron 在 /server/cron.ts 每 10 min 调用
    3.    package.json 增 "sync:wechat": "ts-node scripts/sync_wechat.ts"

验收
    •    跑 pnpm run sync:wechat 控制台显示插入条数 > 0
    •    集合 messages 有唯一索引 { msgId: 1 }
    •    单测 stub 网络 & Mongo，覆盖率 ≥ 90 %