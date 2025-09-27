import React, { useState, useEffect } from 'react';
import { Layout, Card, Row, Col, Statistic, DatePicker, Select } from 'antd';
import { MessageOutlined, UserOutlined, CalendarOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ActivityChart from '../components/charts/ActivityChart';
import WordCloud from '../components/charts/WordCloud';

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface StatsData {
  totalMessages: number;
  totalChats: number;
  totalSenders: number;
  earliestMessage: number;
  latestMessage: number;
}

interface Chat {
  chatId: string;
  lastMessage: any;
  messageCount: number;
  lastTimestamp: number;
}

const Stats: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsResponse, chatsResponse] = await Promise.all([
        fetch('/api/stats/overview'),
        fetch('/api/chats')
      ]);

      const [statsData, chatsData] = await Promise.all([
        statsResponse.json(),
        chatsResponse.json()
      ]);

      if (statsData.success) {
        setStats(statsData.data);
      }
      if (chatsData.success) {
        setChats(chatsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setDateRange(dates);
    }
  };

  const handleChatChange = (value: string) => {
    setSelectedChat(value === 'all' ? undefined : value);
  };

  const dateRangeParams = {
    from: dateRange[0].format('YYYY-MM-DD'),
    to: dateRange[1].format('YYYY-MM-DD')
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: 0, color: '#1890ff' }}>
          <LineChartOutlined style={{ marginRight: 8 }} />
          数据统计
        </h1>
      </Header>

      <Content style={{ padding: 24 }}>
        {/* 筛选器 */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Col>
            <Col>
              <Select
                placeholder="选择聊天"
                style={{ width: 200 }}
                onChange={handleChatChange}
                allowClear
              >
                <Option value="all">全部聊天</Option>
                {chats.map(chat => (
                  <Option key={chat.chatId} value={chat.chatId}>
                    {chat.chatId} ({chat.messageCount})
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总消息数"
                  value={stats.totalMessages}
                  prefix={<MessageOutlined />}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="聊天数量"
                  value={stats.totalChats}
                  prefix={<UserOutlined />}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="发送者数量"
                  value={stats.totalSenders}
                  prefix={<UserOutlined />}
                  loading={loading}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="数据时间范围"
                  value={`${dayjs(stats.earliestMessage).format('MM-DD')} - ${dayjs(stats.latestMessage).format('MM-DD')}`}
                  prefix={<CalendarOutlined />}
                  loading={loading}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 图表区域 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={16}>
            <ActivityChart
              chatId={selectedChat}
              from={dateRangeParams.from}
              to={dateRangeParams.to}
            />
          </Col>
          <Col span={8}>
            <WordCloud
              chatId={selectedChat}
              from={dateRangeParams.from}
              to={dateRangeParams.to}
            />
          </Col>
        </Row>

        {/* 详细数据表格 */}
        <Card title="聊天详情">
          <Row gutter={16}>
            {chats.map(chat => (
              <Col key={chat.chatId} span={8} style={{ marginBottom: 16 }}>
                <Card size="small" hoverable>
                  <Statistic
                    title={chat.chatId}
                    value={chat.messageCount}
                    suffix="条消息"
                  />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                    最后更新: {dayjs(chat.lastTimestamp).format('MM-DD HH:mm')}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Content>
    </Layout>
  );
};

export default Stats;