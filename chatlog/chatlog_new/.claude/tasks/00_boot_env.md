# Boot Env – 环境自检

背景

确保依赖安装成功，项目能跑空白前端。

修改
    •    在根目录添加 check-env.ts：
    1.    检查 Node 版本 ≥ 18
    2.    检查 pnpm 是否安装
    3.    输出 "env ok"
    •    package.json 增 "check:env": "ts-node check-env.ts"

验收
    •    pnpm run check:env 输出 "env ok"
    •    pnpm dev 能启动前端（空白页 200）