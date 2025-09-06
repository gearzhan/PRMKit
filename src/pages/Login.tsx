import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Input, Form, Card, Alert, Spin } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

interface LoginForm {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  
  // 获取重定向路径
  const from = (location.state as any)?.from?.pathname || '/dashboard';
  
  // 如果已经登录，重定向到目标页面
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);
  
  // 清除错误信息
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);
  
  // 处理登录提交
  const handleSubmit = async (values: LoginForm) => {
    try {
      await login(values.email, values.password);
      // 登录成功后会通过useEffect重定向
    } catch (error) {
      // 错误已经在store中处理
    }
  };
  
  // 处理表单验证失败
  const handleSubmitFailed = (errorInfo: any) => {
    // 表单验证失败处理
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <UserOutlined className="text-2xl text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PRMKit</h1>
          <p className="text-gray-600">Project Resource Management System</p>
        </div>
        
        {/* 登录表单 */}
        <Card className="shadow-lg border-0">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Sign In</h2>
            <p className="text-gray-600 mt-1">Welcome back! Please sign in to your account.</p>
            
            {/* 账户重置通知 */}
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">
                ⚠️ All accounts have been reset on 7th of September.
              </p>
              <p className="text-red-600 text-sm mt-1">
                Please use <span className="font-bold bg-yellow-200 px-1 rounded">02580258</span> to log in and then change your password accordingly.
              </p>
            </div>
          </div>
          
          {/* 错误提示 */}
          {error && (
            <Alert
              message="Login Failed"
              description={error}
              type="error"
              showIcon
              closable
              onClose={clearError}
              className="mb-4"
            />
          )}
          
          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            onFinishFailed={handleSubmitFailed}
            layout="vertical"
            requiredMark={false}
          >
            {/* 邮箱输入 */}
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="Enter your email"
                size="large"
                autoComplete="email"
              />
            </Form.Item>
            
            {/* 密码输入 */}
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter your password!' },
                { min: 6, message: 'Password must be at least 6 characters!' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="Enter your password"
                size="large"
                autoComplete="current-password"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>
            
            {/* 登录按钮 */}
            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              >
                {isLoading ? (
                  <>
                    <Spin size="small" className="mr-2" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </Form.Item>
          </Form>
          
        </Card>
        
        {/* 页脚 */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>&copy; 2024 PRMKit. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;