import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  App,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  DatePicker,
  Checkbox,
  Tabs,
  Avatar,
  Divider,
  Empty,
  Popconfirm,
} from 'antd';
import PageLayout from '@/components/PageLayout';
import {
  CheckOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ProjectOutlined,
  CalendarOutlined,
  EyeOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import api, { adminApprovalAPI, timesheetAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 配置dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

// 审批状态选项
const APPROVAL_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending', color: 'orange' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
];

// 审批记录接口类型定义
interface Approval {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  approvedAt?: string;
  comments?: string;
  timesheet: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    hours: number; // 后端返回的是hours字段
    description?: string;
    employee: { // 后端返回的是employee字段，不是submitter
      id: string;
      name: string;
      employeeId: string;
      email: string;
    };
    project: {
      id: string;
      name: string;
      projectCode: string; // 后端返回的是projectCode字段，不是code
    };
    stage?: {
      id: string;
      name: string;
    };
  };
  approver?: {
    id: string;
    name: string;
    employeeId: string;
  };
}

// 按状态分组的审批记录接口
interface StatusGroupedApprovals {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  statusLabel: string;
  statusColor: string;
  count: number;
  totalHours: number;
  dailyGroups: DailyApprovalGroup[];
}

// 按日期分组的审批记录接口
interface DailyApprovalGroup {
  date: string;
  dayOfWeek: string;
  totalHours: number;
  employeeGroups: EmployeeApprovalGroup[];
}

// 按员工分组的审批记录接口
interface EmployeeApprovalGroup {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  totalHours: number;
  approvals: Approval[];
}

// 分页信息接口
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 统计信息接口
interface Statistics {
  statusStats: Array<{ status: string; _count: { id: number } }>;
  projectStats: Array<{ project: { id: string; name: string; projectCode: string }; _count: { id: number } }>;
  approverStats: Array<{ approver: { id: string; name: string; employeeId: string }; _count: { id: number } }>;
  averageApprovalTimeHours: number;
  totalRecords: number;
}

/**
 * 管理员审批页面
 * 提供待审批列表、批量审批、审批历史等功能
 */
const AdminApprovals: React.FC = () => {
  const { message } = App.useApp();
  const { isLevel1Admin } = useAuthStore();
  const [activeTab, setActiveTab] = useState('pending');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [groupedApprovals, setGroupedApprovals] = useState<StatusGroupedApprovals[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchAction] = useState<'approve'>('approve');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [batchForm] = Form.useForm();
  
  // 过滤状态
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [submitterFilter, setSubmitterFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([dayjs().startOf('week'), dayjs().endOf('week')]);
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 分页状态
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  
  // 统计信息
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  
  // 项目和用户选项（用于筛选）
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; name: string; projectCode: string }>>([]);
  const [userOptions, setUserOptions] = useState<Array<{ id: string; name: string; employeeId: string }>>([]);
  
  // 员工卡片展开/收起状态管理
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  // 切换员工卡片展开/收起状态
  const toggleEmployeeExpanded = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  // 重置员工条目为submitted状态（所有管理员可用）
  const handleResetToSubmitted = async (employeeGroup: EmployeeApprovalGroup) => {
    try {
      // 只获取APPROVED状态的timesheet IDs进行重置
      const approvedTimesheetIds = employeeGroup.approvals
        .filter(approval => approval.status === 'APPROVED')
        .map(approval => approval.timesheet.id);
      
      if (approvedTimesheetIds.length === 0) {
        message.warning('No approved entries to reset for this employee.');
        return;
      }
      
      // 使用管理员专用API批量重置工时表状态
      const result = await adminApprovalAPI.batchResetToSubmitted(approvedTimesheetIds);
      
      message.success(result.message || `Successfully reset ${result.resetCount} approved timesheets to submitted status`);
      
      // 刷新数据
      fetchApprovals();
    } catch (error: any) {
      console.error('Reset to submitted error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to reset entries to submitted status';
      message.error(errorMessage);
    }
  };

  // 按状态分组审批记录
  const groupApprovalsByStatus = (approvals: Approval[]): StatusGroupedApprovals[] => {
    // 首先按状态分组
    const statusGroups = approvals.reduce((acc, approval) => {
      const status = approval.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(approval);
      return acc;
    }, {} as Record<string, Approval[]>);

    // 为每个状态创建分组数据
    const result: StatusGroupedApprovals[] = [];
    
    // 按优先级排序状态：PENDING -> APPROVED -> REJECTED
    const statusOrder: Array<'PENDING' | 'APPROVED' | 'REJECTED'> = ['PENDING', 'APPROVED', 'REJECTED'];
    
    statusOrder.forEach(status => {
      const statusApprovals = statusGroups[status] || [];
      if (statusApprovals.length === 0) return;

      // 按日期分组
      const dateGroups = statusApprovals.reduce((acc, approval) => {
        const date = dayjs(approval.timesheet.date).format('YYYY-MM-DD');
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(approval);
        return acc;
      }, {} as Record<string, Approval[]>);

      // 为每个日期创建员工分组
      const dailyGroups: DailyApprovalGroup[] = Object.entries(dateGroups)
        .sort(([a], [b]) => dayjs(b).valueOf() - dayjs(a).valueOf()) // 按日期倒序
        .map(([date, dateApprovals]) => {
          // 按员工分组
          const employeeGroups = dateApprovals.reduce((acc, approval) => {
            const employeeId = approval.timesheet.employee.id;
            if (!acc[employeeId]) {
              acc[employeeId] = {
                employeeId,
                employeeName: approval.timesheet.employee.name,
                employeeCode: approval.timesheet.employee.employeeId,
                totalHours: 0,
                approvals: [],
              };
            }
            acc[employeeId].approvals.push(approval);
            acc[employeeId].totalHours += approval.timesheet.hours;
            return acc;
          }, {} as Record<string, EmployeeApprovalGroup>);

          const totalHours = dateApprovals.reduce((sum, approval) => sum + approval.timesheet.hours, 0);

          return {
            date,
            dayOfWeek: dayjs(date).format('dddd'),
            totalHours,
            employeeGroups: Object.values(employeeGroups).sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
          };
        });

      const statusConfig = {
        PENDING: { label: 'Pending Approvals', color: 'orange' },
        APPROVED: { label: 'Approved', color: 'green' },
        REJECTED: { label: 'Rejected', color: 'red' },
      };

      const totalHours = statusApprovals.reduce((sum, approval) => sum + approval.timesheet.hours, 0);

      result.push({
        status,
        statusLabel: statusConfig[status].label,
        statusColor: statusConfig[status].color,
        count: statusApprovals.length,
        totalHours,
        dailyGroups,
      });
    });

    return result;
  };

  // 获取审批列表
  const fetchApprovals = async (tab: string = activeTab) => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
      };
      

      if (projectFilter) params.projectId = projectFilter;
      if (submitterFilter) params.submitterId = submitterFilter;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
        // 日期筛选参数设置完成
      }
      
      // 开始获取审批列表
      
      const response = tab === 'pending' 
        ? await adminApprovalAPI.getPending(params)
        : await adminApprovalAPI.getHistory(params);
      
      // API响应成功
      const approvalsData = response.approvals || [];
      setApprovals(approvalsData);
      
      // 生成按状态分组的数据
      const grouped = groupApprovalsByStatus(approvalsData);
      setGroupedApprovals(grouped);
      
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Frontend: 获取审批列表失败 - 详细错误信息:', {
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
      
      if (error.response?.status === 401) {
        message.error('Authentication failed. Please login again.');
      } else if (error.response?.status === 403) {
        message.error('Access denied. Insufficient permissions.');
      } else if (error.response?.data?.error) {
        message.error(`Failed to fetch approval list: ${error.response.data.error}`);
      } else {
        message.error('Failed to fetch approval list');
      }
    } finally {
      setLoading(false);
    }
  };

  // 获取统计信息
  const fetchStatistics = async () => {
    try {
      const params: any = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
        // 统计信息日期筛选参数设置完成
      }
      if (projectFilter) params.projectId = projectFilter;
      
      const response = await adminApprovalAPI.getStats(params);
      setStatistics(response);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  // 获取项目和用户选项
  const fetchOptions = async () => {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        api.get('/projects', { params: { limit: 1000 } }),
        api.get('/auth/users', { params: { limit: 1000 } }),
      ]);
      
      setProjectOptions(projectsRes.data.projects || []);
      setUserOptions(usersRes.data.users || []);
    } catch (error) {
      console.error('获取选项数据失败:', error);
    }
  };

  // 当筛选条件改变时重置页码
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [projectFilter, submitterFilter, dateRange, sortBy, sortOrder, activeTab]);

  // 获取数据的useEffect，避免循环依赖
  useEffect(() => {
    const fetchData = async () => {
      await fetchApprovals();
      await fetchStatistics();
    };
    fetchData();
  }, [activeTab, pagination.page, pagination.limit]);

  // 筛选条件变化时获取数据（延迟执行避免频繁调用）
   useEffect(() => {
     const timer = setTimeout(() => {
       fetchApprovals();
       fetchStatistics();
     }, 300);
     
     return () => clearTimeout(timer);
   }, [projectFilter, submitterFilter, dateRange, sortBy, sortOrder]);

  // 组件挂载时获取选项数据
  useEffect(() => {
    fetchOptions();
  }, []);

  // 批量审批
  const handleBatchAction = async () => {
    try {
      const values = await batchForm.validateFields();
      
      await adminApprovalAPI.batchApprove(selectedRowKeys as string[], values.comments);
      
      message.success(`${selectedRowKeys.length} timesheets approved successfully`);
      setBatchModalVisible(false);
      setSelectedRowKeys([]);
      batchForm.resetFields();
      fetchApprovals();
      fetchStatistics();
    } catch (error: any) {
      console.error('批量操作失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to approve timesheets');
      }
    }
  };

  // 打开批量操作模态框
  const openBatchModal = () => {
    setBatchModalVisible(true);
    batchForm.resetFields();
  };

  // 查看详情
  const viewDetail = async (approval: Approval) => {
    try {
      const response = await adminApprovalAPI.getById(approval.id);
      setSelectedApproval(response);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('获取审批详情失败:', error);
      message.error('Failed to fetch approval details');
    }
  };

  // 重置筛选条件
  const resetFilters = () => {
    setProjectFilter(undefined);
    setSubmitterFilter(undefined);
    // 设置日期范围为当周的开始和结束日期
    const startOfWeek = dayjs().startOf('week');
    const endOfWeek = dayjs().endOf('week');
    setDateRange([startOfWeek, endOfWeek]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    const option = APPROVAL_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'default';
  };

  // 获取状态标签文本
  const getStatusText = (status: string) => {
    const option = APPROVAL_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || status;
  };

  // 获取状态标签颜色和文本
  const getStatusTag = (status: string) => {
    const statusConfig = {
      PENDING: { color: 'orange', text: 'Pending' },
      APPROVED: { color: 'green', text: 'Approved' },
      REJECTED: { color: 'red', text: 'Rejected' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 渲染按状态分组的审批记录
  const renderGroupedApprovals = () => {
    if (groupedApprovals.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Empty description="No approvals found" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {groupedApprovals.map((statusGroup) => (
          <Card
            key={statusGroup.status}
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Tag color={statusGroup.statusColor} className="text-sm px-3 py-1">
                    {statusGroup.statusLabel}
                  </Tag>
                  <span className="text-gray-600">
                    {statusGroup.count} records • {statusGroup.totalHours.toFixed(1)} hours
                  </span>
                </div>
                {statusGroup.status === 'PENDING' && (
                   <div className="flex items-center space-x-2">
                     <Checkbox
                       indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < statusGroup.count}
                       checked={selectedRowKeys.length === statusGroup.count}
                       onChange={(e) => {
                         if (e.target.checked) {
                           // 选择该状态组下的所有审批记录
                           const allApprovalIds = statusGroup.dailyGroups
                             .flatMap(daily => daily.employeeGroups)
                             .flatMap(employee => employee.approvals)
                             .map(approval => approval.id);
                           setSelectedRowKeys([...new Set([...selectedRowKeys, ...allApprovalIds])]);
                         } else {
                           // 取消选择该状态组下的所有审批记录
                           const statusApprovalIds = statusGroup.dailyGroups
                             .flatMap(daily => daily.employeeGroups)
                             .flatMap(employee => employee.approvals)
                             .map(approval => approval.id);
                           setSelectedRowKeys(selectedRowKeys.filter(key => !statusApprovalIds.includes(key as string)));
                         }
                       }}
                     >
                       Select All
                     </Checkbox>
                     {selectedRowKeys.length > 0 && (
                       <Button
                         type="primary"
                         size="small"
                         onClick={() => openBatchModal()}
                       >
                         Batch Approve ({selectedRowKeys.length})
                       </Button>
                     )}
                   </div>
                 )}
              </div>
            }
            className="shadow-sm"
          >
            <div className="space-y-4">
              {statusGroup.dailyGroups.map((dailyGroup) => (
                <div key={dailyGroup.date} className="border-l-4 border-blue-200 pl-4">
                  <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center space-x-3">
                       <h4 className="font-medium text-gray-900">
                         {dayjs(dailyGroup.date).format('MMMM D, YYYY')} ({dailyGroup.dayOfWeek})
                       </h4>
                       {statusGroup.status === 'PENDING' && (
                         <Checkbox
                           indeterminate={
                             dailyGroup.employeeGroups.some(emp => 
                               emp.approvals.some(app => selectedRowKeys.includes(app.id))
                             ) && !dailyGroup.employeeGroups.every(emp => 
                               emp.approvals.every(app => selectedRowKeys.includes(app.id))
                             )
                           }
                           checked={
                             dailyGroup.employeeGroups.length > 0 && 
                             dailyGroup.employeeGroups.every(emp => 
                               emp.approvals.every(app => selectedRowKeys.includes(app.id))
                             )
                           }
                           onChange={(e) => {
                             const dailyApprovalIds = dailyGroup.employeeGroups
                               .flatMap(emp => emp.approvals)
                               .map(app => app.id);
                             
                             if (e.target.checked) {
                               setSelectedRowKeys([...new Set([...selectedRowKeys, ...dailyApprovalIds])]);
                             } else {
                               setSelectedRowKeys(selectedRowKeys.filter(key => !dailyApprovalIds.includes(key as string)));
                             }
                           }}
                         >
                           <span className="text-xs text-gray-500">Select Day</span>
                         </Checkbox>
                       )}
                     </div>
                     <span className="text-sm text-gray-600">
                       {dailyGroup.totalHours.toFixed(1)} hours
                     </span>
                   </div>
                  
                  <div className="space-y-3">
                    {dailyGroup.employeeGroups.map((employeeGroup) => {
                      const isExpanded = expandedEmployees.has(employeeGroup.employeeId);
                      return (
                      <div key={employeeGroup.employeeId} className="bg-gray-50 rounded-lg p-4">
                        <div 
                          className="flex items-center justify-between mb-3 cursor-pointer hover:bg-gray-100 rounded-lg p-2 -m-2 transition-colors duration-200"
                          onClick={() => toggleEmployeeExpanded(employeeGroup.employeeId)}
                        >
                           <div className="flex items-center space-x-3">
                             {getUserAvatar(employeeGroup.employeeName)}
                             <div>
                               <div className="font-medium text-gray-900">
                                 {employeeGroup.employeeName}
                               </div>
                               <div className="text-sm text-gray-600">
                                 ID: {employeeGroup.employeeCode}
                               </div>
                             </div>
                             {statusGroup.status === 'PENDING' && (
                               <Checkbox
                                 indeterminate={
                                   employeeGroup.approvals.some(app => selectedRowKeys.includes(app.id)) &&
                                   !employeeGroup.approvals.every(app => selectedRowKeys.includes(app.id))
                                 }
                                 checked={
                                   employeeGroup.approvals.length > 0 &&
                                   employeeGroup.approvals.every(app => selectedRowKeys.includes(app.id))
                                 }
                                 onChange={(e) => {
                                   e.stopPropagation(); // 阻止事件冒泡
                                   const employeeApprovalIds = employeeGroup.approvals.map(app => app.id);
                                   
                                   if (e.target.checked) {
                                     setSelectedRowKeys([...new Set([...selectedRowKeys, ...employeeApprovalIds])]);
                                   } else {
                                     setSelectedRowKeys(selectedRowKeys.filter(key => !employeeApprovalIds.includes(key as string)));
                                   }
                                 }}
                               >
                                 <span className="text-xs text-gray-500">Select Employee</span>
                               </Checkbox>
                             )}
                           </div>
                           <div className="flex items-center space-x-2">
                             <span className="text-sm font-medium text-gray-700">
                               {employeeGroup.totalHours.toFixed(1)} hours
                             </span>
                             {/* 重置按钮 - 仅Level 1管理员可见 */}
                             {isLevel1Admin() && (
                               <Popconfirm
                                 title="Reset to Submitted"
                                 description={`Are you sure you want to reset ${employeeGroup.approvals.filter(a => a.status === 'APPROVED').length} approved timesheet(s) for ${employeeGroup.employeeName} back to submitted status?`}
                                 onConfirm={(e) => {
                                   e?.stopPropagation();
                                   handleResetToSubmitted(employeeGroup);
                                 }}
                                 onCancel={(e) => e?.stopPropagation()}
                                 okText="Yes, Reset"
                                 cancelText="Cancel"
                                 placement="topRight"
                               >
                                 <Button
                                   type="text"
                                   size="small"
                                   onClick={(e) => e.stopPropagation()}
                                   className="text-orange-600 hover:text-orange-700"
                                 >
                                   Reset to Submitted
                                 </Button>
                               </Popconfirm>
                             )}
                             {isExpanded ? (
                               <UpOutlined className="text-gray-500 transition-transform duration-200" />
                             ) : (
                               <DownOutlined className="text-gray-500 transition-transform duration-200" />
                             )}
                           </div>
                         </div>
                        
                        {/* 展开/收起的详细内容 */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <div className="space-y-2 pt-2">
                            {employeeGroup.approvals.map((approval) => (
                              <div key={approval.id} className="bg-white rounded border p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-4 text-sm">
                                      <span className="font-medium text-blue-600">
                                        {approval.timesheet.project.name}
                                      </span>
                                      <span className="text-gray-600">
                                        {dayjs(approval.timesheet.startTime).tz('Australia/Sydney').format('HH:mm')} - {dayjs(approval.timesheet.endTime).tz('Australia/Sydney').format('HH:mm')}
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {approval.timesheet.hours.toFixed(1)}h
                                      </span>
                                    </div>
                                    {approval.timesheet.description && (
                                      <div className="text-sm text-gray-600 mt-1">
                                        {approval.timesheet.description}
                                      </div>
                                    )}
                                    {approval.timesheet.stage && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Stage: {approval.timesheet.stage.name}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    {statusGroup.status === 'PENDING' && (
                                      <Checkbox
                                        checked={selectedRowKeys.includes(approval.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedRowKeys([...selectedRowKeys, approval.id]);
                                          } else {
                                            setSelectedRowKeys(selectedRowKeys.filter(key => key !== approval.id));
                                          }
                                        }}
                                      />
                                    )}
                                    <Button
                                      type="link"
                                      size="small"
                                      onClick={() => viewDetail(approval)}
                                    >
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // 生成用户头像
  const getUserAvatar = (name: string) => {
    const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#87d068'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    return (
      <Avatar 
        style={{ backgroundColor: colors[colorIndex] }}
        size="small"
      >
        {name.charAt(0).toUpperCase()}
      </Avatar>
    );
  };

  // 待审批表格列定义
  const pendingColumns: ColumnsType<Approval> = [
    {
      title: 'Submitter',
      key: 'submitter',
      width: 120,
      fixed: 'left',
      render: (_, record) => {
        const employee = record.timesheet?.employee;
        if (!employee) return '-';
        return (
          <Space>
            {getUserAvatar(employee.name || 'Unknown')}
            <div>
              <div className="font-medium">{employee.name || 'Unknown'}</div>
              <div className="text-xs text-gray-500">{employee.employeeId || '-'}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Project',
      key: 'project',
      width: 200,
      render: (_, record) => {
        const project = record.timesheet?.project;
        if (!project) return '-';
        return (
          <div>
            <div className="font-medium">{project.name || 'Unknown'}</div>
            <div className="text-xs text-gray-500">{project.projectCode || '-'}</div>
          </div>
        );
      },
    },
    {
      title: 'Description',
      key: 'description',
      width: 200,
      render: (_, record) => {
        const description = record.timesheet?.description;
        return description ? (
          <div className="text-sm" title={description}>
            {description.length > 50 ? `${description.substring(0, 50)}...` : description}
          </div>
        ) : '-';
      },
    },
    {
      title: 'Date',
      key: 'date',
      width: 100,
      render: (_, record) => {
        const date = record.timesheet?.date;
        return date ? dayjs(date).format('YYYY-MM-DD') : '-';
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 80,
      render: (_, record) => {
        const hours = record.timesheet?.hours;
        return hours ? `${hours}h` : '-';
      },
    },
    {
      title: 'Submitted',
      key: 'submittedAt',
      width: 120,
      render: (_, record) => dayjs(record.submittedAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Details',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => viewDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  // 审批历史表格列定义
  const historyColumns: ColumnsType<Approval> = [
    {
      title: 'Submitter',
      key: 'submitter',
      width: 120,
      fixed: 'left',
      render: (_, record) => {
        const employee = record.timesheet?.employee;
        if (!employee) return '-';
        return (
          <Space>
            {getUserAvatar(employee.name || 'Unknown')}
            <div>
              <div className="font-medium">{employee.name || 'Unknown'}</div>
              <div className="text-xs text-gray-500">{employee.employeeId || '-'}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Project',
      key: 'project',
      width: 200,
      render: (_, record) => {
        const project = record.timesheet?.project;
        if (!project) return '-';
        return (
          <div>
            <div className="font-medium">{project.name || 'Unknown'}</div>
            <div className="text-xs text-gray-500">{project.projectCode || '-'}</div>
          </div>
        );
      },
    },
    {
      title: 'Date',
      key: 'date',
      width: 100,
      render: (_, record) => {
        const date = record.timesheet?.date;
        return date ? dayjs(date).format('YYYY-MM-DD') : '-';
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 80,
      render: (_, record) => {
        const hours = record.timesheet?.hours;
        return hours ? `${hours}h` : '-';
      },
    },
    {
      title: 'Approver',
      key: 'approver',
      width: 120,
      render: (_, record: Approval) => (
        record.approver ? (
          <div>
            <div className="font-medium">{record.approver.name}</div>
            <div className="text-xs text-gray-500">{record.approver.employeeId}</div>
          </div>
        ) : '-'
      ),
    },
    {
      title: 'Approved',
      key: 'approvedAt',
      width: 120,
      render: (_, record: Approval) => (
        record.approvedAt ? dayjs(record.approvedAt).format('YYYY-MM-DD HH:mm') : '-'
      ),
    },
    {
      title: 'Details',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => viewDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
    getCheckboxProps: (record: Approval) => ({
      disabled: record.status !== 'PENDING',
    }),
  };

  return (
    <PageLayout
      title="Approval Management"
      description="Review and approve employee timesheet submissions"
      icon={<FileTextOutlined />}
    >

      {/* 统计卡片 */}
      {statistics && (
        <div className="mb-6">
          <Row gutter={[16, 16]} justify="center">
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Card 
                className="text-center shadow-sm hover:shadow-md transition-shadow duration-200"
                styles={{ body: { padding: '20px 16px' } }}
              >
                <Statistic
                  title="Total Records"
                  value={statistics.totalRecords}
                  prefix={<FileTextOutlined className="text-blue-500" />}
                  valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Card 
                className="text-center shadow-sm hover:shadow-md transition-shadow duration-200"
                styles={{ body: { padding: '20px 16px' } }}
              >
                <Statistic
                  title="Pending Approvals"
                  value={statistics.statusStats.find(s => s.status === 'PENDING')?._count.id || 0}
                  valueStyle={{ color: '#fa8c16', fontSize: '24px', fontWeight: 'bold' }}
                  prefix={<ClockCircleOutlined className="text-orange-500" />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Card 
                className="text-center shadow-sm hover:shadow-md transition-shadow duration-200"
                styles={{ body: { padding: '20px 16px' } }}
              >
                <Statistic
                  title="Approved"
                  value={statistics.statusStats.find(s => s.status === 'APPROVED')?._count.id || 0}
                  valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
                  prefix={<CheckOutlined className="text-green-500" />}
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* 筛选和操作栏 */}
      <Card className="mb-4 shadow-sm">
        <div className="space-y-4">
          {/* 筛选器区域 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Filters</h4>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={8} lg={6}>
                <Select
                  placeholder="Select Submitter"
                  value={submitterFilter}
                  onChange={setSubmitterFilter}
                  style={{ width: '100%' }}
                  allowClear
                  size="middle"
                >
                  {userOptions.map(user => (
                    <Option key={user.id} value={user.id}>
                      {user.name}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={10} lg={8}>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    // 日期范围变更
                    setDateRange(dates);
                  }}
                  format="YYYY-MM-DD"
                  placeholder={['Start Date', 'End Date']}
                  allowClear
                  size="middle"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </div>
          
          {/* 快速筛选和操作按钮区域 */}
          <div className="flex flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={resetFilters}
                size="middle"
                className="hover:bg-blue-50 hover:border-blue-300"
              >
                This Week / Reset
              </Button>
              <Button 
                onClick={() => {
                  const startOfLastWeek = dayjs().subtract(1, 'week').startOf('week');
                  const endOfLastWeek = dayjs().subtract(1, 'week').endOf('week');
                  setDateRange([startOfLastWeek, endOfLastWeek]);
                }}
                size="middle"
                className="hover:bg-blue-50 hover:border-blue-300"
              >
                Last Week
              </Button>
              <Button 
                onClick={() => {
                  const startOfMonth = dayjs().startOf('month');
                  const endOfMonth = dayjs().endOf('month');
                  setDateRange([startOfMonth, endOfMonth]);
                }}
                size="middle"
                className="hover:bg-blue-50 hover:border-blue-300"
              >
                This Month
              </Button>
            </div>
            
            {/* 主要操作按钮 */}
            {activeTab === 'pending' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => openBatchModal()}
                disabled={selectedRowKeys.length === 0}
                size="middle"
                className="shadow-sm"
              >
                Batch Approve ({selectedRowKeys.length})
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 主要内容区域 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'pending',
              label: 'Pending Approvals',
              children: (
                <div>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading approvals...</p>
                    </div>
                  ) : (
                    renderGroupedApprovals()
                  )}
                </div>
              ),
            },
            {
              key: 'history',
              label: 'Approval History',
              children: (
                <div>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading history...</p>
                    </div>
                  ) : (
                    renderGroupedApprovals()
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 批量操作模态框 */}
      <Modal
        title="Batch Approve Timesheets"
        open={batchModalVisible}
        onOk={handleBatchAction}
        onCancel={() => setBatchModalVisible(false)}
        okText="Approve"
      >
        <p>You are about to approve {selectedRowKeys.length} timesheet(s).</p>
        <Form form={batchForm} layout="vertical">
          <Form.Item
            label="Comments"
            name="comments"
          >
            <TextArea
              rows={4}
              placeholder="Enter optional comments..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="Timesheet Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedApproval && selectedApproval.timesheet && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Timesheet Information" size="small">
                  <p><strong>Date:</strong> {selectedApproval.timesheet.date ? dayjs(selectedApproval.timesheet.date).format('YYYY-MM-DD') : 'N/A'}</p>
                  <p><strong>Time:</strong> {selectedApproval.timesheet.startTime || 'N/A'} - {selectedApproval.timesheet.endTime || 'N/A'}</p>
                  <p><strong>Duration:</strong> {selectedApproval.timesheet.hours || 0} hours</p>
                  <p><strong>Description:</strong> {selectedApproval.timesheet.description || 'N/A'}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Project Information" size="small">
                  <p><strong>Project:</strong> {selectedApproval.timesheet.project?.name || 'Unknown'}</p>
                  <p><strong>Code:</strong> {selectedApproval.timesheet.project?.projectCode || 'N/A'}</p>
                  <p><strong>Stage:</strong> {selectedApproval.timesheet.stage?.name || 'Unassigned'}</p>
                </Card>
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Submitter Information" size="small">
                  <p><strong>Name:</strong> {selectedApproval.timesheet.employee?.name || 'Unknown'}</p>
                  <p><strong>Employee ID:</strong> {selectedApproval.timesheet.employee?.employeeId || 'N/A'}</p>
                  <p><strong>Email:</strong> {selectedApproval.timesheet.employee?.email || 'N/A'}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Approval Information" size="small">
                  <p><strong>Status:</strong> 
                    <Tag color={getStatusColor(selectedApproval.status)} className="ml-2">
                      {getStatusText(selectedApproval.status)}
                    </Tag>
                  </p>
                  <p><strong>Submitted:</strong> {selectedApproval.submittedAt ? dayjs(selectedApproval.submittedAt).format('YYYY-MM-DD HH:mm') : 'N/A'}</p>
                  {selectedApproval.approver && (
                    <p><strong>Approver:</strong> {selectedApproval.approver.name}</p>
                  )}
                  {selectedApproval.approvedAt && (
                    <p><strong>Approved:</strong> {dayjs(selectedApproval.approvedAt).format('YYYY-MM-DD HH:mm')}</p>
                  )}
                  {selectedApproval.comments && (
                    <p><strong>Comments:</strong> {selectedApproval.comments}</p>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
};

export default AdminApprovals;