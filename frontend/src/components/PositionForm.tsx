import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, Space, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { Position, PositionFormData, StageTemplate } from '@/types';
import { positionApi } from '@/services/api';
import { useKanbanStore } from '@/store/kanbanStore';

interface PositionFormProps {
  open: boolean;
  onClose: () => void;
  editPosition?: Position | null;
}

const defaultStages: StageTemplate[] = [
  { name: '初筛', order: 1 },
  { name: '一面', order: 2 },
  { name: '二面', order: 3 },
  { name: 'HR面', order: 4 },
  { name: 'Offer', order: 5 },
  { name: '已淘汰', order: 6 },
];

const PositionForm: React.FC<PositionFormProps> = ({
  open,
  onClose,
  editPosition,
}) => {
  const [form] = Form.useForm<PositionFormData>();
  const addPosition = useKanbanStore((state) => state.addPosition);
  const updatePosition = useKanbanStore((state) => state.updatePosition);
  const setCurrentPositionId = useKanbanStore((state) => state.setCurrentPositionId);

  useEffect(() => {
    if (editPosition) {
      form.setFieldsValue({
        title: editPosition.title,
        department: editPosition.department,
        jobDescription: editPosition.jobDescription,
        qualifications: editPosition.qualifications,
        stageTemplate: editPosition.stageTemplate || defaultStages,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        stageTemplate: defaultStages,
      });
    }
  }, [editPosition, form, open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const stageTemplate = values.stageTemplate?.map((stage, index) => ({
        ...stage,
        order: index + 1,
      })) || defaultStages;

      const data: PositionFormData = {
        ...values,
        stageTemplate,
      };

      if (editPosition) {
        const response = await positionApi.update(editPosition.id, data);
        updatePosition(response.data);
        message.success('职位更新成功');
      } else {
        const response = await positionApi.create(data);
        addPosition(response.data);
        setCurrentPositionId(response.data.id);
        message.success('职位创建成功');
      }

      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message || '保存失败');
    }
  };

  return (
    <Modal
      title={editPosition ? '编辑职位' : '创建新职位'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ stageTemplate: defaultStages }}
      >
        <Form.Item
          name="title"
          label="职位名称"
          rules={[{ required: true, message: '请输入职位名称' }]}
        >
          <Input placeholder="如：高级前端工程师" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="department"
          label="所属部门"
          rules={[{ required: true, message: '请输入所属部门' }]}
        >
          <Input placeholder="如：技术部" maxLength={50} />
        </Form.Item>

        <Form.Item
          name="jobDescription"
          label="职位描述"
          rules={[{ required: true, message: '请输入职位描述' }]}
        >
          <Input.TextArea
            placeholder="请输入职位描述..."
            rows={4}
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="qualifications"
          label="任职要求"
          rules={[{ required: true, message: '请输入任职要求' }]}
        >
          <Input.TextArea
            placeholder="请输入任职要求..."
            rows={4}
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Form.Item label="面试阶段流程">
          <Form.List name="stageTemplate">
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <Space
                    key={key}
                    style={{ display: 'flex', marginBottom: 8, width: '100%' }}
                    align="baseline"
                  >
                    <span style={{ width: 24, textAlign: 'center', color: '#888' }}>
                      {index + 1}.
                    </span>
                    <Form.Item
                      {...restField}
                      name={[name, 'name']}
                      rules={[
                        { required: true, message: '请输入阶段名称' },
                      ]}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <Input placeholder="阶段名称" maxLength={20} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'order']}
                      hidden
                      initialValue={index + 1}
                    >
                      <Input type="hidden" />
                    </Form.Item>
                    {fields.length > 1 && (
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ff4d4f', cursor: 'pointer' }}
                      />
                    )}
                  </Space>
                ))}
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加阶段
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" htmlType="submit">
              {editPosition ? '更新' : '创建'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PositionForm;
