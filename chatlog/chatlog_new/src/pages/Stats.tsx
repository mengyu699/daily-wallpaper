import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { MessageOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';

const Stats: React.FC = () => {
  return (
    <div>
      <Card title="📊 数据统计" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="总消息数"
              value={12547}
              prefix={<MessageOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="聊天数量"
              value={23}
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="数据时间范围"
              value="2024-01-01 至今"
              prefix={<CalendarOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <Card title="📈 消息趋势">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p>消息趋势图表将在这里显示</p>
        </div>
      </Card>

      <Card title="👥 活跃聊天" style={{ marginTop: 16 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p>活跃聊天列表将在这里显示</p>
        </div>
      </Card>
    </div>
  );
};

export default Stats;