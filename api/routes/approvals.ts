import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel2Manager, isLevel3Worker } from '../lib/jwt.js';
import { ApprovalStatus } from '@prisma/client';

const router = Router();

// 获取待审批列表（Level 1管理员和Level 2经理）
router.get('/pending', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = '1', limit = '10', projectId, submitterId } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const where: any = {
      status: 'PENDING',
    };
    
    if (projectId) {
      where.timesheet = {
        projectId,
      };
    }
    
    if (submitterId) {
      where.submitterId = submitterId;
    }
    
    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        include: {
          timesheet: {
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
          },
          submitter: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'asc', // 按提交时间升序，优先处理早提交的
        },
        skip,
        take: limitNum,
      }),
      prisma.approval.count({ where }),
    ]);
    
    res.json({
      approvals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取审批历史
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '10',
      status,
      projectId,
      submitterId,
      approverId,
      startDate,
      endDate,
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const where: any = {};
    
    // 权限控制：Level 3员工只能查看自己提交的审批记录
    if (isLevel3Worker(req.user!.role)) {
      where.submitterId = req.user!.userId;
    } else {
      if (submitterId) where.submitterId = submitterId;
      if (approverId) where.approverId = approverId;
    }
    
    if (status) where.status = status;
    
    if (projectId) {
      where.timesheet = {
        projectId,
      };
    }
    
    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate as string);
      if (endDate) where.submittedAt.lte = new Date(endDate as string);
    }
    
    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        include: {
          timesheet: {
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
          },
          submitter: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.approval.count({ where }),
    ]);
    
    res.json({
      approvals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get approval history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个审批详情
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const where: any = { id };
    
    // 权限控制：Level 3员工只能查看自己提交的审批记录
    if (isLevel3Worker(req.user!.role)) {
      where.submitterId = req.user!.userId;
    }
    
    const approval = await prisma.approval.findFirst({
      where,
      include: {
        timesheet: {
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
        },
        submitter: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            position: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            position: true,
          },
        },
      },
    });
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found or access denied' });
    }
    
    res.json({ approval });
  } catch (error) {
    console.error('Get approval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 审批工时记录（Level 1管理员和Level 2经理）
router.put('/:id/approve', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    
    // 查找审批记录
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        timesheet: true,
      },
    });
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    
    if (approval.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending approvals can be processed' });
    }
    
    // 更新审批状态和工时状态
    const [updatedApproval] = await prisma.$transaction([
      prisma.approval.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approverId: req.user!.userId,
          approvedAt: new Date(),
          comments,
        },
        include: {
          timesheet: {
            include: {
              project: {
                select: {
                  name: true,
                  projectCode: true,
                },
              },
              employee: {
                select: {
                  name: true,
                  employeeId: true,
                },
              },
            },
          },
          approver: {
            select: {
              name: true,
              employeeId: true,
            },
          },
        },
      }),
      prisma.timesheet.update({
        where: { id: approval.timesheetId },
        data: { status: 'APPROVED' },
      }),
    ]);
    
    res.json({
      message: 'Timesheet approved successfully',
      approval: updatedApproval,
    });
  } catch (error) {
    console.error('Approve timesheet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 批量审批工时记录（Level 1管理员和Level 2经理）
router.put('/batch/approve', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { approvalIds, comments } = req.body;
    
    if (!approvalIds || !Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({ error: 'Approval IDs array is required' });
    }
    
    // 查找所有待审批记录
    const approvals = await prisma.approval.findMany({
      where: {
        id: { in: approvalIds },
        status: 'PENDING',
      },
      include: {
        timesheet: true,
      },
    });
    
    if (approvals.length === 0) {
      return res.status(404).json({ error: 'No pending approvals found' });
    }
    
    // 批量更新审批状态和工时状态
    const timesheetIds = approvals.map(approval => approval.timesheetId);
    
    await prisma.$transaction([
      prisma.approval.updateMany({
        where: {
          id: { in: approvalIds },
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          approverId: req.user!.userId,
          approvedAt: new Date(),
          comments,
        },
      }),
      prisma.timesheet.updateMany({
        where: {
          id: { in: timesheetIds },
        },
        data: {
          status: 'APPROVED',
        },
      }),
    ]);
    
    res.json({
      message: `${approvals.length} timesheets approved successfully`,
      approvedCount: approvals.length,
    });
  } catch (error) {
    console.error('Batch approve timesheets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取审批统计
router.get('/stats/summary', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, projectId } = req.query;
    
    const where: any = {};
    
    if (projectId) {
      where.timesheet = {
        projectId,
      };
    }
    
    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate as string);
      if (endDate) where.submittedAt.lte = new Date(endDate as string);
    }
    
    // 按状态统计
    const statusStats = await prisma.approval.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });
    
    // 按审批人统计（已审批的）
    const approverStats = await prisma.approval.groupBy({
      by: ['approverId'],
      where: {
        ...where,
        status: 'APPROVED',
        approverId: { not: null },
      },
      _count: {
        id: true,
      },
    });
    
    // 获取审批人详细信息
    const approverIds = approverStats.map(stat => stat.approverId).filter(Boolean) as string[];
    const approvers = await prisma.employee.findMany({
      where: {
        id: { in: approverIds },
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
      },
    });
    
    // 合并审批人信息
    const approverStatsWithNames = approverStats.map(stat => ({
      ...stat,
      approver: approvers.find(approver => approver.id === stat.approverId),
    }));
    
    // 平均审批时间（已审批的记录）
    const approvedRecords = await prisma.approval.findMany({
      where: {
        ...where,
        status: 'APPROVED',
        approvedAt: { not: null },
      },
      select: {
        submittedAt: true,
        approvedAt: true,
      },
    });
    
    let averageApprovalTime = 0;
    if (approvedRecords.length > 0) {
      const totalTime = approvedRecords.reduce((sum, record) => {
        const timeDiff = record.approvedAt!.getTime() - record.submittedAt.getTime();
        return sum + timeDiff;
      }, 0);
      averageApprovalTime = totalTime / approvedRecords.length / (1000 * 60 * 60); // 转换为小时
    }
    
    res.json({
      statusStats,
      approverStats: approverStatsWithNames,
      averageApprovalTimeHours: Math.round(averageApprovalTime * 100) / 100,
      totalRecords: statusStats.reduce((sum, stat) => sum + stat._count.id, 0),
    });
  } catch (error) {
    console.error('Get approval stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取我的审批工作量（Level 1管理员和Level 2经理）
router.get('/my/workload', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {
      approverId: req.user!.userId,
    };
    
    if (startDate || endDate) {
      where.approvedAt = {};
      if (startDate) where.approvedAt.gte = new Date(startDate as string);
      if (endDate) where.approvedAt.lte = new Date(endDate as string);
    }
    
    const [approvedCount, pendingCount] = await Promise.all([
      prisma.approval.count({
        where: {
          ...where,
          status: 'APPROVED',
        },
      }),
      prisma.approval.count({
        where: {
          status: 'PENDING',
        },
      }),
    ]);
    
    // 按日期统计审批数量
    const dailyStats = await prisma.approval.findMany({
      where: {
        ...where,
        status: 'APPROVED',
      },
      select: {
        approvedAt: true,
      },
    });
    
    // 按日期分组
    const dailyStatsMap = new Map<string, number>();
    dailyStats.forEach(record => {
      if (record.approvedAt) {
        const date = record.approvedAt.toISOString().split('T')[0];
        dailyStatsMap.set(date, (dailyStatsMap.get(date) || 0) + 1);
      }
    });
    
    const dailyStatsArray = Array.from(dailyStatsMap.entries()).map(([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    res.json({
      approvedCount,
      pendingCount,
      dailyStats: dailyStatsArray,
    });
  } catch (error) {
    console.error('Get my approval workload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;