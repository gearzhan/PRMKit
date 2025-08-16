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
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  DatePicker,
  Checkbox,
  Tabs,
  Avatar,
  Divider,
} from 'antd';
import PageLayout from '@/components/PageLayout';
import {
  CheckOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ProjectOutlined,
  CalendarOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import api, { adminApprovalAPI } from '@/lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

// 审批状态选项
const APPROVAL_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending', color: 'orange' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
];

// 审批记录接口类型定义
interface Approval {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  approvedAt?: string;
  comments?: string;
  timesheet: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    hours: number; // 后端返回的是hours字段
    description?: string;
    employee: { // 后端返回的是employee字段，不是submitter
      id: string;
      name: string;
      employeeId: string;
      email: string;
    };
    project: {
      id: string;
      name: string;
      projectCode: string; // 后端返回的是projectCode字段，不是code
    };
    stage?: {
      id: string;
      name: string;
    };
  };
  approver?: {
    id: string;
    name: string;
    employeeId: string;
  };
}

// 分页信息接口
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 统计信息接口
interface Statistics {
  statusStats: Array<{ status: string; _count: { id: number } }>;
  projectStats: Array<{ project: { id: string; name: string; projectCode: string }; _count: { id: number } }>;
  approverStats: Array<{ approver: { id: string; name: string; employeeId: string }; _count: { id: number } }>;
  averageApprovalTimeHours: number;
  totalRecords: number;
}

/**
 * 管理员审批页面
 * 提供待审批列表、批量审批、审批历史等功能
 */
const AdminApprovals: React.FC = () => {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState('pending');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchAction] = useState<'approve'>('approve');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [form] = Form.useForm();
  
  // 过滤状态
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [submitterFilter, setSubmitterFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 分页状态
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  
  // 统计信息
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  
  // 项目和用户选项（用于筛选）
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; name: string; projectCode: string }>>([]);
  const [userOptions, setUserOptions] = useState<Array<{ id: string; name: string; employeeId: string }>>([]);

  // 获取审批列表
  const fetchApprovals = async (tab: string = activeTab) => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
      };
      

      if (projectFilter) params.projectId = projectFilter;
      if (submitterFilter) params.submitterId = submitterFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
        console.log('Frontend: 日期筛选参数', { startDate: params.startDate, endDate: params.endDate });
      }
      
      console.log('Frontend: 开始获取审批列表', { tab, params });
      console.log('Frontend: Token存在?', !!localStorage.getItem('token'));
      
      const response = tab === 'pending' 
        ? await adminApprovalAPI.getPending(params)
        : await adminApprovalAPI.getHistory(params);
      
      console.log('Frontend: API响应成功', response);
      setApprovals(response.approvals || []);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Frontend: 获取审批列表失败 - 详细错误信息:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      
      if (error.response?.status === 401) {
        message.error('Authentication failed. Please login again.');
      } else if (error.response?.status === 403) {
        message.error('Access denied. Insufficient permissions.');
      } else if (error.response?.data?.error) {
        message.error(`Failed to fetch approval list: ${error.response.data.error}`);
      } else {
        message.error('Failed to fetch approval list');
      }
    } finally {
      setLoading(false);
    }
  };

  // 获取统计信息
  const fetchStatistics = async () => {
    try {
      const params: any = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
        console.log('Frontend: 统计信息日期筛选参数', { startDate: params.startDate, endDate: params.endDate });
      }
      if (projectFilter) params.projectId = projectFilter;
      
      const response = await adminApprovalAPI.getStats(params);
      setStatistics(response);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  // 获取项目和用户选项
  const fetchOptions = async () => {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        api.get('/projects', { params: { limit: 1000 } }),
        api.get('/auth/users', { params: { limit: 1000 } }),
      ]);
      
      setProjectOptions(projectsRes.data.projects || []);
      setUserOptions(usersRes.data.users || []);
    } catch (error) {
      console.error('获取选项数据失败:', error);
    }
  };

  // 当筛选条件改变时重置页码
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [projectFilter, submitterFilter, dateRange, sortBy, sortOrder, activeTab]);

  // 获取数据的useEffect，避免循环依赖
  useEffect(() => {
    const fetchData = async () => {
      await fetchApprovals();
      await fetchStatistics();
    };
    fetchData();
  }, [activeTab, pagination.page, pagination.limit]);

  // 筛选条件变化时获取数据（延迟执行避免频繁调用）
   useEffect(() => {
     const timer = setTimeout(() => {
       fetchApprovals();
       fetchStatistics();
     }, 300);
     
     return () => clearTimeout(timer);
   }, [projectFilter, submitterFilter, dateRange, sortBy, sortOrder]);

  // 组件挂载时获取选项数据
  useEffect(() => {
    fetchOptions();
  }, []);

  // 批量审批
  const handleBatchAction = async () => {
    try {
      const values = await form.validateFields();
      
      await adminApprovalAPI.batchApprove(selectedRowKeys as string[], values.comments);
      
      message.success(`${selectedRowKeys.length} timesheets approved successfully`);
      setBatchModalVisible(false);
      setSelectedRowKeys([]);
      form.resetFields();
      fetchApprovals();
      fetchStatistics();
    } catch (error: any) {
      console.error('批量操作失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to approve timesheets');
      }
    }
  };

  // 打开批量操作模态框
  const openBatchModal = () => {
    setBatchModalVisible(true);
    form.resetFields();
  };

  // 查看详情
  const viewDetail = async (approval: Approval) => {
    try {
      const response = await adminApprovalAPI.getById(approval.id);
      setSelectedApproval(response);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('获取审批详情失败:', error);
      message.error('Failed to fetch approval details');
    }
  };

  // 重置筛选条件
  const resetFilters = () => {
    setProjectFilter(undefined);
    setSubmitterFilter(undefined);
    setDateRange(null);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    const option = APPROVAL_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'default';
  };

  // 获取状态标签文本
  const getStatusText = (status: string) => {
    const option = APPROVAL_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || status;
  };

  // 生成用户头像
  const getUserAvatar = (name: string) => {
    const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#87d068'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    return (
      <Avatar 
        style={{ backgroundColor: colors[colorIndex] }}
        size="small"
      >
        {name.charAt(0).toUpperCase()}
      </Avatar>
    );
  };

  // 待审批表格列定义
  const pendingColumns: ColumnsType<Approval> = [
    {
      title: 'Submitter',
      key: 'submitter',
      width: 120,
      fixed: 'left',
      render: (_, record) => {
        const employee = record.timesheet?.employee;
        if (!employee) return '-';
        return (
          <Space>
            {getUserAvatar(employee.name || 'Unknown')}
            <div>
              <div className="font-medium">{employee.name || 'Unknown'}</div>
              <div className="text-xs text-gray-500">{employee.employeeId || '-'}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Project',
      key: 'project',
      width: 200,
      render: (_, record) => {
        const project = record.timesheet?.project;
        if (!project) return '-';
        return (
          <div>
            <div className="font-medium">{project.name || 'Unknown'}</div>
            <div className="text-xs text-gray-500">{project.projectCode || '-'}</div>
          </div>
        );
      },
    },
    {
      title: 'Description',
      key: 'description',
      width: 200,
      render: (_, record) => {
        const description = record.timesheet?.description;
        return description ? (
          <div className="text-sm" title={description}>
            {description.length > 50 ? `${description.substring(0, 50)}...` : description}
          </div>
        ) : '-';
      },
    },
    {
      title: 'Date',
      key: 'date',
      width: 100,
      render: (_, record) => {
        const date = record.timesheet?.date;
        return date ? dayjs(date).format('YYYY-MM-DD') : '-';
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 80,
      render: (_, record) => {
        const hours = record.timesheet?.hours;
        return hours ? `${hours}h` : '-';
      },
    },
    {
      title: 'Submitted',
      key: 'submittedAt',
      width: 120,
      render: (_, record) => dayjs(record.submittedAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Details',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => viewDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  // 审批历史表格列定义
  const historyColumns: ColumnsType<Approval> = [
    {
      title: 'Submitter',
      key: 'submitter',
      width: 120,
      fixed: 'left',
      render: (_, record) => {
        const employee = record.timesheet?.employee;
        if (!employee) return '-';
        return (
          <Space>
            {getUserAvatar(employee.name || 'Unknown')}
            <div>
              <div className="font-medium">{employee.name || 'Unknown'}</div>
              <div className="text-xs text-gray-500">{employee.employeeId || '-'}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Project',
      key: 'project',
      width: 200,
      render: (_, record) => {
        const project = record.timesheet?.project;
        if (!project) return '-';
        return (
          <div>
            <div className="font-medium">{project.name || 'Unknown'}</div>
            <div className="text-xs text-gray-500">{project.projectCode || '-'}</div>
          </div>
        );
      },
    },
    {
      title: 'Date',
      key: 'date',
      width: 100,
      render: (_, record) => {
        const date = record.timesheet?.date;
        return date ? dayjs(date).format('YYYY-MM-DD') : '-';
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 80,
      render: (_, record) => {
        const hours = record.timesheet?.hours;
        return hours ? `${hours}h` : '-';
      },
    },
    {
      title: 'Approver',
      key: 'approver',
      width: 120,
      render: (_, record: Approval) => (
        record.approver ? (
          <div>
            <div className="font-medium">{record.approver.name}</div>
            <div className="text-xs text-gray-500">{record.approver.employeeId}</div>
          </div>
        ) : '-'
      ),
    },
    {
      title: 'Approved',
      key: 'approvedAt',
      width: 120,
      render: (_, record: Approval) => (
        record.approvedAt ? dayjs(record.approvedAt).format('YYYY-MM-DD HH:mm') : '-'
      ),
    },
    {
      title: 'Details',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => viewDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
    getCheckboxProps: (record: Approval) => ({
      disabled: record.status !== 'PENDING',
    }),
  };

  return (
    <PageLayout
      title="Approval Management"
      description="Review and approve employee timesheet submissions"
      icon={<FileTextOutlined />}
    >

      {/* 统计卡片 */}
      {statistics && (
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Records"
                value={statistics.totalRecords}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Pending Approvals"
                value={statistics.statusStats.find(s => s.status === 'PENDING')?._count.id || 0}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Approved"
                value={statistics.statusStats.find(s => s.status === 'APPROVED')?._count.id || 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Avg. Approval Time"
                value={statistics.averageApprovalTimeHours}
                suffix="hrs"
                precision={1}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选和操作栏 */}
      <Card className="mb-4">
        <Row gutter={16} align="middle" className="mb-4">
          <Col flex="auto">
            <Space wrap>

              <Select
                placeholder="Project"
                value={projectFilter}
                onChange={setProjectFilter}
                style={{ width: 150 }}
                allowClear
              >
                {projectOptions.map(project => (
                  <Option key={project.id} value={project.id}>
                    {project.name}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="Submitter"
                value={submitterFilter}
                onChange={setSubmitterFilter}
                style={{ width: 150 }}
                allowClear
              >
                {userOptions.map(user => (
                  <Option key={user.id} value={user.id}>
                    {user.name}
                  </Option>
                ))}
              </Select>

              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  console.log('Frontend: 日期范围变更', {
                    dates,
                    isValid: dates && dates[0] && dates[1],
                    startDate: dates?.[0]?.format('YYYY-MM-DD'),
                    endDate: dates?.[1]?.format('YYYY-MM-DD')
                  });
                  setDateRange(dates);
                }}
                format="YYYY-MM-DD"
                placeholder={['Start Date', 'End Date']}
                allowClear
              />
              <Button onClick={resetFilters}>Reset</Button>
              {activeTab === 'pending' && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => openBatchModal()}
                  disabled={selectedRowKeys.length === 0}
                >
                  Batch Approve ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 主要内容区域 */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'pending',
              label: 'Pending Approvals',
              children: (
                <Table
                  columns={pendingColumns}
                  dataSource={approvals}
                  rowKey="id"
                  loading={loading}
                  rowSelection={rowSelection}
                  scroll={{ x: 1400 }}
                  pagination={{
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({ ...prev, page, limit: pageSize || prev.limit }));
                    },
                  }}
                />
              ),
            },
            {
              key: 'history',
              label: 'Approval History',
              children: (
                <Table
                  columns={historyColumns}
                  dataSource={approvals}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1400 }}
                  pagination={{
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({ ...prev, page, limit: pageSize || prev.limit }));
                    },
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 批量操作模态框 */}
      <Modal
        title="Batch Approve Timesheets"
        open={batchModalVisible}
        onOk={handleBatchAction}
        onCancel={() => setBatchModalVisible(false)}
        okText="Approve"
      >
        <p>You are about to approve {selectedRowKeys.length} timesheet(s).</p>
        <Form form={form} layout="vertical">
          <Form.Item
            label="Comments"
            name="comments"
          >
            <TextArea
              rows={4}
              placeholder="Enter optional comments..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="Timesheet Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedApproval && selectedApproval.timesheet && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Timesheet Information" size="small">
                  <p><strong>Date:</strong> {selectedApproval.timesheet.date ? dayjs(selectedApproval.timesheet.date).format('YYYY-MM-DD') : 'N/A'}</p>
                  <p><strong>Time:</strong> {selectedApproval.timesheet.startTime || 'N/A'} - {selectedApproval.timesheet.endTime || 'N/A'}</p>
                  <p><strong>Duration:</strong> {selectedApproval.timesheet.hours || 0} hours</p>
                  <p><strong>Description:</strong> {selectedApproval.timesheet.description || 'N/A'}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Project Information" size="small">
                  <p><strong>Project:</strong> {selectedApproval.timesheet.project?.name || 'Unknown'}</p>
                  <p><strong>Code:</strong> {selectedApproval.timesheet.project?.projectCode || 'N/A'}</p>
                  <p><strong>Stage:</strong> {selectedApproval.timesheet.stage?.name || 'Unassigned'}</p>
                </Card>
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Submitter Information" size="small">
                  <p><strong>Name:</strong> {selectedApproval.timesheet.employee?.name || 'Unknown'}</p>
                  <p><strong>Employee ID:</strong> {selectedApproval.timesheet.employee?.employeeId || 'N/A'}</p>
                  <p><strong>Email:</strong> {selectedApproval.timesheet.employee?.email || 'N/A'}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Approval Information" size="small">
                  <p><strong>Status:</strong> 
                    <Tag color={getStatusColor(selectedApproval.status)} className="ml-2">
                      {getStatusText(selectedApproval.status)}
                    </Tag>
                  </p>
                  <p><strong>Submitted:</strong> {selectedApproval.submittedAt ? dayjs(selectedApproval.submittedAt).format('YYYY-MM-DD HH:mm') : 'N/A'}</p>
                  {selectedApproval.approver && (
                    <p><strong>Approver:</strong> {selectedApproval.approver.name}</p>
                  )}
                  {selectedApproval.approvedAt && (
                    <p><strong>Approved:</strong> {dayjs(selectedApproval.approvedAt).format('YYYY-MM-DD HH:mm')}</p>
                  )}
                  {selectedApproval.comments && (
                    <p><strong>Comments:</strong> {selectedApproval.comments}</p>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
};

export default AdminApprovals;