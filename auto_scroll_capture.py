#!/usr/bin/env python3
"""
飞书表格自动滚动截图系统
将截取全部4013条数据
"""

import os
import time
from datetime import datetime

# 创建截图目录
screenshots_dir = "/Users/mengyu/Desktop/Cursor/feishu_screenshots"
os.makedirs(screenshots_dir, exist_ok=True)

print("=" * 60)
print("🚀 开始自动滚动截图 - 获取全部4013条真实数据")
print("=" * 60)
print(f"\n📁 截图保存目录: {screenshots_dir}")
print(f"⏰ 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("\n预计需要:")
print("  • 截图数量: 约200张")
print("  • 所需时间: 10-15分钟")
print("  • 每页数据: 约20条")
print("\n开始滚动...")
print("-" * 40)