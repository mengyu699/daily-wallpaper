import { useState } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Button, Input, DatePicker, Select } from 'antd';
import { MessageOutlined, SearchOutlined, BarChartOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import Stats from './pages/Stats';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Search } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

function App() {
  const [selectedKey, setSelectedKey] = useState('search');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/search?query=${encodeURIComponent(value)}&limit=20`);
      const data = await response.json();
      setSearchResults(data.data?.messages || []);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (selectedKey) {
      case 'search':
        return (
          <div>
            <Card title="🔍 聊天记录搜索" style={{ marginBottom: 16 }}>
              <Search
                placeholder="输入关键词搜索聊天记录..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onSearch={handleSearch}
                loading={loading}
                style={{ marginBottom: 16 }}
              />
              <Row gutter={16}>
                <Col span={8}>
                  <RangePicker style={{ width: '100%' }} />
                </Col>
                <Col span={8}>
                  <Select placeholder="选择聊天" style={{ width: '100%' }} allowClear>
                    <Option value="all">全部聊天</Option>
                  </Select>
                </Col>
                <Col span={8}>
                  <Button type="primary" onClick={() => handleSearch('')}>
                    搜索
                  </Button>
                </Col>
              </Row>
            </Card>

            <Card title="📊 搜索结果" loading={loading}>
              {searchResults.length > 0 ? (
                <div>
                  <p>找到 {searchResults.length} 条消息</p>
                  {searchResults.map((msg: any) => (
                    <Card key={msg._id} size="small" style={{ marginBottom: 8 }}>
                      <div>
                        <strong>{msg.sender}</strong> → {msg.receiver}
                        <br />
                        <span style={{ color: '#666' }}>{dayjs(msg.timestamp).format('MM-DD HH:mm')}</span>
                        <p>{msg.content}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <MessageOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                  <p>输入关键词开始搜索你的微信聊天记录</p>
                </div>
              )}
            </Card>
          </div>
        );
      case 'stats':
        return <Stats />;
      case 'ai':
        return (
          <Card title="🤖 AI 智能摘要">
            <div style={{ textAlign: 'center', padding: 40 }}>
              <BarChartOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <h3>AI 对话摘要功能</h3>
              <p>选择聊天记录，一键生成AI摘要</p>
              <Button type="primary" size="large">
                开始体验
              </Button>
            </div>
          </Card>
        );
      default:
        return <Stats />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: 0, display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <h1 style={{ color: '#1890ff', margin: 0 }}>
          <MessageOutlined style={{ marginRight: 8 }} />
          微信聊天记忆宫殿
        </h1>
      </Header>
      
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item key="search" icon={<SearchOutlined />}>
              聊天记录搜索
            </Menu.Item>
            <Menu.Item key="stats" icon={<BarChartOutlined />}>
              数据统计
            </Menu.Item>
            <Menu.Item key="ai" icon={<UserOutlined />}>
              AI 摘要
            </Menu.Item>
          </Menu>
        </Sider>
        
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="总消息数"
                  value={12547}
                  prefix={<MessageOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="聊天数量"
                  value={23}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="数据时间范围"
                  value="2024-01-01 至今"
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
          </Row>
          
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;