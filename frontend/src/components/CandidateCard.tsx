import React from 'react';
import { Card, Tag, Button, Space, Tooltip, Popconfirm, Progress } from 'antd';
import {
  PhoneOutlined,
  MailOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CalendarOutlined,
  SolutionOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Candidate } from '@/types';
import { candidateApi } from '@/services/api';
import { useKanbanStore } from '@/store/kanbanStore';
import { message } from 'antd';

interface CandidateCardProps {
  candidate: Candidate;
  onViewLogs: (candidate: Candidate) => void;
  onScheduleInterview?: (candidate: Candidate) => void;
  onViewOffer?: (candidate: Candidate) => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({
  candidate,
  onViewLogs,
  onScheduleInterview,
  onViewOffer,
}) => {
  const removeCandidate = useKanbanStore((state) => state.removeCandidate);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: candidate.id,
    data: {
      type: 'candidate',
      candidate,
    },
    disabled: candidate.locked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const handleDelete = async () => {
    try {
      await candidateApi.delete(candidate.id);
      removeCandidate(candidate.id);
      message.success('删除成功');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleDownload = () => {
    if (candidate.resumeFileUrl) {
      window.open(candidate.resumeFileUrl, '_blank');
    } else {
      message.warning('暂无简历文件');
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        size="small"
        className="candidate-card"
        style={{
          marginBottom: 8,
          cursor: candidate.locked ? 'not-allowed' : 'grab',
          borderLeft: `4px solid ${getConfidenceColor(candidate.confidenceScore || 0)}`,
          opacity: candidate.locked ? 0.6 : 1,
        }}
        hoverable
      >
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ fontSize: 16 }}>{candidate.name}</strong>
            {candidate.locked && (
              <Tooltip title="卡片已锁定">
                <LockOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
              </Tooltip>
            )}
            {candidate.talentPoolStatus === '已入职' && (
              <Tag color="green" style={{ margin: 0 }}>已入职</Tag>
            )}
          </div>
          <Tooltip title="置信度">
            <div style={{ width: 60, textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={candidate.confidenceScore || 0}
                size={40}
                strokeColor={getConfidenceColor(candidate.confidenceScore || 0)}
                format={(percent) => `${percent}`}
              />
            </div>
          </Tooltip>
        </div>

        <div className="card-info" style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div>
              <PhoneOutlined style={{ marginRight: 6 }} />
              {candidate.phone || '-'}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MailOutlined style={{ marginRight: 6 }} />
              <Tooltip title={candidate.email}>{candidate.email || '-'}</Tooltip>
            </div>
            <div>
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              {candidate.workYears ? `${candidate.workYears}年工作经验` : '工作经验未知'}
            </div>
          </Space>
        </div>

        {candidate.skills && candidate.skills.length > 0 && (
          <div className="card-skills" style={{ marginBottom: 8 }}>
            {candidate.skills.slice(0, 5).map((skill, index) => (
              <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                {skill}
              </Tag>
            ))}
            {candidate.skills.length > 5 && (
              <Tag>+{candidate.skills.length - 5}</Tag>
            )}
          </div>
        )}

        <div className="card-actions" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 8 }}>
          <Space size={4}>
            <Tooltip title="查看简历">
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined />}
                onClick={handleDownload}
              />
            </Tooltip>
            {['一面', '二面', 'HR面'].includes(candidate.currentStage) && (
              <Tooltip title="发起面试">
                <Button
                  type="text"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onScheduleInterview?.(candidate);
                  }}
                />
              </Tooltip>
            )}
            {candidate.currentStage === 'Offer' && (
              <Tooltip title="Offer审批">
                <Button
                  type="text"
                  size="small"
                  icon={<SolutionOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOffer?.(candidate);
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title="查看流转日志">
              <Button
                type="text"
                size="small"
                icon={<HistoryOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewLogs(candidate);
                }}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除该候选人吗？"
              description="删除后无法恢复"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDelete();
              }}
              onCancel={(e) => e?.stopPropagation()}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default CandidateCard;
