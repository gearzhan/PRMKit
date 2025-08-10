import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Space,
  App,
  Popconfirm,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  InputNumber,
} from 'antd';
import Navigation from '@/components/Navigation';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ProjectOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import api from '@/lib/api';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

// 项目状态选项
const PROJECT_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', color: 'green' },
  { value: 'COMPLETED', label: 'Completed', color: 'blue' },
  { value: 'SUSPENDED', label: 'Suspended', color: 'orange' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'red' },
];

// 项目接口类型定义
interface Project {
  id: string;
  projectCode: string;
  name: string;
  description?: string;
  status: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  stages: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  _count: {
    timesheets: number;
  };
}

// 项目表单数据类型
interface ProjectFormData {
  projectCode: string;
  name: string;
  description?: string;
  status: string;
  startDate: dayjs.Dayjs;
  endDate?: dayjs.Dayjs;
}

/**
 * 管理员项目列表页面
 * 提供项目的增删改查功能
 */
const AdminProjectList: React.FC = () => {
  const { message } = App.useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [form] = Form.useForm<ProjectFormData>();
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    completed: 0,
    suspended: 0,
  });

  // 获取项目列表
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      
      const response = await api.get('/projects', { params });
      const projectList = response.data.projects || [];
      setProjects(projectList);
      
      // 计算统计数据
      const stats = {
        total: projectList.length,
        active: projectList.filter((p: Project) => p.status === 'ACTIVE').length,
        completed: projectList.filter((p: Project) => p.status === 'COMPLETED').length,
        suspended: projectList.filter((p: Project) => p.status === 'SUSPENDED').length,
      };
      setStatistics(stats);
    } catch (error) {
      console.error('获取项目列表失败:', error);
      message.error('Failed to fetch project list');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchProjects();
  }, [searchText, statusFilter]);

  // 打开新建/编辑模态框
  const openModal = (project?: Project) => {
    setEditingProject(project || null);
    setModalVisible(true);
    
    if (project) {
      // 编辑模式，填充表单数据
      form.setFieldsValue({
        projectCode: project.projectCode,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: dayjs(project.startDate),
        endDate: project.endDate ? dayjs(project.endDate) : undefined,
      });
    } else {
      // 新建模式，重置表单
      form.resetFields();
      form.setFieldsValue({
        status: 'ACTIVE',
      });
    }
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingProject(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData = {
        ...values,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate?.toISOString(),
      };

      if (editingProject) {
        // 更新项目
        await api.put(`/projects/${editingProject.id}`, formData);
        message.success('Project updated successfully');
      } else {
        // 创建项目
        await api.post('/projects', formData);
        message.success('Project created successfully');
      }

      closeModal();
      fetchProjects();
    } catch (error: any) {
      console.error('项目操作失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error(editingProject ? 'Failed to update project' : 'Failed to create project');
      }
    }
  };

  // 删除项目
  const handleDelete = async (projectId: string) => {
    try {
      await api.delete(`/projects/${projectId}`);
      message.success('Project deleted successfully');
      fetchProjects();
    } catch (error: any) {
      console.error('删除项目失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to delete project');
      }
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    const option = PROJECT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'default';
  };

  // 获取状态标签文本
  const getStatusText = (status: string) => {
    const option = PROJECT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || status;
  };

  // 表格列定义
  const columns: ColumnsType<Project> = [
    {
      title: 'Project Code',
      dataIndex: 'projectCode',
      key: 'projectCode',
      width: 120,
      fixed: 'left',
    },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },

    {
      title: 'Timesheets',
      key: 'timesheets',
      width: 100,
      render: (_, record) => (
        <span>
          <CalendarOutlined /> {record._count.timesheets}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this project?"
            description="This action cannot be undone and will affect related timesheet records."
            onConfirm={() => handleDelete(record.id)}
            okText="OK"
            cancelText="Cancel"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Title level={2}>
            <ProjectOutlined className="mr-2" />
            Project Management
          </Title>
        </div>
        <div>
          <Navigation />
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Projects"
              value={statistics.total}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active"
              value={statistics.active}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Completed"
              value={statistics.completed}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Suspended"
              value={statistics.suspended}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card className="mb-4">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space>
              <Input
                placeholder="Search project name, code or description"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                placeholder="Filter by status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
              >
                {PROJECT_STATUS_OPTIONS.map(option => (
                  <Option key={option.value} value={option.value}>
                    <Tag color={option.color}>{option.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
            >
              New Project
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 项目表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
        />
      </Card>

      {/* 新建/编辑项目模态框 */}
      <Modal
        title={editingProject ? 'Edit Project' : 'New Project'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        width={600}
        okText="OK"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Project Code"
                name="projectCode"
                rules={[
                  { required: true, message: 'Please enter project code' },
                  { pattern: /^[A-Z0-9_-]+$/, message: 'Project code can only contain uppercase letters, numbers, underscores and hyphens' },
                ]}
              >
                <Input placeholder="e.g.: PROJ_2024_001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Project Status"
                name="status"
                rules={[{ required: true, message: 'Please select project status' }]}
              >
                <Select>
                  {PROJECT_STATUS_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>
                      <Tag color={option.color}>{option.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Project Name"
            name="name"
            rules={[{ required: true, message: 'Please enter project name' }]}
          >
            <Input placeholder="Enter project name" />
          </Form.Item>

          <Form.Item
            label="Project Description"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="Enter project description (optional)"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Start Date"
                name="startDate"
                rules={[{ required: true, message: 'Please select start date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="End Date"
                name="endDate"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>


        </Form>
      </Modal>
    </div>
  );
};

export default AdminProjectList;