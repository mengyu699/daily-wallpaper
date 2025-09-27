#!/usr/bin/env python3
"""
飞书表格真实数据提取器
通过自动滚动截图来获取全部数据
"""

import time
import os

def create_scroll_script():
    """创建滚动并截图的脚本"""

    script = """
// 滚动到表格底部以获取所有数据
async function scrollAndCapture() {
    const results = [];
    const container = document.querySelector('.sheet-container, [role="grid"], canvas')?.parentElement;

    if (!container) {
        return "未找到表格容器";
    }

    // 获取容器的滚动高度
    const scrollHeight = container.scrollHeight;
    const viewportHeight = container.clientHeight;
    const scrollStep = viewportHeight * 0.8; // 每次滚动80%的视口高度

    let currentPosition = 0;
    let pageNum = 1;

    // 滚动到顶部
    container.scrollTop = 0;
    await new Promise(r => setTimeout(r, 1000));

    while (currentPosition < scrollHeight) {
        console.log(`正在处理第 ${pageNum} 页...`);

        // 等待内容加载
        await new Promise(r => setTimeout(r, 500));

        // 记录当前位置
        results.push({
            page: pageNum,
            scrollTop: currentPosition,
            timestamp: new Date().toISOString()
        });

        // 滚动到下一个位置
        currentPosition += scrollStep;
        container.scrollTop = currentPosition;
        pageNum++;

        // 避免滚动过快
        await new Promise(r => setTimeout(r, 800));

        // 限制最多滚动200页，避免无限循环
        if (pageNum > 200) break;
    }

    return {
        totalPages: pageNum - 1,
        scrollHeight: scrollHeight,
        viewportHeight: viewportHeight,
        results: results
    };
}

// 执行滚动
return await scrollAndCapture();
"""
    return script

print("=" * 60)
print("🚀 飞书表格数据滚动捕获器")
print("=" * 60)
print("\n说明：")
print("1. 此脚本将自动滚动飞书表格")
print("2. 每次滚动后会等待数据加载")
print("3. 估计需要滚动约200次来获取全部4013条数据")
print("\n准备开始滚动...")

# 生成JavaScript代码
js_code = create_scroll_script()

# 保存JavaScript文件
with open('/Users/mengyu/Desktop/Cursor/scroll_script.js', 'w', encoding='utf-8') as f:
    f.write(js_code)

print("\n✅ 滚动脚本已生成：scroll_script.js")
print("\n下一步：")
print("1. 在浏览器中执行此脚本")
print("2. 同时进行截图")
print("3. 使用OCR提取数据")