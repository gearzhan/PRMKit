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
  Popconfirm,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  InputNumber,
  Switch,
  Avatar,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  MailOutlined,
  PhoneOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import api from '@/lib/api';

const { Title } = Typography;
const { Option } = Select;

// 用户角色选项 - 新的角色层级系统
const ROLE_OPTIONS = [
  { value: 'LEVEL1', label: 'Level 1 Admin', color: 'red' },
  { value: 'LEVEL2', label: 'Level 2 Manager', color: 'blue' },
  { value: 'LEVEL3', label: 'Level 3 Worker', color: 'green' },
];



// 员工接口类型定义
interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  position?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 员工表单数据类型
interface EmployeeFormData {
  employeeId: string;
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  role: string;
  position?: string;
  isActive: boolean;
}



/**
 * 管理员员工列表页面
 * 提供员工的增删改查功能
 */
const AdminEmployeeList: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [form] = Form.useForm<EmployeeFormData>();
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    managers: 0,
    employees: 0,
  });

  // 获取员工列表
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/users');
      let employeeList = response.data.users || [];
      
      // 前端过滤（因为后端API可能不支持所有过滤选项）
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        employeeList = employeeList.filter((emp: Employee) => 
          emp.name.toLowerCase().includes(searchLower) ||
          emp.email.toLowerCase().includes(searchLower) ||
          emp.employeeId.toLowerCase().includes(searchLower) ||
          (emp.position && emp.position.toLowerCase().includes(searchLower))
        );
      }
      
      if (roleFilter) {
        employeeList = employeeList.filter((emp: Employee) => emp.role === roleFilter);
      }
      
      setEmployees(employeeList);
      
      // 计算统计数据
      const stats = {
        total: employeeList.length,
        active: employeeList.filter((emp: Employee) => emp.isActive).length,
        inactive: employeeList.filter((emp: Employee) => !emp.isActive).length,
        admins: employeeList.filter((emp: Employee) => emp.role === 'LEVEL1').length,
        managers: employeeList.filter((emp: Employee) => emp.role === 'LEVEL2').length,
        employees: employeeList.filter((emp: Employee) => emp.role === 'LEVEL3').length,
      };
      setStatistics(stats);
    } catch (error) {
      console.error('获取员工列表失败:', error);
      message.error('Failed to fetch employee list');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchEmployees();
  }, [searchText, roleFilter]);

  // 打开新建/编辑模态框
  const openModal = (employee?: Employee) => {
    setEditingEmployee(employee || null);
    setModalVisible(true);
    
    if (employee) {
      // 编辑模式，填充表单数据
      form.setFieldsValue({
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        position: employee.position,
        isActive: employee.isActive,
      });
    } else {
      // 新建模式，重置表单
      form.resetFields();
      form.setFieldsValue({
        role: 'LEVEL3',
        isActive: true,
      });
    }
  };

  // 关闭模态框
  const closeModal = () => {
    setModalVisible(false);
    setEditingEmployee(null);
    form.resetFields();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 处理编辑模式下的密码字段
      if (editingEmployee) {
        // 保存密码值用于后续处理
        const newPassword = values.password;
        
        // 移除密码相关字段，不通过用户更新API发送
        delete values.password;
        delete values.confirmPassword;
        
        // 更新员工基本信息
        await api.put(`/auth/users/${editingEmployee.id}`, values);
        
        // 如果提供了新密码，单独调用密码重置API
        if (newPassword) {
          await api.put(`/auth/users/${editingEmployee.id}/reset-password`, { password: newPassword });
          message.success('Employee updated successfully with new password');
        } else {
          message.success('Employee updated successfully');
        }
      } else {
        // 创建员工
        await api.post('/auth/users', values);
        message.success('Employee created successfully');
      }

      closeModal();
      fetchEmployees();
    } catch (error: any) {
      console.error('员工操作失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error(editingEmployee ? 'Failed to update employee' : 'Failed to create employee');
      }
    }
  };

  // 删除员工
  const handleDelete = async (employeeId: string) => {
    try {
      await api.delete(`/auth/users/${employeeId}`);
      message.success('Employee deleted successfully');
      fetchEmployees();
    } catch (error: any) {
      console.error('删除员工失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to delete employee');
      }
    }
  };

  // 切换员工状态
  const toggleEmployeeStatus = async (employeeId: string, isActive: boolean) => {
    try {
      await api.put(`/auth/users/${employeeId}`, { isActive });
      message.success(`Employee ${isActive ? 'activated' : 'deactivated'} successfully`);
      fetchEmployees();
    } catch (error: any) {
      console.error('切换员工状态失败:', error);
      message.error('Operation failed');
    }
  };

  // 重置员工密码
  const handleResetPassword = async (employeeId: string, employeeName: string) => {
    try {
      await api.put(`/auth/users/${employeeId}/reset-password`, { password: '02580258' });
      message.success(`Password reset successfully for ${employeeName}`);
    } catch (error: any) {
      console.error('重置密码失败:', error);
      if (error.response?.data?.error) {
        message.error(error.response.data.error);
      } else {
        message.error('Failed to reset password');
      }
    }
  };

  // 处理查看员工详情 - 跳转到新页面
  const handleViewEmployeeDetails = (employee: Employee) => {
    navigate(`/admin/employee/${employee.id}/drilldown`);
  };

  // 获取角色标签颜色
  const getRoleColor = (role: string) => {
    const option = ROLE_OPTIONS.find(opt => opt.value === role);
    return option?.color || 'default';
  };

  // 获取角色标签文本
  const getRoleText = (role: string) => {
    const option = ROLE_OPTIONS.find(opt => opt.value === role);
    return option?.label || role;
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

  // 表格列定义
  const columns: ColumnsType<Employee> = [
    {
      title: 'Employee',
      key: 'employee',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => a.employeeId.localeCompare(b.employeeId),
      defaultSortOrder: 'ascend',
      render: (_, record) => (
        <Space>
          {getUserAvatar(record.name)}
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-xs text-gray-500">{record.employeeId}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (email) => (
        <Tooltip placement="topLeft" title={email}>
          <Space>
            <MailOutlined className="text-gray-400" />
            {email}
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (position) => (
        <Tooltip placement="topLeft" title={position}>
          {position || '-'}
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={(checked) => toggleEmployeeStatus(record.id, checked)}
          checkedChildren="激活"
          unCheckedChildren="停用"
        />
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewEmployeeDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to reset this employee's password?"
            description="The password will be reset to 02580258."
            onConfirm={() => handleResetPassword(record.id, record.name)}
            okText="OK"
            cancelText="Cancel"
          >
            <Tooltip title="Reset Password">
              <Button
                type="text"
                icon={<ReloadOutlined />}
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="Are you sure you want to delete this employee?"
            description="This action cannot be undone and will affect related timesheet records."
            onConfirm={() => handleDelete(record.id)}
            okText="OK"
            cancelText="Cancel"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageLayout
      title="Employee Management"
      description="Manage employee accounts and permissions"
      icon={<TeamOutlined />}
    >

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Employees"
              value={statistics.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Active Users"
              value={statistics.active}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Inactive Users"
              value={statistics.inactive}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card className="mb-4">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space>
              <Input
                placeholder="Search employee name, email, ID, etc."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                placeholder="Filter by role"
                value={roleFilter}
                onChange={setRoleFilter}
                style={{ width: 150 }}
                allowClear
              >
                {ROLE_OPTIONS.map(option => (
                  <Option key={option.value} value={option.value}>
                    <Tag color={option.color}>{option.label}</Tag>
                  </Option>
                ))}
              </Select>

            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
            >
              New Employee
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 员工表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={employees}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            pageSizeOptions: ['20', '50'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
        />
      </Card>

      {/* 新建/编辑员工模态框 */}
      <Modal
        title={editingEmployee ? 'Edit Employee' : 'New Employee'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        width={600}
        okText="OK"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Employee ID"
                name="employeeId"
                rules={[
                  { required: true, message: 'Please enter employee ID' },
                  { pattern: /^[A-Z0-9_-]+$/, message: 'Employee ID can only contain uppercase letters, numbers, underscores and hyphens' },
                ]}
              >
                <Input placeholder="e.g.: EMP_001" disabled={!!editingEmployee} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Employee Name"
                name="name"
                rules={[{ required: true, message: 'Please enter employee name' }]}
              >
                <Input placeholder="Enter employee name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  { required: true, message: 'Please enter email address' },
                  { type: 'email', message: 'Please enter a valid email address' },
                ]}
              >
                <Input placeholder="Enter email address" disabled={!!editingEmployee} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Role"
                name="role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select>
                  {ROLE_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>
                      <Tag color={option.color}>{option.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!editingEmployee && (
            <Form.Item
              label="Initial Password"
              name="password"
              rules={[
                { required: true, message: 'Please enter initial password' },
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password placeholder="Enter initial password" />
            </Form.Item>
          )}

          {editingEmployee && (
            <>
              <Form.Item
                label="New Password (Optional)"
                name="password"
                rules={[
                  { min: 6, message: 'Password must be at least 6 characters' },
                ]}
              >
                <Input.Password placeholder="Enter new password (leave blank to keep current)" />
              </Form.Item>
              <Form.Item
                label="Confirm New Password"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('The two passwords do not match!'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Confirm new password" />
              </Form.Item>
            </>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Position"
                name="position"
              >
                <Input placeholder="Enter position" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Account Status"
                name="isActive"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>


    </PageLayout>
  );
};

export default AdminEmployeeList;