import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Select, 
  DatePicker, 
  TimePicker, 
  Input, 
  Button, 
  Row, 
  Col, 
  Alert, 
  Spin,
  App
} from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Navigation from '@/components/Navigation';
import { useAuthStore } from '@/stores/authStore';
import api, { timesheetAPI, projectAPI, stageAPI } from '../lib/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

interface Project {
  id: string;
  name: string;
  projectCode: string;
  stages: Stage[];
}

interface Stage {
  id: string;
  name: string;
  description?: string;
}

interface TimesheetForm {
  projectId: string;
  stageId?: string;
  date: dayjs.Dayjs;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  description?: string;
}

const TimesheetEntry: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [calculatedHours, setCalculatedHours] = useState<number>(0);
  
  const isEditMode = !!id;
  
  // 获取用户可访问的项目列表
  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getList({ status: 'ACTIVE' });
      setProjects(response.projects || []);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      setError(error.response?.data?.error || 'Failed to load projects');
    }
  };
  
  // 获取阶段列表
  const fetchStages = async () => {
    try {
      const response = await stageAPI.getList({ limit: 100 });
      setStages(response.stages || []);
    } catch (error: any) {
      console.error('Failed to fetch stages:', error);
    }
  };
  
  // 获取工时记录详情（编辑模式）
  const fetchTimesheetDetails = async (timesheetId: string) => {
    try {
      setLoading(true);
      const response = await timesheetAPI.getById(timesheetId);
      const timesheet = response.timesheet;
      
      // 设置表单值
      form.setFieldsValue({
        projectId: timesheet.projectId,
        stageId: timesheet.stageId,
        date: dayjs(timesheet.date),
        startTime: dayjs(timesheet.startTime),
        endTime: dayjs(timesheet.endTime),
        description: timesheet.description,
      });
      
      // 设置选中的项目
      const project = projects.find(p => p.id === timesheet.projectId);
      if (project) {
        setSelectedProject(project);
      }
      
      // 计算工时
      calculateHours(dayjs(timesheet.startTime), dayjs(timesheet.endTime));
    } catch (error: any) {
      console.error('Failed to fetch timesheet details:', error);
      setError(error.response?.data?.error || 'Failed to load timesheet details');
    } finally {
      setLoading(false);
    }
  };
  
  // 计算工时（15分钟增量）- 修复循环引用问题
  const calculateHours = useCallback((startTime: string | dayjs.Dayjs, endTime: string | dayjs.Dayjs) => {
    if (!startTime || !endTime) {
      setCalculatedHours(0);
      return;
    }
    
    const start = typeof startTime === 'string' ? dayjs(startTime, 'HH:mm') : startTime;
    const end = typeof endTime === 'string' ? dayjs(endTime, 'HH:mm') : endTime;
    
    if (end.isBefore(start)) {
      setCalculatedHours(0);
      return;
    }
    
    const diffMinutes = end.diff(start, 'minute');
    // 向上取整到最近的15分钟
    const roundedMinutes = Math.ceil(diffMinutes / 15) * 15;
    const hours = roundedMinutes / 60;
    
    setCalculatedHours(hours);
  }, []);
  
  // 处理项目选择 - 修复循环引用问题
  const handleProjectChange = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProject(project || null);
    
    // 清除阶段选择
    form.setFieldValue('stageId', undefined);
  }, [projects, form]);
  
  // 处理时间变化 - 修复循环引用问题
  const handleTimeChange = useCallback(() => {
    const formValues = form.getFieldsValue(['startTime', 'endTime']);
    const { startTime, endTime } = formValues;
    
    if (startTime && endTime) {
      // 直接计算工时，避免依赖calculateHours函数
      const start = startTime;
      const end = endTime;
      
      if (end.isBefore(start)) {
        setCalculatedHours(0);
        return;
      }
      
      const diffMinutes = end.diff(start, 'minute');
      // 向上取整到最近的15分钟
      const roundedMinutes = Math.ceil(diffMinutes / 15) * 15;
      const hours = roundedMinutes / 60;
      
      setCalculatedHours(hours);
    }
  }, [form]);
  
  // 保存草稿
  const handleSaveDraft = async (values: TimesheetForm) => {
    try {
      setSaving(true);
      setError(null);
      
      const timesheetData = {
        projectId: values.projectId,
        stageId: values.stageId,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        description: values.description,
      };
      
      if (isEditMode) {
        await timesheetAPI.update(id!, timesheetData);
        message.success('Timesheet updated successfully');
      } else {
        await timesheetAPI.create(timesheetData);
        message.success('Timesheet saved as draft');
      }
      
      navigate('/timesheets');
    } catch (error: any) {
      console.error('Failed to save timesheet:', error);
      setError(error.response?.data?.error || 'Failed to save timesheet');
    } finally {
      setSaving(false);
    }
  };
  
  // 提交审批 - 改进错误处理和验证
  const handleSubmitForApproval = async (values: TimesheetForm) => {
    try {
      setSubmitting(true);
      setError(null);
      
      // 验证必需字段
      if (!values.projectId) {
        const errorMsg = 'Please select a project';
        setError(errorMsg);
        message.error(errorMsg);
        return;
      }
      if (!values.date) {
        const errorMsg = 'Please select a date';
        setError(errorMsg);
        message.error(errorMsg);
        return;
      }
      if (!values.startTime || !values.endTime) {
        const errorMsg = 'Please select start and end time';
        setError(errorMsg);
        message.error(errorMsg);
        return;
      }
      
      // 验证时间逻辑
      if (values.startTime.isAfter(values.endTime)) {
        const errorMsg = 'Start time must be before end time';
        setError(errorMsg);
        message.error(errorMsg);
        return;
      }
      
      // 验证项目是否在可选列表中
      const selectedProject = projects.find(p => p.id === values.projectId);
      if (!selectedProject) {
        const errorMsg = 'Selected project is not available. Please refresh and try again.';
        setError(errorMsg);
        message.error(errorMsg);
        return;
      }
      
      const timesheetData = {
        projectId: values.projectId,
        stageId: values.stageId || null,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        description: values.description || '',
      };
      
      console.log('Submitting timesheet data:', timesheetData);
      
      let timesheetId = id;
      
      if (isEditMode && id) {
        // 编辑模式：先更新工时记录
        console.log('Updating existing timesheet:', id);
        const updateResponse = await timesheetAPI.update(id, timesheetData);
        if (!updateResponse || !updateResponse.timesheet) {
          throw new Error('Failed to update timesheet - invalid response');
        }
        timesheetId = updateResponse.timesheet.id || id;
        console.log('Timesheet updated successfully:', timesheetId);
      } else {
        // 新建模式：先创建工时记录
        console.log('Creating new timesheet');
        const createResponse = await timesheetAPI.create(timesheetData);
        if (!createResponse || !createResponse.timesheet || !createResponse.timesheet.id) {
          console.error('Create response:', createResponse);
          throw new Error('Failed to create timesheet - invalid response');
        }
        timesheetId = createResponse.timesheet.id;
        console.log('Timesheet created successfully:', timesheetId);
      }
      
      // 确保有有效的timesheetId
      if (!timesheetId) {
        throw new Error('Invalid timesheet ID after create/update');
      }
      
      // 提交审批
      console.log('Submitting timesheet for approval:', timesheetId);
      const submitResponse = await timesheetAPI.submit(timesheetId);
      if (!submitResponse) {
        throw new Error('Failed to submit timesheet for approval - no response');
      }
      
      console.log('Timesheet submitted successfully');
      message.success('Timesheet submitted for approval successfully');
      navigate('/timesheets');
    } catch (error: any) {
      console.error('Failed to submit timesheet:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Failed to submit timesheet';
      
      // 改进错误消息处理
      if (error.response?.status === 404) {
        errorMessage = error.response.data?.error || 'Resource not found';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.error || 'Invalid request data';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };
  
  // 生成15分钟增量的时间选项 - 使用useMemo优化
  const timeOptions = useMemo(() => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = dayjs().hour(hour).minute(minute).second(0);
        options.push(time);
      }
    }
    return options;
  }, []);
  
  // 禁用非15分钟增量的时间 - 使用useMemo优化
  const disabledTime = useMemo(() => () => ({
    disabledMinutes: () => {
      const disabled = [];
      for (let i = 0; i < 60; i++) {
        if (i % 15 !== 0) {
          disabled.push(i);
        }
      }
      return disabled;
    },
  }), []);
  
  // 初始化数据
  useEffect(() => {
    fetchProjects();
    fetchStages();
  }, []);
  
  useEffect(() => {
    if (isEditMode && projects.length > 0) {
      fetchTimesheetDetails(id!);
    }
  }, [isEditMode, id, projects.length]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Loading timesheet...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/timesheets')}
            className="mb-4"
          >
            Back to Timesheets
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Timesheet' : 'New Timesheet'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEditMode ? 'Update your timesheet entry' : 'Create a new timesheet entry with 15-minute increments'}
          </p>
        </div>
        <div>
          <Navigation />
        </div>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          className="mb-6"
        />
      )}
      
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveDraft}
          initialValues={{
            date: dayjs(),
            startTime: dayjs().hour(9).minute(0),
            endTime: dayjs().hour(17).minute(0),
          }}
        >
          <Row gutter={16}>
            {/* 项目选择 */}
            <Col xs={24} md={12}>
              <Form.Item
                name="projectId"
                label="Project"
                rules={[{ required: true, message: 'Please select a project!' }]}
              >
                <Select
                  placeholder="Select a project"
                  onChange={handleProjectChange}
                  showSearch
                  filterOption={(input, option) => {
                    const label = option?.label || option?.children || '';
                    return String(label).toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {projects.map(project => (
                    <Option key={project.id} value={project.id} label={`${project.name} (${project.projectCode})`}>
                      {project.name} ({project.projectCode})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            {/* 阶段选择 */}
            <Col xs={24} md={12}>
              <Form.Item
                name="stageId"
                label="Stage (Optional)"
              >
                <Select
                  placeholder="Select a stage"
                  allowClear
                  showSearch
                  filterOption={(input, option) => {
                    const label = option?.label || option?.children || '';
                    return String(label).toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {stages.map(stage => (
                    <Option key={stage.id} value={stage.id} label={stage.name}>
                      {stage.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            {/* 日期选择 */}
            <Col xs={24} md={8}>
              <Form.Item
                name="date"
                label="Date"
                rules={[{ required: true, message: 'Please select a date!' }]}
              >
                <DatePicker
                  className="w-full"
                  format="MMM DD, YYYY"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
            
            {/* 开始时间 */}
            <Col xs={24} md={8}>
              <Form.Item
                name="startTime"
                label="Start Time"
                rules={[{ required: true, message: 'Please select start time!' }]}
              >
                <TimePicker
                  className="w-full"
                  format="HH:mm"
                  minuteStep={15}
                  disabledTime={disabledTime}
                  onChange={handleTimeChange}
                />
              </Form.Item>
            </Col>
            
            {/* 结束时间 */}
            <Col xs={24} md={8}>
              <Form.Item
                name="endTime"
                label="End Time"
                rules={[
                  { required: true, message: 'Please select end time!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startTime = getFieldValue('startTime');
                      if (!value || !startTime) {
                        return Promise.resolve();
                      }
                      if (value.isBefore(startTime)) {
                        return Promise.reject(new Error('End time must be after start time!'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <TimePicker
                  className="w-full"
                  format="HH:mm"
                  minuteStep={15}
                  disabledTime={disabledTime}
                  onChange={handleTimeChange}
                />
              </Form.Item>
            </Col>
          </Row>
          
          {/* 计算的工时显示 */}
          {calculatedHours > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm text-blue-700">
                <strong>Calculated Hours:</strong> {calculatedHours}h
              </div>
            </div>
          )}
          
          {/* 描述 */}
          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <TextArea
              rows={4}
              placeholder="Describe the work performed..."
              maxLength={500}
              showCount
            />
          </Form.Item>
          
          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => navigate('/timesheets')}
            >
              Cancel
            </Button>
            
            <Button
              type="default"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => form.submit()}
            >
              Save Draft
            </Button>
            
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={submitting}
              onClick={() => {
                form.validateFields().then(values => {
                  handleSubmitForApproval(values);
                }).catch(error => {
                  console.log('Form validation failed:', error);
                });
              }}
            >
              Submit for Approval
            </Button>
          </div>
        </Form>
      </Card>
      </div>
    </div>
  );
};

// 使用App组件包装以提供message context
const TimesheetEntryWithApp = () => (
  <App>
    <TimesheetEntry />
  </App>
);

export default TimesheetEntryWithApp;