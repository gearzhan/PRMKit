import { useState, useEffect, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { timesheetAPI } from '../lib/api';
import { Project, Stage } from './useTimesheetData';

// 启用dayjs时区插件
dayjs.extend(utc);
dayjs.extend(timezone);

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

interface UseTimesheetEntriesProps {
  projects: Project[];
  stages: Stage[];
  initialDate: Dayjs;
  isNewMode: boolean;
}

export const useTimesheetEntries = ({
  projects,
  stages,
  initialDate,
  isNewMode,
}: UseTimesheetEntriesProps) => {
  const [entries, setEntries] = useState<TimesheetEntryItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // 生成时间选项（15分钟间隔）
  const generateTimeOptions = useCallback(() => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push({
          label: timeString,
          value: timeString,
        });
      }
    }
    return options;
  }, []);

  const timeOptions = generateTimeOptions();

  // 计算工时（与后端保持一致：四舍五入到最近的15分钟）
  const calculateHours = useCallback((startTime: Dayjs, endTime: Dayjs): number => {
    if (!startTime || !endTime) return 0;
    
    const diffMs = endTime.valueOf() - startTime.valueOf();
    if (diffMs <= 0) return 0;
    
    // 转换为小时
    const hours = diffMs / (1000 * 60 * 60);
    
    // 四舍五入到最近的15分钟（0.25小时）
    return Math.round(hours * 4) / 4;
  }, []);

  // 创建默认条目
  const createDefaultEntries = useCallback((): TimesheetEntryItem[] => {
    const adminProject = projects.find(p => p.projectCode === 'OA' || p.name.toLowerCase().includes('admin'));
    const administrationStage = stages.find(s => s.name === 'Administration');
    
    const entry1StartTime = dayjs().hour(9).minute(0).second(0);
    const entry1EndTime = dayjs().hour(13).minute(0).second(0);
    const entry2StartTime = dayjs().hour(14).minute(0).second(0);
    const entry2EndTime = dayjs().hour(17).minute(30).second(0);
    const entry3StartTime = dayjs().hour(17).minute(30).second(0);
    const entry3EndTime = dayjs().hour(18).minute(0).second(0);
    
    return [
      {
        id: 'default-1',
        projectId: '',
        stageId: '',
        startTime: entry1StartTime,
        endTime: entry1EndTime,
        description: '',
        hours: calculateHours(entry1StartTime, entry1EndTime),
      },
      {
        id: 'default-2',
        projectId: '',
        stageId: '',
        startTime: entry2StartTime,
        endTime: entry2EndTime,
        description: '',
        hours: calculateHours(entry2StartTime, entry2EndTime),
      },
      {
        id: 'default-3',
        projectId: adminProject?.id || '',
        stageId: administrationStage?.id || '',
        startTime: entry3StartTime,
        endTime: entry3EndTime,
        description: '',
        hours: calculateHours(entry3StartTime, entry3EndTime),
      },
    ];
  }, [projects, stages, calculateHours]);

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
        const existingEntries = response.timesheets.map((timesheet: any, index: number) => {
          // 修复时区问题：直接解析UTC时间字符串，避免时区转换
          // 从UTC时间字符串中提取时间部分（如："2025-09-01T09:00:00.000Z" -> "09:00"）
          const startTimeStr = timesheet.startTime; // 例如："2025-09-01T09:00:00.000Z"
          const endTimeStr = timesheet.endTime;     // 例如："2025-09-01T13:00:00.000Z"
          
          // 提取UTC时间的小时和分钟部分
          const startTimeMatch = startTimeStr.match(/T(\d{2}):(\d{2})/);
          const endTimeMatch = endTimeStr.match(/T(\d{2}):(\d{2})/);
          
          if (!startTimeMatch || !endTimeMatch) {
            console.error('时间格式解析失败:', { startTimeStr, endTimeStr });
            return null;
          }
          
          const startHour = parseInt(startTimeMatch[1], 10);
          const startMinute = parseInt(startTimeMatch[2], 10);
          const endHour = parseInt(endTimeMatch[1], 10);
          const endMinute = parseInt(endTimeMatch[2], 10);
          
          // 使用当前日期和提取的UTC时间构造本地dayjs对象
          const startTimeDayjs = date.hour(startHour).minute(startMinute).second(0);
          const endTimeDayjs = date.hour(endHour).minute(endMinute).second(0);
          

          
          return {
            id: timesheet.id || `existing-${index}`,
            projectId: timesheet.projectId || '',
            stageId: timesheet.stageId || '',
            startTime: startTimeDayjs,
            endTime: endTimeDayjs,
            description: timesheet.description || '',
            hours: timesheet.hours || 0,
          };
        }).filter(entry => entry !== null); // 过滤掉解析失败的条目
        
        // 按开始时间排序
        const sortedEntries = existingEntries.sort((a, b) => {
          if (!a.startTime || !b.startTime) return 0;
          return a.startTime.valueOf() - b.startTime.valueOf();
        });
        setEntries(sortedEntries);
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
  const addEntry = useCallback(() => {
    const startTime = dayjs().hour(9).minute(0).second(0);
    const endTime = dayjs().hour(17).minute(0).second(0);
    
    const newEntry: TimesheetEntryItem = {
      id: `entry-${Date.now()}`,
      projectId: '',
      stageId: '',
      startTime: startTime,
      endTime: endTime,
      description: '',
      hours: calculateHours(startTime, endTime), // 使用计算得出的小时数
    };
    setEntries(prevEntries => {
      const updatedEntries = [...prevEntries, newEntry];
      // 按开始时间排序
      return updatedEntries.sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return a.startTime.valueOf() - b.startTime.valueOf();
      });
    });
  }, [calculateHours]);

  // 删除条目
  const removeEntry = useCallback((entryId: string) => {
    setEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
  }, []);

  // 更新条目
  const updateEntry = useCallback((entryId: string, field: keyof TimesheetEntryItem, value: any) => {
    setEntries(prevEntries => {
      const updatedEntries = prevEntries.map(entry => {
        if (entry.id === entryId) {
          const updatedEntry = { ...entry, [field]: value };
          
          // 如果更新的是时间，重新计算工时
          if (field === 'startTime' || field === 'endTime') {
            updatedEntry.hours = calculateHours(updatedEntry.startTime, updatedEntry.endTime);
          }
          
          return updatedEntry;
        }
        return entry;
      });
      
      // 按开始时间排序条目
      return updatedEntries.sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return a.startTime.valueOf() - b.startTime.valueOf();
      });
    });
  }, [calculateHours]);

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

  return {
    selectedDate,
    setSelectedDate,
    entries,
    totalHours,
    timeOptions,
    addEntry,
    removeEntry,
    updateEntry,
    fetchExistingTimesheet,
  };
};

export type { TimesheetEntryItem };