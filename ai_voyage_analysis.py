import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib import font_manager

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False

# 从截图中手动提取的数据
data = {
    '船员编号': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    '船员姓名': ['李海峰DISC', '陈芳强', '李慈', '林不材', '李严', '威霜', '贾红阳', '施小华',
                '熊岳', '娄刚', '杜金科', '马列丨营销人', '翁武斌', '浩宁', '刘王刘东升',
                '何鑫', '李沛盈', '钟征', '陈智新', '徐大勇', '麒麟'],
    '船员昵称': ['李海峰', '陈芳强', '李慈', '唐剑锋_lh', 'Joshua@李严', '二十八画',
                '贾红阳', '施小华', '回到起点', '娄刚 Victor G. Lou', '金科同学',
                '马列丨营销人', '翁.曾;:.祥', '欢乐马', 'liuG', '何鑫', 'Ashley',
                '钟征', '', '龙之魂', '麒麟'],
    '船票': [1000, 356, 301, 288, 259, 259, 238, 227, 216, 211, 200, 200,
            200, 188, 175, 169, 168, 160, 158, 150, 135],
    '学分': [822, 1540, 1144, 1055, 1101, 249, 3086, 1176, 504, 1041, 800,
            224, 99, 197, 2396, 932, 538, 959, 165, 1306, 175],
    '所在大区': ['华南', '华中', '华北', '西南', '西南', '华北', '华北', '华南',
                '华南', '华东', '西南', '华南', '华东', '华南', '华北', '华北',
                '华北', '华南', '华北', '华北', '华东'],
    '常驻城市': ['广东广州', '长沙', '北京/福州/杭州', '四川省成都市', '四川成都',
                '天津市', '北京', '深圳', '广东省深圳市', '浙江杭州\n加拿大温哥华',
                '重庆', '广州', '福建省福州市', '广州', '北京', '北京', '北京',
                '广东省深圳市', '北京', '北京', '福建省福州市']
}

# 创建DataFrame
df = pd.DataFrame(data)

# 数据清洗：处理城市名称
df['城市_简化'] = df['常驻城市'].str.extract(r'(北京|上海|广州|深圳|杭州|成都|重庆|福州|天津|长沙)')
df['城市_简化'] = df['城市_简化'].fillna('其他')

print("="*60)
print("🛳️ AI大航海 - 船员数据分析报告")
print("="*60)
print(f"\n📊 样本数据：{len(df)}条（总计4013名船员）")

# 1. 基础统计
print("\n### 1. 关键指标统计")
print("-"*40)
print(f"船票（押券数）统计：")
print(f"  • 平均值：{df['船票'].mean():.0f}")
print(f"  • 中位数：{df['船票'].median():.0f}")
print(f"  • 最高值：{df['船票'].max()} ({df.loc[df['船票'].idxmax(), '船员姓名']})")
print(f"  • 最低值：{df['船票'].min()} ({df.loc[df['船票'].idxmin(), '船员姓名']})")

print(f"\n学分统计：")
print(f"  • 平均值：{df['学分'].mean():.0f}")
print(f"  • 中位数：{df['学分'].median():.0f}")
print(f"  • 最高值：{df['学分'].max()} ({df.loc[df['学分'].idxmax(), '船员姓名']})")
print(f"  • 最低值：{df['学分'].min()} ({df.loc[df['学分'].idxmin(), '船员姓名']})")

# 2. 地区分布
print("\n### 2. 地区分布")
print("-"*40)
region_dist = df['所在大区'].value_counts()
for region, count in region_dist.items():
    percentage = count / len(df) * 100
    print(f"  • {region}: {count}人 ({percentage:.1f}%)")

# 3. TOP学员排名
print("\n### 3. 学分TOP5学员")
print("-"*40)
top_students = df.nlargest(5, '学分')[['船员姓名', '学分', '船票', '所在大区']]
for idx, row in top_students.iterrows():
    print(f"  {idx+1}. {row['船员姓名']}: {row['学分']}分 (船票:{row['船票']}, {row['所在大区']})")

# 4. 需关注学员（低活跃度）
print("\n### 4. 需关注学员（学分<200）")
print("-"*40)
low_active = df[df['学分'] < 200][['船员姓名', '学分', '船票', '所在大区']]
for idx, row in low_active.iterrows():
    print(f"  • {row['船员姓名']}: {row['学分']}分 (船票:{row['船票']}, {row['所在大区']})")

# 5. 投入产出分析
print("\n### 5. 投入产出效率分析")
print("-"*40)
df['学分效率'] = df['学分'] / df['船票']
efficiency_top = df.nlargest(3, '学分效率')[['船员姓名', '学分效率', '学分', '船票']]
print("学分效率最高（学分/船票）：")
for idx, row in efficiency_top.iterrows():
    print(f"  • {row['船员姓名']}: {row['学分效率']:.2f} (学分:{row['学分']}, 船票:{row['船票']})")

# 创建可视化
fig, axes = plt.subplots(2, 2, figsize=(15, 12))
fig.suptitle('🛳️ AI大航海 数据分析可视化', fontsize=16, fontweight='bold')

# 图1：地区分布饼图
ax1 = axes[0, 0]
region_dist.plot(kind='pie', ax=ax1, autopct='%1.1f%%', startangle=90)
ax1.set_title('地区分布', fontsize=14)
ax1.set_ylabel('')

# 图2：船票vs学分散点图
ax2 = axes[0, 1]
colors = {'华南': 'red', '华北': 'blue', '华东': 'green', '西南': 'orange', '华中': 'purple'}
for region in df['所在大区'].unique():
    mask = df['所在大区'] == region
    ax2.scatter(df[mask]['船票'], df[mask]['学分'],
               label=region, alpha=0.7, s=100, c=colors.get(region, 'gray'))
ax2.set_xlabel('船票（押券数）', fontsize=12)
ax2.set_ylabel('学分', fontsize=12)
ax2.set_title('船票与学分关系', fontsize=14)
ax2.legend()
ax2.grid(True, alpha=0.3)

# 图3：学分分布直方图
ax3 = axes[1, 0]
ax3.hist(df['学分'], bins=10, edgecolor='black', alpha=0.7, color='steelblue')
ax3.set_xlabel('学分', fontsize=12)
ax3.set_ylabel('人数', fontsize=12)
ax3.set_title('学分分布', fontsize=14)
ax3.axvline(df['学分'].mean(), color='red', linestyle='dashed', linewidth=2, label=f'平均值: {df["学分"].mean():.0f}')
ax3.legend()

# 图4：TOP10学员对比
ax4 = axes[1, 1]
top10 = df.nlargest(10, '学分')[['船员姓名', '学分']].sort_values('学分')
ax4.barh(range(len(top10)), top10['学分'], color='teal')
ax4.set_yticks(range(len(top10)))
ax4.set_yticklabels([name[:8] for name in top10['船员姓名']], fontsize=10)
ax4.set_xlabel('学分', fontsize=12)
ax4.set_title('TOP10 学员学分排名', fontsize=14)
for i, v in enumerate(top10['学分']):
    ax4.text(v + 10, i, str(v), va='center')

plt.tight_layout()
plt.savefig('/Users/mengyu/Desktop/Cursor/ai_voyage_analysis.png', dpi=150, bbox_inches='tight')
print("\n✅ 可视化图表已保存为: ai_voyage_analysis.png")

# 6. 洞察与建议
print("\n### 6. 关键洞察与建议")
print("-"*40)
print("📌 关键发现：")
print("  1. 学分与船票相关性弱：高学分学员不一定高投入")
print("  2. 地域集中度高：华北地区占比最大")
print("  3. 活跃度差异巨大：学分从99到3086，差距30倍")

print("\n💡 运营建议：")
print("  1. 建立分层激励机制：对高学分学员设立荣誉体系")
print("  2. 低活跃用户召回：对学分<200的用户进行专项激活")
print("  3. 地区均衡发展：在华东、西南等地区加强推广")
print("  4. 优化投入产出：研究高效率学员的学习模式并推广")

print("\n" + "="*60)
print("📝 注：以上分析基于21条样本数据，完整分析需要全部4013条数据")
print("="*60)