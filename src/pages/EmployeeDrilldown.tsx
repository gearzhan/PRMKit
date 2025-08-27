import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Spin,
  Typography,
  Button,
  Space,
  Tag,
  Avatar,
  Divider,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import api from '@/lib/api';
import { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 员工项目数据接口
interface EmployeeProjectData {
  projectId: string;
  projectName: string;
  projectCode: string;
  totalHours: number;
  totalDays: number;
  firstDate: string;
  lastDate: string;
}

// 员工详情数据接口
interface EmployeeDrillData {
  employee: {
    id: string;
    name: string;
    email: string;
    role: string;
    position?: string;
  };
  projectStats: EmployeeProjectData[];
  summary: {
    totalProjects: number;
    totalHours: number;
    averageHoursPerProject: number;
    dateRange: {
      startDate: string;
      endDate: string;
    } | null;
  };
}

const EmployeeDrilldown: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [drillData, setDrillData] = useState<EmployeeDrillData | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 获取员工详情数据
  const fetchEmployeeDrillData = async (startDate?: string, endDate?: string) => {
    if (!employeeId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      
      const response = await api.get(`/admin/dashboard/employee-drill/${employeeId}?${params.toString()}`);
      setDrillData(response.data);
    } catch (error: any) {
      console.error('获取员工详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理时间范围变化
  const handleDateRangeChange = (dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      fetchEmployeeDrillData(startDate, endDate);
    } else {
      // 清除日期范围，获取所有数据
      fetchEmployeeDrillData();
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchEmployeeDrillData();
  }, [employeeId]);

  // 获取角色标签颜色
  const getRoleTagColor = (role: string) => {
    switch (role) {
      case 'LEVEL1': return 'red';
      case 'LEVEL2': return 'blue';
      case 'LEVEL3': return 'green';
      default: return 'default';
    }
  };

  // 获取角色显示文本
  const getRoleText = (role: string) => {
    switch (role) {
      case 'LEVEL1': return 'Level 1 Admin';
      case 'LEVEL2': return 'Level 2 Manager';
      case 'LEVEL3': return 'Level 3 Worker';
      default: return role;
    }
  };

  // 项目表格列定义
  const projectColumns: ColumnsType<EmployeeProjectData> = [
    {
      title: 'Project Name',
      dataIndex: 'projectName',
      key: 'projectName',
      render: (text: string, record: EmployeeProjectData) => (
        <Space>
          <ProjectOutlined style={{ color: '#1890ff' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.projectCode}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalHours',
      key: 'totalHours',
      render: (hours: number) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#52c41a' }} />
          <Text strong>{hours.toFixed(1)}h</Text>
        </Space>
      ),
      sorter: (a, b) => a.totalHours - b.totalHours,
    },
    {
      title: 'Total Days',
      dataIndex: 'totalDays',
      key: 'totalDays',
      render: (days: number) => (
        <Space>
          <CalendarOutlined style={{ color: '#fa8c16' }} />
          <Text>{days} days</Text>
        </Space>
      ),
      sorter: (a, b) => a.totalDays - b.totalDays,
    },
    {
      title: 'First Timesheet',
      dataIndex: 'firstDate',
      key: 'firstDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a, b) => dayjs(a.firstDate).unix() - dayjs(b.firstDate).unix(),
    },
    {
      title: 'Last Timesheet',
      dataIndex: 'lastDate',
      key: 'lastDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a, b) => dayjs(a.lastDate).unix() - dayjs(b.lastDate).unix(),
    },
  ];

  return (
    <PageLayout>
      <div style={{ padding: '24px' }}>
        {/* 返回按钮和标题 */}
        <div style={{ marginBottom: '24px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/employees')}
            style={{ marginBottom: '16px' }}
          >
            Back to Employee List
          </Button>
          
          {drillData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar size={64} icon={<UserOutlined />} />
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  {drillData.employee.name}
                </Title>
                <Space size="middle" style={{ marginTop: '8px' }}>
                  <Text type="secondary">{drillData.employee.email}</Text>
                  <Tag color={getRoleTagColor(drillData.employee.role)}>
                    {getRoleText(drillData.employee.role)}
                  </Tag>
                  {drillData.employee.position && (
                    <Text type="secondary">• {drillData.employee.position}</Text>
                  )}
                </Space>
              </div>
            </div>
          )}
        </div>

        <Spin spinning={loading}>
          {drillData ? (
            <>
              {/* 时间范围选择器 */}
              <Card style={{ marginBottom: '24px' }}>
                <Space align="center">
                  <Text strong>Date Range Filter:</Text>
                  <RangePicker
                    value={dateRange}
                    onChange={handleDateRangeChange}
                    allowClear
                    placeholder={['Start Date', 'End Date']}
                  />
                  {drillData.summary.dateRange && (
                    <Text type="secondary">
                      Showing data from {dayjs(drillData.summary.dateRange.startDate).format('YYYY-MM-DD')} to{' '}
                      {dayjs(drillData.summary.dateRange.endDate).format('YYYY-MM-DD')}
                    </Text>
                  )}
                </Space>
              </Card>

              {/* 统计概览 */}
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Total Projects"
                      value={drillData.summary.totalProjects}
                      prefix={<ProjectOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Total Hours"
                      value={drillData.summary.totalHours}
                      precision={1}
                      suffix="h"
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Avg Hours/Project"
                      value={drillData.summary.averageHoursPerProject}
                      precision={1}
                      suffix="h"
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Active Projects"
                      value={drillData.projectStats.length}
                      prefix={<ProjectOutlined />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* 项目详情表格 */}
              <Card>
                <Title level={4} style={{ marginBottom: '16px' }}>
                  Project Participation Details
                </Title>
                <Divider style={{ margin: '16px 0' }} />
                {drillData.projectStats.length > 0 ? (
                  <Table
                    columns={projectColumns}
                    dataSource={drillData.projectStats}
                    rowKey="projectId"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} projects`,
                    }}
                    scroll={{ x: 800 }}
                  />
                ) : (
                  <Empty
                    description="No project data found for the selected time range"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </>
          ) : (
            !loading && (
              <Empty
                description="Employee data not found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          )}
        </Spin>
      </div>
    </PageLayout>
  );
};

export default EmployeeDrilldown;