import React, { useCallback } from 'react';
import { Card, Row, Col, Select, Input, Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { TimesheetEntryItem } from '../hooks/useTimesheetEntries';
import { Project, Stage } from '../hooks/useTimesheetData';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

interface TimeEntryRowProps {
  entry: TimesheetEntryItem;
  projects: Project[];
  stages: Stage[];
  hoursOptions: { label: string; value: number }[];
  onUpdate: (entryId: string, field: keyof TimesheetEntryItem, value: any) => void;
  onRemove: (entryId: string) => void;
}

const TimeEntryRow: React.FC<TimeEntryRowProps> = ({
  entry,
  projects,
  stages,
  hoursOptions,
  onUpdate,
  onRemove,
}) => {
  // 处理工时选择变化
  const handleHoursChange = useCallback((hours: number) => {
    onUpdate(entry.id, 'hours', hours);
  }, [entry.id, onUpdate]);

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
              filterOption={(input, option) => {
                const project = projects.find(p => p.id === option?.value);
                if (!project) return false;
                const searchText = `${project.projectCode} - ${project.name}`.toLowerCase();
                return searchText.includes(input.toLowerCase());
              }}
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
              filterOption={(input, option) => {
                const stage = stages.find(s => s.id === option?.value);
                if (!stage) return false;
                return stage.name.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {stages.map(stage => (
                <Option key={stage.id} value={stage.id}>
                  {stage.name}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
        
        <Col xs={12} sm={6} md={6}>
          <div>
            <Text strong>Hours:</Text>
            <Select
              value={entry.hours}
              onChange={handleHoursChange}
              placeholder="Select hours"
              className="w-full mt-1"
              showSearch
            >
              {hoursOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
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