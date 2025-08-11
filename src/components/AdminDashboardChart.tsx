import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Empty, Tooltip as AntTooltip } from 'antd';
import { BarChartOutlined, UserOutlined, ProjectOutlined } from '@ant-design/icons';

// 图表数据接口
interface ChartDataItem {
  name: string;
  approvedHours: number;
  count: number; // employeeCount 或 projectCount
}

// 组件属性接口
interface AdminDashboardChartProps {
  data: ChartDataItem[];
  mode: 'project' | 'employee';
  type: 'bar' | 'horizontal';
  loading?: boolean;
  onItemClick?: (itemName: string) => void;
}

// 自定义工具提示组件
const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">
          {mode === 'project' ? '项目' : '员工'}: {label}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-green-600">已批准工时:</span>
            <span className="font-medium">{data.approvedHours} hrs</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">
              {mode === 'project' ? '参与人数' : '项目数量'}:
            </span>
            <span className="font-medium">{data.count}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 border-t pt-1">
          点击查看详细信息
        </p>
      </div>
    );
  }
  return null;
};

/**
 * 管理员仪表板图表组件
 * 支持项目和员工两种模式，柱状图和横向图两种类型
 */
const AdminDashboardChart: React.FC<AdminDashboardChartProps> = ({
  data,
  mode,
  type,
  loading = false,
  onItemClick,
}) => {
  // 处理图表数据，转换为recharts需要的格式
  const chartData = data.map(item => ({
    name: item.name,
    approvedHours: item.approvedHours,
    count: item.count,
  }));

  // 处理柱状图点击事件
  const handleBarClick = (data: any) => {
    if (onItemClick && data && data.name) {
      onItemClick(data.name);
    }
  };



  // 空数据状态
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span className="text-gray-500">
              {mode === 'project' ? '暂无项目数据' : '暂无员工数据'}
            </span>
          }
        />
      </div>
    );
  }

  // 横向柱状图
  if (type === 'horizontal') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="horizontal"
          margin={{
            top: 20,
            right: 30,
            left: 100,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#666' }}
            axisLine={{ stroke: '#d9d9d9' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: '#666' }}
            axisLine={{ stroke: '#d9d9d9' }}
            width={90}
          />
          <Tooltip
            content={<CustomTooltip mode={mode} />}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />
          <Bar
            dataKey="approvedHours"
            fill="#52c41a"
            radius={[0, 4, 4, 0]}
            onClick={handleBarClick}
            style={{ cursor: onItemClick ? 'pointer' : 'default' }}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // 垂直柱状图
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 60,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#666' }}
          axisLine={{ stroke: '#d9d9d9' }}
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#666' }}
          axisLine={{ stroke: '#d9d9d9' }}
          label={{
            value: 'Hours',
            angle: -90,
            position: 'insideLeft',
            style: { textAnchor: 'middle', fontSize: 12, fill: '#666' },
          }}
        />
        <Tooltip
          content={<CustomTooltip mode={mode} />}
          cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
        />
        <Bar
          dataKey="approvedHours"
          name="Approved Hours"
          fill="#52c41a"
          radius={[4, 4, 0, 0]}
          onClick={handleBarClick}
          style={{ cursor: onItemClick ? 'pointer' : 'default' }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// 图表图例组件
export const ChartLegend: React.FC<{ mode: 'project' | 'employee' }> = ({ mode }) => {
  return (
    <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 bg-green-500 rounded"></div>
        <span className="text-gray-600">Approved Hours</span>
      </div>
      <div className="flex items-center space-x-2">
        {mode === 'project' ? (
          <ProjectOutlined className="text-gray-500" />
        ) : (
          <UserOutlined className="text-gray-500" />
        )}
        <span className="text-gray-600">
          {mode === 'project' ? 'Projects' : 'Employees'}
        </span>
      </div>
    </div>
  );
};

export default AdminDashboardChart;