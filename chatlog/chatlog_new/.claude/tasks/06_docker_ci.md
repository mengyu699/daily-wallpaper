# Docker & CI/CD

背景

一键交付，并在 GitHub Actions 上保证质量门禁。

修改
    1.    Dockerfile.multi
    •    stage1 build 前端
    •    stage2 安装 deps & copy server
    2.    docker-compose.yml
    •    services: mongo, chatlog, web
    3.    .github/workflows/ci.yml
    •    steps: pnpm i → pnpm test → pnpm build

验收
    •    docker compose up -d 后访问 http://localhost:5173
    •    CI fail if test fail or cov < 90 %