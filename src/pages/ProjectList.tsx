import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Input,
  List,
  Typography,
  Tag,
  Space,
  Spin,
  Alert,
  Row,
  Col,
  Empty,
  App,
  Button
} from 'antd';
import { SearchOutlined, ProjectOutlined, CalendarOutlined } from '@ant-design/icons';
import PageLayout from '@/components/PageLayout';
import { useAuthStore } from '@/stores/authStore';
import { projectAPI } from '@/lib/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

// 项目接口定义
interface Project {
  id: string;
  name: string;
  projectCode: string;
  description?: string;
  nickname?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

const ProjectList: React.FC = () => {
  const { user } = useAuthStore();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 获取活跃项目列表
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectAPI.getList({ status: 'ACTIVE' });
      setProjects(response.projects || []);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      const errorMessage = error.response?.data?.error || 'Failed to load projects';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取项目数据
  useEffect(() => {
    fetchProjects();
  }, []);

  // 根据搜索条件过滤项目
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) {
      return projects;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    return projects.filter(project => 
      project.projectCode.toLowerCase().includes(searchLower) ||
      project.name.toLowerCase().includes(searchLower) ||
      (project.nickname && project.nickname.toLowerCase().includes(searchLower))
    );
  }, [projects, searchTerm]);

  // 处理搜索输入变化
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  // 格式化日期显示
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('YYYY-MM-DD');
  };

  // 渲染项目卡片
  const renderProjectItem = (project: Project) => (
    <List.Item key={project.id}>
      <Card 
        hoverable
        className="w-full"
        bodyStyle={{ padding: '16px' }}
      >
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" size="small" className="w-full">
              <div className="flex items-center gap-2">
                <ProjectOutlined className="text-blue-500" />
                <Title level={5} className="!mb-0">
                  {project.name}
                </Title>
              </div>
              <div className="flex items-center gap-2">
                <Text strong>Project Code:</Text>
                <Tag color="blue" className="font-mono">
                  {project.projectCode}
                </Tag>
              </div>
              {project.nickname && (
                <div className="flex items-center gap-2">
                  <Text strong>Nickname:</Text>
                  <Tag color="orange">
                    {project.nickname}
                  </Tag>
                </div>
              )}
            </Space>
          </Col>
          
          <Col xs={24} sm={12} md={10}>
            <Space direction="vertical" size="small" className="w-full">
              <div>
                <Text strong>Description:</Text>
                <Paragraph 
                  className="!mb-0 !mt-1" 
                  ellipsis={{ rows: 2, tooltip: project.description }}
                >
                  {project.description || 'No description available'}
                </Paragraph>
              </div>
            </Space>
          </Col>
          
          <Col xs={24} sm={24} md={6}>
            <Space direction="vertical" size="small" className="w-full">
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-green-500" />
                <Text strong>Start Date:</Text>
              </div>
              <Text>{formatDate(project.startDate)}</Text>
              
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-red-500" />
                <Text strong>End Date:</Text>
              </div>
              <Text>{formatDate(project.endDate)}</Text>
              
              <Tag color="green" className="mt-2">
                {project.status}
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>
    </List.Item>
  );

  return (
    <PageLayout
      title="Project List"
      description="View all active projects and their details"
      icon={<ProjectOutlined />}
    >
      <div className="container mx-auto px-4 py-6">

        {/* 搜索栏 */}
        <Card className="mb-6">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={16} md={12} lg={8}>
              <Search
                placeholder="Search by project code, name, or nickname..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                onSearch={handleSearch}
              />
            </Col>
            <Col xs={24} sm={8} md={6} lg={4}>
              <div className="flex items-center h-full">
                <Text strong>
                  Total: {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            className="mb-6"
            action={
              <Button size="small" onClick={fetchProjects}>
                Retry
              </Button>
            }
          />
        )}

        {/* 项目列表 */}
        <Spin spinning={loading}>
          {filteredProjects.length === 0 && !loading ? (
            <Card>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchTerm ? 
                    `No projects found matching "${searchTerm}"` : 
                    'No active projects available'
                }
              >
                {searchTerm && (
                  <Button type="primary" onClick={() => setSearchTerm('')}>
                    Clear Search
                  </Button>
                )}
              </Empty>
            </Card>
          ) : (
            <List
              grid={{
                gutter: 16,
                xs: 1,
                sm: 1,
                md: 1,
                lg: 1,
                xl: 1,
                xxl: 1,
              }}
              dataSource={filteredProjects}
              renderItem={renderProjectItem}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} projects`,
                className: 'mt-6'
              }}
            />
          )}
        </Spin>
      </div>
    </PageLayout>
  );
};

export default ProjectList;