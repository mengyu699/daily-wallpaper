禁区（AI 请勿修改）
    •    /webapp/routes/**
    •    .eslintrc.cjs、prettier.config.js
    •    任意 *.png / *.svg 资源文件

代码规范
    •    TypeScript 5.x（严格模式）
    •    commit message 使用 Conventional Commits
    •    所有新模块必须带 *.test.ts（Vitest）

依赖锁定

chatlog >= 0.25.0
mongodb ^6
express ^4
vitest ^1
react ^18
antd ^5

测试要求
    •    pnpm test 无错误
    •    覆盖率 ≥ 90 %
    •    E2E：pnpm test:e2e 启动后端 & 前端后跑 Playwright

输出格式
    •    补丁使用 UNIX 行尾
    •    新建脚本以 #!/usr/bin/env ts-node 开头
    •    补丁末尾附 ## 完成 注释