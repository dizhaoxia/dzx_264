import React, { useState, useRef, useEffect } from 'react';
import { Modal, Upload, Progress, List, Button, Space, Alert, message } from 'antd';
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload/interface';
import type { UploadProgress } from '@/types';
import { candidateApi } from '@/services/api';
import { useKanbanStore } from '@/store/kanbanStore';

const { Dragger } = Upload;

interface ResumeUploadProps {
  open: boolean;
  onClose: () => void;
}

interface UploadTask {
  uid: string;
  fileName: string;
  file: File;
  progress: number;
  status: UploadProgress['status'];
  message?: string;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ open, onClose }) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ success: number; error: number }>({ success: 0, error: 0 });
  const [showResults, setShowResults] = useState(false);
  const processingRef = useRef<Set<string>>(new Set());

  const currentPositionId = useKanbanStore((state) => state.currentPositionId);
  const fetchCandidates = useKanbanStore((state) => state.fetchCandidates);

  useEffect(() => {
    if (open) {
      setTasks([]);
      setResults({ success: 0, error: 0 });
      setShowResults(false);
      processingRef.current.clear();
    }
  }, [open]);

  const handleClose = () => {
    if (uploading) {
      message.warning('有文件正在上传中，请等待完成');
      return;
    }
    onClose();
  };

  const updateTask = (uid: string, updates: Partial<UploadTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.uid === uid ? { ...t, ...updates } : t))
    );
  };

  const processFile = async (task: UploadTask, positionId: number) => {
    if (processingRef.current.has(task.uid)) {
      return;
    }
    processingRef.current.add(task.uid);

    try {
      updateTask(task.uid, { progress: 0, status: 'uploading' });

      const response = await candidateApi.uploadResume(
        positionId,
        task.file,
        (progress) => {
          updateTask(task.uid, {
            progress: Math.min(progress, 99),
            status: 'uploading',
          });
        }
      );

      updateTask(task.uid, {
        progress: 100,
        status: 'parsing',
        message: '正在解析简历...',
      });

      if (response.data && (response.data.status === 'PROCESSING' || response.data.candidateId)) {
        updateTask(task.uid, {
          progress: 100,
          status: 'success',
          message: `上传成功，正在后台解析：${response.data.fileName || task.fileName}`,
        });
        setResults((prev) => ({ ...prev, success: prev.success + 1 }));
      } else {
        updateTask(task.uid, {
          progress: 100,
          status: 'error',
          message: response.data?.message || '简历上传失败',
        });
        setResults((prev) => ({ ...prev, error: prev.error + 1 }));
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      updateTask(task.uid, {
        progress: 100,
        status: 'error',
        message: error.message || '上传失败，请检查网络连接',
      });
      setResults((prev) => ({ ...prev, error: prev.error + 1 }));
    } finally {
      processingRef.current.delete(task.uid);
    }
  };

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const { file, onError, onSuccess } = options;
    const fileObj = file as File;
    const uid = String((file as any).uid || Date.now() + Math.random());

    if (!currentPositionId) {
      message.error('请先选择一个职位');
      onError?.(new Error('请先选择一个职位'));
      return;
    }

    const newTask: UploadTask = {
      uid,
      fileName: fileObj.name,
      file: fileObj,
      progress: 0,
      status: 'uploading',
    };

    setTasks((prev) => [...prev, newTask]);
    setUploading(true);
    setShowResults(false);

    try {
      await processFile(newTask, currentPositionId);
      onSuccess?.(null, fileObj);
    } catch (err) {
      onError?.(err as Error);
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      const allDone = tasks.every(
        (t) => t.status === 'success' || t.status === 'error'
      );
      if (allDone && uploading) {
        setUploading(false);
        setShowResults(true);
        if (currentPositionId) {
          setTimeout(() => {
            fetchCandidates(currentPositionId);
          }, 500);
        }
      }
    }
  }, [tasks, uploading, currentPositionId, fetchCandidates]);

  const beforeUpload = (file: File) => {
    const isPdfOrDocx =
      file.type === 'application/pdf' ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.docx');

    if (!isPdfOrDocx) {
      message.error(`${file.name} 格式不支持，只支持 PDF 或 DOCX`);
      return Upload.LIST_IGNORE;
    }

    const isLt50M = file.size / 1024 / 1024 < 50;
    if (!isLt50M) {
      message.error(`${file.name} 文件大小不能超过 50MB`);
      return Upload.LIST_IGNORE;
    }

    return true;
  };

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
      maskClosable={!uploading}
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
        beforeUpload={beforeUpload}
        customRequest={customRequest}
        disabled={!currentPositionId || uploading}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持批量上传 PDF 和 DOCX 格式简历，单个文件不超过 50MB
        </p>
      </Dragger>

      {tasks.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 12 }}>上传列表</h4>
          <List
            dataSource={tasks}
            renderItem={(item) => (
              <List.Item key={item.uid}>
                <List.Item.Meta
                  avatar={getStatusIcon(item.status)}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginRight: 16,
                        }}
                      >
                        {item.fileName}
                      </span>
                      <span style={{ color: '#888' }}>{getStatusText(item.status)}</span>
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
