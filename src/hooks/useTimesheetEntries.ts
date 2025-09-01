import { useState, useEffect, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { timesheetAPI } from '../lib/api';
import { Project, Stage } from './useTimesheetData';

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

  // 计算工时（精确计算，不进行向上取整）
  const calculateHours = useCallback((startTime: Dayjs, endTime: Dayjs): number => {
    if (!startTime || !endTime) return 0;
    
    const diffMinutes = endTime.diff(startTime, 'minute');
    if (diffMinutes <= 0) return 0;
    
    // 精确计算小时数，保留两位小数
    return Math.round((diffMinutes / 60) * 100) / 100;
  }, []);

  // 创建默认条目
  const createDefaultEntries = useCallback((): TimesheetEntryItem[] => {
    const adminProject = projects.find(p => p.projectCode === 'OA' || p.name.toLowerCase().includes('admin'));
    const administrationStage = stages.find(s => s.name === 'Administration');
    
    return [
      {
        id: 'default-1',
        projectId: '',
        stageId: '',
        startTime: dayjs().hour(9).minute(0).second(0),
        endTime: dayjs().hour(13).minute(0).second(0),
        description: '',
        hours: 0,
      },
      {
        id: 'default-2',
        projectId: '',
        stageId: '',
        startTime: dayjs().hour(14).minute(0).second(0),
        endTime: dayjs().hour(17).minute(30).second(0),
        description: '',
        hours: 0,
      },
      {
        id: 'default-3',
        projectId: adminProject?.id || '',
        stageId: administrationStage?.id || '',
        startTime: dayjs().hour(17).minute(30).second(0),
        endTime: dayjs().hour(18).minute(0).second(0),
        description: '',
        hours: 0,
      },
    ];
  }, [projects, stages]);

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
    const newEntry: TimesheetEntryItem = {
      id: `entry-${Date.now()}`,
      projectId: '',
      stageId: '',
      startTime: dayjs().hour(9).minute(0).second(0),
      endTime: dayjs().hour(17).minute(0).second(0),
      description: '',
      hours: 0,
    };
    setEntries(prevEntries => {
      const updatedEntries = [...prevEntries, newEntry];
      // 按开始时间排序
      return updatedEntries.sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return a.startTime.valueOf() - b.startTime.valueOf();
      });
    });
  }, []);

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