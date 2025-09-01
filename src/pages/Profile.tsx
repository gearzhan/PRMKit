import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Divider,
  Typography,
  Row,
  Col,
  Avatar,
  Tag,
  Modal,
  App,
  Spin,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LockOutlined,
  SaveOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
} from '@ant-design/icons';
import PageLayout from '@/components/PageLayout';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '../lib/api';

const { Title, Text } = Typography;

// 用户信息表单接口
interface UserInfoForm {
  name: string;
  email: string;
  position: string;
}

// 密码修改表单接口
interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 用户个人资料页面组件
 * 显示用户基本信息，支持编辑个人信息和修改密码
 */
const Profile: React.FC = () => {
  const { message } = App.useApp();
  const { user, getCurrentUser } = useAuthStore();
  const [userInfoForm] = Form.useForm<UserInfoForm>();
  const [passwordForm] = Form.useForm<PasswordForm>();
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 初始化用户信息表单
  useEffect(() => {
    if (user) {
      userInfoForm.setFieldsValue({
        name: user.name,
        email: user.email,
        position: user.position,
      });
    }
  }, [user, userInfoForm]);

  // 获取角色显示文本
  const getRoleText = (role: string) => {
    const roleMap: Record<string, { text: string; color: string }> = {
      LEVEL1: { text: 'System Administrator', color: 'red' },
      LEVEL2: { text: 'Project Manager', color: 'blue' },
      LEVEL3: { text: 'Employee', color: 'green' },
    };
    return roleMap[role] || { text: role, color: 'default' };
  };

  // 保存用户信息
  const handleSaveUserInfo = async (values: UserInfoForm) => {
    if (!user) return;
    
    setLoading(true);
    try {
      await authAPI.updateUser(user.id, values);
      
      // 刷新用户信息
      await getCurrentUser();
      
      message.success('Profile updated successfully');
      setEditMode(false);
    } catch (error: any) {
      message.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (values: PasswordForm) => {
    setPasswordLoading(true);
    try {
      await authAPI.changePassword(values.currentPassword, values.newPassword);
      
      message.success('Password changed successfully');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    if (user) {
      userInfoForm.setFieldsValue({
        name: user.name,
        email: user.email,
        position: user.position,
      });
    }
    setEditMode(false);
  };

  if (!user) {
    return (
      <PageLayout title="Profile" icon={<UserOutlined />}>
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </PageLayout>
    );
  }

  const roleInfo = getRoleText(user.role);

  return (
    <PageLayout
      title="Profile"
      description="View and manage your personal information"
      icon={<UserOutlined />}
    >
      <Row gutter={[24, 24]}>
        {/* 基本信息卡片 */}
        <Col xs={24} lg={16}>
          <Card
            title="Basic Information"
            extra={
              <Space>
                {editMode ? (
                  <>
                    <Button onClick={handleCancelEdit}>Cancel</Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={loading}
                      onClick={() => userInfoForm.submit()}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </Button>
                )}
              </Space>
            }
          >
            <Form
              form={userInfoForm}
              layout="vertical"
              onFinish={handleSaveUserInfo}
              disabled={!editMode}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[
                      { required: true, message: 'Please enter your name' },
                      { min: 2, message: 'Name must be at least 2 characters' },
                    ]}
                  >
                    <Input placeholder="Please enter your name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email address' },
                    ]}
                  >
                    <Input placeholder="Please enter your email" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Position"
                    name="position"
                    rules={[{ required: true, message: 'Please enter your position' }]}
                  >
                    <Input placeholder="Please enter your position" disabled />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* 账户信息卡片 */}
        <Col xs={24} lg={8}>
          <Card title="Account Information">
            <Space direction="vertical" size="middle" className="w-full">
              {/* 用户头像 */}
              <div className="text-center">
                <Avatar size={80} icon={<UserOutlined />} className="mb-4" />
                <div>
                  <Title level={4} className="!mb-1">
                    {user.name}
                  </Title>
                  <Text type="secondary">{user.email}</Text>
                </div>
              </div>

              <Divider />

              {/* 账户详情 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Text strong>Employee ID:</Text>
                  <Text>{user.employeeId}</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text strong>Role:</Text>
                  <Tag color={roleInfo.color}>{roleInfo.text}</Tag>
                </div>
                <div className="flex justify-between items-center">
                  <Text strong>Status:</Text>
                  <Tag color={user.isActive ? 'green' : 'red'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                </div>
                <div className="flex justify-between items-center">
                  <Text strong>Created At:</Text>
                  <Text type="secondary">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </Text>
                </div>
              </div>

              <Divider />

              {/* 密码修改按钮 */}
              <Button
                type="default"
                icon={<LockOutlined />}
                block
                onClick={() => setPasswordModalVisible(true)}
              >
                Change Password
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 修改密码模态框 */}
      <Modal
          title="Change Password"
          open={passwordModalVisible}
          onCancel={() => {
            setPasswordModalVisible(false);
            passwordForm.resetFields();
          }}
          footer={null}
          destroyOnHidden
        >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            label="Current Password"
            name="currentPassword"
            rules={[{ required: true, message: 'Please enter your current password' }]}
          >
            <Input.Password
              placeholder="Please enter your current password"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item
            label="New Password"
            name="newPassword"
            rules={[
              { required: true, message: 'Please enter your new password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password
              placeholder="Please enter your new password"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item
            label="Confirm New Password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="Please enter your new password again"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setPasswordModalVisible(false);
                  passwordForm.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={passwordLoading}
              >
                Confirm Change
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
};

export default Profile;