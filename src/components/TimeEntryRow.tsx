import React, { useCallback } from 'react';
import { Card, Row, Col, Select, TimePicker, Input, Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { TimesheetEntryItem } from '../hooks/useTimesheetEntries';
import { Project, Stage } from '../hooks/useTimesheetData';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

interface TimeEntryRowProps {
  entry: TimesheetEntryItem;
  projects: Project[];
  stages: Stage[];
  timeOptions: { label: string; value: string }[];
  onUpdate: (entryId: string, field: keyof TimesheetEntryItem, value: any) => void;
  onRemove: (entryId: string) => void;
}

const TimeEntryRow: React.FC<TimeEntryRowProps> = ({
  entry,
  projects,
  stages,
  timeOptions,
  onUpdate,
  onRemove,
}) => {
  // 处理时间选择变化
  const handleTimeChange = useCallback((field: 'startTime' | 'endTime', timeString: string | null) => {
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const newTime = dayjs().hour(hours).minute(minutes).second(0);
      onUpdate(entry.id, field, newTime);
    }
  }, [entry.id, onUpdate]);

  // 计算工时显示
  const calculateDisplayHours = useCallback((startTime: Dayjs, endTime: Dayjs): number => {
    if (!startTime || !endTime) return 0;
    const diffMinutes = endTime.diff(startTime, 'minute');
    if (diffMinutes <= 0) return 0;
    return Math.round((diffMinutes / 60) * 100) / 100;
  }, []);

  const displayHours = calculateDisplayHours(entry.startTime, entry.endTime);

  return (
    <Card key={entry.id} size="small" className="border-l-4 border-l-blue-500">
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} sm={12} md={6}>
          <div>
            <Text strong>Project:</Text>
            <Select
              value={entry.projectId}
              onChange={(value) => onUpdate(entry.id, 'projectId', value)}
              placeholder="Select project"
              className="w-full mt-1"
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
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
              onChange={(value) => onUpdate(entry.id, 'stageId', value)}
              placeholder="Select stage"
              className="w-full mt-1"
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {stages.map(stage => (
                <Option key={stage.id} value={stage.id}>
                  {stage.name}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
        
        <Col xs={12} sm={6} md={3}>
          <div>
            <Text strong>Start:</Text>
            <Select
              value={entry.startTime ? entry.startTime.format('HH:mm') : undefined}
              onChange={(value) => handleTimeChange('startTime', value)}
              placeholder="Start time"
              className="w-full mt-1"
              showSearch
            >
              {timeOptions.map(option => (
                <Option key={`start-${option.value}`} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
        
        <Col xs={12} sm={6} md={3}>
          <div>
            <Text strong>End:</Text>
            <Select
              value={entry.endTime ? entry.endTime.format('HH:mm') : undefined}
              onChange={(value) => handleTimeChange('endTime', value)}
              placeholder="End time"
              className="w-full mt-1"
              showSearch
            >
              {timeOptions.map(option => (
                <Option key={`end-${option.value}`} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
        
        <Col xs={12} sm={6} md={3}>
          <div>
            <Text strong>Hours:</Text>
            <div className="mt-1 p-2 bg-gray-50 rounded text-center font-semibold text-green-600">
              {displayHours.toFixed(2)}h
            </div>
          </div>
        </Col>
        
        <Col xs={12} sm={6} md={3}>
          <div className="flex justify-end">
            <Popconfirm
              title="Delete Entry"
              description="Are you sure you want to delete this entry?"
              onConfirm={() => onRemove(entry.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                className="hover:bg-red-50"
              />
            </Popconfirm>
          </div>
        </Col>
      </Row>
      
      {/* Description row */}
      <Row className="mt-3">
        <Col span={24}>
          <div>
            <Text strong>Description:</Text>
            <TextArea
              value={entry.description}
              onChange={(e) => onUpdate(entry.id, 'description', e.target.value)}
              placeholder="Enter work description..."
              className="mt-1"
              rows={2}
              maxLength={500}
            />
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default TimeEntryRow;