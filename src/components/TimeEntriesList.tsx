import React from 'react';
import { Card, Button, Empty, Typography, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import TimeEntryRow from './TimeEntryRow';
import { TimesheetEntryItem } from '../hooks/useTimesheetEntries';
import { Project, Stage } from '../hooks/useTimesheetData';

const { Title, Text } = Typography;

interface TimeEntriesListProps {
  entries: TimesheetEntryItem[];
  projects: Project[];
  stages: Stage[];
  timeOptions: { label: string; value: string }[];
  onAddEntry: () => void;
  onUpdateEntry: (entryId: string, field: keyof TimesheetEntryItem, value: any) => void;
  onRemoveEntry: (entryId: string) => void;
}

const TimeEntriesList: React.FC<TimeEntriesListProps> = ({
  entries,
  projects,
  stages,
  timeOptions,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}) => {
  return (
    <div className="mb-6">
      {/* 条目列表标题和添加按钮 */}
      <div className="flex justify-between items-center mb-4">
        <Title level={3} className="mb-0">Time Entries</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddEntry}
          size="large"
        >
          Add Entry
        </Button>
      </div>

      {/* 条目列表 */}
      {entries.length === 0 ? (
        <Card>
          <Empty
            description={
              <Space direction="vertical" size="small">
                <Text>No time entries yet</Text>
                <Text type="secondary">Click "Add Entry" to create your first time entry</Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <TimeEntryRow
              key={entry.id}
              entry={entry}
              projects={projects}
              stages={stages}
              timeOptions={timeOptions}
              onUpdate={onUpdateEntry}
              onRemove={onRemoveEntry}
            />
          ))}
        </div>
      )}

      {/* 条目数量提示 */}
      {entries.length > 0 && (
        <div className="mt-4 text-center">
          <Text type="secondary">
            Total {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
        </div>
      )}
    </div>
  );
};

export default TimeEntriesList;