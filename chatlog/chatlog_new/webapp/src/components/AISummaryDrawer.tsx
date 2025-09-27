import React, { useState } from 'react';
import { Drawer, Button, Spin, Alert, Typography, Tag } from 'antd';
import { MessageOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface AISummary {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keyPoints: string[];
}

interface AISummaryDrawerProps {
  messageIds: string[];
  open: boolean;
  onClose: () => void;
  onSummaryGenerated?: (summary: AISummary) => void;
}

const AISummaryDrawer: React.FC<AISummaryDrawerProps> = ({
  messageIds,
  open,
  onClose,
  onSummaryGenerated
}) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    if (messageIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: messageIds,
          provider: 'openai' // 可以配置为其他提供商
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSummary(result.data.summary);
        onSummaryGenerated?.(result.data.summary);
      } else {
        setError(result.error || '生成摘要失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'green';
      case 'negative':
        return 'red';
      case 'neutral':
      default:
        return 'blue';
    }
  };

  const getSentimentText = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '积极';
      case 'negative':
        return '消极';
      case 'neutral':
      default:
        return '中性';
    }
  };

  return (
    <Drawer
      title="AI 对话摘要"
      placement="right"
      width={400}
      onClose={onClose}
      open={open}
      extra={
        <Button
          type="primary"
          onClick={generateSummary}
          loading={loading}
          icon={<MessageOutlined />}
          disabled={messageIds.length === 0}
        >
          生成摘要
        </Button>
      }
    >
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {summary ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>消息数量：</Text> {messageIds.length}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>情感分析：</Text>
            <Tag color={getSentimentColor(summary.sentiment)}>
              {getSentimentText(summary.sentiment)}
            </Tag>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Title level={4}>摘要</Title>
            <Paragraph>{summary.summary}</Paragraph>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Title level={4}>关键信息</Title>
            <div>
              {summary.keyPoints.map((point, index) => (
                <Tag key={index} style={{ marginRight: 8, marginBottom: 8 }}>
                  {point}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 100 }}>
          <MessageOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <Text type="secondary">
            选择消息后点击"生成摘要"按钮
          </Text>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 100 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">正在生成摘要...</Text>
          </div>
        </div>
      )}
    </Drawer>
  );
};

export default AISummaryDrawer;