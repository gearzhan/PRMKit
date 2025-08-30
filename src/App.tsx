import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import TimesheetEntry from '@/pages/TimesheetEntry';
import Timesheets from '@/pages/Timesheets';
import Home from '@/pages/Home';
import Profile from '@/pages/Profile';

import AdminProjectList from '@/pages/AdminProjectList';
import AdminEmployeeList from '@/pages/AdminEmployeeList';
import AdminStagingManagement from '@/pages/AdminStagingManagement';
import AdminApprovals from '@/pages/AdminApprovals';
import AdminDashboard from '@/pages/AdminDashboard';
import DataManagement from '@/pages/DataManagement';
import ProjectDrilldown from '@/pages/ProjectDrilldown';
import EmployeeDrilldown from '@/pages/EmployeeDrilldown';
import ProtectedRoute from '@/components/ProtectedRoute';
import { initializeAuth } from '@/stores/authStore';
import 'antd/dist/reset.css';

// Ant Design主题配置
const theme = {
  token: {
    colorPrimary: '#2563eb', // 蓝色主题
    borderRadius: 6,
    wireframe: false,
  },
};

export default function App() {
  // 初始化认证状态
  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <ConfigProvider theme={theme}>
      <AntdApp>
        <Router>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />
          
          {/* 受保护的路由 */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            } 
          />
          
          {/* 临时保留的Home页面 */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          
          {/* 个人资料页面 */}
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          
          {/* 工时相关路由 */}
          <Route 
            path="/timesheets" 
            element={
              <ProtectedRoute>
                <Timesheets />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/timesheets/new" 
            element={
              <ProtectedRoute>
                <TimesheetEntry />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/timesheets/:id/edit" 
            element={
              <ProtectedRoute>
                <TimesheetEntry />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/timesheets/:id" 
            element={
              <ProtectedRoute>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Timesheet Details - Coming Soon</h1>
                </div>
              </ProtectedRoute>
            } 
          />
          

          
          {/* 审批管理路由 - Level 1管理员 */}
          <Route 
            path="/approvals" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Approvals - Coming Soon</h1>
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* 报表路由 - Level 1管理员 */}
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Reports - Coming Soon</h1>
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* 管理员专用路由 - Level 1管理员 */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/projects" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <AdminProjectList />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/employees" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <AdminEmployeeList />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/stages" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <AdminStagingManagement />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/approvals" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1', 'LEVEL2']}>
                <AdminApprovals />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/data-management" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <DataManagement />
              </ProtectedRoute>
            } 
          />
          
          {/* 项目钻取页面 - Level 1管理员 */}
          <Route 
            path="/admin/project/:projectId/drilldown" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <ProjectDrilldown />
              </ProtectedRoute>
            } 
          />
          
          {/* 员工详情页面 - Level 1管理员 */}
          <Route 
            path="/admin/employee/:employeeId/drilldown" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <EmployeeDrilldown />
              </ProtectedRoute>
            } 
          />
          
          {/* 用户管理路由 - Level 1管理员（保持向后兼容） */}
          <Route 
            path="/users" 
            element={
              <ProtectedRoute requiredRoles={['LEVEL1']}>
                <AdminEmployeeList />
              </ProtectedRoute>
            } 
          />
          
          {/* 404页面 */}
          <Route 
            path="*" 
            element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl text-gray-400 mb-4">404</div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">Page Not Found</h1>
                  <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                </div>
              </div>
            } 
          />
        </Routes>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
}
