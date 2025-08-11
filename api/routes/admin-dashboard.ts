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
    const { month } = req.query;
    
    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month parameter is required (format: YYYY-MM)' });
    }
    
    console.log('Fetching project drill data for:', { projectName, month });
    
    // 解析月份参数
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    
    // 查找项目详情
    const project = await prisma.project.findFirst({
      where: {
        name: decodeURIComponent(projectName),
      },
      include: {
          timesheets: {
            where: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
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
    
    console.log('Processed drill data:', {
      stageStatsCount: processedStageStats.length,
      employeeStatsCount: processedEmployeeStats.length,
    });
    
    const drillData = {
      project: {
        id: project.id,
        name: project.name,
        projectCode: project.projectCode,
      },
      stageStats: processedStageStats,
      employeeStats: processedEmployeeStats,
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

export default router;