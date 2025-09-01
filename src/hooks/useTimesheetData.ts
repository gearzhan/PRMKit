import { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import { projectAPI, stageAPI } from '../lib/api';

// 项目接口
interface Project {
  id: string;
  name: string;
  projectCode: string;
  status: string;
}

// 阶段接口
interface Stage {
  id: string;
  name: string;
  taskId: string;
  category: string;
}

export const useTimesheetData = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);

  // 获取项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectAPI.getList({ page: 1, limit: 100 });
      if (response.projects) {
        setProjects(response.projects);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
      message.error('Failed to fetch projects');
    }
  }, [message]);

  // 获取阶段列表
  const fetchStages = useCallback(async () => {
    try {
      const response = await stageAPI.getList();
      setStages(response.stages || []);
    } catch (error) {
      console.error('获取阶段列表失败:', error);
      message.error('Failed to fetch stages');
    }
  }, [message]);

  // 初始化数据
  const initializeData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProjects(), fetchStages()]);
    } catch (error) {
      console.error('初始化数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchProjects, fetchStages]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  return {
    loading,
    projects,
    stages,
    fetchProjects,
    fetchStages,
    initializeData,
  };
};

export type { Project, Stage };