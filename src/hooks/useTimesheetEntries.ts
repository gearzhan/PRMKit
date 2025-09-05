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
  description: string;
  hours: number; // 必需字段，默认0，15分钟增量（0-10小时）
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

  // 生成工时选项（0-10小时，15分钟增量）
  const generateHoursOptions = useCallback(() => {
    const options = [];
    for (let i = 0; i <= 40; i++) { // 0到10小时，每0.25递增
      const hours = i * 0.25;
      options.push({
        label: `${hours.toFixed(2)}h`,
        value: hours
      });
    }
    return options;
  }, []);

  const hoursOptions = generateHoursOptions();

  // 创建默认条目
  const createDefaultEntries = useCallback((): TimesheetEntryItem[] => {
    const adminProject = projects.find(p => p.projectCode === 'OA' || p.name.toLowerCase().includes('admin'));
    const administrationStage = stages.find(s => s.name === 'Administration');
    
    return [
      {
        id: 'default-1',
        projectId: '',
        stageId: '',
        description: '',
        hours: 4, // 默认4小时（上午工作时间）
      },
      {
        id: 'default-2',
        projectId: '',
        stageId: '',
        description: '',
        hours: 3.5, // 默认3.5小时（下午工作时间）
      },
      {
        id: 'default-3',
        projectId: adminProject?.id || '',
        stageId: administrationStage?.id || '',
        description: '',
        hours: 0.5, // 默认0.5小时（管理工作）
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
        const existingEntries = response.timesheets.map((timesheet: any, index: number) => {
          return {
            id: timesheet.id || `existing-${index}`,
            projectId: timesheet.projectId || '',
            stageId: timesheet.stageId || '',
            description: timesheet.description || '',
            hours: timesheet.hours || 0,
          };
        });
        
        // 按ID排序（保持稳定顺序）
        const sortedEntries = existingEntries.sort((a, b) => a.id.localeCompare(b.id));
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
      return sum + (entry.hours || 0);
    }, 0);
    setTotalHours(total);
  }, [entries]);

  // 添加新条目
  const addEntry = useCallback(() => {
    const newEntry: TimesheetEntryItem = {
      id: `entry-${Date.now()}`,
      projectId: '',
      stageId: '',
      description: '',
      hours: 0, // 默认0小时
    };
    setEntries(prevEntries => [...prevEntries, newEntry]);
  }, []);

  // 删除条目
  const removeEntry = useCallback((entryId: string) => {
    setEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
  }, []);

  // 更新条目
  const updateEntry = useCallback((entryId: string, field: keyof TimesheetEntryItem, value: any) => {
    setEntries(prevEntries => {
      return prevEntries.map(entry => {
        if (entry.id === entryId) {
          const updatedEntry = { ...entry, [field]: value };
          return updatedEntry;
        }
        return entry;
      });
    });
  }, []);

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
    hoursOptions,
    addEntry,
    removeEntry,
    updateEntry,
    fetchExistingTimesheet,
  };
};

export type { TimesheetEntryItem };