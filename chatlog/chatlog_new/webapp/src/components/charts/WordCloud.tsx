import React, { useState, useEffect } from 'react';
import { Card, Spin } from 'antd';
import { CloudOutlined } from '@ant-design/icons';

interface Keyword {
  keyword: string;
  count: number;
  weight: number;
}

interface WordCloudProps {
  chatId?: string;
  from?: string;
  to?: string;
}

const WordCloud: React.FC<WordCloudProps> = ({ chatId, from, to }) => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (chatId) params.append('chatId', chatId);

      const response = await fetch(`/api/stats/keywords?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setKeywords(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, [chatId, from, to]);

  const getFontSize = (weight: number) => {
    const minSize = 12;
    const maxSize = 36;
    const maxWeight = Math.max(...keywords.map(k => k.weight), 1);
    const minWeight = Math.min(...keywords.map(k => k.weight), 0);
    
    if (maxWeight === minWeight) return minSize;
    
    return minSize + ((weight - minWeight) / (maxWeight - minWeight)) * (maxSize - minSize);
  };

  const getColor = (index: number) => {
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#13c2c2', '#fa8c16', '#eb2f96', '#52c41a', '#1890ff'
    ];
    return colors[index % colors.length];
  };

  return (
    <Card
      title="关键词云"
      icon={<CloudOutlined />}
    >
      {loading ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : keywords.length > 0 ? (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          padding: 16
        }}>
          {keywords.map((keyword, index) => (
            <span
              key={keyword.keyword}
              style={{
                fontSize: `${getFontSize(keyword.weight)}px`,
                color: getColor(index),
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.textShadow = '0 0 10px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.textShadow = 'none';
              }}
              title={`出现次数: ${keyword.count}`}
            >
              {keyword.keyword}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <CloudOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <span style={{ color: '#999' }}>暂无关键词数据</span>
        </div>
      )}
    </Card>
  );
};

export default WordCloud;