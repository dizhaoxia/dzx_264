import React, { useState, useEffect } from 'react';
import { Button, Space, Popconfirm, Tooltip, Spin, Empty } from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useKanbanStore } from '@/store/kanbanStore';
import type { Candidate, Position } from '@/types';
import { positionApi } from '@/services/api';
import { message } from 'antd';
import KanbanBoard from './components/KanbanBoard';
import PositionForm from './components/PositionForm';
import ResumeUpload from './components/ResumeUpload';
import StageLogModal from './components/StageLogModal';
import InterviewScheduleModal from './components/InterviewScheduleModal';
import OfferApprovalModal from './components/OfferApprovalModal';
import './App.css';

const App: React.FC = () => {
  const {
    positions,
    currentPositionId,
    candidates,
    positionsLoading,
    loading,
    setCurrentPositionId,
    fetchPositions,
    fetchCandidates,
    removePosition,
    getCurrentPosition,
  } = useKanbanStore();

  const [positionFormOpen, setPositionFormOpen] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [interviewCandidate, setInterviewCandidate] = useState<Candidate | null>(null);
  const [offerCandidate, setOfferCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleCreatePosition = () => {
    setEditPosition(null);
    setPositionFormOpen(true);
  };

  const handleEditPosition = (position: Position, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditPosition(position);
    setPositionFormOpen(true);
  };

  const handleDeletePosition = async (position: Position, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await positionApi.delete(position.id);
      removePosition(position.id);
      message.success('删除成功');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleRefresh = () => {
    if (currentPositionId) {
      fetchCandidates(currentPositionId);
    }
    fetchPositions();
    message.success('刷新成功');
  };

  const handleViewLogs = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setLogModalOpen(true);
  };

  const handleScheduleInterview = (candidate: Candidate) => {
    setInterviewCandidate(candidate);
    setInterviewModalOpen(true);
  };

  const handleViewOffer = (candidate: Candidate) => {
    setOfferCandidate(candidate);
    setOfferModalOpen(true);
  };

  const handleMovedToOffer = (candidate: Candidate) => {
    setOfferCandidate(candidate);
    setOfferModalOpen(true);
  };

  const handleInterviewSuccess = () => {
    if (currentPositionId) {
      fetchCandidates(currentPositionId);
    }
  };

  const handleOfferUpdated = () => {
    if (currentPositionId) {
      fetchCandidates(currentPositionId);
    }
  };

  const currentPosition = getCurrentPosition();
  const totalCandidates = candidates.length;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">招聘管理系统</h1>
          <Tooltip title="创建职位">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreatePosition}
              size="small"
            />
          </Tooltip>
        </div>

        <div className="sidebar-content">
          {positionsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="small" tip="加载中..." style={{ color: 'white' }} />
            </div>
          ) : positions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无职位"
              style={{ padding: '40px 0' }}
            />
          ) : (
            <ul className="position-list">
              {positions.map((position) => (
                <li
                  key={position.id}
                  className={`position-item ${
                    currentPositionId === position.id ? 'active' : ''
                  }`}
                  onClick={() => setCurrentPositionId(position.id)}
                >
                  <div className="position-item-title">{position.title}</div>
                  <div className="position-item-department">
                    <AppstoreOutlined style={{ marginRight: 4 }} />
                    {position.department}
                  </div>
                  <div className="position-item-actions">
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => handleEditPosition(position, e)}
                        style={{ color: 'white', padding: '0 4px' }}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除该职位吗？"
                      description="删除后该职位下的所有候选人数据也将被删除"
                      onConfirm={(e) => handleDeletePosition(position, e!)}
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
                        style={{ padding: '0 4px' }}
                      />
                    </Popconfirm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div>
            <h2 className="main-header-title">
              {currentPosition ? currentPosition.title : '招聘看板'}
            </h2>
            <div className="main-header-info">
              {currentPosition ? (
                <>
                  <span style={{ marginRight: 16 }}>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    共 {totalCandidates} 位候选人
                  </span>
                  <span>
                    <AppstoreOutlined style={{ marginRight: 4 }} />
                    {currentPosition.department}
                  </span>
                </>
              ) : (
                '请选择或创建一个职位开始管理'
              )}
            </div>
          </div>
          <Space>
            <Tooltip title="刷新">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              />
            </Tooltip>
            <Tooltip title="上传简历">
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalOpen(true)}
                disabled={!currentPositionId}
              >
                上传简历
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreatePosition}
            >
              创建职位
            </Button>
          </Space>
        </header>

        <div className="main-body">
          <div className="kanban-container">
            <KanbanBoard
              onViewLogs={handleViewLogs}
              onScheduleInterview={handleScheduleInterview}
              onViewOffer={handleViewOffer}
              onMovedToOffer={handleMovedToOffer}
            />
          </div>
        </div>
      </main>

      <PositionForm
        open={positionFormOpen}
        onClose={() => {
          setPositionFormOpen(false);
          setEditPosition(null);
        }}
        editPosition={editPosition}
      />

      <ResumeUpload
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />

      <StageLogModal
        open={logModalOpen}
        onClose={() => {
          setLogModalOpen(false);
          setSelectedCandidate(null);
        }}
        candidate={selectedCandidate}
      />

      <InterviewScheduleModal
        open={interviewModalOpen}
        candidate={interviewCandidate}
        onClose={() => {
          setInterviewModalOpen(false);
          setInterviewCandidate(null);
        }}
        onSuccess={handleInterviewSuccess}
      />

      <OfferApprovalModal
        open={offerModalOpen}
        candidate={offerCandidate}
        onClose={() => {
          setOfferModalOpen(false);
          setOfferCandidate(null);
        }}
        onUpdated={handleOfferUpdated}
      />
    </div>
  );
};

export default App;
