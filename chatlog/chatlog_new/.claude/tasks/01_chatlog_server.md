# Chatlog Server – 解密并起 REST API

背景

需要解密本机微信 DB 并通过 chatlog serve 暴露接口。

修改
    1.    scripts/start_chatlog.ts
    •    读取 env WECHAT_DB_PATH
    •    chatlog decrypt wechat "$WECHAT_DB_PATH" --out ./data/wechat.db
    •    chatlog serve --db ./data/wechat.db --port 3030
    2.    package.json 增 "start:chatlog": "ts-node scripts/start_chatlog.ts"

验收
    •    .env.example 含 WECHAT_DB_PATH=</absolute/path>
    •    pnpm run start:chatlog 输出 server running at http://localhost:3030
    •    curl http://localhost:3030/chats 返回 200 JSON
    •    单测 mock chatlog，覆盖率 ≥ 90 %