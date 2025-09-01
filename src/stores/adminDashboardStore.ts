import { create } from 'zustand';
import { adminDashboardAPI } from '@/lib/api';

// 统计数据接口
export interface DashboardStats {
  totalHours: number;
  approvedHours: number;
  totalProjects: number; // 修复字段名：后端返回totalProjects而不是activeProjects
  activeEmployees: number;
  completionRate: number;
}

// 图表数据项接口
export interface ChartDataItem {
  name: string;
  totalHours: number;
  approvedHours: number;
  count: number; // 项目数或员工数
  completionRate: number;
}

// 图表数据接口
export interface ChartData {
  projectStats: ChartDataItem[];
  employeeStats: ChartDataItem[];
}

// 项目钻取数据接口
export interface ProjectDrillData {
  projectName: string;
  stages: Array<{
    stageName: string;
    totalHours: number;
    approvedHours: number;
    employeeCount: number;
    completionRate: number;
  }>;
  employees: Array<{
    employeeName: string;
    totalHours: number;
    approvedHours: number;
    completionRate: number;
  }>;
}

// 状态接口
interface AdminDashboardState {
  // 数据状态
  stats: DashboardStats | null;
  chartData: ChartData | null;
  drillData: ProjectDrillData | null;
  
  // 加载状态
  statsLoading: boolean;
  chartLoading: boolean;
  drillLoading: boolean;
  
  // 错误状态
  statsError: string | null;
  chartError: string | null;
  drillError: string | null;
  
  // 当前选择的月份
  selectedMonth: string;
  
  // 当前钻取的项目
  drillProject: string | null;
}

// 操作接口
interface AdminDashboardActions {
  // 获取统计数据
  fetchStats: (month: string) => Promise<void>;
  
  // 获取图表数据
  fetchChartData: (month: string) => Promise<void>;
  
  // 获取项目钻取数据
  fetchDrillData: (projectName: string, month: string) => Promise<void>;
  
  // 设置选择的月份
  setSelectedMonth: (month: string) => void;
  
  // 设置钻取项目
  setDrillProject: (projectName: string | null) => void;
  
  // 清除错误
  clearErrors: () => void;
  
  // 重置状态
  reset: () => void;
  
  // 刷新所有数据
  refreshAll: (month: string) => Promise<void>;
}

// 初始状态
const initialState: AdminDashboardState = {
  stats: null,
  chartData: null,
  drillData: null,
  statsLoading: false,
  chartLoading: false,
  drillLoading: false,
  statsError: null,
  chartError: null,
  drillError: null,
  selectedMonth: new Date().toISOString().slice(0, 7), // YYYY-MM格式
  drillProject: null,
};

// 创建管理员仪表板store
export const useAdminDashboardStore = create<AdminDashboardState & AdminDashboardActions>()(
  (set, get) => ({
    ...initialState,

    // 获取统计数据
    fetchStats: async (month: string) => {
      try {
        set({ statsLoading: true, statsError: null });
        
        // 开始获取仪表板统计数据
        
        const response = await adminDashboardAPI.getStats(month);
        
        // 统计数据API响应成功
        
        set({
          stats: response, // 直接使用 response，不是 response.data
          statsLoading: false,
          statsError: null,
        });
      } catch (error: any) {
        console.error('Frontend: 获取统计数据失败 - 详细错误信息:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });
        
        const errorMessage = error.response?.data?.error || 'Failed to fetch stats';
        set({
          statsLoading: false,
          statsError: errorMessage,
        });
        throw error;
      }
    },

    // 获取图表数据
    fetchChartData: async (month: string) => {
      try {
        set({ chartLoading: true, chartError: null });
        
        // 开始获取图表数据
        
        const response = await adminDashboardAPI.getChartData(month);
        
        // 图表数据API响应成功
        
        // 转换数据结构以匹配前端接口
        const chartData: ChartData = {
          projectStats: response.projectStats || [],
          employeeStats: response.employeeStats || []
        };
        
        // 转换后的图表数据
        
        set({
          chartData: chartData,
          chartLoading: false,
          chartError: null,
        });
      } catch (error: any) {
        console.error('Frontend: 获取图表数据失败 - 详细错误信息:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });
        
        const errorMessage = error.response?.data?.error || 'Failed to fetch chart data';
        set({
          chartLoading: false,
          chartError: errorMessage,
        });
        throw error;
      }
    },

    // 获取项目钻取数据
    fetchDrillData: async (projectName: string, month: string) => {
      try {
        set({ drillLoading: true, drillError: null });
        
        const response = await adminDashboardAPI.getProjectDrill(projectName, { month });
        
        set({
          drillData: response.data,
          drillLoading: false,
          drillError: null,
          drillProject: projectName,
        });
      } catch (error: any) {
        const errorMessage = error.response?.data?.error || 'Failed to fetch drill data';
        set({
          drillLoading: false,
          drillError: errorMessage,
        });
        console.error('获取项目钻取数据失败:', error);
        throw error;
      }
    },

    // 设置选择的月份
    setSelectedMonth: (month: string) => {
      set({ selectedMonth: month });
    },

    // 设置钻取项目
    setDrillProject: (projectName: string | null) => {
      set({ drillProject: projectName });
      
      // 如果清除钻取项目，也清除钻取数据
      if (!projectName) {
        set({ drillData: null });
      }
    },

    // 清除错误
    clearErrors: () => {
      set({
        statsError: null,
        chartError: null,
        drillError: null,
      });
    },

    // 重置状态
    reset: () => {
      set(initialState);
    },

    // 刷新所有数据
    refreshAll: async (month: string) => {
      const { fetchStats, fetchChartData } = get();
      
      try {
        // 并行获取统计数据和图表数据
        await Promise.all([
          fetchStats(month),
          fetchChartData(month),
        ]);
      } catch (error) {
        console.error('刷新仪表板数据失败:', error);
        throw error;
      }
    },
  })
);

// 导出便捷的选择器函数
export const selectStats = (state: AdminDashboardState & AdminDashboardActions) => state.stats;
export const selectChartData = (state: AdminDashboardState & AdminDashboardActions) => state.chartData;
export const selectDrillData = (state: AdminDashboardState & AdminDashboardActions) => state.drillData;
export const selectLoading = (state: AdminDashboardState & AdminDashboardActions) => ({
  stats: state.statsLoading,
  chart: state.chartLoading,
  drill: state.drillLoading,
});
export const selectErrors = (state: AdminDashboardState & AdminDashboardActions) => ({
  stats: state.statsError,
  chart: state.chartError,
  drill: state.drillError,
});