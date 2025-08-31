import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Input,
  Button,
  DatePicker,
  TimePicker,
  Select,
  Spin,
  Card,
  Row,
  Col,
  Space,
  Typography,
  Divider,
  Popconfirm,
  Alert,
  App,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { timesheetAPI, projectAPI, stageAPI } from '../lib/api';

// 扩展dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);

const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;

// 时间表条目接口
interface TimesheetEntryItem {
  id: string;
  projectId: string;
  stageId: string;
  startTime: Dayjs;
  endTime: Dayjs;
  description: string;
  hours?: number;
}

// 项目接口
interface Project {
  id: string;
  name: string;
  projectCode: string;
  status: string;
}

// 阶段接口
interface Stage {
  id: string;
  name: string;
  taskId: string;
  category: string;
}

const TimesheetEntry: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();
  
  // 检测是否为新建模式
  const isNewMode = window.location.pathname === '/timesheets/new';
  
  // 从URL参数获取日期
  const dateParam = searchParams.get('date');
  const initialDate = dateParam ? dayjs(dateParam).tz('Australia/Sydney') : dayjs().tz('Australia/Sydney');
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(initialDate);
  const [entries, setEntries] = useState<TimesheetEntryItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [existingTimesheetId, setExistingTimesheetId] = useState<string | null>(null);

  // 生成时间选项（15分钟间隔）
  const generateTimeOptions = useCallback(() => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = dayjs().hour(hour).minute(minute).second(0);
        options.push({
          label: time.format('HH:mm'),
          value: time.format('HH:mm'),
        });
      }
    }
    return options;
  }, []);

  const timeOptions = generateTimeOptions();

  // 计算工时（向上取整到最近的15分钟）
  const calculateHours = useCallback((startTime: Dayjs, endTime: Dayjs): number => {
    if (!startTime || !endTime) return 0;
    
    const diffMinutes = endTime.diff(startTime, 'minute');
    if (diffMinutes <= 0) return 0;
    
    // 向上取整到最近的15分钟
    const roundedMinutes = Math.ceil(diffMinutes / 15) * 15;
    return roundedMinutes / 60;
  }, []);

  // 创建默认条目
  const createDefaultEntries = useCallback((): TimesheetEntryItem[] => {
    const adminProject = projects.find(p => p.projectCode === 'OA' || p.name.toLowerCase().includes('admin'));
    const administrationStage = stages.find(s => s.name === 'Administration');
    
    return [
      {
        id: 'default-1',
        projectId: adminProject?.id || '',
        stageId: administrationStage?.id || '',
        startTime: dayjs().hour(17).minute(30).second(0),
        endTime: dayjs().hour(18).minute(0).second(0),
        description: '',
        hours: 0.5,
      },
      {
        id: 'default-2',
        projectId: '',
        stageId: '',
        startTime: dayjs().hour(9).minute(0).second(0),
        endTime: dayjs().hour(13).minute(0).second(0),
        description: '',
        hours: 4,
      },
      {
        id: 'default-3',
        projectId: '',
        stageId: '',
        startTime: dayjs().hour(14).minute(0).second(0),
        endTime: dayjs().hour(17).minute(30).second(0),
        description: '',
        hours: 3.5,
      },
    ];
  }, [projects, stages]);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectAPI.getList({ page: 1, limit: 100 });
      if (response.projects) {
        setProjects(response.projects);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
      message.error('Failed to fetch projects');
    }
  }, []);

  // 获取阶段列表
  const fetchStages = useCallback(async () => {
    try {
      const response = await stageAPI.getList();
      setStages(response.stages || []);
    } catch (error) {
      console.error('获取阶段列表失败:', error);
      message.error('Failed to fetch stages');
    }
  }, []);

  // 获取现有工时记录
  const fetchExistingTimesheet = useCallback(async (date: Dayjs) => {
    // 如果是新建模式，直接创建默认条目，不加载已有记录
    if (isNewMode) {
      const defaultEntries = createDefaultEntries();
      setEntries(defaultEntries);
      return;
    }
    
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const response = await timesheetAPI.getList({ startDate: dateStr, endDate: dateStr });
      
      if (response.timesheets && response.timesheets.length > 0) {
        // 转换现有记录为条目格式
        const existingEntries = response.timesheets.map((timesheet: any, index: number) => ({
          id: timesheet.id || `existing-${index}`,
          projectId: timesheet.projectId || '',
          stageId: timesheet.stageId || '',
          startTime: dayjs(timesheet.startTime),
          endTime: dayjs(timesheet.endTime),
          description: timesheet.description || '',
          hours: timesheet.hours || 0,
        }));
        setEntries(existingEntries);
      } else {
        // 没有现有记录，创建默认条目
        const defaultEntries = createDefaultEntries();
        setEntries(defaultEntries);
      }
    } catch (error) {
      console.error('获取工时记录失败:', error);
      // 出错时也创建默认条目
      const defaultEntries = createDefaultEntries();
      setEntries(defaultEntries);
    }
  }, [createDefaultEntries, isNewMode]);

  // 计算总工时
  const calculateTotalHours = useCallback(() => {
    const total = entries.reduce((sum, entry) => {
      const hours = calculateHours(entry.startTime, entry.endTime);
      return sum + hours;
    }, 0);
    setTotalHours(total);
  }, [entries, calculateHours]);

  // 添加新条目
  const addEntry = () => {
    const newEntry: TimesheetEntryItem = {
      id: `entry-${Date.now()}`,
      projectId: '',
      stageId: '',
      startTime: dayjs().hour(9).minute(0).second(0),
      endTime: dayjs().hour(17).minute(0).second(0),
      description: '',
      hours: 0,
    };
    setEntries([...entries, newEntry]);
  };

  // 删除条目
  const removeEntry = (entryId: string) => {
    setEntries(entries.filter(entry => entry.id !== entryId));
  };

  // 更新条目
  const updateEntry = (entryId: string, field: keyof TimesheetEntryItem, value: any) => {
    setEntries(entries.map(entry => {
      if (entry.id === entryId) {
        const updatedEntry = { ...entry, [field]: value };
        
        // 如果更新的是时间，重新计算工时
        if (field === 'startTime' || field === 'endTime') {
          updatedEntry.hours = calculateHours(updatedEntry.startTime, updatedEntry.endTime);
        }
        
        return updatedEntry;
      }
      return entry;
    }));
  };

  // 日期变化处理
  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
      fetchExistingTimesheet(date);
    }
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    try {
      setSubmitting(true);
      
      // 验证必填字段
      const validEntries = entries.filter(entry => 
        entry.projectId && entry.stageId && entry.startTime && entry.endTime
      );
      
      if (validEntries.length === 0) {
        message.warning('Please fill in at least one complete entry');
        return;
      }
      
      // 先保存/更新每个条目的数据
      for (const entry of validEntries) {
        const timesheetData = {
          projectId: entry.projectId,
          stageId: entry.stageId || undefined, // 如果stageId为空字符串，传undefined
          date: selectedDate.format('YYYY-MM-DD'),
          startTime: entry.startTime.format('HH:mm'),
          endTime: entry.endTime.format('HH:mm'),
          description: entry.description || '',
        };
        
        await timesheetAPI.create(timesheetData);
      }
      
      // 批量更新所有条目状态为DRAFT
      await timesheetAPI.batchUpdateStatus(selectedDate.format('YYYY-MM-DD'), 'DRAFT');
      
      message.success('Draft saved successfully');
      navigate('/timesheets');
    } catch (error: any) {
      console.error('保存草稿失败:', error);
      message.error(error.response?.data?.error || 'Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  // 提交审批
  const handleSubmitForApproval = async () => {
    try {
      setSubmitting(true);
      
      // 验证必填字段
      const validEntries = entries.filter(entry => 
        entry.projectId && entry.stageId && entry.startTime && entry.endTime
      );
      
      if (validEntries.length === 0) {
        message.warning('Please fill in at least one complete entry');
        return;
      }
      
      // 先保存/更新每个条目的数据
      for (const entry of validEntries) {
        const timesheetData = {
          projectId: entry.projectId,
          stageId: entry.stageId || undefined,
          date: selectedDate.format('YYYY-MM-DD'),
          startTime: entry.startTime.format('HH:mm'),
          endTime: entry.endTime.format('HH:mm'),
          description: entry.description || '',
        };
        
        await timesheetAPI.create(timesheetData);
      }
      
      // 批量更新所有条目状态为SUBMITTED
      await timesheetAPI.batchUpdateStatus(selectedDate.format('YYYY-MM-DD'), 'SUBMITTED');
      
      message.success('Submitted for approval successfully');
      navigate('/timesheets');
    } catch (error: any) {
      console.error('提交审批失败:', error);
      message.error(error.response?.data?.error || 'Failed to submit for approval');
    } finally {
      setSubmitting(false);
    }
  };

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchProjects(), fetchStages()]);
      } catch (error) {
        console.error('初始化数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [fetchProjects, fetchStages]);

  // 当项目和阶段数据加载完成后，获取现有记录或创建默认条目
  useEffect(() => {
    if (projects.length > 0 && stages.length > 0) {
      fetchExistingTimesheet(selectedDate);
    }
  }, [projects, stages, selectedDate, fetchExistingTimesheet]);

  // 实时计算总工时
  useEffect(() => {
    calculateTotalHours();
  }, [entries, calculateTotalHours]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/timesheets')}
          className="mb-4"
        >
          Back to Timesheets
        </Button>
        <Title level={2}>{isNewMode ? 'Create New Timesheet' : 'Edit Timesheet'}</Title>
      </div>

      {/* 顶部：日期选择器和工时汇总 */}
      <Card className="mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={16}>
            <div className="text-center">
              <Text strong className="text-lg">Total Hours: </Text>
              <Text className="text-2xl font-bold text-blue-600">
                {totalHours.toFixed(2)}h
              </Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <Text strong className="text-lg whitespace-nowrap text-gray-700">
                Date:
              </Text>
              <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                format="YYYY-MM-DD (dddd)"
                className="flex-1 min-w-0"
                showToday
                size="large"
                placeholder="Select date"
              />
            </div>
          </Col>
                  </Row>
        
        {/* Project and Stage fields mandatory notice */}
        <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
          <Text strong className="text-blue-800">Note: Both Project and Stage fields are mandatory.</Text>
          <ul className="mt-2 ml-4 text-sm text-blue-700">
            <li>• If either field is left blank, the entry will be considered invalid.</li>
            <li>• Invalid entries will not be saved nor submitted.</li>
          </ul>
        </div>
      </Card>

      {/* 中部：条目列表 */}
      <Card title="Time Entries" className="mb-6">
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <Card key={entry.id} size="small" className="border-l-4 border-l-blue-500">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={12} md={6}>
                  <div>
                    <Text strong>Project:</Text>
                    <Select
                      value={entry.projectId}
                      onChange={(value) => updateEntry(entry.id, 'projectId', value)}
                      placeholder="Select project"
                      className="w-full mt-1"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {projects.map(project => (
                        <Option key={project.id} value={project.id}>
                          {project.projectCode} - {project.name}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </Col>
                
                <Col xs={24} sm={12} md={6}>
                  <div>
                    <Text strong>Stage:</Text>
                    <Select
                      value={entry.stageId}
                      onChange={(value) => updateEntry(entry.id, 'stageId', value)}
                      placeholder="Select stage"
                      className="w-full mt-1"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {stages.map(stage => (
                        <Option key={stage.id} value={stage.id}>
                          {stage.taskId} - {stage.name}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </Col>
                
                <Col xs={12} sm={6} md={3}>
                  <div>
                    <Text strong>Start:</Text>
                    <TimePicker
                      value={entry.startTime}
                      onChange={(time) => time && updateEntry(entry.id, 'startTime', time)}
                      format="HH:mm"
                      minuteStep={15}
                      className="w-full mt-1"
                      changeOnSelect
                      needConfirm={false}
                    />
                  </div>
                </Col>
                
                <Col xs={12} sm={6} md={3}>
                  <div>
                    <Text strong>End:</Text>
                    <TimePicker
                      value={entry.endTime}
                      onChange={(time) => time && updateEntry(entry.id, 'endTime', time)}
                      format="HH:mm"
                      minuteStep={15}
                      className="w-full mt-1"
                      changeOnSelect
                      needConfirm={false}
                    />
                  </div>
                </Col>
                
                <Col xs={12} sm={8} md={4}>
                  <div className="text-center">
                    <Text strong>Hours:</Text>
                    <div className="text-lg font-semibold text-green-600 mt-1">
                      {calculateHours(entry.startTime, entry.endTime).toFixed(2)}h
                    </div>
                  </div>
                </Col>
                
                <Col xs={12} sm={4} md={2}>
                  <div className="text-right">
                    <Popconfirm
                      title="Delete this entry?"
                      onConfirm={() => removeEntry(entry.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={entries.length <= 1}
                      />
                    </Popconfirm>
                  </div>
                </Col>
                
                <Col span={24}>
                  <div>
                    <Text strong>Description:</Text>
                    <TextArea
                      value={entry.description}
                      onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                      placeholder="Enter work description..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </Col>
              </Row>
            </Card>
          ))}
          
          {/* 添加条目按钮 */}
          <Button
            type="dashed"
            onClick={addEntry}
            icon={<PlusOutlined />}
            className="w-full h-12"
          >
            Add New Entry
          </Button>
        </div>
      </Card>

      {/* 底部：操作按钮 */}
      <div className="flex justify-end space-x-4">
        <Button
          size="large"
          onClick={() => navigate('/timesheets')}
        >
          Cancel
        </Button>
        
        <Button
          size="large"
          onClick={handleSaveDraft}
          loading={submitting}
        >Save Draft</Button>
        
        <Button
          type="primary"
          size="large"
          onClick={handleSubmitForApproval}
          loading={submitting}
        >Submit for Approval</Button>
      </div>
    </div>
  );
};

export default TimesheetEntry;