import React, { useState, useEffect } from 'react';
import { Modal, Timeline, Spin, Empty, Typography, Tag } from 'antd';
import { ArrowRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Candidate, StageLog } from '@/types';
import { candidateApi } from '@/services/api';
import { message } from 'antd';

const { Text, Title } = Typography;

interface StageLogModalProps {
  open: boolean;
  onClose: () => void;
  candidate: Candidate | null;
}

const getStageColor = (stage: string): string => {
  const colorMap: Record<string, string> = {
    '初筛': 'blue',
    '一面': 'green',
    '二面': 'purple',
    'HR面': 'orange',
    'Offer': 'cyan',
    '已淘汰': 'red',
  };
  return colorMap[stage] || 'default';
};

const StageLogModal: React.FC<StageLogModalProps> = ({
  open,
  onClose,
  candidate,
}) => {
  const [logs, setLogs] = useState<StageLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!candidate) return;
      
      setLoading(true);
      try {
        const response = await candidateApi.getStageLogs(candidate.id);
        setLogs(response.data.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ));
      } catch (error: any) {
        message.error(error.message || '获取日志失败');
      } finally {
        setLoading(false);
      }
    };

    if (open && candidate) {
      fetchLogs();
    }
  }, [open, candidate]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Modal
      title={
        candidate ? (
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {candidate.name} - 阶段流转日志
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {candidate.phone} | {candidate.email}
            </Text>
          </div>
        ) : (
          '阶段流转日志'
        )
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : logs.length === 0 ? (
        <Empty description="暂无流转记录" style={{ padding: '40px 0' }} />
      ) : (
        <div style={{ maxHeight: 500, overflowY: 'auto', padding: '8px 0' }}>
          <Timeline
            mode="left"
            items={logs.map((log, index) => ({
              color: index === logs.length - 1 ? 'green' : 'blue',
              label: (
                <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {formatDate(log.createdAt)}
                </div>
              ),
              children: (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color={getStageColor(log.fromStage)}>
                      {log.fromStage}
                    </Tag>
                    <ArrowRightOutlined style={{ color: '#888', fontSize: 12 }} />
                    <Tag color={getStageColor(log.toStage)}>
                      {log.toStage}
                    </Tag>
                  </div>
                  {log.remark && (
                    <div style={{ fontSize: 13, color: '#666', paddingLeft: 4 }}>
                      备注：{log.remark}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        </div>
      )}
    </Modal>
  );
};

export default StageLogModal;
