#!/usr/bin/env python3
"""
AI大航海数据深度分析系统
对4013名船员进行全面的数据分析
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib import font_manager
import json

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False

# 读取数据
print("📖 正在加载数据...")
df = pd.read_csv('/Users/mengyu/Desktop/Cursor/ship_crew_data.csv')
print(f"✅ 成功加载 {len(df)} 条数据\n")

# ============================================================
# 1. 数据概览
# ============================================================
print("=" * 60)
print("📊 1. 数据概览")
print("=" * 60)

print("\n基本信息:")
print(f"  • 总船员数: {len(df):,} 人")
print(f"  • 数据列: {', '.join(df.columns)}")
print(f"  • 地区数: {df['大区'].nunique()} 个")
print(f"  • 城市数: {df['城市'].nunique()} 个")

# 数值型数据统计
print("\n数值统计:")
numeric_stats = df[['船票', '学分']].describe()
print(numeric_stats.round(0).to_string())

# ============================================================
# 2. 学分分析
# ============================================================
print("\n" + "=" * 60)
print("🎯 2. 学分深度分析")
print("=" * 60)

# 学分分层
def categorize_score(score):
    if score >= 2000:
        return '顶级船员(>=2000)'
    elif score >= 1000:
        return '高级船员(1000-2000)'
    elif score >= 500:
        return '中级船员(500-1000)'
    else:
        return '初级船员(<500)'

df['学分等级'] = df['学分'].apply(categorize_score)

print("\n学分分层分布:")
level_dist = df['学分等级'].value_counts()
for level, count in level_dist.items():
    percentage = (count / len(df)) * 100
    print(f"  • {level}: {count:,}人 ({percentage:.1f}%)")

# 学分TOP10
print("\n学分TOP10船员:")
top10 = df.nlargest(10, '学分')[['编号', '姓名', '学分', '船票', '大区', '城市']]
for idx, row in top10.iterrows():
    print(f"  {row['编号']:4d}. {row['姓名'][:10]:<10} | 学分:{row['学分']:4d} | 船票:{row['船票']:4d} | {row['大区']}-{row['城市']}")

# ============================================================
# 3. 地域分析
# ============================================================
print("\n" + "=" * 60)
print("🗺️ 3. 地域分布分析")
print("=" * 60)

# 地区统计
region_stats = df.groupby('大区').agg({
    '编号': 'count',
    '学分': ['mean', 'median', 'max'],
    '船票': 'mean'
}).round(0)

region_stats.columns = ['人数', '平均学分', '中位学分', '最高学分', '平均船票']
region_stats = region_stats.sort_values('平均学分', ascending=False)

print("\n各地区详细统计:")
print(region_stats.to_string())

# 城市TOP10
print("\n城市TOP10 (按人数):")
city_top10 = df['城市'].value_counts().head(10)
for city, count in city_top10.items():
    percentage = (count / len(df)) * 100
    avg_score = df[df['城市'] == city]['学分'].mean()
    print(f"  • {city:<8}: {count:3d}人 ({percentage:4.1f}%) | 平均学分:{avg_score:.0f}")

# ============================================================
# 4. 投入产出分析
# ============================================================
print("\n" + "=" * 60)
print("💰 4. 投入产出效率分析")
print("=" * 60)

# 计算ROI (学分/船票)
df['ROI'] = df['学分'] / df['船票']

print("\n投入产出效率(ROI = 学分/船票):")
print(f"  • 平均ROI: {df['ROI'].mean():.2f}")
print(f"  • 中位ROI: {df['ROI'].median():.2f}")
print(f"  • 最高ROI: {df['ROI'].max():.2f}")
print(f"  • 最低ROI: {df['ROI'].min():.2f}")

# ROI TOP10
print("\n最高效率TOP10 (ROI最高):")
roi_top10 = df.nlargest(10, 'ROI')[['编号', '姓名', 'ROI', '学分', '船票']]
for idx, row in roi_top10.iterrows():
    print(f"  {row['编号']:4d}. {row['姓名'][:10]:<10} | ROI:{row['ROI']:5.2f} | 学分:{row['学分']:4d} | 船票:{row['船票']:4d}")

# ============================================================
# 5. 用户活跃度分析
# ============================================================
print("\n" + "=" * 60)
print("📈 5. 用户活跃度分析")
print("=" * 60)

# 按编号区间分析（模拟时间维度）
def get_user_period(user_id):
    if user_id <= 1000:
        return '早期用户(1-1000)'
    elif user_id <= 2500:
        return '中期用户(1001-2500)'
    else:
        return '后期用户(2501-4013)'

df['用户时期'] = df['编号'].apply(get_user_period)

period_stats = df.groupby('用户时期').agg({
    '编号': 'count',
    '学分': 'mean',
    '船票': 'mean'
}).round(0)

period_stats.columns = ['人数', '平均学分', '平均船票']

print("\n不同时期用户对比:")
print(period_stats.to_string())

# 活跃度分布
inactive_users = len(df[df['学分'] < 200])
low_active = len(df[(df['学分'] >= 200) & (df['学分'] < 500)])
medium_active = len(df[(df['学分'] >= 500) & (df['学分'] < 1000)])
high_active = len(df[df['学分'] >= 1000])

print("\n活跃度分布:")
print(f"  • 极低活跃(<200分): {inactive_users:,}人 ({inactive_users/len(df)*100:.1f}%)")
print(f"  • 低活跃(200-500分): {low_active:,}人 ({low_active/len(df)*100:.1f}%)")
print(f"  • 中活跃(500-1000分): {medium_active:,}人 ({medium_active/len(df)*100:.1f}%)")
print(f"  • 高活跃(>=1000分): {high_active:,}人 ({high_active/len(df)*100:.1f}%)")

# ============================================================
# 6. 相关性分析
# ============================================================
print("\n" + "=" * 60)
print("🔗 6. 相关性分析")
print("=" * 60)

# 计算相关系数
correlation = df['船票'].corr(df['学分'])
print(f"\n船票与学分相关系数: {correlation:.3f}")

if correlation < 0.3:
    print("  → 弱相关：船票投入与学分产出关系不明显")
elif correlation < 0.7:
    print("  → 中等相关：存在一定的正向关系")
else:
    print("  → 强相关：船票投入与学分产出高度相关")

# ============================================================
# 7. 创建高级可视化
# ============================================================
print("\n" + "=" * 60)
print("📈 7. 生成可视化报告...")
print("=" * 60)

# 创建一个大图表
fig = plt.figure(figsize=(20, 16))
fig.suptitle('🛳️ AI大航海 - 4013名船员数据分析报告', fontsize=20, fontweight='bold')

# 1. 学分分布直方图
ax1 = plt.subplot(3, 3, 1)
ax1.hist(df['学分'], bins=50, edgecolor='black', alpha=0.7, color='steelblue')
ax1.axvline(df['学分'].mean(), color='red', linestyle='--', label=f'均值:{df["学分"].mean():.0f}')
ax1.set_xlabel('学分')
ax1.set_ylabel('人数')
ax1.set_title('学分分布')
ax1.legend()
ax1.grid(True, alpha=0.3)

# 2. 地区分布饼图
ax2 = plt.subplot(3, 3, 2)
region_counts = df['大区'].value_counts()
colors = plt.cm.Set3(range(len(region_counts)))
ax2.pie(region_counts.values, labels=region_counts.index, autopct='%1.1f%%',
        startangle=90, colors=colors)
ax2.set_title('地区分布')

# 3. 船票vs学分散点图
ax3 = plt.subplot(3, 3, 3)
scatter = ax3.scatter(df['船票'], df['学分'], alpha=0.5, c=df['学分'],
                     cmap='viridis', s=20)
ax3.set_xlabel('船票(押券数)')
ax3.set_ylabel('学分')
ax3.set_title(f'船票vs学分 (相关系数:{correlation:.3f})')
plt.colorbar(scatter, ax=ax3)
ax3.grid(True, alpha=0.3)

# 4. 各地区平均学分
ax4 = plt.subplot(3, 3, 4)
region_avg = df.groupby('大区')['学分'].mean().sort_values()
ax4.barh(region_avg.index, region_avg.values, color='teal')
ax4.set_xlabel('平均学分')
ax4.set_title('各地区平均学分')
for i, v in enumerate(region_avg.values):
    ax4.text(v + 10, i, f'{v:.0f}', va='center')

# 5. ROI分布
ax5 = plt.subplot(3, 3, 5)
ax5.hist(df['ROI'], bins=30, edgecolor='black', alpha=0.7, color='coral')
ax5.set_xlabel('ROI (学分/船票)')
ax5.set_ylabel('人数')
ax5.set_title('投入产出效率分布')
ax5.axvline(df['ROI'].mean(), color='red', linestyle='--', label=f'均值:{df["ROI"].mean():.2f}')
ax5.legend()
ax5.grid(True, alpha=0.3)

# 6. 用户时期对比
ax6 = plt.subplot(3, 3, 6)
period_avg = df.groupby('用户时期')['学分'].mean()
ax6.bar(range(len(period_avg)), period_avg.values, color=['green', 'orange', 'red'])
ax6.set_xticks(range(len(period_avg)))
ax6.set_xticklabels(['早期', '中期', '后期'])
ax6.set_ylabel('平均学分')
ax6.set_title('不同时期用户平均学分')
for i, v in enumerate(period_avg.values):
    ax6.text(i, v + 20, f'{v:.0f}', ha='center')

# 7. 学分等级分布
ax7 = plt.subplot(3, 3, 7)
level_counts = df['学分等级'].value_counts()
ax7.bar(range(len(level_counts)), level_counts.values,
        color=['gold', 'silver', 'brown', 'gray'])
ax7.set_xticks(range(len(level_counts)))
ax7.set_xticklabels(['顶级', '高级', '中级', '初级'], rotation=0)
ax7.set_ylabel('人数')
ax7.set_title('船员等级分布')
for i, v in enumerate(level_counts.values):
    ax7.text(i, v + 50, f'{v:,}', ha='center')

# 8. TOP20城市
ax8 = plt.subplot(3, 3, 8)
city_top20 = df['城市'].value_counts().head(20)
ax8.barh(range(len(city_top20)), city_top20.values, color='purple', alpha=0.7)
ax8.set_yticks(range(len(city_top20)))
ax8.set_yticklabels(city_top20.index, fontsize=8)
ax8.set_xlabel('人数')
ax8.set_title('TOP20 城市分布')
ax8.invert_yaxis()

# 9. 箱线图 - 各地区学分分布
ax9 = plt.subplot(3, 3, 9)
regions = df['大区'].unique()
data_to_plot = [df[df['大区'] == region]['学分'].values for region in regions]
bp = ax9.boxplot(data_to_plot, labels=regions, patch_artist=True)
for patch in bp['boxes']:
    patch.set_facecolor('lightblue')
ax9.set_ylabel('学分')
ax9.set_title('各地区学分分布箱线图')
ax9.grid(True, alpha=0.3, axis='y')

plt.tight_layout()
plt.savefig('/Users/mengyu/Desktop/Cursor/ai_voyage_complete_analysis.png',
            dpi=150, bbox_inches='tight')
print("✅ 可视化报告已保存为: ai_voyage_complete_analysis.png")

# ============================================================
# 8. 关键洞察与建议
# ============================================================
print("\n" + "=" * 60)
print("💡 8. 关键洞察与运营建议")
print("=" * 60)

print("\n📌 关键发现:")
print(f"1. 早期用户质量高：前1000名用户平均学分({df[df['编号']<=1000]['学分'].mean():.0f})远高于整体平均")
print(f"2. 地域发展不均：不同地区平均学分差异达{region_stats['平均学分'].max() - region_stats['平均学分'].min():.0f}分")
print(f"3. 投入产出效率差异大：ROI从{df['ROI'].min():.2f}到{df['ROI'].max():.2f}，差异巨大")
print(f"4. 活跃度两极分化：{(inactive_users + high_active)/len(df)*100:.1f}%的用户处于两个极端")

print("\n🎯 运营建议:")
print("1. 【用户分层】建立4级会员体系，针对不同等级提供差异化服务")
print("2. 【地区拓展】重点发展薄弱地区，可考虑地区专属活动")
print("3. 【激活策略】对<200分的用户实施专项激活计划")
print("4. 【榜样效应】打造高ROI用户案例，引导高效学习模式")
print("5. 【早鸟优势】给予新用户更多激励，参考早期用户的高活跃度")

print("\n" + "=" * 60)
print("✅ 分析完成！共处理4013条数据")
print("=" * 60)