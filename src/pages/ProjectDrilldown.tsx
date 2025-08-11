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
} from 'antd';
import {
  ArrowLeftOutlined,
  ProjectOutlined,
  DownloadOutlined,
  PieChartOutlined,
  TeamOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { adminDashboardAPI } from '@/lib/api';
import Navigation from '@/components/Navigation';

const { Title, Text } = Typography;

// 项目钻取数据接口
interface ProjectDrillData {
  project: {
    id: string;
    name: string;
    projectCode: string;
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
  const projectName = searchParams.get('name') || '';
  const month = searchParams.get('month') || '';
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<ProjectDrillData | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // 获取项目钻取数据
  const fetchDrillData = async () => {
    if (!projectName || !month) {
      setError('Missing project name or month parameter');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await adminDashboardAPI.getProjectDrill(projectName, month);
      setDrillData(response);
    } catch (err: any) {
      console.error('获取项目钻取数据失败:', err);
      setError(err.response?.data?.error || 'Failed to fetch project drill data');
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
      console.error('CSV导出失败:', err);
    } finally {
      setExportLoading(false);
    }
  };

  // 返回管理员仪表板
  const handleGoBack = () => {
    navigate(`/admin/dashboard?month=${month}`);
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchDrillData();
  }, [projectName, month]);

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
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
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
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 面包屑导航 */}
      <div className="mb-6">
        <Breadcrumb 
          className="mb-4"
          items={[
            {
              title: (
                <Button 
                  type="link" 
                  icon={<ArrowLeftOutlined />} 
                  onClick={handleGoBack}
                  className="p-0"
                >
                  Admin Dashboard
                </Button>
              )
            },
            {
              title: (
                <span>
                  <ProjectOutlined className="mr-1" />
                  Project Drill-down
                </span>
              )
            },
            {
              title: <span className="font-medium">{drillData?.project.name}</span>
            }
          ]}
        />
        
        <div className="flex justify-between items-center">
          <div>
            <Title level={2} className="mb-2">
              <ProjectOutlined className="mr-2" />
              {drillData?.project.name}
            </Title>
            <Space split={<Divider type="vertical" />}>
              <Text type="secondary">Code: {drillData?.project.projectCode}</Text>
              <Text type="secondary">Month: {drillData?.month}</Text>
            </Space>
          </div>
          <div>
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportCSV}
                loading={exportLoading}
              >
                Export CSV
              </Button>
              <Navigation />
            </Space>
          </div>
        </div>
      </div>

      {/* 项目统计概览 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Hours"
              value={totalProjectHours}
              prefix={<ClockCircleOutlined />}
              suffix="hrs"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Approved Hours"
              value={totalApprovedHours}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="hrs"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Approval Rate"
              value={approvalRate}
              prefix={<PieChartOutlined />}
              valueStyle={{ color: approvalRate >= 80 ? '#52c41a' : approvalRate >= 60 ? '#faad14' : '#ff4d4f' }}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Employees"
              value={drillData?.employeeStats.length || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 双饼图展示 */}
      <Row gutter={16}>
        {/* 按阶段分布饼图 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <PieChartOutlined />
                Stage Distribution
              </Space>
            }
            className="h-96"
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
        <Col span={12}>
          <Card
            title={
              <Space>
                <TeamOutlined />
                Personnel Distribution (Top 10)
              </Space>
            }
            className="h-96"
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
    </div>
  );
};

export default ProjectDrilldown;