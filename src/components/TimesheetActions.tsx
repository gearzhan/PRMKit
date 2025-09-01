import React from 'react';
import { Card, Button, Space, Typography, Alert } from 'antd';
import { SaveOutlined, SendOutlined, LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface TimesheetActionsProps {
  totalHours: number;
  hasValidEntries: boolean;
  canSubmit: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  lastSaved?: Date;
  onSaveDraft: () => void;
  onSubmitForApproval: () => void;
}

const TimesheetActions: React.FC<TimesheetActionsProps> = ({
  totalHours,
  hasValidEntries,
  canSubmit,
  isSaving,
  isSubmitting,
  lastSaved,
  onSaveDraft,
  onSubmitForApproval,
}) => {
  return (
    <Card className="mt-6 shadow-sm">
      {/* 状态提示区域 - 统一处理所有提示信息 */}
      {!hasValidEntries ? (
        <Alert
          message="No Time Entries"
          description="Please add at least one time entry with project and stage information to get started."
          type="info"
          showIcon
          className="mb-6"
        />
      ) : !canSubmit ? (
        <Alert
          message="Incomplete Entries"
          description={
            <div>
              <Text>To submit for approval, please ensure all entries have:</Text>
              <ul className="mt-2 ml-4 space-y-1">
                <li>• Project and Stage selected</li>
                <li>• Valid start and end times</li>
                <li>• End time is after start time</li>
              </ul>
            </div>
          }
          type="warning"
          showIcon
          className="mb-6"
        />
      ) : null}

      {/* 操作按钮区域 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        {/* 左侧：保存状态信息 */}
        <div className="flex flex-col gap-2">
          {lastSaved && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <Text type="secondary" className="text-sm">
                Last saved: {lastSaved.toLocaleString()}
              </Text>
            </div>
          )}
          {isSaving && (
            <div className="flex items-center gap-2">
              <LoadingOutlined className="text-blue-500" />
              <Text type="secondary" className="text-sm">
                Saving draft...
              </Text>
            </div>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <Space size="large" className="flex-wrap">
          <Button
            icon={<SaveOutlined />}
            onClick={onSaveDraft}
            disabled={!hasValidEntries || isSaving || isSubmitting}
            loading={isSaving}
            size="large"
            className="min-w-[120px]"
          >
            Save Draft
          </Button>
          
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSubmitForApproval}
            disabled={!canSubmit || isSaving || isSubmitting}
            loading={isSubmitting}
            size="large"
            className="min-w-[160px] bg-blue-600 hover:bg-blue-700"
          >
            Submit for Approval
          </Button>
        </Space>
      </div>

      {/* 总工时显示 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <Text strong className="text-lg">Total Hours for Submission: </Text>
          <Text className="text-xl font-bold text-green-600">
            {totalHours.toFixed(2)}h
          </Text>
        </div>
      </div>
    </Card>
  );
};

export default TimesheetActions;