import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  DatePicker,
  Select,
  Input,
  Modal,
  App,
  Tooltip,
  Dropdown,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  MoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { useAuthStore } from '@/stores/authStore';
import { timesheetAPI, projectAPI } from '@/lib/api';
import { isLevel3Worker, isLevel1Admin } from '@/utils/roleUtils';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

// 工时记录接口定义
interface TimesheetRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  project: {
    id: string;
    name: string;
    projectCode: string;
  };
  stage?: {
    id: string;
    name: string;
  };
  description?: string;
  employee?: {
    id: string;
    name: string;
    employeeId: string;
  };
  createdAt: string;
  updatedAt: string;
}

// 状态标签配置
const statusConfig = {
  DRAFT: { color: 'default', text: 'Draft' },
  SUBMITTED: { color: 'processing', text: 'Submitted' },
  APPROVED: { color: 'success', text: 'Approved' },
};

const Timesheets: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { user, isManagerOrAdmin } = useAuthStore();
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [timesheets, setTimesheets] = useState<TimesheetRecord[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // 筛选条件 - 设置默认日期范围为当月
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    projectId: undefined as string | undefined,
    employeeId: undefined as string | undefined,
    dateRange: [dayjs().startOf('month'), dayjs().endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs] | undefined,
    search: '',
  });
  
  // 临时日期范围状态 - 用于确认按钮功能
  const [tempDateRange, setTempDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | undefined>(
    [dayjs().startOf('month'), dayjs().endOf('month')]
  );
  
  // 统计数据
  const [stats, setStats] = useState({
    totalHours: 0,
    totalRecords: 0,
    pendingApproval: 0,
    approvedHours: 0,
  });

  // 获取工时记录列表
  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: pageSize,
        ...filters,
      };
      
      // 处理日期范围
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
        delete params.dateRange;
      }
      
      const response = await timesheetAPI.getList(params);
      setTimesheets(response.timesheets || []);
      setTotal(response.pagination?.total || 0);
      
      // 计算统计数据
      const totalHours = response.timesheets?.reduce((sum: number, item: TimesheetRecord) => sum + item.hours, 0) || 0;
      const pendingCount = response.timesheets?.filter((item: TimesheetRecord) => item.status === 'SUBMITTED').length || 0;
      const approvedHours = response.timesheets?.filter((item: TimesheetRecord) => item.status === 'APPROVED')
        .reduce((sum: number, item: TimesheetRecord) => sum + item.hours, 0) || 0;
      
      setStats({
        totalHours,
        totalRecords: response.pagination?.total || 0,
        pendingApproval: pendingCount,
        approvedHours,
      });
    } catch (error: any) {
      console.error('Failed to fetch timesheets:', error);
      message.error(error.response?.data?.error || 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  };

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getList({ status: 'ACTIVE' });
      setProjects(response.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  // 删除工时记录
  const handleDelete = async (id: string) => {
    modal.confirm({
      title: 'Delete Timesheet',
      content: 'Are you sure you want to delete this timesheet record?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await timesheetAPI.delete(id);
          message.success('Timesheet deleted successfully');
          fetchTimesheets();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'Failed to delete timesheet');
        }
      },
    });
  };

  // 撤回工时记录
  const handleWithdraw = async (id: string) => {
    try {
      await timesheetAPI.withdraw(id);
      message.success('Timesheet withdrawn successfully');
      fetchTimesheets();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to withdraw timesheet');
    }
  };

  // 重新提交工时记录
  const handleResubmit = async (id: string) => {
    try {
      await timesheetAPI.submit(id);
      message.success('Timesheet resubmitted successfully');
      fetchTimesheets();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to resubmit timesheet');
    }
  };

  // 操作菜单
  const getActionMenu = (record: TimesheetRecord) => {
    const items: any[] = [];

    // Draft状态下的操作：Edit, Submit, Delete
    if (record.status === 'DRAFT') {
      // Edit - 编辑操作
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Edit',
        onClick: (info: any) => {
          info?.domEvent?.stopPropagation();
          navigate(`/timesheets/${record.id}/edit`);
        },
      });
      
      // Submit - 提交操作
      items.push({
        key: 'submit',
        icon: <PlusOutlined />,
        label: 'Submit',
        onClick: (info: any) => {
          info?.domEvent?.stopPropagation();
          handleResubmit(record.id);
        },
      });
      
      // Delete - 删除操作
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: 'Delete',
        onClick: (info: any) => {
          info?.domEvent?.stopPropagation();
          handleDelete(record.id);
        },
      });
    }

    // Withdraw - 只有已提交的记录可以撤回
    if (record.status === 'SUBMITTED') {
      items.push({
        key: 'withdraw',
        icon: <DeleteOutlined />,
        label: 'Withdraw',
        onClick: (info: any) => {
          info?.domEvent?.stopPropagation();
          handleWithdraw(record.id);
        },
      });
    }

    return items;
  };

  // 表格列定义
  const columns: ColumnsType<TimesheetRecord> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: true,
    },
    {
      title: 'Project',
      key: 'project',
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.project.name}</div>
          <div className="text-xs text-gray-500">{record.project.projectCode}</div>
        </div>
      ),
    },
    {
      title: 'Stage',
      key: 'stage',
      width: 120,
      render: (_, record) => record.stage?.name || 'N/A',
    },
    {
      title: 'Time',
      key: 'time',
      width: 150,
      render: (_, record) => {
        // 将ISO时间格式转换为24小时制时间格式
        const startTime = dayjs(record.startTime).format('HH:mm');
        const endTime = dayjs(record.endTime).format('HH:mm');
        return (
          <div className="text-sm">
            <div>{startTime} - {endTime}</div>
            <div className="text-gray-500">{record.hours}h</div>
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: {
        showTitle: false,
      },
      render: (description: string) => (
        <Tooltip placement="topLeft" title={description}>
          {description || 'No description'}
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const statusConfig = {
          DRAFT: { color: 'default', text: 'Draft' },
          SUBMITTED: { color: 'processing', text: 'Submitted' },
          APPROVED: { color: 'success', text: 'Approved' },
        };
        const config = statusConfig[record.status as keyof typeof statusConfig] || 
                      { color: 'default', text: 'Draft' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },

    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const menuItems = getActionMenu(record);
        
        // 如果没有可用操作，显示禁用的按钮
        if (menuItems.length === 0) {
          return (
            <Button 
              type="text" 
              icon={<MoreOutlined />} 
              disabled 
              title="No actions available"
            />
          );
        }
        
        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  // 确认日期筛选
  const handleConfirmDateFilter = () => {
    setFilters({ ...filters, dateRange: tempDateRange });
    setCurrentPage(1);
  };

  // 重置筛选条件
  const handleResetFilters = () => {
    setFilters({
      status: undefined,
      projectId: undefined,
      employeeId: undefined,
      dateRange: undefined,
      search: '',
    });
    setTempDateRange(undefined);
    setCurrentPage(1);
  };

  // 导出数据
  const handleExport = () => {
    // TODO: 实现导出功能
    message.info('Export feature coming soon');
  };

  // 初始化数据
  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [currentPage, pageSize, filters]);

  return (
    <PageLayout
      title="Timesheets"
      description="Manage and track your timesheet records"
      icon={<ClockCircleOutlined />}
    >

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Hours"
              value={stats.totalHours}
              precision={1}
              suffix="h"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Records"
              value={stats.totalRecords}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Approval"
              value={stats.pendingApproval}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Approved Hours"
              value={stats.approvedHours}
              precision={1}
              suffix="h"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和操作栏 */}
      <Card className="mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Search
              placeholder="Search timesheets..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onSearch={() => fetchTimesheets()}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Filter by status"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="DRAFT">Draft</Option>
              <Option value="SUBMITTED">Submitted</Option>
              <Option value="APPROVED">Approved</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Filter by project"
              value={filters.projectId}
              onChange={(value) => setFilters({ ...filters, projectId: value })}
              allowClear
              style={{ width: '100%' }}
            >
              {projects.map((project) => (
                <Option key={project.id} value={project.id}>
                  {project.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space.Compact style={{ width: '100%' }}>
              <RangePicker
                value={tempDateRange}
                onChange={(dates) => setTempDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                style={{ width: 'calc(100% - 30px)' }}
              />
              <Button
                type="primary"
                onClick={handleConfirmDateFilter}
                style={{ width: '30px' }}
              >
                OK
              </Button>
            </Space.Compact>
          </Col>
        </Row>
        
        <Row gutter={16} className="mt-4" justify="space-between">
          <Col>
            <Space>
              <Button
                icon={<FilterOutlined />}
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={handleExport}
              >
                Export
              </Button>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/timesheets/new')}
            >
              New Timesheet
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 工时记录表格 */}
      <Card>
        <Table<TimesheetRecord>
          columns={columns}
          dataSource={timesheets}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 20);
            },
          }}
          scroll={{ x: 1200 }}
        />      </Card>
    </PageLayout>
  );
};

export default Timesheets;