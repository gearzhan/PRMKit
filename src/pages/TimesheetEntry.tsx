import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import dayjs from 'dayjs';

// Import custom hooks
import { useTimesheetData } from '../hooks/useTimesheetData';
import { useTimesheetEntries } from '../hooks/useTimesheetEntries';
import { useTimesheetSubmission } from '../hooks/useTimesheetSubmission';

// Import sub-components
import TimesheetHeader from '../components/TimesheetHeader';
import TimeEntriesList from '../components/TimeEntriesList';
import TimesheetActions from '../components/TimesheetActions';

const TimesheetEntry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从URL参数或location state获取日期
  const dateFromUrl = new URLSearchParams(location.search).get('date');
  const dateFromState = location.state?.date;
  
  // 确定初始日期和模式
  const initialDate = dateFromUrl || dateFromState || dayjs().format('YYYY-MM-DD');
  const isNewMode = !dateFromUrl && !dateFromState;
  
  // 使用自定义 hooks
  const { projects, stages, loading: dataLoading } = useTimesheetData();
  
  const {
    selectedDate,
    setSelectedDate,
    entries,
    totalHours,
    timeOptions,
    addEntry,
    removeEntry,
    updateEntry,
    fetchExistingTimesheet
  } = useTimesheetEntries({
    projects,
    stages,
    initialDate: dayjs(initialDate),
    isNewMode
  });
  
  const {
    isSaving,
    submitting,
    lastSavedTime,
    handleSaveDraft,
    handleSubmitForApproval
  } = useTimesheetSubmission({
    entries,
    projects,
    stages,
    selectedDate
  });



  // 日期变化处理
  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
      fetchExistingTimesheet(date);
    }
  };

  // 返回处理
  const handleBack = () => {
    navigate('/timesheets');
  };



  if (dataLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面头部 */}
        <div className="mb-8">
          <TimesheetHeader
            isNewMode={isNewMode}
            totalHours={totalHours}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onBackClick={handleBack}
          />
        </div>

        {/* 主要内容区域 */}
        <div className="space-y-6">
          {/* 条目列表 */}
          <TimeEntriesList
            entries={entries}
            projects={projects}
            stages={stages}
            timeOptions={timeOptions}
            onAddEntry={addEntry}
            onUpdateEntry={updateEntry}
            onRemoveEntry={removeEntry}
          />

          {/* 操作按钮 */}
          <TimesheetActions
            totalHours={totalHours}
            hasValidEntries={entries.length > 0 && entries.some(entry => entry.projectId && entry.stageId)}
            canSubmit={entries.length > 0 && entries.every(entry => 
              entry.projectId && entry.stageId && entry.startTime && entry.endTime
            )}
            isSaving={isSaving}
            isSubmitting={submitting}
            lastSaved={lastSavedTime}
            onSaveDraft={handleSaveDraft}
            onSubmitForApproval={handleSubmitForApproval}
          />
        </div>
      </div>
    </div>
  );
};

export default TimesheetEntry;