import React, { useState, useEffect } from 'react';
import { Line } from '@ant-design/charts';
import { Card, DatePicker, Select, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface DailyStats {
  date: string;
  messageCount: number;
  senderCount: number;
}

interface ActivityChartProps {
  chatId?: string;
}

const ActivityChart: React.FC<ActivityChartProps> = ({ chatId }) => {
  const [data, setData] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('from', dateRange[0].format('YYYY-MM-DD'));
      params.append('to', dateRange[1].format('YYYY-MM-DD'));
      if (chatId) {
        params.append('chatId', chatId);
      }

      const response = await fetch(`/api/stats/daily?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, chatId]);

  const config = {
    data,
    xField: 'date',
    yField: 'messageCount',
    height: 300,
    smooth: true,
    color: '#1890ff',
    point: {
      size: 5,
      shape: 'diamond',
      style: {
        fill: 'white',
        stroke: '#1890ff',
        lineWidth: 2,
      },
    },
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: '消息数量',
          value: datum.messageCount,
        };
      },
    },
    xAxis: {
      type: 'time',
      mask: 'MM-DD',
    },
    yAxis: {
      label: {
        formatter: (v: string) => `${v}`,
      },
    },
    animation: {
      appear: {
        animation: 'wave-in',
        duration: 1000,
      },
    },
  };

  const handleDateChange = (dates: any) => {
    if (dates) {
      setDateRange(dates);
    }
  };

  return (
    <Card
      title="每日活跃度"
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchData}
          loading={loading}
          size="small"
        >
          刷新
        </Button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <RangePicker
          value={dateRange}
          onChange={handleDateChange}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
          style={{ marginRight: 16 }}
        />
      </div>

      {loading ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          加载中...
        </div>
      ) : data.length > 0 ? (
        <Line {...config} />
      ) : (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          暂无数据
        </div>
      )}
    </Card>
  );
};

export default ActivityChart;