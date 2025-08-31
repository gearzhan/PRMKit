import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  App,
  Popconfirm,
  Tag,
  Card,
  Typography,
  Tooltip,
  Switch,
} from 'antd';
import PageLayout from '@/components/PageLayout';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  TagOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import api, { stageAPI } from '@/lib/api';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 阶段接口类型定义
interface Stage {
  id: string;
  taskId: string; // 任务ID (如 TD.00.00)
  name: string; // 任务名称
  description?: string; // 任务描述
  category?: string; // 任务类别
  isActive: boolean; // 是否激活
  createdAt: string;
  updatedAt: string;
}

// 阶段表单数据类型
interface StageFormData {
  taskId: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
}

// 类别颜色映射
const CATEGORY_COLORS: Record<string, string> = {
  'Administration': 'blue',
  'Leave': 'orange',
  'Design': 'green',
  'Construction': 'purple',
  'Marketing': 'cyan',
  'Consulting': 'magenta',
  'Management': 'gold',
};

/**
 * 管理员阶段模板管理页面
 * 提供阶段模板的增删改查功能
 */
const AdminStagingManagement: React.FC = () => {
  const { message } = App.useApp();
  const [stages, setStages] = useState<Stage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [form] = Form.useForm<StageFormData>();


  // 获取类别列表
  const fetchCategories = async () => {
    try {
      const response = await stageAPI.getCategories();
      setCategories(response.categories || []);
    } catch (error: any) {
      console.error('获取类别列表失败:', error);
      if (error.response?.status === 401) {
        message.error('认证失败，请重新登录');
      } else {
        message.error('获取类别列表失败，请检查网络连接');
      }
    }
  };

  // 获取阶段列表
  const fetchStages = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchText) params.search = searchText;
      if (categoryFilter) params.category = categoryFilter;
      
      const response = await stageAPI.getList(params);
      const stageList = response.stages || [];
      setStages(stageList);
    } catch (error: any) {
      console.error('获取阶段列表失败:', error);
      if (error.response?.status === 401) {
        message.error('认证失败，请重新登录');
      } else {
        message.error('Failed to fetch stage list');
      }
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchStages();
  }, [searchText, categoryFilter]);

  // 打开新建/编辑模态框
  const openModal = (stage?: Stage) => {
    setEditingStage(stage || null);
    setModalVisible(true);
    
    if (stage) {
      // 编辑模式，填充表单数据
      form.setFieldsValue({
        taskId: stage.taskId,
        name: stage.name,
        description: stage.description,
        category: stage.category,
        isActive: stage.isActive,
      });
    } else {
      // 新建模式，重置表单
      form.resetFields();
      form.setFieldsValue({
        isActive: true,
      });
    }
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingStage(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingStage) {
        // 更新阶段
        await stageAPI.update(editingStage.id, values);
        message.success('Stage updated successfully');
      } else {
        // 创建阶段
        await stageAPI.create(values);
        message.success('Stage created successfully');
      }
      
      closeModal();
      fetchStages();
      fetchCategories(); // 重新获取类别列表
    } catch (error: any) {
      console.error('提交阶段失败:', error);
      if (error.response?.status === 401) {
        message.error('认证失败，请重新登录');
      } else if (error.response?.status === 409) {
        message.error('Task ID already exists');
      } else {
        message.error('Failed to save stage');
      }
    }
  };

  // 删除阶段
  const handleDelete = async (id: string) => {
    try {
      await stageAPI.delete(id);
      message.success('Stage deleted successfully');
      fetchStages();
    } catch (error: any) {
      console.error('删除阶段失败:', error);
      if (error.response?.status === 401) {
        message.error('认证失败，请重新登录');
      } else {
        message.error('Failed to delete stage');
      }
    }
  };

  // 表格列定义
  const columns: ColumnsType<Stage> = [
    {
      title: 'Task ID',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 120,
      sorter: (a, b) => a.taskId.localeCompare(b.taskId),
      render: (taskId: string) => (
        <Tag color="blue" style={{ fontFamily: 'monospace' }}>
          {taskId}
        </Tag>
      ),
    },
    {
      title: 'Task Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => (
        <span style={{ fontWeight: 500 }}>{name}</span>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: {
        showTitle: false,
      },
      render: (description?: string) => (
        <Tooltip title={description} placement="topLeft">
          <span style={{ color: '#666' }}>
            {description || 'No description'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: categories.map(cat => ({ text: cat, value: cat })),
      onFilter: (value, record) => record.category === value,
      render: (category?: string) => {
        if (!category) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Tag color={CATEGORY_COLORS[category] || 'default'}>
            {category}
          </Tag>
        );
      },
    },

    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal(record)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
              title="Delete Stage"
              description="Are you sure you want to delete this stage?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
            <Tooltip title="Delete">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageLayout
      title="Staging Management"
      description="Manage task templates and categories for timesheet entries"
      icon={<SettingOutlined />}
    >



        {/* 操作栏 */}
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Space size="middle">
                <Input.Search
                  placeholder="Search by task ID, name, or description"
                  allowClear
                  style={{ width: 300 }}
                  onSearch={setSearchText}
                  onChange={(e) => !e.target.value && setSearchText('')}
                />
                <Select
                  placeholder="Filter by category"
                  allowClear
                  style={{ width: 150 }}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                >
                  {categories.map(category => (
                    <Option key={category} value={category}>
                      {category}
                    </Option>
                  ))}
                </Select>
              </Space>
            </div>
            <div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openModal()}
              >
                Add New Stage
              </Button>
            </div>
          </div>
        </Card>

        {/* 阶段表格 */}
        <Card>
          <Table<Stage>
            columns={columns}
            dataSource={stages}
            rowKey="id"
            loading={loading}
            pagination={{
              total: stages.length,
              pageSize: 20,
              pageSizeOptions: ['20', '50'],
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            }}
            scroll={{ x: 800 }}
          />
        </Card>

        {/* 新建/编辑模态框 */}
        <Modal
          title={editingStage ? 'Edit Stage' : 'Add Stage'}
          open={modalVisible}
          onOk={handleSubmit}
          onCancel={closeModal}
          width={600}
          destroyOnHidden
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
          >
            <Form.Item
              name="taskId"
              label="Task ID"
              rules={[
                { required: true, message: 'Please enter task ID' },
                { pattern: /^TD\.[0-9]{2}\.[0-9]{2}$/, message: 'Task ID format should be TD.XX.XX' },
              ]}
            >
              <Input
                placeholder="e.g., TD.01.00"
                style={{ fontFamily: 'monospace' }}
                disabled={!!editingStage} // 编辑时不允许修改ID
              />
            </Form.Item>

            <Form.Item
              name="name"
              label="Task Name"
              rules={[{ required: true, message: 'Please enter task name' }]}
            >
              <Input placeholder="e.g., Sketch Design" />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description"
            >
              <TextArea
                rows={3}
                placeholder="Detailed description of the task"
              />
            </Form.Item>

            <Form.Item
              name="category"
              label="Category"
            >
              <Select
                placeholder="Select a category"
                allowClear
                showSearch
              >
                {categories.map(category => (
                  <Option key={category} value={category}>
                    {category}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="isActive"
              label="Status"
              valuePropName="checked"
            >
              <Switch
                checkedChildren="Active"
                unCheckedChildren="Inactive"
              />
            </Form.Item>
          </Form>
        </Modal>
    </PageLayout>
  );
};

export default AdminStagingManagement;