import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore, UserRole } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole | UserRole[];
  fallbackPath?: string;
}

/**
 * 路由保护组件
 * 用于保护需要认证或特定角色权限的页面
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  fallbackPath = '/login',
}) => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    hasRole, 
    getCurrentUser 
  } = useAuthStore();
  
  // 如果有token但没有用户信息，尝试获取用户信息
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user && !isLoading) {
      getCurrentUser().catch(() => {
        // 获取用户信息失败，可能token已过期
        console.log('Failed to get user info, redirecting to login');
      });
    }
  }, [user, isLoading, getCurrentUser]);
  
  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // 未认证，重定向到登录页
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location }} 
        replace 
      />
    );
  }
  
  // 检查角色权限
  if (requiredRoles && !hasRole(requiredRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-gray-400 mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required role(s): {Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles}
          </p>
          <p className="text-sm text-gray-500">
            Your role: {user.role}
          </p>
        </div>
      </div>
    );
  }
  
  // 权限验证通过，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;