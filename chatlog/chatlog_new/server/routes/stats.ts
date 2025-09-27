import express from 'express';
import { MongoClient } from 'mongodb';

const router = express.Router();

interface StatsQuery {
  from?: string;
  to?: string;
  chatId?: string;
}

interface DailyStats {
  date: string;
  messageCount: number;
  senderCount: number;
  topSenders: Array<{
    sender: string;
    count: number;
  }>;
}

interface KeywordStats {
  keyword: string;
  count: number;
  weight: number;
}

// 获取MongoDB客户端
function getMongoClient(): MongoClient {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat';
  return new MongoClient(uri);
}

// 获取每日统计
router.get('/api/stats/daily', async (req, res) => {
  const { from, to, chatId }: StatsQuery = req.query;
  
  const client = getMongoClient();
  
  try {
    await client.connect();
    const db = client.db();
    const messages = db.collection('messages');

    // 构建时间范围查询
    const query: any = {};
    if (from || to) {
      query.timestamp = {};
      if (from) {
        query.timestamp.$gte = new Date(from).getTime();
      }
      if (to) {
        query.timestamp.$lte = new Date(to).getTime();
      }
    }
    if (chatId) {
      query.chatId = chatId;
    }

    // 获取每日统计数据
    const dailyStats = await messages.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: { $toDate: '$timestamp' } },
            month: { $month: { $toDate: '$timestamp' } },
            day: { $dayOfMonth: { $toDate: '$timestamp' } }
          },
          messageCount: { $sum: 1 },
          senderCount: { $addToSet: '$sender' },
          topSenders: {
            $push: {
              sender: '$sender',
              count: 1
            }
          }
        }
      },
      {
        $addFields: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                  day: '$_id.day'
                }
              }
            }
          },
          senderCount: { $size: '$senderCount' }
        }
      },
      {
        $unwind: '$topSenders'
      },
      {
        $group: {
          _id: {
            date: '$date',
            messageCount: '$messageCount',
            senderCount: '$senderCount'
          },
          senderCounts: {
            $push: {
              sender: '$topSenders.sender',
              count: 1
            }
          }
        }
      },
      {
        $addFields: {
          topSenders: {
            $slice: [
              {
                $map: {
                  input: {
                    $slice: [
                      {
                        $sortByCount: '$senderCounts.sender'
                      },
                      5
                    ]
                  },
                  as: 'sender',
                  in: {
                    sender: '$$sender._id',
                    count: '$$sender.count'
                  }
                }
              },
              5
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          messageCount: '$_id.messageCount',
          senderCount: '$_id.senderCount',
          topSenders: 1
        }
      },
      {
        $sort: { date: 1 }
      }
    ]).toArray();

    // 补充缺失的日期
    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date();
    
    const dateMap = new Map();
    dailyStats.forEach(stat => {
      dateMap.set(stat.date, stat);
    });

    const filledStats: DailyStats[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = dateMap.get(dateStr);
      
      filledStats.push(existing || {
        date: dateStr,
        messageCount: 0,
        senderCount: 0,
        topSenders: []
      });
      
      current.setDate(current.getDate() + 1);
    }

    res.json({
      success: true,
      data: filledStats
    });

  } catch (error) {
    console.error('Daily stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    await client.close();
  }
});

// 获取关键词统计
router.get('/api/stats/keywords', async (req, res) => {
  const { from, to, chatId }: StatsQuery = req.query;
  
  const client = getMongoClient();
  
  try {
    await client.connect();
    const db = client.db();
    const messages = db.collection('messages');

    // 构建查询
    const query: any = {};
    if (from || to) {
      query.timestamp = {};
      if (from) {
        query.timestamp.$gte = new Date(from).getTime();
      }
      if (to) {
        query.timestamp.$lte = new Date(to).getTime();
      }
    }
    if (chatId) {
      query.chatId = chatId;
    }

    // 获取消息内容并分词
    const messagesData = await messages
      .find(query)
      .project({ content: 1 })
      .limit(1000)
      .toArray();

    // 简单的关键词提取（实际项目中可以使用更复杂的NLP）
    const wordCount = new Map();
    const stopWords = new Set(['的', '了', '在', '是', '我', '你', '他', '她', '它', '这', '那', '和', '与', '或', '但', '就', '很', '也', '都', '还', '又', '再', '不', '没', '有', '要', '去', '来', '上', '下', '里', '外', '前', '后', '左', '右', '大', '小', '好', '坏', '高', '低', '长', '短', '新', '旧', '快', '慢', '多', '少', '一些', '一下', '一个', '一种', '一样', '一般', '一直', '一定', '一天', '一年', '一次', '一次', '一直', '一定', '一天', '一年', '一次', '一次']);

    messagesData.forEach(msg => {
      if (msg.content) {
        const words = msg.content
          .replace(/[^\u4e00-\u9fa5\w]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length >= 2 && !stopWords.has(word));

        words.forEach(word => {
          wordCount.set(word, (wordCount.get(word) || 0) + 1);
        });
      }
    });

    // 获取前20个关键词
    const keywords: KeywordStats[] = Array.from(wordCount.entries())
      .map(([keyword, count]) => ({
        keyword,
        count,
        weight: Math.log(count + 1) * 10 // 简单的权重计算
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({
      success: true,
      data: keywords
    });

  } catch (error) {
    console.error('Keywords stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    await client.close();
  }
});

// 获取聊天统计概览
router.get('/api/stats/overview', async (req, res) => {
  const client = getMongoClient();
  
  try {
    await client.connect();
    const db = client.db();
    const messages = db.collection('messages');

    const [totalMessages, totalChats, totalSenders, dateRange] = await Promise.all([
      messages.countDocuments(),
      messages.distinct('chatId').then(ids => ids.length),
      messages.distinct('sender').then(senders => senders.length),
      messages.aggregate([
        {
          $group: {
            _id: null,
            earliest: { $min: '$timestamp' },
            latest: { $max: '$timestamp' }
          }
        }
      ]).toArray()
    ]);

    const range = dateRange[0] || { earliest: 0, latest: 0 };

    res.json({
      success: true,
      data: {
        totalMessages,
        totalChats,
        totalSenders,
        earliestMessage: range.earliest,
        latestMessage: range.latest
      }
    });

  } catch (error) {
    console.error('Overview stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    await client.close();
  }
});

export default router;