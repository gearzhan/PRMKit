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
  Collapse,
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
  SendOutlined,
  RollbackOutlined,
  ReloadOutlined,
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

// 按天聚合的工时记录接口
interface DailyTimesheetSummary {
  date: string;
  dayOfWeek: string;
  totalHours: number;
  projects: {
    projectName: string;
    projectCode: string;
    stageName?: string;
    hours: number;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  }[];
  records: TimesheetRecord[];
  hasMultipleStatuses: boolean;
  primaryStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
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
  const [dailySummaries, setDailySummaries] = useState<DailyTimesheetSummary[]>([]);
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

  // 按天聚合工时记录数据
  const groupTimesheetsByDay = (timesheets: TimesheetRecord[]): DailyTimesheetSummary[] => {
    const grouped = timesheets.reduce((acc, record) => {
      const date = dayjs(record.date).format('YYYY-MM-DD');
      
      if (!acc[date]) {
        acc[date] = {
          date,
          dayOfWeek: dayjs(record.date).format('dddd'), // 获取周几
          totalHours: 0,
          projects: [],
          records: [],
          hasMultipleStatuses: false,
          primaryStatus: record.status,
        };
      }
      
      acc[date].records.push(record);
      acc[date].totalHours += record.hours;
      
      // 检查项目是否已存在
      const existingProject = acc[date].projects.find(
        p => p.projectName === record.project.name && p.stageName === record.stage?.name
      );
      
      if (existingProject) {
        existingProject.hours += record.hours;
      } else {
        acc[date].projects.push({
          projectName: record.project.name,
          projectCode: record.project.projectCode,
          stageName: record.stage?.name,
          hours: record.hours,
          status: record.status,
        });
      }
      
      // 检查是否有多种状态
      const statuses = acc[date].records.map(r => r.status);
      const uniqueStatuses = [...new Set(statuses)];
      acc[date].hasMultipleStatuses = uniqueStatuses.length > 1;
      
      // 确定主要状态（优先级：APPROVED > SUBMITTED > DRAFT）
      if (statuses.includes('APPROVED')) {
        acc[date].primaryStatus = 'APPROVED';
      } else if (statuses.includes('SUBMITTED')) {
        acc[date].primaryStatus = 'SUBMITTED';
      } else {
        acc[date].primaryStatus = 'DRAFT';
      }
      
      return acc;
    }, {} as Record<string, DailyTimesheetSummary>);
    
    // 转换为数组并按日期排序
    return Object.values(grouped).sort((a, b) => 
      dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
    );
  };

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
      const timesheetsData = response.timesheets || [];
      setTimesheets(timesheetsData);
      setTotal(response.pagination?.total || 0);
      
      // 生成按天聚合的数据
      const dailyData = groupTimesheetsByDay(timesheetsData);
      setDailySummaries(dailyData);
      
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

  // 批量提交某日期下的所有DRAFT状态记录
  const handleSubmitDay = async (date: string) => {
    try {
      // 找到该日期下所有DRAFT状态的记录
      const dailySummary = dailySummaries.find(summary => summary.date === date);
      if (!dailySummary) {
        message.error('No records found for this date');
        return;
      }

      const draftRecords = dailySummary.records.filter(record => record.status === 'DRAFT');
      if (draftRecords.length === 0) {
        message.info('No draft records to submit for this date');
        return;
      }

      // 确认提交
      modal.confirm({
        title: 'Submit All Draft Records',
        content: `Are you sure you want to submit all ${draftRecords.length} draft record(s) for ${dayjs(date).format('MMM DD, YYYY')}?`,
        okText: 'Submit',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            // 批量提交所有DRAFT记录
            await Promise.all(draftRecords.map(record => timesheetAPI.submit(record.id)));
            message.success(`Successfully submitted ${draftRecords.length} record(s)`);
            fetchTimesheets();
          } catch (error: any) {
            message.error(error.response?.data?.error || 'Failed to submit records');
          }
        },
      });
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to submit records');
    }
  };

  // 批量删除某日期下的所有记录（仅限非APPROVED状态）
  const handleDeleteDay = async (date: string) => {
    try {
      // 找到该日期下的所有记录
      const dailySummary = dailySummaries.find(summary => summary.date === date);
      if (!dailySummary) {
        message.error('No records found for this date');
        return;
      }

      // 过滤出可删除的记录（非APPROVED状态）
      const deletableRecords = dailySummary.records.filter(record => record.status !== 'APPROVED');
      if (deletableRecords.length === 0) {
        message.info('No deletable records found for this date');
        return;
      }

      // 确认删除
      modal.confirm({
        title: 'Delete All Entries',
        content: (
          <div>
            <p>Are you sure you want to delete all {deletableRecords.length} record(s) for {dayjs(date).format('MMM DD, YYYY')}?</p>
            <p className="text-red-500 mt-2">This action cannot be undone.</p>
          </div>
        ),
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            // 批量删除所有可删除的记录
            await Promise.all(deletableRecords.map(record => timesheetAPI.delete(record.id)));
            message.success(`Successfully deleted ${deletableRecords.length} record(s)`);
            fetchTimesheets();
          } catch (error: any) {
            message.error(error.response?.data?.error || 'Failed to delete records');
          }
        },
      });
    } catch (error: any) {
       message.error(error.response?.data?.error || 'Failed to delete records');
     }
   };

  // 操作菜单
  const getActionMenu = (record: TimesheetRecord) => {
    const items: any[] = [];

    // Draft和Submitted状态下的操作：Edit, Delete
    if (record.status === 'DRAFT' || record.status === 'SUBMITTED') {
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

    // Draft状态下的额外操作：Submit
    if (record.status === 'DRAFT') {
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
    }

    // Submitted状态下的额外操作：Withdraw
    if (record.status === 'SUBMITTED') {
      items.push({
        key: 'withdraw',
        icon: <RollbackOutlined />,
        label: 'Withdraw',
        onClick: (info: any) => {
          info?.domEvent?.stopPropagation();
          handleWithdraw(record.id);
        },
      });
    }

    return items;
  };

  // 按天聚合显示的表格列定义
  const dailyColumns: ColumnsType<DailyTimesheetSummary> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      sorter: (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
      render: (date: string, record: DailyTimesheetSummary) => (
        <div className="text-sm">
          <div className="font-medium">{dayjs(date).format('MMM DD, YYYY')}</div>
          <div className="text-gray-500">{record.dayOfWeek}</div>
        </div>
      ),
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalHours',
      key: 'totalHours',
      width: 120,
      sorter: (a, b) => a.totalHours - b.totalHours,
      render: (hours: number) => (
        <div className="text-sm font-medium text-blue-600">
          {hours.toFixed(1)}h
        </div>
      ),
    },
    {
      title: 'Projects & Time',
      key: 'projects',
      render: (record: DailyTimesheetSummary) => (
        <div className="text-sm space-y-1">
          {record.projects.map((project, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex-1">
                <span className="font-medium text-gray-900">{project.projectName}</span>
                {project.stageName && (
                  <span className="text-gray-500 ml-1">({project.stageName})</span>
                )}
              </div>
              <div className="text-blue-600 font-medium ml-2">
                {project.hours.toFixed(1)}h
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Draft', value: 'DRAFT' },
        { text: 'Submitted', value: 'SUBMITTED' },
        { text: 'Approved', value: 'APPROVED' },
      ],
      onFilter: (value, record) => record.primaryStatus === value,
      render: (record: DailyTimesheetSummary) => {
        const config = statusConfig[record.primaryStatus as keyof typeof statusConfig];
        return (
          <div>
            <Tag color={config.color} className="text-xs">
              {config.text}
            </Tag>
            {record.hasMultipleStatuses && (
              <div className="text-xs text-gray-500 mt-1">Mixed Status</div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (record: DailyTimesheetSummary) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              disabled={record.primaryStatus === 'APPROVED'}
              onClick={() => navigate(`/timesheet-entry?date=${record.date}`)}
            />
          </Tooltip>
          <Tooltip title="Submit">
            <Button
              type="text"
              size="small"
              icon={<SendOutlined />}
              disabled={record.primaryStatus !== 'DRAFT'}
              onClick={() => handleSubmitDay(record.date)}
            />
          </Tooltip>
          <Tooltip title="Delete All Entries">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.primaryStatus === 'APPROVED'}
              onClick={() => handleDeleteDay(record.date)}
              danger
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 确认日期筛选
  const handleConfirmDateFilter = () => {
    setFilters({ ...filters, dateRange: tempDateRange });
    setCurrentPage(1);
  };

  // 重置筛选条件
  const handleResetFilters = () => {
    const currentMonthStart = dayjs().startOf('month');
    const currentMonthEnd = dayjs().endOf('month');
    
    setFilters({
      status: undefined,
      projectId: undefined,
      employeeId: undefined,
      dateRange: [currentMonthStart, currentMonthEnd],
      search: '',
    });
    setTempDateRange([currentMonthStart, currentMonthEnd]);
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
      {/* 统计卡片和用户手册 */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Hours of Listed"
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
              title="Pending Approval"
              value={stats.pendingApproval}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={12}>
          <Card style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Collapse
              ghost
              items={[
                {
                  key: '1',
                  label: <span className="font-semibold text-green-700">User Manual</span>,
                  children: (
                    <div className="text-sm space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        <span><strong>Draft</strong> → User-only visibility, fully editable.</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span><strong>Submitted</strong> → Visible to Admin, pending approval, still editable until approved.</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span><strong>Approved</strong> → Locked; no further edits or additions allowed.</span>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和操作栏 */}
      <Card className="mb-6">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={24} md={8} lg={9} xl={9}>
            <Search
              placeholder="Search timesheets..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onSearch={() => fetchTimesheets()}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={4} lg={4} xl={3}>
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
          <Col xs={12} sm={8} md={6} lg={6} xl={6}>
             <RangePicker
               value={filters.dateRange}
               onChange={(dates) => {
                 setFilters({ ...filters, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] });
                 setCurrentPage(1);
               }}
               style={{ width: '100%' }}
             />
           </Col>
          <Col xs={12} sm={4} md={3} lg={3} xl={3}>
            <Button
              icon={<FilterOutlined />}
              onClick={handleResetFilters}
              style={{ width: '100%' }}
            >Reset</Button>
          </Col>
          <Col xs={12} sm={4} md={3} lg={4} xl={3}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/timesheets/new')}
              style={{ width: '100%' }}
            >New</Button>
          </Col>
        </Row>
      </Card>

      {/* 工时记录表格 */}
      <Card>
        <Table<DailyTimesheetSummary>
          columns={dailyColumns}
          dataSource={dailySummaries}
          rowKey="date"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total: dailySummaries.length,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} days`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 20);
            },
          }}
          scroll={{ x: 1000 }}
          size="small"
          expandable={{
            expandedRowRender: (record: DailyTimesheetSummary) => (
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium mb-3">Detailed Records for {dayjs(record.date).format('MMM DD, YYYY')}</h4>
                <div className="space-y-2">
                  {record.records.map((timesheet, index) => (
                    <div key={timesheet.id} className="bg-white p-3 rounded border text-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-blue-600">{timesheet.project.name}</div>
                          <div className="text-gray-500">{timesheet.project.projectCode}</div>
                          {timesheet.stage && (
                            <div className="text-gray-600">Stage: {timesheet.stage.name}</div>
                          )}
                          {timesheet.description && (
                            <div className="text-gray-600 mt-1">Description: {timesheet.description}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {timesheet.startTime.substring(11, 16)} - {timesheet.endTime.substring(11, 16)}
                          </div>
                          <div className="text-blue-600">{timesheet.hours}h</div>
                          <Tag color={statusConfig[timesheet.status].color} className="text-xs mt-1">
                            {statusConfig[timesheet.status].text}
                          </Tag>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
            rowExpandable: (record) => record.records.length > 0,
          }}
        />      </Card>
    </PageLayout>
  );
};

export default Timesheets;