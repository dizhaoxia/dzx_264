import React, { useState, useCallback } from 'react';
import { Modal, Upload, Progress, List, Button, Space, Alert, message } from 'antd';
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadChangeParam, UploadFile } from 'antd/es/upload/interface';
import type { UploadProgress } from '@/types';
import { candidateApi } from '@/services/api';
import { useKanbanStore } from '@/store/kanbanStore';

const { Dragger } = Upload;

interface UploadFileWithProcessed extends UploadFile {
  _processed?: boolean;
}

interface ResumeUploadProps {
  open: boolean;
  onClose: () => void;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ open, onClose }) => {
  const [uploadProgressList, setUploadProgressList] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ success: number; error: number }>({ success: 0, error: 0 });
  const [showResults, setShowResults] = useState(false);

  const currentPositionId = useKanbanStore((state) => state.currentPositionId);
  const addCandidates = useKanbanStore((state) => state.addCandidates);
  const fetchCandidates = useKanbanStore((state) => state.fetchCandidates);

  const handleClose = () => {
    if (uploading) {
      message.warning('有文件正在上传中，请等待完成或刷新页面取消');
      return;
    }
    setUploadProgressList([]);
    setResults({ success: 0, error: 0 });
    setShowResults(false);
    onClose();
  };

  const uploadFile = useCallback(
    async (file: File, positionId: number): Promise<void> => {
      const fileIndex = uploadProgressList.findIndex((p) => p.fileName === file.name);
      
      try {
        setUploadProgressList((prev) =>
          prev.map((p, i) =>
            i === fileIndex ? { ...p, progress: 0, status: 'uploading' as const } : p
          )
        );

        const response = await candidateApi.uploadResume(
          positionId,
          file,
          (progress) => {
            setUploadProgressList((prev) =>
              prev.map((p, i) =>
                i === fileIndex
                  ? { ...p, progress: Math.min(progress, 99), status: 'uploading' as const }
                  : p
              )
            );
          }
        );

        setUploadProgressList((prev) =>
          prev.map((p, i) =>
            i === fileIndex
              ? { ...p, progress: 100, status: 'parsing' as const, message: '正在解析简历...' }
              : p
          )
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (response.data.status === 'PROCESSING' || response.data.candidateId) {
          setUploadProgressList((prev) =>
            prev.map((p, i) =>
              i === fileIndex
                ? {
                    ...p,
                    progress: 100,
                    status: 'success' as const,
                    message: `上传成功，正在后台解析：${response.data.fileName}`,
                  }
                : p
            )
          );
          setResults((prev) => ({ ...prev, success: prev.success + 1 }));
        } else {
          setUploadProgressList((prev) =>
            prev.map((p, i) =>
              i === fileIndex
                ? {
                    ...p,
                    progress: 100,
                    status: 'error' as const,
                    message: response.data.message || '简历上传失败',
                  }
                : p
            )
          );
          setResults((prev) => ({ ...prev, error: prev.error + 1 }));
        }
      } catch (error: any) {
        setUploadProgressList((prev) =>
          prev.map((p, i) =>
            i === fileIndex
              ? {
                  ...p,
                  progress: 100,
                  status: 'error' as const,
                  message: error.message || '上传失败',
                }
              : p
          )
        );
        setResults((prev) => ({ ...prev, error: prev.error + 1 }));
      }
    },
    [uploadProgressList, addCandidates]
  );

  const handleBeforeUpload = useCallback(
    (file: File) => {
      if (!currentPositionId) {
        message.error('请先选择一个职位');
        return Upload.LIST_IGNORE;
      }

      const isPdfOrDocx =
        file.type === 'application/pdf' ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.docx');

      if (!isPdfOrDocx) {
        message.error('只支持 PDF 或 DOCX 格式的文件');
        return Upload.LIST_IGNORE;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB');
        return Upload.LIST_IGNORE;
      }

      setUploadProgressList((prev) => [
        ...prev,
        {
          fileName: file.name,
          progress: 0,
          status: 'uploading',
        },
      ]);

      return false;
    },
    [currentPositionId]
  );

  const handleChange = useCallback(
    async (info: UploadChangeParam<UploadFileWithProcessed>) => {
      if (!currentPositionId) return;

      const { fileList } = info;
      const newFiles = fileList.filter((f) => f.status === 'uploading' && !f._processed);

      if (newFiles.length > 0) {
        setUploading(true);
        setShowResults(false);

        for (const file of newFiles) {
          (file as UploadFileWithProcessed)._processed = true;
          if (file.originFileObj) {
            await uploadFile(file.originFileObj, currentPositionId);
          }
        }

        setUploading(false);
        setShowResults(true);

        if (currentPositionId) {
          await fetchCandidates(currentPositionId);
        }
      }
    },
    [currentPositionId, uploadFile, fetchCandidates]
  );

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return <LoadingOutlined style={{ color: '#1890ff' }} spin />;
      case 'parsing':
        return <LoadingOutlined style={{ color: '#faad14' }} spin />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return '上传中';
      case 'parsing':
        return '解析中';
      case 'success':
        return '成功';
      case 'error':
        return '失败';
      default:
        return '';
    }
  };

  return (
    <Modal
      title="批量上传简历"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={700}
      destroyOnClose
    >
      {!currentPositionId && (
        <Alert
          message="请先在左侧选择一个职位"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Dragger
        name="file"
        multiple
        accept=".pdf,.docx"
        beforeUpload={handleBeforeUpload}
        onChange={handleChange}
        disabled={!currentPositionId || uploading}
        showUploadList={false}
        fileList={[]}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持批量上传 PDF 和 DOCX 格式简历，单个文件不超过 10MB
        </p>
      </Dragger>

      {uploadProgressList.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 12 }}>上传列表</h4>
          <List
            dataSource={uploadProgressList}
            renderItem={(item, index) => (
              <List.Item key={index}>
                <List.Item.Meta
                  avatar={getStatusIcon(item.status)}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.fileName}
                      </span>
                      <span style={{ marginLeft: 16, color: '#888' }}>
                        {getStatusText(item.status)}
                      </span>
                    </div>
                  }
                  description={
                    <div style={{ marginTop: 8 }}>
                      <Progress
                        percent={item.progress}
                        size="small"
                        status={
                          item.status === 'error'
                            ? 'exception'
                            : item.status === 'success'
                            ? 'success'
                            : 'active'
                        }
                      />
                      {item.message && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: item.status === 'error' ? '#ff4d4f' : '#52c41a',
                          }}
                        >
                          {item.message}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {showResults && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <span>
              成功 <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{results.success}</span> 个
            </span>
            <span>
              失败 <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{results.error}</span> 个
            </span>
          </Space>
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={handleClose} disabled={uploading}>
            {uploading ? '上传中...' : '关闭'}
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default ResumeUpload;
