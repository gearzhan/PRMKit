import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel1Admin, isLevel3Worker } from '../lib/jwt.js';
import * as XLSX from 'xlsx';

const router = Router();

// 获取工时报表数据
router.get('/timesheets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      projectId,
      employeeId,
      groupBy = 'employee', // employee, project, date
      includeDetails = 'false',
    } = req.query;
    
    // 构建查询条件
    const where: any = {};
    
    // 权限控制：Level 3员工只能查看自己的数据
    if (isLevel3Worker(req.user!.role)) {
      where.employeeId = req.user!.userId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (projectId) where.projectId = projectId;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    
    let reportData;
    
    if (groupBy === 'employee') {
      // 按员工分组统计
      reportData = await prisma.timesheet.groupBy({
        by: ['employeeId'],
        where,
        _sum: {
          hours: true,
        },
        _count: {
          id: true,
        },
      });
      
      // 获取员工信息
      const employeeIds = reportData.map(item => item.employeeId);
      const employees = await prisma.employee.findMany({
        where: {
          id: { in: employeeIds },
        },
        select: {
          id: true,
          name: true,
          employeeId: true,
        },
      });
      
      reportData = reportData.map(item => ({
        ...item,
        employee: employees.find(emp => emp.id === item.employeeId),
        totalHours: item._sum.hours ? Number(item._sum.hours) : 0,
        totalRecords: item._count.id,
      }));
    } else if (groupBy === 'project') {
      // 按项目分组统计
      reportData = await prisma.timesheet.groupBy({
        by: ['projectId'],
        where,
        _sum: {
          hours: true,
        },
        _count: {
          id: true,
        },
      });
      
      // 获取项目信息
      const projectIds = reportData.map(item => item.projectId);
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
      
      reportData = reportData.map(item => ({
        ...item,
        project: projects.find(proj => proj.id === item.projectId),
        totalHours: item._sum.hours ? Number(item._sum.hours) : 0,
        totalRecords: item._count.id,
      }));
    } else if (groupBy === 'date') {
      // 按日期分组统计
      reportData = await prisma.timesheet.groupBy({
        by: ['date'],
        where,
        _sum: {
          hours: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          date: 'asc',
        },
      });
      
      reportData = reportData.map(item => ({
        ...item,
        totalHours: item._sum.hours ? Number(item._sum.hours) : 0,
        totalRecords: item._count.id,
      }));
    }
    
    // 如果需要详细数据
    let details = null;
    if (includeDetails === 'true') {
      details = await prisma.timesheet.findMany({
        where,
        include: {
          employee: {
            select: {
              name: true,
              employeeId: true,
            },
          },
          project: {
            select: {
              name: true,
              projectCode: true,
            },
          },
          stage: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
    }
    
    // 计算总计
    const totalStats = await prisma.timesheet.aggregate({
      where,
      _sum: {
        hours: true,
      },
      _count: {
        id: true,
      },
    });
    
    res.json({
      reportData,
      details,
      summary: {
        totalHours: totalStats._sum.hours ? Number(totalStats._sum.hours) : 0,
        totalRecords: totalStats._count.id,
        groupBy,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    console.error('Get timesheet report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取项目进度报表
router.get('/project-progress', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    
    const where: any = {};
    if (projectId) where.id = projectId;
    
    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    // 为每个项目计算进度数据
    const projectProgress = await Promise.all(
      projects.map(async (project) => {
        // 获取项目总工时
        const totalHours = await prisma.timesheet.aggregate({
          where: {
            projectId: project.id,
          },
          _sum: {
            hours: true,
          },
        });
        
        // 获取已审批工时
        const approvedHours = await prisma.timesheet.aggregate({
          where: {
            projectId: project.id,
            status: 'APPROVED',
          },
          _sum: {
            hours: true,
          },
        });
        

        
        // 计算时间进度
        const now = new Date();
        const totalDuration = project.endDate
          ? project.endDate.getTime() - project.startDate.getTime()
          : null;
        const elapsedDuration = now.getTime() - project.startDate.getTime();
        const timeProgress = totalDuration
          ? Math.min((elapsedDuration / totalDuration) * 100, 100)
          : 0;
        
        return {
          project: {
            id: project.id,
            name: project.name,
            projectCode: project.projectCode,
            status: project.status,
            startDate: project.startDate,
            endDate: project.endDate,

          },
          hours: {
            total: totalHours._sum.hours ? Number(totalHours._sum.hours) : 0,
          approved: approvedHours._sum.hours ? Number(approvedHours._sum.hours) : 0,
          },

          progress: {
            timePercentage: Math.round(timeProgress * 100) / 100,
            stagesCompleted: 0,
            totalStages: 0,
          },
        };
      })
    );
    
    res.json({ projectProgress });
  } catch (error) {
    console.error('Get project progress report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取员工绩效报表
router.get('/employee-performance', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, departmentFilter } = req.query;
    
    const where: any = {};
    if (departmentFilter) where.department = departmentFilter;
    
    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        employeeId: true,
        position: true,
      },
    });
    
    const performanceData = await Promise.all(
      employees.map(async (employee) => {
        const timesheetWhere: any = {
          employeeId: employee.id,
        };
        
        if (startDate || endDate) {
          timesheetWhere.date = {};
          if (startDate) timesheetWhere.date.gte = new Date(startDate as string);
          if (endDate) timesheetWhere.date.lte = new Date(endDate as string);
        }
        
        // 获取工时统计
        const [totalHours, approvedHours, timesheetCount] = await Promise.all([
          prisma.timesheet.aggregate({
            where: timesheetWhere,
            _sum: { hours: true },
          }),
          prisma.timesheet.aggregate({
            where: { ...timesheetWhere, status: 'APPROVED' },
            _sum: { hours: true },
          }),
          prisma.timesheet.count({ where: timesheetWhere }),
        ]);
        
        // 获取项目参与数量
        const projectCount = 0;
        
        // 计算审批通过率
        const approvalRate = totalHours._sum.hours && approvedHours._sum.hours
          ? (Number(approvedHours._sum.hours) / Number(totalHours._sum.hours)) * 100
          : 0;
        
        return {
          employee,
          performance: {
            totalHours: totalHours._sum.hours ? Number(totalHours._sum.hours) : 0,
        approvedHours: approvedHours._sum.hours ? Number(approvedHours._sum.hours) : 0,
            timesheetCount,

            approvalRate: Math.round(approvalRate * 100) / 100,
            averageHoursPerDay: timesheetCount > 0
              ? Math.round(((totalHours._sum.hours ? Number(totalHours._sum.hours) : 0) / timesheetCount) * 100) / 100
              : 0,
          },
        };
      })
    );
    
    res.json({ performanceData });
  } catch (error) {
    console.error('Get employee performance report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 导出工时报表为Excel
router.get('/export/timesheets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      projectId,
      employeeId,
      format = 'xlsx',
    } = req.query;
    
    // 构建查询条件
    const where: any = {};
    
    // 权限控制：Level 3员工只能导出自己的数据
    if (isLevel3Worker(req.user!.role)) {
      where.employeeId = req.user!.userId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (projectId) where.projectId = projectId;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    
    // 获取数据
    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        employee: {
          select: {
            name: true,
            employeeId: true,
          },
        },
        project: {
          select: {
            name: true,
            projectCode: true,
          },
        },
        stage: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
    
    // 准备Excel数据
    const excelData = timesheets.map(timesheet => ({
      'Employee ID': timesheet.employee.employeeId,
      'Employee Name': timesheet.employee.name,
      'Project Code': timesheet.project.projectCode,
      'Project Name': timesheet.project.name,
      'Stage': timesheet.stage?.name || 'N/A',
      'Date': timesheet.date.toISOString().split('T')[0],
      'Start Time': timesheet.startTime,
      'End Time': timesheet.endTime,
      'Hours': Number(timesheet.hours),
      'Description': timesheet.description || '',
      'Status': timesheet.status,
      'Created At': timesheet.createdAt.toISOString(),
    }));
    
    if (format === 'csv') {
      // 导出CSV格式
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="timesheets_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // 导出Excel格式
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheets');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="timesheets_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(buffer);
    }
  } catch (error) {
    console.error('Export timesheets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取仪表板统计数据
router.get('/dashboard/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate: startDateParam, endDate: endDateParam, period = '30' } = req.query;
    
    let startDate: Date;
    let endDate: Date;
    
    // 如果提供了startDate和endDate参数，使用这些参数
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam as string);
      endDate = new Date(endDateParam as string);
    } else {
      // 否则使用period参数（默认30天）
      const days = parseInt(period as string);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      endDate = new Date();
    }
    
    const where: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };
    
    // 权限控制：Level 3员工只能查看自己的数据
    if (isLevel3Worker(req.user!.role)) {
      where.employeeId = req.user!.userId;
    }
    
    const [totalHours, totalTimesheets, pendingApprovals, activeProjects] = await Promise.all([
      // 总工时
      prisma.timesheet.aggregate({
        where,
        _sum: { hours: true },
      }),
      // 工时记录数
      prisma.timesheet.count({ where }),
      // 待审批数量（Level 1和Level 2可见）
      !isLevel3Worker(req.user!.role)
        ? prisma.approval.count({
            where: { status: 'PENDING' },
          })
        : 0,
      // 活跃项目数
      prisma.project.count({
        where: { status: 'ACTIVE' },
      }),
    ]);
    
    // 按日期统计工时趋势
    const dailyHours = await prisma.timesheet.groupBy({
      by: ['date'],
      where,
      _sum: { hours: true },
      orderBy: { date: 'asc' },
    });
    
    const hoursTrend = dailyHours.map(item => ({
      date: item.date.toISOString().split('T')[0],
      hours: item._sum.hours ? Number(item._sum.hours) : 0,
    }));
    
    // 按项目统计工时分布
    const projectHours = await prisma.timesheet.groupBy({
      by: ['projectId'],
      where,
      _sum: { hours: true },
      orderBy: { _sum: { hours: 'desc' } },
      take: 5, // 取前5个项目
    });
    
    // 获取项目信息
    const projectIds = projectHours.map(item => item.projectId);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, projectCode: true },
    });
    
    const projectDistribution = projectHours.map(item => ({
      project: projects.find(p => p.id === item.projectId),
      hours: item._sum.hours ? Number(item._sum.hours) : 0,
    }));
    
    // 计算实际的天数差
    const actualDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    res.json({
      stats: {
        totalHours: totalHours._sum.hours ? Number(totalHours._sum.hours) : 0,
        totalTimesheets,
        pendingApprovals,
        activeProjects,
        dailyTrends: hoursTrend,
        projectDistribution: projectDistribution.map(item => ({
          projectName: item.project?.name || 'Unknown Project',
          hours: item.hours,
        })),
      },
      period: actualDays,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;