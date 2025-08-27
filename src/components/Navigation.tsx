import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Button, Avatar, Space } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  FormOutlined,
  TableOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { isLevel1Admin, canAccessTimesheets, canApproveTimesheets } from '@/utils/roleUtils';



/**
 * 导航组件 - 提供用户菜单和管理员功能入口
 */
const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // 处理退出登录
  const handleLogout = async () => {
    try {
      // 清除本地存储的token
      localStorage.removeItem('token');
      logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 用户菜单项
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider' as const,
    },
    // 基础页面 - 所有用户都可以访问
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/dashboard'),
    },
    // 工时表相关页面 - 有工时表权限的用户可以访问
    ...(user && canAccessTimesheets(user.role) ? [
        {
        key: 'timesheets',
        icon: <TableOutlined />,
        label: 'Timesheets',
        onClick: () => navigate('/timesheets'),
      },
    ] : []),

    // 审批管理页面 - Level 1和Level 2管理员可以访问
    ...(user && canApproveTimesheets(user.role) ? [
      {
        key: 'admin-approvals',
        icon: <CheckCircleOutlined />,
        label: 'Approval Management',
        onClick: () => navigate('/admin/approvals'),
      },
    ] : []),
    // Level 1 管理员专用菜单项
    ...(user && isLevel1Admin(user.role) ? [
      {
        type: 'divider' as const,
      },
      {
        key: 'admin-header',
        label: 'Management',
        type: 'group' as const,
      },
      {
        key: 'admin-dashboard',
        icon: <DashboardOutlined />,
        label: 'Admin Dashboard',
        onClick: () => navigate('/admin/dashboard'),
      },
      {
        key: 'admin-projects',
        icon: <ProjectOutlined />,
        label: 'Project Management',
        onClick: () => navigate('/admin/projects'),
      },
      {
        key: 'admin-employees',
        icon: <TeamOutlined />,
        label: 'Employee Management',
        onClick: () => navigate('/admin/employees'),
      },
      {
        key: 'admin-stages',
        icon: <ClockCircleOutlined />,
        label: 'Stage Management',
        onClick: () => navigate('/admin/stages'),
      },
      {
        key: 'admin-data-management',
        icon: <DatabaseOutlined />,
        label: 'Data Management',
        onClick: () => navigate('/admin/data-management'),
      },
    ] : []),
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  return (
    <Dropdown
      menu={{ items: userMenuItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button type="text" className="flex items-center">
        <Space>
          <Avatar 
            size="small" 
            icon={<UserOutlined />}
          />
          <span className="text-gray-700">{user?.name}</span>
        </Space>
      </Button>
    </Dropdown>
  );
};

export default Navigation;