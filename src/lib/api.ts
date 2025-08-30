import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token过期或无效，清除本地存储并跳转到登录页
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// 认证相关API
export const authAPI = {
  // 用户登录
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  // 获取当前用户信息
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  
  // 创建用户（管理员）
  createUser: async (userData: any) => {
    const response = await api.post('/auth/users', userData);
    return response.data;
  },
  
  // 获取所有用户
  getUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },
  
  // 更新用户信息
  updateUser: async (userId: string, userData: any) => {
    const response = await api.put(`/auth/users/${userId}`, userData);
    return response.data;
  },
  
  // 修改密码
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// 工时相关API
export const timesheetAPI = {
  // 创建工时记录
  create: async (timesheetData: any) => {
    const response = await api.post('/timesheets', timesheetData);
    return response.data;
  },
  
  // 获取工时记录列表
  getList: async (params: any = {}) => {
    const response = await api.get('/timesheets', { params });
    return response.data;
  },
  
  // 获取单个工时记录
  getById: async (id: string) => {
    const response = await api.get(`/timesheets/${id}`);
    return response.data;
  },
  
  // 更新工时记录
  update: async (id: string, timesheetData: any) => {
    const response = await api.put(`/timesheets/${id}`, timesheetData);
    return response.data;
  },
  
  // 提交工时记录
  submit: async (id: string) => {
    const response = await api.put(`/timesheets/${id}/submit`);
    return response.data;
  },
  
  // 撤回工时记录
  withdraw: async (id: string) => {
    const response = await api.put(`/timesheets/${id}/withdraw`);
    return response.data;
  },
  
  // 删除工时记录
  delete: async (id: string) => {
    const response = await api.delete(`/timesheets/${id}`);
    return response.data;
  },
  
  // 获取工时统计
  getStats: async (params: any = {}) => {
    const response = await api.get('/timesheets/stats/summary', { params });
    return response.data;
  },
  
  // 批量更新工时记录状态
  batchUpdateStatus: async (date: string, status: 'DRAFT' | 'SUBMITTED') => {
    const response = await api.put('/timesheets/batch/status', { date, status });
    return response.data;
  },
};

// 项目相关API
export const projectAPI = {
  // 获取项目列表
  getList: async (params: any = {}) => {
    const response = await api.get('/projects', { params });
    return response.data;
  },
  
  // 获取单个项目
  getById: async (id: string) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  
  // 创建项目
  create: async (projectData: any) => {
    const response = await api.post('/projects', projectData);
    return response.data;
  },
  
  // 更新项目
  update: async (id: string, projectData: any) => {
    const response = await api.put(`/projects/${id}`, projectData);
    return response.data;
  },
  
  // 添加项目成员
  addMember: async (projectId: string, employeeId: string) => {
    const response = await api.post(`/projects/${projectId}/members`, { employeeId });
    return response.data;
  },
  
  // 移除项目成员
  removeMember: async (projectId: string, employeeId: string) => {
    const response = await api.delete(`/projects/${projectId}/members/${employeeId}`);
    return response.data;
  },
  
  // 获取项目阶段
  getStages: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/stages`);
    return response.data;
  },
  
  // 创建项目阶段
  createStage: async (projectId: string, stageData: any) => {
    const response = await api.post(`/projects/${projectId}/stages`, stageData);
    return response.data;
  },
  
  // 更新项目阶段
  updateStage: async (projectId: string, stageId: string, stageData: any) => {
    const response = await api.put(`/projects/${projectId}/stages/${stageId}`, stageData);
    return response.data;
  },
};

// 审批相关API
export const approvalAPI = {
  // 获取待审批列表
  getPending: async (params: any = {}) => {
    const response = await api.get('/approvals/pending', { params });
    return response.data;
  },
  
  // 获取审批历史
  getHistory: async (params: any = {}) => {
    const response = await api.get('/approvals/history', { params });
    return response.data;
  },
  
  // 获取单个审批记录
  getById: async (id: string) => {
    const response = await api.get(`/approvals/${id}`);
    return response.data;
  },
  
  // 审批工时记录
  approve: async (approvalId: string, comments?: string) => {
    const response = await api.put(`/approvals/${approvalId}/approve`, { comments });
    return response.data;
  },
  
  // 批量审批
  batchApprove: async (approvalIds: string[], comments?: string) => {
    const response = await api.put('/approvals/batch/approve', {
      approvalIds,
      comments,
    });
    return response.data;
  },
  
  // 获取审批统计
  getStats: async (params: any = {}) => {
    const response = await api.get('/approvals/stats/summary', { params });
    return response.data;
  },
  
  // 获取个人审批工作量
  getWorkload: async (params: any = {}) => {
    const response = await api.get('/approvals/my/workload', { params });
    return response.data;
  },
  
};

// 阶段相关API
export const stageAPI = {
  // 获取阶段列表
  getList: async (params: any = {}) => {
    const response = await api.get('/stages', { params });
    return response.data;
  },
  
  // 获取单个阶段
  getById: async (id: string) => {
    const response = await api.get(`/stages/${id}`);
    return response.data;
  },
  
  // 获取阶段类别列表
  getCategories: async () => {
    const response = await api.get('/stages/categories/list');
    return response.data;
  },
  
  // 创建阶段
  create: async (stageData: any) => {
    const response = await api.post('/stages', stageData);
    return response.data;
  },
  
  // 更新阶段
  update: async (id: string, stageData: any) => {
    const response = await api.put(`/stages/${id}`, stageData);
    return response.data;
  },
  
  // 删除阶段
  delete: async (id: string) => {
    const response = await api.delete(`/stages/${id}`);
    return response.data;
  },
};

// 报表相关API
export const reportAPI = {
  // 获取工时报表
  getTimesheetReport: async (params: any = {}) => {
    const response = await api.get('/reports/timesheets', { params });
    return response.data;
  },
  
  // 获取项目进度报表
  getProjectProgress: async (params: any = {}) => {
    const response = await api.get('/reports/project-progress', { params });
    return response.data;
  },
  
  // 获取员工绩效报表
  getEmployeePerformance: async (params: any = {}) => {
    const response = await api.get('/reports/employee-performance', { params });
    return response.data;
  },
  
  // 导出工时数据
  exportTimesheets: async (params: any = {}) => {
    const response = await api.get('/reports/export/timesheets', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
  
  // 获取仪表板统计
  getDashboardStats: async (params: any = {}) => {
    const response = await api.get('/reports/dashboard/stats', { params });
    return response.data;
  },
};

// 管理员审批相关API
export const adminApprovalAPI = {
  // 获取待审批列表（管理员专用）
  getPending: async (params: any = {}) => {
    const response = await api.get('/admin/approvals/pending', { params });
    return response.data;
  },
  
  // 获取审批历史（管理员专用）
  getHistory: async (params: any = {}) => {
    const response = await api.get('/admin/approvals/history', { params });
    return response.data;
  },
  
  // 获取审批详情（管理员专用）
  getById: async (id: string) => {
    const response = await api.get(`/admin/approvals/${id}`);
    return response.data;
  },
  
  // 批量审批（管理员专用）
  batchApprove: async (approvalIds: string[], comments?: string) => {
    const response = await api.put('/admin/approvals/batch-approve', {
      approvalIds,
      comments,
    });
    return response.data;
  },
  
  // 批量拒绝（管理员专用）
  batchReject: async (approvalIds: string[], comments: string) => {
    const response = await api.put('/admin/approvals/batch-reject', {
      approvalIds,
      comments,
    });
    return response.data;
  },
  
  // 获取审批统计（管理员专用）
  getStats: async (params: any = {}) => {
    const response = await api.get('/admin/approvals/stats', { params });
    return response.data;
  },
  
  // 批量重置工时表状态为SUBMITTED（仅Level 1管理员）
  batchResetToSubmitted: async (timesheetIds: string[]) => {
    const response = await api.put('/admin/approvals/batch/reset-to-submitted', {
      timesheetIds,
    });
    return response.data;
  },
};

// 管理员仪表板相关API
export const adminDashboardAPI = {
  // 获取月度统计数据
  getStats: async (month: string) => {
    const response = await api.get('/admin/dashboard/stats', {
      params: { month },
    });
    return response.data;
  },
  
  // 获取图表数据
  getChartData: async (month: string) => {
    const response = await api.get('/admin/dashboard/charts', {
      params: { month },
    });
    return response.data;
  },
  
  // 获取项目钻取数据
  getProjectDrill: async (projectName: string, params: { month?: string; startDate?: string; endDate?: string }) => {
    const response = await api.get(`/admin/dashboard/project-drill/${encodeURIComponent(projectName)}`, {
      params,
    });
    return response.data;
  },
};