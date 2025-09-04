import React from 'react';
import { Button, Card, Row, Col, Typography, DatePicker } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

interface TimesheetHeaderProps {
  isNewMode: boolean;
  totalHours: number;
  selectedDate: Dayjs;
  onDateChange: (date: Dayjs | null) => void;
  onBackClick: () => void;
}

const TimesheetHeader: React.FC<TimesheetHeaderProps> = ({
  isNewMode,
  totalHours,
  selectedDate,
  onDateChange,
  onBackClick,
}) => {
  return (
    <>
      {/* 页面标题 */}
      <div className="mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBackClick}
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
                onChange={onDateChange}
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
        
        {/* Recent Bug Fixes Summary */}
        <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-400 rounded">
          <Text strong className="text-green-800">Recent Bug Fixes:</Text>
          <ul className="mt-2 ml-4 text-sm text-green-700">
            <li>• Fixed search functionality in Project dropdown - you can now search by project code or name</li>
            <li>• Fixed search functionality in Stage dropdown - you can now search by stage name</li>
          </ul>
        </div>
      </Card>
    </>
  );
};

export default TimesheetHeader;