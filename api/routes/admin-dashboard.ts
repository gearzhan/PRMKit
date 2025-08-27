import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel1Admin } from '../lib/jwt.js';

const router = Router();

// 获取管理员仪表板统计数据
router.get('/stats', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Dashboard Stats API Called ===');
  console.log('User:', req.user);
  console.log('Query params:', req.query);
  
  try {
    const { month } = req.query;
    
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month parameter is required (format: YYYY-MM)' });
    }
    
    console.log('Fetching stats for month:', month);
    
    // 解析月份参数
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    
    console.log('Date range:', { startDate, endDate });
    
    // 并行查询所有统计数据
    const [timesheetStats, projectCount, employeeCount] = await Promise.all([
      // 工时统计 - 按状态分组
      prisma.timesheet.groupBy({
        by: ['status'],
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          hours: true,
        },
        _count: {
          id: true,
        },
      }),
      
      // 活跃项目数量
      prisma.project.count({
        where: {
          timesheets: {
            some: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
      }),
      
      // 活跃员工数量
      prisma.employee.count({
        where: {
          timesheets: {
            some: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
      }),
    ]);
    
    console.log('Raw timesheet stats:', timesheetStats);
    console.log('Project count:', projectCount);
    console.log('Employee count:', employeeCount);
    
    // 处理工时统计数据
    const stats = {
      totalHours: 0,
      approvedHours: 0,
      pendingHours: 0,
      rejectedHours: 0,
      totalProjects: projectCount,
      activeEmployees: employeeCount,
      completionRate: 0,
    };
    
    timesheetStats.forEach(stat => {
      const hours = stat._sum.hours || 0;
      stats.totalHours += hours;
      
      switch (stat.status) {
        case 'APPROVED':
          stats.approvedHours = hours;
          break;
        case 'SUBMITTED':
          stats.pendingHours = hours;
          break;
        case 'DRAFT':
          stats.rejectedHours = hours;
          break;
      }
    });
    
    // 计算完成率（已批准工时 / 总工时）
    if (stats.totalHours > 0) {
      stats.completionRate = Math.round((stats.approvedHours / stats.totalHours) * 100 * 10) / 10;
    }
    
    console.log('Processed stats:', stats);
    
    res.json(stats);
  } catch (error) {
    console.error('=== Admin Dashboard Stats Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 获取管理员仪表板图表数据
router.get('/charts', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Dashboard Charts API Called ===');
  console.log('User:', req.user);
  console.log('Query params:', req.query);
  
  try {
    const { month } = req.query;
    
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month parameter is required (format: YYYY-MM)' });
    }
    
    console.log('Fetching chart data for month:', month);
    
    // 解析月份参数
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    
    console.log('Date range:', { startDate, endDate });
    
    // 并行查询项目和员工统计数据
    const [projectStats, employeeStats] = await Promise.all([
      // 项目统计数据
      prisma.project.findMany({
        where: {
          timesheets: {
            some: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          projectCode: true,
          timesheets: {
            where: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            select: {
              hours: true,
              status: true,
              employeeId: true,
            },
          },
        },
      }),
      
      // 员工统计数据
      prisma.employee.findMany({
        where: {
          timesheets: {
            some: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          employeeId: true,
          timesheets: {
            where: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
            select: {
              hours: true,
              status: true,
              projectId: true,
            },
          },
        },
      }),
    ]);
    
    console.log('Raw project stats count:', projectStats.length);
    console.log('Raw employee stats count:', employeeStats.length);
    
    // 处理项目统计数据
    const processedProjectStats = projectStats.map(project => {
      const totalHours = project.timesheets.reduce((sum, ts) => sum + (ts.hours || 0), 0);
      const approvedHours = project.timesheets
        .filter(ts => ts.status === 'APPROVED')
        .reduce((sum, ts) => sum + (ts.hours || 0), 0);
      const uniqueEmployees = new Set(project.timesheets.map(ts => ts.employeeId));
      
      return {
        name: project.name, // 修复字段名：使用name而不是projectName
        totalHours,
        approvedHours,
        count: uniqueEmployees.size, // 修复字段名：使用count而不是employeeCount
      };
    })
    .filter(project => project.totalHours > 0) // 过滤掉没有工时的项目
    .sort((a, b) => b.totalHours - a.totalHours) // 按总工时降序排列
    .slice(0, 10); // 取前10个项目
    
    // 处理员工统计数据
    const processedEmployeeStats = employeeStats.map(employee => {
      const totalHours = employee.timesheets.reduce((sum, ts) => sum + (ts.hours || 0), 0);
      const approvedHours = employee.timesheets
        .filter(ts => ts.status === 'APPROVED')
        .reduce((sum, ts) => sum + (ts.hours || 0), 0);
      const uniqueProjects = new Set(employee.timesheets.map(ts => ts.projectId));
      
      return {
        name: employee.name, // 修复字段名：使用name而不是employeeName
        totalHours,
        approvedHours,
        count: uniqueProjects.size, // 修复字段名：使用count而不是projectCount
      };
    })
    .filter(employee => employee.totalHours > 0) // 过滤掉没有工时的员工
    .sort((a, b) => b.totalHours - a.totalHours) // 按总工时降序排列
    .slice(0, 10); // 取前10个员工
    
    console.log('Processed project stats count:', processedProjectStats.length);
    console.log('Processed employee stats count:', processedEmployeeStats.length);
    
    const chartData = {
      projectStats: processedProjectStats,
      employeeStats: processedEmployeeStats,
    };
    
    console.log('Chart data summary:', {
      projectStatsCount: chartData.projectStats.length,
      employeeStatsCount: chartData.employeeStats.length,
    });
    
    // 添加详细的数据结构日志
    console.log('修复后的项目数据结构:', JSON.stringify(chartData.projectStats, null, 2));
    console.log('修复后的员工数据结构:', JSON.stringify(chartData.employeeStats, null, 2));
    
    // 设置no-cache头以强制浏览器获取最新数据
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json(chartData);
  } catch (error) {
    console.error('=== Admin Dashboard Charts Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 获取项目钻取详情数据
router.get('/project-drill/:projectName', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Dashboard Project Drill API Called ===');
  console.log('User:', req.user);
  console.log('Params:', req.params);
  console.log('Query params:', req.query);
  
  try {
    const { projectName } = req.params;
    const { month, startDate: startDateParam, endDate: endDateParam } = req.query;
    
    let startDate: Date;
    let endDate: Date;
    
    // 支持新的日期范围参数或向后兼容月份参数，如果都没有则返回所有数据
    let hasTimeFilter = false;
    
    if (startDateParam && endDateParam && typeof startDateParam === 'string' && typeof endDateParam === 'string') {
      // 使用新的日期范围参数
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      
      // 设置结束日期为当天的23:59:59
      endDate.setHours(23, 59, 59, 999);
      hasTimeFilter = true;
      
      console.log('Using date range parameters:', { startDate, endDate });
    } else if (month && typeof month === 'string') {
      // 向后兼容：使用月份参数
      const [year, monthNum] = month.split('-').map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      hasTimeFilter = true;
      
      console.log('Using month parameter:', { month, startDate, endDate });
    } else {
      // 没有时间参数时，返回所有数据
      console.log('No time parameters provided, fetching all project data');
      hasTimeFilter = false;
    }
    
    console.log('Fetching project drill data for:', { projectName, hasTimeFilter, startDate, endDate });
    
    // 查找项目详情
    const project = await prisma.project.findFirst({
      where: {
        name: decodeURIComponent(projectName),
      },
      include: {
          timesheets: {
            where: hasTimeFilter ? {
              date: {
                gte: startDate,
                lte: endDate,
              },
            } : {},
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeId: true,
              },
            },
            stage: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    console.log('Found project with timesheets count:', project.timesheets.length);
    
    // 按阶段分组统计
    const stageStats = new Map();
    const employeeStats = new Map();
    
    // 获取所有活跃阶段
    const allStages = await prisma.stage.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });
    
    // 初始化所有阶段
    allStages.forEach(stage => {
      stageStats.set(stage.id, {
        stageName: stage.name,
        totalHours: 0,
        approvedHours: 0,
        employeeCount: new Set(),
      });
    });
    
    // 添加"未分配阶段"类别
    stageStats.set('unassigned', {
      stageName: 'Unassigned Stage',
      totalHours: 0,
      approvedHours: 0,
      employeeCount: new Set(),
    });
    
    // 统计工时数据
    project.timesheets.forEach(timesheet => {
      const stageId = timesheet.stage?.id || 'unassigned';
      const employeeId = timesheet.employee.id;
      const hours = timesheet.hours || 0;
      
      // 阶段统计
      if (stageStats.has(stageId)) {
        const stageStat = stageStats.get(stageId);
        stageStat.totalHours += hours;
        if (timesheet.status === 'APPROVED') {
          stageStat.approvedHours += hours;
        }
        stageStat.employeeCount.add(employeeId);
      }
      
      // 员工统计
      if (!employeeStats.has(employeeId)) {
        employeeStats.set(employeeId, {
          employeeName: timesheet.employee.name,
          totalHours: 0,
          approvedHours: 0,
          stageCount: new Set(),
        });
      }
      
      const employeeStat = employeeStats.get(employeeId);
      employeeStat.totalHours += hours;
      if (timesheet.status === 'APPROVED') {
        employeeStat.approvedHours += hours;
      }
      employeeStat.stageCount.add(stageId);
    });
    
    // 转换为数组格式并过滤空数据
    const processedStageStats = Array.from(stageStats.values())
      .map(stat => ({
        ...stat,
        employeeCount: stat.employeeCount.size,
      }))
      .filter(stat => stat.totalHours > 0);
    
    const processedEmployeeStats = Array.from(employeeStats.values())
      .map(stat => ({
        ...stat,
        stageCount: stat.stageCount.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
    
    // 获取项目的全局第一条timesheet记录日期（不受日期范围限制）
    const globalFirstTimesheet = await prisma.timesheet.findFirst({
      where: {
        projectId: project.id,
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
      },
    });
    
    const globalFirstTimesheetDate = globalFirstTimesheet ? globalFirstTimesheet.date : null;
    
    // 获取当前日期范围内的第一条timesheet记录日期（用于其他统计）
    let firstTimesheetDate = null;
    if (project.timesheets.length > 0) {
      const sortedTimesheets = project.timesheets.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      firstTimesheetDate = sortedTimesheets[0].date;
    }
    
    console.log('Processed drill data:', {
      stageStatsCount: processedStageStats.length,
      employeeStatsCount: processedEmployeeStats.length,
      firstTimesheetDate,
      globalFirstTimesheetDate,
    });
    
    const drillData = {
      project: {
        id: project.id,
        name: project.name,
        projectCode: project.projectCode,
      },
      stageStats: processedStageStats,
      employeeStats: processedEmployeeStats,
      firstTimesheetDate, // 当前日期范围内的第一条timesheet日期
      globalFirstTimesheetDate, // 项目全局第一条timesheet日期
      month,
    };
    
    res.json(drillData);
  } catch (error) {
    console.error('=== Admin Dashboard Project Drill Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 获取员工详情数据 - 员工参与的项目和工时统计
router.get('/employee-drill/:employeeId', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Dashboard Employee Drill API Called ===');
  console.log('User:', req.user);
  console.log('Params:', req.params);
  console.log('Query params:', req.query);
  
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    
    console.log('Fetching employee drill data for:', { employeeId, startDate, endDate });
    
    // 构建日期过滤条件
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      };
    }
    
    console.log('Date filter:', dateFilter);
    
    // 获取员工信息
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
      },
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    console.log('Found employee:', employee);
    
    // 获取员工的工时记录
    const timesheets = await prisma.timesheet.findMany({
      where: {
        employeeId: employeeId,
        ...dateFilter,
      },
      orderBy: {
        date: 'asc',
      },
    });
    
    console.log('Found timesheets:', timesheets.length);
    
    // 获取所有相关项目信息
    const projectIds = [...new Set(timesheets.map(t => t.projectId))];
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
      },
      select: {
        id: true,
        name: true,
        projectCode: true,
      },
    });
    
    // 创建项目ID到项目信息的映射
    const projectMap = new Map(projects.map(p => [p.id, p]));
    
    // 按项目分组统计
    const projectStats = new Map();
    
    timesheets.forEach(timesheet => {
      const projectId = timesheet.projectId;
      const project = projectMap.get(projectId);
      
      if (!project) return; // 跳过找不到项目信息的记录
      
      const projectName = project.name;
      const projectCode = project.projectCode;
      
      if (!projectStats.has(projectId)) {
        projectStats.set(projectId, {
          projectId,
          projectName,
          projectCode,
          totalHours: 0,
          totalDays: new Set(),
          firstDate: timesheet.date,
          lastDate: timesheet.date,
        });
      }
      
      const stats = projectStats.get(projectId);
      stats.totalHours += timesheet.hours;
      stats.totalDays.add(timesheet.date.toISOString().split('T')[0]); // 按日期去重
      
      // 更新首次和最后工时日期
      if (timesheet.date < stats.firstDate) {
        stats.firstDate = timesheet.date;
      }
      if (timesheet.date > stats.lastDate) {
        stats.lastDate = timesheet.date;
      }
    });
    
    // 转换为数组并计算总天数
    const processedProjectStats = Array.from(projectStats.values()).map(stats => ({
      ...stats,
      totalDays: stats.totalDays.size, // 转换Set为数量
    }));
    
    console.log('Processed project stats:', processedProjectStats.length);
    
    // 计算总体统计
    const totalProjects = processedProjectStats.length;
    const totalHours = processedProjectStats.reduce((sum, project) => sum + project.totalHours, 0);
    const averageHoursPerProject = totalProjects > 0 ? totalHours / totalProjects : 0;
    
    const drillData = {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        position: employee.position,
      },
      projectStats: processedProjectStats,
      summary: {
        totalProjects,
        totalHours: Math.round(totalHours * 100) / 100, // 保留2位小数
        averageHoursPerProject: Math.round(averageHoursPerProject * 100) / 100,
        dateRange: startDate && endDate ? { startDate, endDate } : null,
      },
    };
    
    console.log('Employee drill data summary:', {
      employeeId: employee.id,
      employeeName: employee.name,
      totalProjects,
      totalHours: drillData.summary.totalHours,
    });
    
    res.json(drillData);
  } catch (error) {
    console.error('=== Admin Dashboard Employee Drill Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;