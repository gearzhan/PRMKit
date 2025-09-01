import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Breadcrumb,
  Typography,
  Button,
  Spin,
  Alert,
  Space,
  Statistic,
  Divider,
  DatePicker,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
  ProjectOutlined,
  DownloadOutlined,
  PieChartOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { adminDashboardAPI } from '@/lib/api';
import PageLayout from '@/components/PageLayout';

const { Title, Text } = Typography;

// 项目钻取数据接口
interface ProjectDrillData {
  project: {
    id: string;
    name: string;
    projectCode: string;
    description?: string; // 项目描述字段
  };
  stageStats: Array<{
    stageName: string;
    totalHours: number;
    approvedHours: number;
    employeeCount: number;
  }>;
  employeeStats: Array<{
    employeeName: string;
    totalHours: number;
    approvedHours: number;
    stageCount: number;
  }>;
  month: string;
  firstTimesheetDate?: string; // 当前日期范围内的第一条timesheet日期
  globalFirstTimesheetDate?: string; // 项目全局第一条timesheet日期
}

// 饼图颜色配置
const COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb',
  '#fa541c', '#1890ff', '#52c41a', '#faad14', '#f5222d'
];

const ProjectDrilldown: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 从URL参数获取项目名称和月份
  const projectName = searchParams.get('projectName') || searchParams.get('name') || '';
  const month = searchParams.get('month') || '';
  
  // 初始化参数处理完成
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<ProjectDrillData | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  // 处理用户手动选择日期范围的情况
  const [isUserDateSelection, setIsUserDateSelection] = useState(false);
  // 标识初始化是否完成
  const [isInitialized, setIsInitialized] = useState(false);

  // 获取项目钻取数据
  const fetchDrillData = async () => {
    if (!projectName) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      // 优先使用dateRange，其次使用URL中的month参数，最后直接获取项目数据（无时间限制）
      if (dateRange && dateRange[0] && dateRange[1]) {
        // 使用日期范围参数
        const startDate = dateRange[0].format('YYYY-MM-DD');
        const endDate = dateRange[1].format('YYYY-MM-DD');
        
        // 使用日期范围获取数据
        response = await adminDashboardAPI.getProjectDrill(projectName, {
          startDate,
          endDate
        });
      } else if (month) {
         // 使用URL中的month参数
         // 使用month参数获取数据
         response = await adminDashboardAPI.getProjectDrill(projectName, {
           month
         });
       } else {
         // 没有时间参数时，直接获取项目数据（无时间限制）
         // 没有时间参数，直接获取项目数据
         response = await adminDashboardAPI.getProjectDrill(projectName, {});
       }
      
      // 验证响应数据结构
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format');
      }
      
      // 设置钻取数据
      setDrillData(response);
      
      // 如果没有dateRange且有globalFirstTimesheetDate，自动设置dateRange为从该日期到今天
      if (!dateRange && response.globalFirstTimesheetDate && !isUserDateSelection) {
        const firstDate = dayjs(response.globalFirstTimesheetDate);
        const today = dayjs();
        // 自动设置日期范围
        setDateRange([firstDate, today]);
      }
    } catch (err: any) {
      // 获取钻取数据失败
      setError(err.response?.data?.message || 'Failed to load project drill data');
    } finally {
      setLoading(false);
    }
  };

  // 处理CSV导出
  const handleExportCSV = async () => {
    if (!drillData) return;
    
    try {
      setExportLoading(true);
      
      // 准备CSV数据
      const csvData = [
        ['Project Drill-down Report'],
        ['Project:', drillData.project.name],
        ['Project Code:', drillData.project.projectCode],
        ['Month:', drillData.month],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Stage Distribution'],
        ['Stage Name', 'Total Hours', 'Approved Hours', 'Employee Count'],
        ...drillData.stageStats.map(stage => [
          stage.stageName,
          stage.totalHours.toString(),
          stage.approvedHours.toString(),
          stage.employeeCount.toString()
        ]),
        [''],
        ['Personnel Distribution'],
        ['Employee Name', 'Total Hours', 'Approved Hours', 'Stage Count'],
        ...drillData.employeeStats.map(employee => [
          employee.employeeName,
          employee.totalHours.toString(),
          employee.approvedHours.toString(),
          employee.stageCount.toString()
        ])
      ];
      
      // 创建CSV内容
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      
      // 创建下载链接
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `project-drilldown-${drillData.project.projectCode}-${drillData.month}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      // CSV导出失败
    } finally {
      setExportLoading(false);
    }
  };

  // 返回管理员仪表板
  const handleGoBack = () => {
    navigate(`/admin/dashboard?month=${month}`);
  };

  // 初始化日期范围
  useEffect(() => {
    // 如果URL中有month参数且dateRange未初始化，则初始化dateRange
    if (month && !dateRange && !isInitialized) {
      // 从URL month参数初始化日期范围
      const monthStart = dayjs(month, 'YYYY-MM').startOf('month');
      const monthEnd = dayjs(month, 'YYYY-MM').endOf('month');
      setDateRange([monthStart, monthEnd]);
      setIsInitialized(true);
    } else if (!month && !isInitialized) {
      // 如果没有month参数，直接标记为已初始化，允许获取数据
      // 没有month参数，直接标记为已初始化
      setIsInitialized(true);
    }
  }, [month, dateRange, isInitialized]);
  
  // 获取数据
  useEffect(() => {
    // 确保在初始化完成且有projectName的情况下获取数据
    // 移除对dateRange的依赖，允许在没有dateRange时也能获取数据
    if (projectName && isInitialized && !isUserDateSelection) {
      // 触发数据获取
      fetchDrillData();
    }
  }, [projectName, isInitialized]);

  // 当日期范围改变时重新获取数据
  useEffect(() => {
    if (projectName && dateRange && isUserDateSelection && isInitialized) {
      // 用户手动选择日期范围，重新获取数据
      fetchDrillData();
    }
  }, [dateRange, isUserDateSelection, isInitialized]);

  // 计算总工时
  const totalProjectHours = drillData?.stageStats.reduce((sum, stage) => sum + stage.totalHours, 0) || 0;
  const totalApprovedHours = drillData?.stageStats.reduce((sum, stage) => sum + stage.approvedHours, 0) || 0;
  const approvalRate = totalProjectHours > 0 ? (totalApprovedHours / totalProjectHours * 100) : 0;

  // 准备饼图数据
  const stageChartData = drillData?.stageStats.map(stage => ({
    name: stage.stageName,
    value: stage.totalHours,
    approvedHours: stage.approvedHours,
    employeeCount: stage.employeeCount,
  })) || [];

  const employeeChartData = drillData?.employeeStats.slice(0, 10).map(employee => ({
    name: employee.employeeName,
    value: employee.totalHours,
    approvedHours: employee.approvedHours,
    stageCount: employee.stageCount,
  })) || [];

  // 自定义Tooltip组件
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-blue-600">Total Hours: {data.value}</p>
          <p className="text-green-600">Approved Hours: {data.approvedHours}</p>
          {data.employeeCount !== undefined && (
            <p className="text-purple-600">Employees: {data.employeeCount}</p>
          )}
          {data.stageCount !== undefined && (
            <p className="text-orange-600">Stages: {data.stageCount}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <PageLayout
        title="Project Drill-down"
        description="Loading project details and analytics"
        icon={<ProjectOutlined />}
      >
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout
        title="Project Drill-down"
        description="Error loading project data"
        icon={<ProjectOutlined />}
      >
        <Alert
          message="Error Loading Data"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <Button size="small" onClick={fetchDrillData}>
                Retry
              </Button>
              <Button size="small" onClick={handleGoBack}>
                Go Back
              </Button>
            </Space>
          }
        />
      </PageLayout>
    );
  }

  // 创建面包屑导航和操作按钮的 extra 内容
  const extraContent = (
    <div className="flex flex-col gap-4">
      {/* 面包屑导航 */}
      <Breadcrumb 
        items={[
          {
            title: (
              <Button 
                type="primary" 
                icon={<ArrowLeftOutlined />} 
                onClick={handleGoBack}
                className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
                size="small"
              >
                Admin Dashboard
              </Button>
            )
          },
          {
            title: (
              <Button
                type="default"
                size="small"
                onClick={() => navigate('/admin/projects')}
                className="text-blue-600 hover:text-blue-700 border-blue-600 hover:border-blue-700"
              >
                Back to Project List
              </Button>
            )
          }
        ]}
      />
      
      {/* 项目信息和操作按钮 */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
            <Text type="secondary" className="text-xs sm:text-sm break-words">Code: {drillData?.project.projectCode}</Text>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Text type="secondary" className="text-xs sm:text-sm whitespace-nowrap">Date Range:</Text>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setIsUserDateSelection(true);
                  setDateRange(dates);
                }}
                format="YYYY-MM-DD"
                placeholder={['Start Date', 'End Date']}
                size="small"
                allowClear
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            loading={exportLoading}
            size="small"
            className="w-full sm:w-auto"
          >
            <span className="text-xs sm:text-sm">Export CSV</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout
      title={drillData?.project.name || 'Project Drill-down'}
      description={`Detailed analytics and insights for ${drillData?.project.name || 'project'}`}
      icon={<ProjectOutlined />}
      extra={extraContent}
    >

      {/* 项目统计概览 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} sm={12} md={6} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm">Total Hours</span>}
              value={totalProjectHours}
              prefix={<ClockCircleOutlined className="text-sm" />}
              suffix={<span className="text-xs sm:text-sm">hrs</span>}
              precision={1}
              valueStyle={{ fontSize: '1.2rem' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm">Approved Hours</span>}
              value={totalApprovedHours}
              prefix={<ClockCircleOutlined className="text-sm" />}
              valueStyle={{ color: '#52c41a', fontSize: '1.2rem' }}
              suffix={<span className="text-xs sm:text-sm">hrs</span>}
              precision={1}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm break-words">First Timesheet Date</span>}
              value={drillData?.globalFirstTimesheetDate ? dayjs(drillData.globalFirstTimesheetDate).format('YYYY-MM-DD') : 'No data'}
              prefix={<CalendarOutlined className="text-sm" />}
              valueStyle={{ color: '#1890ff', fontSize: '0.9rem' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6}>
          <Card className="h-full">
            <Statistic
              title={<span className="text-xs sm:text-sm">Active Employees</span>}
              value={drillData?.employeeStats.length || 0}
              prefix={<TeamOutlined className="text-sm" />}
              valueStyle={{ color: '#1890ff', fontSize: '1.2rem' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Project Budget 卡片 */}
        {drillData?.project?.description && (
          <Row gutter={[16, 16]} className="mb-4 sm:mb-6">
            <Col span={24}>
              <Card
                title={
                  <Space className="flex-wrap">
                    <FileTextOutlined className="text-sm" />
                    <span className="text-sm sm:text-base font-medium">Project Budget</span>
                  </Space>
                }
                className="shadow-sm"
                styles={{ body: { padding: '12px 16px' } }}
              >
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border-l-4 border-blue-500 mx-0">
                  <Text className="text-sm sm:text-base break-words leading-relaxed block">
                    {drillData.project.description}
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        )}

      {/* 双饼图展示 */}
      <Row gutter={[16, 16]}>
        {/* 按阶段分布饼图 */}
        <Col xs={24} sm={24} md={12} lg={12}>
          <Card
            title={
              <Space>
                <PieChartOutlined />
                <span className="text-sm sm:text-base">Stage Distribution</span>
              </Space>
            }
            className="h-80 sm:h-96"
          >
            {stageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stageChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-64">
                <Text type="secondary">No stage data available</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* 按人员分布饼图 */}
        <Col xs={24} sm={24} md={12} lg={12}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span className="text-sm sm:text-base break-words">Personnel Distribution (Top 10)</span>
              </Space>
            }
            className="h-80 sm:h-96"
          >
            {employeeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={employeeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {employeeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-64">
                <Text type="secondary">No employee data available</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>


    </PageLayout>
  );
};

export default ProjectDrilldown;