import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  DatePicker,
  Space,
  Button,
  Spin,
  Empty,
  Tooltip,
} from 'antd';
import PageLayout from '@/components/PageLayout';
import {
  DashboardOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/lib/api';
import { useAdminDashboardStore } from '@/stores/adminDashboardStore';

const { Title } = Typography;
const { MonthPicker } = DatePicker;

// 仪表板统计数据接口
interface DashboardStats {
  approvedHours: number;
  totalProjects: number;
  activeEmployees: number;
}

// 图表数据接口
interface ChartData {
  projectStats: Array<{
    name: string;
    approvedHours: number;
    count: number;
  }>;
  employeeStats: Array<{
    name: string;
    approvedHours: number;
    count: number;
  }>;
}

/**
 * 管理员仪表板页面
 * 提供月度工时数据统计、可视化图表和钻取功能
 */
const AdminDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Zustand状态管理
  const {
    stats,
    chartData,
    drillData,
    statsLoading,
    chartLoading,
    drillLoading,
    statsError,
    chartError,
    drillError,
    selectedMonth: storeSelectedMonth,
    drillProject,
    fetchStats,
    fetchChartData,
    fetchDrillData,
    setSelectedMonth: setStoreSelectedMonth,
    setDrillProject,
    clearErrors,
    refreshAll,
  } = useAdminDashboardStore();
  
  // 本地UI状态
  const [drillModalVisible, setDrillModalVisible] = useState(false);
  
  // 本地UI状态
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(() => {
    const monthParam = searchParams.get('month');
    return monthParam ? dayjs(monthParam) : dayjs();
  });
  
  // 计算加载状态
  const loading = chartLoading;
  const error = statsError || chartError;

  // 处理月份变化
  const handleMonthChange = async (month: string) => {
    try {
      setStoreSelectedMonth(month);
      setSearchParams({ month });
      await refreshAll(month);
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  };
  
  // 处理图表钻取
  const handleChartDrillDown = async (projectName: string) => {
    try {
      await fetchDrillData(projectName, storeSelectedMonth);
      setDrillModalVisible(true);
    } catch (error) {
      console.error('获取项目钻取数据失败:', error);
    }
  };

  // 处理月份选择变化
  const handleMonthPickerChange = (month: Dayjs | null) => {
    if (month) {
      setSelectedMonth(month);
      const monthStr = month.format('YYYY-MM');
      handleMonthChange(monthStr);
    }
  };



  // 组件挂载和月份变化时获取数据
  useEffect(() => {
    const monthStr = selectedMonth.format('YYYY-MM');
    if (monthStr !== storeSelectedMonth) {
      handleMonthChange(monthStr);
    }
  }, [selectedMonth]);

  // 初始化数据加载
  useEffect(() => {
    if (!stats && !chartData) {
      const monthStr = selectedMonth.format('YYYY-MM');
      refreshAll(monthStr);
    }
  }, []);

  // 监听数据变化
  useEffect(() => {
    // 数据状态更新时的处理逻辑可以在这里添加
  }, [stats, chartData, statsLoading, chartLoading, statsError, chartError]);



  return (
    <PageLayout
      title="Admin Dashboard"
      description="Monthly timesheet analytics and project insights"
      icon={<DashboardOutlined />}
    >

      {/* 月度选择器 */}
      <Card className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <Title level={4} className="mb-2">Monthly Overview</Title>
            <p className="text-gray-600 mb-0">
              Select a month to view detailed analytics and statistics
            </p>
          </div>
          <Space>
            <MonthPicker
              value={selectedMonth}
              onChange={handleMonthPickerChange}
              format="YYYY-MM"
              placeholder="Select Month"
              allowClear={false}
              disabledDate={(current) => current && current > dayjs().endOf('month')}
            />
            <Button
              onClick={() => handleMonthPickerChange(dayjs())}
              disabled={selectedMonth.isSame(dayjs(), 'month')}
            >
              Current Month
            </Button>
          </Space>
        </div>
      </Card>

      {/* 统计面板 */}
      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="Approved Hours"
              value={stats?.approvedHours || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
              loading={statsLoading}
              suffix="hrs"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Active Projects"
              value={stats?.totalProjects || 0}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col span={8}>
            <Card>
              <Statistic
                title="Active Employees"
                value={stats?.activeEmployees || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#722ed1' }}
                loading={statsLoading}
              />
            </Card>
          </Col>
      </Row>

      {/* 次要统计指标 */}


      {/* 项目列表 */}
      {chartData?.projectStats && chartData.projectStats.length > 0 && (
        <Card title="Project Summary" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chartData.projectStats.map((project, index) => (
              <div 
                key={project.name} 
                className="bg-gray-50 p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/project/drill/drilldown?name=${encodeURIComponent(project.name)}&month=${selectedMonth.format('YYYY-MM')}`)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">{project.name}</h4>
                    <p className="text-sm text-gray-600">{project.count} 参与人员</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">
                      {project.approvedHours} hrs
                    </div>
                    <div className="text-xs text-gray-500">已批准工时</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageLayout>
  );
};

export default AdminDashboard;