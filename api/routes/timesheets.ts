import { Router, Response } from 'express';
import prisma, { calculateHours, validateTimesheet } from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel1Admin, isLevel3Worker } from '../lib/jwt.js';
import { TimesheetStatus } from '@prisma/client';

const router = Router();

// 创建工时记录
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      projectId,
      stageId,
      date,
      startTime,
      endTime,
      description,
    } = req.body;
    
    // 验证必填字段
    if (!projectId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Project ID, date, start time, and end time are required' });
    }
    
    // 验证工时
    const validation = validateTimesheet(startTime, endTime, date);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // 计算工时
    const hours = calculateHours(startTime, endTime);
    
    // 检查项目是否存在（项目对全公司共享，不区分权限）
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 检查阶段是否属于该项目
    if (stageId) {
      const stage = await prisma.stage.findUnique({
        where: {
          id: stageId,
        },
      });
      
      if (!stage) {
        return res.status(404).json({ error: 'Stage not found or does not belong to the project' });
      }
    }
    
    // 移除了7.6小时的每日工时限制检查
    
    // 创建完整的DateTime对象
    const workDate = new Date(date);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startDateTime = new Date(workDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    const endDateTime = new Date(workDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);
    
    // 创建工时记录
    const timesheetData: any = {
      employeeId: req.user!.userId,
      projectId,
      date: workDate,
      startTime: startDateTime,
      endTime: endDateTime,
      hours,
      description,
      status: 'DRAFT',
    };
    
    // 只有当stageId存在且不为空时才添加到数据中
    if (stageId) {
      timesheetData.stageId = stageId;
    }
    
    const timesheet = await prisma.timesheet.create({
      data: timesheetData,
      include: {
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
        employee: {
          select: {
            name: true,
            employeeId: true,
          },
        },
      },
    });
    
    res.status(201).json({
      message: 'Timesheet created successfully',
      timesheet,
    });
  } catch (error) {
    console.error('Create timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取工时记录列表
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      projectId,
      status,
      startDate,
      endDate,
      employeeId,
      search,
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const where: any = {};
    
    // 权限控制：Level 3员工只能查看自己的工时
    if (isLevel3Worker(req.user!.role)) {
      where.employeeId = req.user!.userId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    
    // 搜索功能：支持按项目名称、项目代码、描述搜索
    if (search) {
      where.OR = [
        {
          project: {
            name: {
              contains: search as string,
            },
          },
        },
        {
          project: {
            projectCode: {
              contains: search as string,
            },
          },
        },
        {
          description: {
            contains: search as string,
          },
        },
      ];
    }
    
    // 获取工时记录
    const [timesheets, total] = await Promise.all([
      prisma.timesheet.findMany({
        where,
        include: {
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
          employee: {
            select: {
              name: true,
              employeeId: true,
            },
          },
          approval: {
            select: {
              status: true,
              approvedAt: true,
              approver: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.timesheet.count({ where }),
    ]);
    
    res.json({
      timesheets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get timesheets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个工时记录
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const where: any = { id };
    
    // 权限控制：Level 3 员工只能查看自己的工时
    if (isLevel3Worker(req.user!.role)) {
      where.employeeId = req.user!.userId;
    }
    
    const timesheet = await prisma.timesheet.findFirst({
      where,
      include: {
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
        employee: {
          select: {
            name: true,
            employeeId: true,
          },
        },
        approval: {
          include: {
            approver: {
              select: {
                name: true,
                employeeId: true,
              },
            },
          },
        },
      },
    });
    
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }
    
    res.json({ timesheet });
  } catch (error) {
    console.error('Get timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新工时记录
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      projectId,
      stageId,
      date,
      startTime,
      endTime,
      description,
    } = req.body;
    
    // 查找工时记录
    const existingTimesheet = await prisma.timesheet.findFirst({
      where: {
        id,
        employeeId: req.user!.userId, // 只能修改自己的工时
      },
    });
    
    if (!existingTimesheet) {
      return res.status(404).json({ error: 'Timesheet not found or access denied' });
    }
    
    // 只有草稿状态的工时可以修改
    if (existingTimesheet.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only draft timesheets can be modified' });
    }
    
    // 验证工时（如果提供了时间）
    let hours = Number(existingTimesheet.hours);
    if (startTime && endTime && date) {
      const validation = validateTimesheet(startTime, endTime, date);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }
      hours = calculateHours(startTime, endTime);
    }
    
    // 处理时间字段
    let updateData: any = {
      projectId: projectId || existingTimesheet.projectId,
      hours,
      description: description !== undefined ? description : existingTimesheet.description,
    };
    
    // 只有当stageId存在且不为空时才添加到更新数据中
    const finalStageId = stageId !== undefined ? stageId : existingTimesheet.stageId;
    if (finalStageId) {
      updateData.stageId = finalStageId;
    }
    
    // 处理日期和时间
    if (date) {
      updateData.date = new Date(date);
    }
    
    if (startTime && date) {
      const workDate = new Date(date);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const startDateTime = new Date(workDate);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      updateData.startTime = startDateTime;
    }
    
    if (endTime && date) {
      const workDate = new Date(date);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const endDateTime = new Date(workDate);
      endDateTime.setHours(endHour, endMinute, 0, 0);
      updateData.endTime = endDateTime;
    }
    
    // 更新工时记录
    const updatedTimesheet = await prisma.timesheet.update({
      where: { id },
      data: updateData,
      include: {
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
    });
    
    res.json({
      message: 'Timesheet updated successfully',
      timesheet: updatedTimesheet,
    });
  } catch (error) {
    console.error('Update timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 提交工时记录
router.put('/:id/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 查找工时记录
    const timesheet = await prisma.timesheet.findFirst({
      where: {
        id,
        employeeId: req.user!.userId,
      },
    });
    
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found or access denied' });
    }
    
    if (timesheet.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only draft timesheets can be submitted' });
    }
    
    // 更新状态并创建审批记录
    const [updatedTimesheet] = await prisma.$transaction([
      prisma.timesheet.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      }),
      prisma.approval.create({
        data: {
          timesheetId: id,
          submitterId: req.user!.userId,
          status: 'PENDING',
        },
      }),
    ]);
    
    res.json({
      message: 'Timesheet submitted successfully',
      timesheet: updatedTimesheet,
    });
  } catch (error) {
    console.error('Submit timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 撤回工时记录
router.put('/:id/withdraw', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 查找工时记录
    const timesheet = await prisma.timesheet.findFirst({
      where: {
        id,
        employeeId: req.user!.userId,
      },
      include: {
        approval: true,
      },
    });
    
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found or access denied' });
    }
    
    if (timesheet.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only submitted timesheets can be withdrawn' });
    }
    
    if (timesheet.approval && timesheet.approval.status === 'APPROVED') {
      return res.status(400).json({ error: 'Approved timesheets cannot be withdrawn' });
    }
    
    // 更新状态为DRAFT并删除审批记录
    await prisma.$transaction([
      prisma.timesheet.update({
        where: { id },
        data: { status: 'DRAFT' },
      }),
      ...(timesheet.approval ? [
        prisma.approval.delete({
          where: { id: timesheet.approval.id },
        })
      ] : []),
    ]);
    
    res.json({ message: 'Timesheet withdrawn successfully' });
  } catch (error) {
    console.error('Withdraw timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除工时记录
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 查找工时记录
    const timesheet = await prisma.timesheet.findFirst({
      where: {
        id,
        employeeId: req.user!.userId,
      },
    });
    
    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found or access denied' });
    }
    
    // 只有草稿状态的工时可以删除
    if (timesheet.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only draft timesheets can be deleted' });
    }
    
    await prisma.timesheet.delete({
      where: { id },
    });
    
    res.json({ message: 'Timesheet deleted successfully' });
  } catch (error) {
    console.error('Delete timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取工时统计
router.get('/stats/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    
    const where: any = {};
    
    // 权限控制
    if (isLevel3Worker(req.user!.role)) {
      where.employeeId = req.user!.userId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }
    
    // 仅根据筛选条件统计（无 WITHDRAWN 状态）
    
    const stats = await prisma.timesheet.groupBy({
      by: ['status'],
      where,
      _sum: {
        hours: true,
      },
      _count: {
        id: true,
      },
    });
    
    const totalHours = await prisma.timesheet.aggregate({
      where,
      _sum: {
        hours: true,
      },
    });
    
    res.json({
      stats,
      totalHours: totalHours._sum.hours ? Number(totalHours._sum.hours) : 0,
    });
  } catch (error) {
    console.error('Get timesheet stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;