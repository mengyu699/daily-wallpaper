
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
