import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@/lib/api';

// 用户角色类型 - 新的角色层级系统
export type UserRole = 
  // Level 1 Admin - Full Access
  | 'DIRECTOR' 
  | 'ASSOCIATE' 
  | 'OFFICE_ADMIN'
  // Level 2 Manager - Time Sheets
  | 'PROJECT_MANAGER'
  // Level 3 Worker - Time Sheets  
  | 'JUNIOR_ARCHITECT'
  | 'ARCHITECT';

// 角色系统级别定义
export const ROLE_LEVELS = {
  // Level 1 Admin - Full Access
  DIRECTOR: 1,
  ASSOCIATE: 1,
  OFFICE_ADMIN: 1,
  
  // Level 2 Manager - Time Sheets
  PROJECT_MANAGER: 2,
  
  // Level 3 Worker - Time Sheets
  JUNIOR_ARCHITECT: 3,
  ARCHITECT: 3,
} as const;

// 用户信息接口
export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  position?: string;
  hourlyRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// 认证状态接口
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// 认证操作接口
interface AuthActions {
  // 登录
  login: (email: string, password: string) => Promise<void>;
  // 登出
  logout: () => void;
  // 获取当前用户信息
  getCurrentUser: () => Promise<void>;
  // 清除错误
  clearError: () => void;
  // 设置加载状态
  setLoading: (loading: boolean) => void;
  // 检查权限
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  // 检查角色是否有足够的权限级别
  hasPermissionLevel: (requiredLevel: number) => boolean;
  // 检查是否为Level 1管理员（全权限）
  isLevel1Admin: () => boolean;
  // 检查是否为Level 2经理（时间表权限）
  isLevel2Manager: () => boolean;
  // 检查是否为Level 3员工（时间表权限）
  isLevel3Worker: () => boolean;
  // 检查是否有时间表访问权限（Level 2和Level 3）
  hasTimesheetAccess: () => boolean;
  // 检查是否有管理员访问权限（Level 1）
  hasAdminAccess: () => boolean;
  // 兼容性方法 - 检查是否为管理员
  isAdmin: () => boolean;
  // 兼容性方法 - 检查是否为经理或管理员
  isManagerOrAdmin: () => boolean;
}

// 创建认证store
export const useAuthStore = create<AuthState & AuthActions>()(persist(
  (set, get) => ({
    // 初始状态
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    // 登录操作
    login: async (email: string, password: string) => {
      try {
        set({ isLoading: true, error: null });
        
        const response = await authAPI.login(email, password);
        const { token, user } = response;
        
        // 保存token到localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Login failed';
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: errorMessage,
        });
        throw error;
      }
    },

    // 登出操作
    logout: () => {
      // 清除localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    },

    // 获取当前用户信息
    getCurrentUser: async () => {
      try {
        set({ isLoading: true, error: null });
        
        const response = await authAPI.getCurrentUser();
        const { user } = response;
        
        // 更新localStorage中的用户信息
        localStorage.setItem('user', JSON.stringify(user));
        
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Failed to get user info';
        set({
          isLoading: false,
          error: errorMessage,
        });
        
        // 如果获取用户信息失败，可能是token过期，执行登出
        if (error.response?.status === 401) {
          get().logout();
        }
        
        throw error;
      }
    },

    // 清除错误
    clearError: () => {
      set({ error: null });
    },

    // 设置加载状态
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    // 检查权限
    hasRole: (roles: UserRole | UserRole[]) => {
      const { user } = get();
      if (!user) return false;
      
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(user.role);
    },

    // 检查角色是否有足够的权限级别
    hasPermissionLevel: (requiredLevel: number) => {
      const { user } = get();
      if (!user) return false;
      
      const userLevel = ROLE_LEVELS[user.role];
      return userLevel <= requiredLevel; // 数字越小权限越高
    },

    // 检查是否为Level 1管理员（全权限）
    isLevel1Admin: () => {
      const { user } = get();
      if (!user) return false;
      return ROLE_LEVELS[user.role] === 1;
    },

    // 检查是否为Level 2经理（时间表权限）
    isLevel2Manager: () => {
      const { user } = get();
      if (!user) return false;
      return ROLE_LEVELS[user.role] === 2;
    },

    // 检查是否为Level 3员工（时间表权限）
    isLevel3Worker: () => {
      const { user } = get();
      if (!user) return false;
      return ROLE_LEVELS[user.role] === 3;
    },

    // 检查是否有时间表访问权限（Level 2和Level 3）
    hasTimesheetAccess: () => {
      const { user } = get();
      if (!user) return false;
      const level = ROLE_LEVELS[user.role];
      return level === 2 || level === 3;
    },

    // 检查是否有管理员访问权限（Level 1）
    hasAdminAccess: () => {
      const { user } = get();
      if (!user) return false;
      return ROLE_LEVELS[user.role] === 1;
    },

    // 兼容性方法
    isAdmin: () => {
      return get().isLevel1Admin();
    },

    // 兼容性方法
    isManagerOrAdmin: () => {
      return get().isLevel1Admin();
    },
  }),
  {
    name: 'auth-storage', // localStorage key
    partialize: (state) => ({
      user: state.user,
      token: state.token,
      isAuthenticated: state.isAuthenticated,
    }),
  }
));

// 初始化认证状态
export const initializeAuth = () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      useAuthStore.setState({
        user,
        token,
        isAuthenticated: true,
      });
    } catch (error) {
      // 如果解析用户信息失败，清除localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
};