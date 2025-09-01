import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from 'antd';
import { Dayjs } from 'dayjs';
import { timesheetAPI } from '../lib/api';
import { TimesheetEntryItem } from './useTimesheetEntries';
import { Project, Stage } from './useTimesheetData';

interface UseTimesheetSubmissionProps {
  entries: TimesheetEntryItem[];
  projects: Project[];
  stages: Stage[];
  selectedDate: Dayjs;
}

export const useTimesheetSubmission = ({
  entries,
  projects,
  stages,
  selectedDate,
}: UseTimesheetSubmissionProps) => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 实际执行保存草稿的函数
  const performSaveDraft = useCallback(async () => {
    try {
      setIsSaving(true);
      setSubmitting(true);
      
      console.debug('开始保存草稿，当前条目数量:', entries.length);
      console.debug('当前条目详情:', entries);
      console.debug('可用项目列表:', projects);
      console.debug('可用阶段列表:', stages);
      
      // 检查条目是否已初始化
      if (entries.length === 0) {
        console.debug('没有可保存的条目');
        return;
      }
      
      // 草稿验证：更宽松的条件，只要有项目ID即可
      const draftEntries = entries.filter(entry => {
        const hasProject = entry.projectId && typeof entry.projectId === 'string' && entry.projectId.trim() !== '';
        console.debug('条目验证:', { 
          entryId: entry.id, 
          projectId: entry.projectId, 
          hasProject,
          projectType: typeof entry.projectId
        });
        return hasProject;
      });
      
      console.debug('通过初步验证的草稿条目:', draftEntries.length);
      
      if (draftEntries.length === 0) {
        console.debug('没有选择项目的条目');
        message.warning('Please select at least one project to save as draft');
        return;
      }
      
      // 草稿保存：不强制验证项目和阶段是否在列表中，因为数据可能还在加载
      // 只进行基本的数据完整性检查
      const validDraftEntries = draftEntries.filter(entry => {
        const isValid = entry.projectId && entry.projectId.trim() !== '';
        if (!isValid) {
          console.debug('条目验证失败:', entry);
        }
        return isValid;
      });
      
      console.debug('最终有效的草稿条目:', validDraftEntries.length);
      
      if (validDraftEntries.length === 0) {
        console.debug('没有有效的草稿条目');
        message.warning('No valid entries to save as draft');
        return;
      }
      
      // 优化：使用批量创建而不是循环调用（草稿允许部分字段为空）
      const timesheetDataList = validDraftEntries.map(entry => {
        // 使用更稳定的时间格式化方法，确保在所有环境中都能正确解析
        let startTimeISO = null;
        let endTimeISO = null;
        
        if (entry.startTime) {
          const startHour = entry.startTime.hour();
          const startMinute = entry.startTime.minute();
          // 构建标准的 ISO 8601 格式字符串
          const dateStr = selectedDate.format('YYYY-MM-DD');
          startTimeISO = `${dateStr}T${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:00.000Z`;
        }
        
        if (entry.endTime) {
          const endHour = entry.endTime.hour();
          const endMinute = entry.endTime.minute();
          // 构建标准的 ISO 8601 格式字符串
          const dateStr = selectedDate.format('YYYY-MM-DD');
          endTimeISO = `${dateStr}T${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00.000Z`;
        }

        return {
          projectId: entry.projectId,
          stageId: entry.stageId || undefined,
          date: selectedDate.format('YYYY-MM-DD'),
          startTime: startTimeISO,
          endTime: endTimeISO,
          description: entry.description || '',
        };
      });
      
      // 先删除当天的所有记录，然后批量创建新记录
      // 这样可以避免重复条目的问题
      const dateStr = selectedDate.format('YYYY-MM-DD');
      
      try {
        // 获取当天现有记录
        const existingResponse = await timesheetAPI.getList({ 
          startDate: dateStr, 
          endDate: dateStr 
        });
        
        // 删除现有记录（使用Promise.all并行删除提高效率）
        if (existingResponse.timesheets && existingResponse.timesheets.length > 0) {
          const deletePromises = existingResponse.timesheets
            .filter(timesheet => timesheet.id)
            .map(timesheet => timesheetAPI.delete(timesheet.id));
          
          await Promise.all(deletePromises);
        }
        
        // 批量创建新记录（使用Promise.all并行创建）
        const createPromises = timesheetDataList.map(timesheetData => 
          timesheetAPI.create(timesheetData)
        );
        await Promise.all(createPromises);
        
      } catch (error) {
        console.error('保存记录时出错:', error);
        throw error; // 重新抛出错误以便上层处理
      }
      
      // 批量更新所有条目状态为DRAFT
      await timesheetAPI.batchUpdateStatus(selectedDate.format('YYYY-MM-DD'), 'DRAFT');
      
      setLastSavedTime(new Date());
      message.success('Draft saved successfully');
      navigate('/timesheets');
    } catch (error: any) {
      console.error('保存草稿失败:', error);
      message.error(error.response?.data?.error || 'Failed to save draft');
    } finally {
      setIsSaving(false);
      setSubmitting(false);
    }
  }, [
    entries,
    projects,
    stages,
    selectedDate,
    navigate,
    message,
  ]);

  // 保存草稿（带防抖和优化逻辑）
  const handleSaveDraft = useCallback(() => {
    // 防抖：清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 防止重复保存
    if (isSaving || submitting) {
      return;
    }
    
    // 设置防抖延迟
    saveTimeoutRef.current = setTimeout(async () => {
      await performSaveDraft();
    }, 300); // 300ms 防抖延迟
  }, [isSaving, submitting, performSaveDraft]);

  // 提交审批（同样优化逻辑）
  const handleSubmitForApproval = useCallback(async () => {
    // 防止重复提交
    if (isSaving || submitting) {
      return;
    }
    
    try {
      setIsSaving(true);
      setSubmitting(true);
      
      // 提交审批验证：要求所有字段完整
      const validEntries = entries.filter(entry => 
        entry.projectId && entry.stageId && entry.startTime && entry.endTime
      );
      
      if (validEntries.length === 0) {
        message.warning('Please fill in at least one complete entry (project, stage, start time, and end time) to submit for approval');
        return;
      }
      
      // 优化：使用批量创建而不是循环调用
      const timesheetDataList = validEntries.map(entry => {
        // 使用更稳定的时间格式化方法，确保在所有环境中都能正确解析
        const startHour = entry.startTime!.hour();
        const startMinute = entry.startTime!.minute();
        const endHour = entry.endTime!.hour();
        const endMinute = entry.endTime!.minute();
        
        // 构建标准的 ISO 8601 格式字符串
        const dateStr = selectedDate.format('YYYY-MM-DD');
        const startTimeISO = `${dateStr}T${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:00.000Z`;
        const endTimeISO = `${dateStr}T${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00.000Z`;

        return {
          projectId: entry.projectId,
          stageId: entry.stageId || undefined,
          date: selectedDate.format('YYYY-MM-DD'),
          startTime: startTimeISO,
          endTime: endTimeISO,
          description: entry.description || '',
        };
      });
      
      // 先删除当天的所有记录，然后批量创建新记录
      // 这样可以避免重复条目的问题
      const dateStr = selectedDate.format('YYYY-MM-DD');
      
      try {
        const existingResponse = await timesheetAPI.getList({ 
          startDate: dateStr, 
          endDate: dateStr 
        });
        
        // 删除现有记录（使用Promise.all并行删除提高效率）
        if (existingResponse.timesheets && existingResponse.timesheets.length > 0) {
          const deletePromises = existingResponse.timesheets
            .filter(timesheet => timesheet.id)
            .map(timesheet => timesheetAPI.delete(timesheet.id));
          
          await Promise.all(deletePromises);
        }
        
        // 批量创建新记录（使用Promise.all并行创建）
        const createPromises = timesheetDataList.map(timesheetData => 
          timesheetAPI.create(timesheetData)
        );
        await Promise.all(createPromises);
        
      } catch (error) {
        console.error('提交记录时出错:', error);
        throw error; // 重新抛出错误以便上层处理
      }
      
      // 批量更新所有条目状态为SUBMITTED
      await timesheetAPI.batchUpdateStatus(selectedDate.format('YYYY-MM-DD'), 'SUBMITTED');
      
      message.success('Submitted for approval successfully');
      navigate('/timesheets');
    } catch (error: any) {
      console.error('提交审批失败:', error);
      message.error(error.response?.data?.error || 'Failed to submit for approval');
    } finally {
      setIsSaving(false);
      setSubmitting(false);
    }
  }, [
    entries,
    selectedDate,
    navigate,
    message,
    isSaving,
    submitting,
  ]);

  // 清理定时器
  const cleanup = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  return {
    submitting,
    isSaving,
    lastSavedTime,
    handleSaveDraft,
    handleSubmitForApproval,
    cleanup,
  };
};