import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert, Select } from 'antd';
import {
  DashboardOutlined,
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  TeamOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import PageLayout from '@/components/PageLayout';
import { useAuthStore } from '@/stores/authStore';
import { reportAPI } from '@/lib/api';
import dayjs from 'dayjs';



interface DashboardStats {
  totalHours: number;
  totalTimesheets: number;
  pendingApprovals: number;
  activeProjects: number;
  dailyTrends: Array<{
    date: string;
    hours: number;
  }>;
  projectDistribution: Array<{
    projectName: string;
    hours: number;
  }>;
}



const Dashboard: React.FC = () => {
  const { user, isManagerOrAdmin } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'previous'>('current');


  // 获取仪表板统计数据
  const fetchDashboardStats = async (period: 'current' | 'previous' = selectedPeriod) => {
    try {
      setStatsLoading(true);
      
      // 根据选择的时间段计算日期范围
      let startDate: string;
      let endDate: string;
      
      if (period === 'current') {
        startDate = dayjs().startOf('month').format('YYYY-MM-DD');
        endDate = dayjs().endOf('month').format('YYYY-MM-DD');
      } else {
        startDate = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        endDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
      }
      
      const response = await reportAPI.getDashboardStats({
        startDate,
        endDate,
      });
      setStats(response.stats);
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error);
      setError(error.response?.data?.error || 'Failed to load dashboard statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  // 处理时间段选择变化
  const handlePeriodChange = (value: 'current' | 'previous') => {
    setSelectedPeriod(value);
    fetchDashboardStats(value);
  };





  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        await fetchDashboardStats();
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Dashboard"
      description="Monthly timesheet analytics and project insights"
      icon={<DashboardOutlined />}
    >

      {/* 错误提示 */}
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="mb-6"
        />
      )}



      {/* 时间范围选择器 */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Statistics Overview</h2>
        <Select
          value={selectedPeriod}
          onChange={handlePeriodChange}
          style={{ width: 160 }}
          options={[
            { value: 'current', label: 'Current Month' },
            { value: 'previous', label: 'Previous Month' },
          ]}
        />
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Hours"
              value={stats?.totalHours || 0}
              suffix="h"
              prefix={<ClockCircleOutlined className="text-blue-500" />}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Timesheets"
              value={stats?.totalTimesheets || 0}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              loading={statsLoading}
            />
          </Card>
        </Col>
        {isManagerOrAdmin() && (
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Pending Approvals"
                value={stats?.pendingApprovals || 0}
                prefix={<ExclamationCircleOutlined className="text-orange-500" />}
                loading={statsLoading}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* 项目工时分布饼图 */}
      <Row gutter={16} className="mb-6">
        <Col span={24}>
          <Card title="Total Hours per Project" loading={statsLoading}>
            {stats?.projectDistribution && stats.projectDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={stats.projectDistribution.map((item, index) => ({
                      name: item.projectName,
                      value: item.hours,
                      fill: `hsl(${(index * 360) / stats.projectDistribution.length}, 70%, 50%)`
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value}h (${(percent * 100).toFixed(1)}%)`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.projectDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`hsl(${(index * 360) / stats.projectDistribution.length}, 70%, 50%)`} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}h`, 'Hours']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No project data available for the selected period
              </div>
            )}
          </Card>
        </Col>
      </Row>

    </PageLayout>
  );
};

export default Dashboard;