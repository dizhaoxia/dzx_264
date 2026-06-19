import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Button,
  Spin,
  Tag,
  Steps,
  Space,
  Descriptions,
  message,
} from 'antd';
import dayjs from 'dayjs';
import type { Candidate, OfferApproval, OfferApprovalNode } from '@/types';
import { offerApi } from '@/services/api';

interface OfferApprovalModalProps {
  open: boolean;
  candidate: Candidate | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const statusMap: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'processing', text: '审批中' },
  APPROVED: { color: 'green', text: '已通过' },
  REJECTED: { color: 'red', text: '已驳回' },
};

const nodeStatusMap: Record<
  string,
  'wait' | 'finish' | 'error' | 'process'
> = {
  PENDING: 'wait',
  APPROVED: 'finish',
  REJECTED: 'error',
};

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
};

const OfferApprovalModal: React.FC<OfferApprovalModalProps> = ({
  open,
  candidate,
  onClose,
  onUpdated,
}) => {
  const [editForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [approval, setApproval] = useState<OfferApproval | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const loadApproval = async () => {
    if (!candidate) return;
    setLoading(true);
    try {
      const res = await offerApi.getByCandidate(candidate.id);
      setApproval(res.data);
    } catch (error: any) {
      setApproval(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && candidate) {
      setApproval(null);
      editForm.resetFields();
      actionForm.resetFields();
      loadApproval();
    }
  }, [open, candidate]);

  useEffect(() => {
    if (approval) {
      editForm.setFieldsValue({
        salaryPackage: approval.salaryPackage,
        onboardingDate: approval.onboardingDate
          ? dayjs(approval.onboardingDate)
          : undefined,
      });
    } else {
      editForm.resetFields();
    }
  }, [approval, editForm]);

  const handleCreate = async () => {
    if (!candidate) return;
    try {
      const values = await editForm.validateFields();
      setCreating(true);
      await offerApi.create({
        candidateId: candidate.id,
        salaryPackage: values.salaryPackage,
        onboardingDate: dayjs(values.onboardingDate).format('YYYY-MM-DD'),
      });
      message.success('审批单已创建，卡片已锁定');
      onUpdated?.();
      await loadApproval();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!approval) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await offerApi.update(approval.id, {
        salaryPackage: values.salaryPackage,
        onboardingDate: dayjs(values.onboardingDate).format('YYYY-MM-DD'),
      });
      message.success('保存成功');
      await loadApproval();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!approval) return;
    try {
      const values = await actionForm.validateFields();
      setActing(true);
      await offerApi.approve(approval.id, {
        approverName: values.approverName,
        comment: values.comment,
      });
      message.success('已通过');
      onUpdated?.();
      actionForm.resetFields();
      await loadApproval();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '操作失败');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!approval) return;
    try {
      const values = await actionForm.validateFields();
      setActing(true);
      await offerApi.reject(approval.id, {
        approverName: values.approverName,
        comment: values.comment,
      });
      message.success('已驳回');
      onUpdated?.();
      actionForm.resetFields();
      await loadApproval();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '操作失败');
    } finally {
      setActing(false);
    }
  };

  const currentNode: OfferApprovalNode | undefined = approval
    ? approval.nodes.find((n) => n.nodeOrder === approval.currentNode) ||
      approval.nodes.find((n) => n.status === 'PENDING')
    : undefined;

  const isPending = approval?.status === 'PENDING';

  return (
    <Modal
      title="Offer 审批"
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : !approval ? (
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="salaryPackage"
            label="薪酬方案"
            rules={[{ required: true, message: '请输入薪酬方案' }]}
          >
            <Input placeholder="如：25k*16" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="onboardingDate"
            label="入职日期"
            rules={[{ required: true, message: '请选择入职日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button type="primary" loading={creating} onClick={handleCreate}>
              创建审批单
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Tag color={statusMap[approval.status]?.color || 'default'}>
              {statusMap[approval.status]?.text || approval.status}
            </Tag>
          </div>

          <Form form={editForm} layout="vertical">
            <Form.Item
              name="salaryPackage"
              label="薪酬方案"
              rules={[{ required: true, message: '请输入薪酬方案' }]}
            >
              <Input disabled={!isPending} maxLength={100} />
            </Form.Item>
            <Form.Item
              name="onboardingDate"
              label="入职日期"
              rules={[{ required: true, message: '请选择入职日期' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabled={!isPending}
              />
            </Form.Item>
            {isPending && (
              <Form.Item style={{ marginBottom: 16, textAlign: 'right' }}>
                <Button loading={saving} onClick={handleSave}>
                  保存
                </Button>
              </Form.Item>
            )}
          </Form>

          <div style={{ marginTop: 8 }}>
            <Steps
              direction="vertical"
              size="small"
              current={
                approval.nodes.findIndex((n) => n.status === 'PENDING') >= 0
                  ? approval.nodes.findIndex((n) => n.status === 'PENDING')
                  : approval.nodes.length - 1
              }
              items={approval.nodes.map((node) => ({
                title: node.roleName,
                status: nodeStatusMap[node.status] || 'wait',
                description: (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {node.approverName && (
                      <div>审批人：{node.approverName}</div>
                    )}
                    {node.comment && <div>意见：{node.comment}</div>}
                    {node.approvedAt && (
                      <div>时间：{formatDateTime(node.approvedAt)}</div>
                    )}
                  </div>
                ),
              }))}
            />
          </div>

          {isPending && currentNode && (
            <Form
              form={actionForm}
              layout="vertical"
              style={{
                marginTop: 16,
                padding: 16,
                backgroundColor: '#fafafa',
                borderRadius: 8,
              }}
            >
              <Descriptions
                column={1}
                size="small"
                style={{ marginBottom: 12 }}
              >
                <Descriptions.Item label="当前节点">
                  {currentNode.roleName}
                </Descriptions.Item>
              </Descriptions>
              <Form.Item
                name="approverName"
                label="审批人"
                rules={[{ required: true, message: '请输入审批人' }]}
              >
                <Input placeholder="请输入审批人姓名" maxLength={50} />
              </Form.Item>
              <Form.Item name="comment" label="意见">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button danger loading={acting} onClick={handleReject}>
                    驳回
                  </Button>
                  <Button type="primary" loading={acting} onClick={handleApprove}>
                    通过
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </>
      )}
    </Modal>
  );
};

export default OfferApprovalModal;
