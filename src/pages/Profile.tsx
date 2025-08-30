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
      LEVEL1: { text: '系统管理员', color: 'red' },
      LEVEL2: { text: '项目经理', color: 'blue' },
      LEVEL3: { text: '普通员工', color: 'green' },
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
      
      message.success('个人信息更新成功');
      setEditMode(false);
    } catch (error: any) {
      message.error(error.message || '更新个人信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (values: PasswordForm) => {
    setPasswordLoading(true);
    try {
      await authAPI.changePassword(values.currentPassword, values.newPassword);
      
      message.success('密码修改成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.message || '密码修改失败');
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
      <PageLayout title="个人资料" icon={<UserOutlined />}>
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </PageLayout>
    );
  }

  const roleInfo = getRoleText(user.role);

  return (
    <PageLayout
      title="个人资料"
      description="查看和管理您的个人信息"
      icon={<UserOutlined />}
    >
      <Row gutter={[24, 24]}>
        {/* 基本信息卡片 */}
        <Col xs={24} lg={16}>
          <Card
            title="基本信息"
            extra={
              <Space>
                {editMode ? (
                  <>
                    <Button onClick={handleCancelEdit}>取消</Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={loading}
                      onClick={() => userInfoForm.submit()}
                    >
                      保存
                    </Button>
                  </>
                ) : (
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => setEditMode(true)}
                  >
                    编辑
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
                    label="姓名"
                    name="name"
                    rules={[
                      { required: true, message: '请输入姓名' },
                      { min: 2, message: '姓名至少2个字符' },
                    ]}
                  >
                    <Input placeholder="请输入姓名" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input placeholder="请输入邮箱" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="职位"
                    name="position"
                    rules={[{ required: true, message: '请输入职位' }]}
                  >
                    <Input placeholder="请输入职位" disabled />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* 账户信息卡片 */}
        <Col xs={24} lg={8}>
          <Card title="账户信息">
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
                  <Text strong>员工ID:</Text>
                  <Text>{user.employeeId}</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text strong>角色:</Text>
                  <Tag color={roleInfo.color}>{roleInfo.text}</Tag>
                </div>
                <div className="flex justify-between items-center">
                  <Text strong>状态:</Text>
                  <Tag color={user.isActive ? 'green' : 'red'}>
                    {user.isActive ? '激活' : '停用'}
                  </Tag>
                </div>
                <div className="flex justify-between items-center">
                  <Text strong>创建时间:</Text>
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
                修改密码
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 修改密码模态框 */}
      <Modal
          title="修改密码"
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
            label="当前密码"
            name="currentPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password
              placeholder="请输入当前密码"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              placeholder="请输入新密码"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="请再次输入新密码"
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
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={passwordLoading}
              >
                确认修改
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
};

export default Profile;