import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  TimePicker,
  InputNumber,
  Input,
  Button,
  Spin,
  Descriptions,
  Alert,
  Tag,
  Space,
  message,
} from 'antd';
import dayjs from 'dayjs';
import type {
  Candidate,
  Interviewer,
  MeetingRoom,
  ConflictCheckResult,
} from '@/types';
import { interviewApi } from '@/services/api';

const { TextArea } = Input;

interface InterviewScheduleModalProps {
  open: boolean;
  candidate: Candidate | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const buildDateTime = (dateVal: any, timeVal: any): string => {
  if (!dateVal || !timeVal) return '';
  const datePart = dayjs(dateVal).format('YYYY-MM-DD');
  const timePart = `${dayjs(timeVal).format('HH:mm')}:00`;
  return `${datePart}T${timePart}`;
};

const InterviewScheduleModal: React.FC<InterviewScheduleModalProps> = ({
  open,
  candidate,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(
    null
  );
  const [lastCheckedKey, setLastCheckedKey] = useState<string>('');

  useEffect(() => {
    if (open && candidate) {
      setLoading(true);
      setConflictResult(null);
      setLastCheckedKey('');
      form.resetFields();
      form.setFieldsValue({ round: 1 });
      Promise.all([interviewApi.getInterviewers(), interviewApi.getRooms()])
        .then(([interviewerRes, roomRes]) => {
          setInterviewers(interviewerRes.data);
          setRooms(roomRes.data);
        })
        .catch((error: any) => {
          message.error(error.message || '加载面试官/会议室失败');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, candidate, form]);

  const runCheck = async (): Promise<ConflictCheckResult | null> => {
    if (!candidate) return null;
    const values = form.getFieldsValue();
    if (
      !values.interviewerId ||
      !values.roomId ||
      !values.date ||
      !values.startTime ||
      !values.endTime
    ) {
      message.warning('请先完整填写面试官、会议室、日期与时间');
      return null;
    }
    setChecking(true);
    try {
      const startTime = buildDateTime(values.date, values.startTime);
      const endTime = buildDateTime(values.date, values.endTime);
      const res = await interviewApi.checkConflict({
        candidateId: candidate.id,
        interviewerId: values.interviewerId,
        roomId: values.roomId,
        startTime,
        endTime,
      });
      const result = res.data;
      setConflictResult(result);
      setLastCheckedKey(
        `${values.interviewerId}|${values.roomId}|${startTime}|${endTime}`
      );
      return result;
    } catch (error: any) {
      message.error(error.message || '检测冲突失败');
      return null;
    } finally {
      setChecking(false);
    }
  };

  const handleCheck = async () => {
    await runCheck();
  };

  const handleSlotClick = (slot: { startTime: string; endTime: string }) => {
    const startDayjs = dayjs(slot.startTime);
    const endDayjs = dayjs(slot.endTime);
    form.setFieldsValue({
      date: startDayjs,
      startTime: startDayjs,
      endTime: endDayjs,
    });
    setConflictResult(null);
    setLastCheckedKey('');
  };

  const handleSubmit = async () => {
    if (!candidate) return;
    try {
      const values = await form.validateFields();
      const startTime = buildDateTime(values.date, values.startTime);
      const endTime = buildDateTime(values.date, values.endTime);
      const currentKey = `${values.interviewerId}|${values.roomId}|${startTime}|${endTime}`;

      let result = conflictResult;
      if (!result || lastCheckedKey !== currentKey) {
        result = await runCheck();
      }
      if (!result) return;
      if (result.conflict) {
        message.error('当前时段存在冲突，请调整后再提交');
        return;
      }

      setSubmitting(true);
      await interviewApi.create({
        candidateId: candidate.id,
        positionId: candidate.positionId,
        stage: candidate.currentStage,
        interviewerId: values.interviewerId,
        roomId: values.roomId,
        startTime,
        endTime,
        round: values.round,
        remark: values.remark,
      });
      message.success('面试日程已创建，已发送邮件通知');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const interviewerValidateStatus =
    conflictResult?.conflict && conflictResult.interviewerConflict
      ? 'error'
      : '';
  const roomValidateStatus =
    conflictResult?.conflict && conflictResult.roomConflict ? 'error' : '';

  const footer = (
    <Space>
      <Button onClick={onClose}>取消</Button>
      <Button loading={checking} onClick={handleCheck}>
        检测冲突
      </Button>
      <Button type="primary" loading={submitting} onClick={handleSubmit}>
        提交
      </Button>
    </Space>
  );

  return (
    <Modal
      title="发起面试"
      open={open}
      onCancel={onClose}
      footer={footer}
      width={560}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        candidate && (
          <>
            <Descriptions
              column={2}
              size="small"
              bordered
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="候选人">
                {candidate.name}
              </Descriptions.Item>
              <Descriptions.Item label="当前阶段">
                {candidate.currentStage}
              </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical" initialValues={{ round: 1 }}>
              <Form.Item
                name="interviewerId"
                label="面试官"
                validateStatus={interviewerValidateStatus}
                rules={[{ required: true, message: '请选择面试官' }]}
              >
                <Select
                  placeholder="请选择面试官"
                  allowClear
                  options={interviewers.map((item) => ({
                    value: item.id,
                    label: `${item.name}（${item.department}/${item.title}）`,
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="roomId"
                label="会议室"
                validateStatus={roomValidateStatus}
                rules={[{ required: true, message: '请选择会议室' }]}
              >
                <Select
                  placeholder="请选择会议室"
                  allowClear
                  options={rooms.map((item) => ({
                    value: item.id,
                    label: `${item.name}（${item.location}）`,
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="date"
                label="日期"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Space style={{ display: 'flex', width: '100%' }} size={12}>
                <Form.Item
                  name="startTime"
                  label="开始时间"
                  style={{ flex: 1, marginBottom: 16 }}
                  rules={[{ required: true, message: '请选择开始时间' }]}
                >
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  name="endTime"
                  label="结束时间"
                  style={{ flex: 1, marginBottom: 16 }}
                  rules={[{ required: true, message: '请选择结束时间' }]}
                >
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Space>

              <Form.Item name="round" label="轮次">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <TextArea rows={3} maxLength={500} />
              </Form.Item>
            </Form>

            {conflictResult &&
              (conflictResult.conflict ? (
                <Alert
                  type="error"
                  showIcon
                  message={conflictResult.message || '该时段存在冲突'}
                  description={
                    conflictResult.recommendedSlots &&
                    conflictResult.recommendedSlots.length > 0 ? (
                      <div>
                        <div style={{ marginBottom: 8 }}>推荐可用时段：</div>
                        <Space wrap>
                          {conflictResult.recommendedSlots.map((slot, idx) => (
                            <Tag
                              key={idx}
                              color="blue"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleSlotClick(slot)}
                            >
                              {dayjs(slot.startTime).format('MM-DD HH:mm')} ~{' '}
                              {dayjs(slot.endTime).format('HH:mm')}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    ) : undefined
                  }
                />
              ) : (
                <Alert
                  type="success"
                  showIcon
                  message="该时段空闲，可提交"
                />
              ))}
          </>
        )
      )}
    </Modal>
  );
};

export default InterviewScheduleModal;
