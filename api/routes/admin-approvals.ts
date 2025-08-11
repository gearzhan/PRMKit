import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel1Admin, requireLevel2Manager } from '../lib/jwt.js';

const router = Router();

// 获取待审批列表（管理员专用）
router.get('/pending', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Approvals Pending API Called ===');
  console.log('User:', req.user);
  console.log('Query params:', req.query);
  
  try {
    const {
      page = '1',
      limit = '20',
      projectId,
      submitterId,
      startDate,
      endDate,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('Parsed params:', { page, limit, projectId, submitterId, startDate, endDate, search, sortBy, sortOrder });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    console.log('Pagination:', { pageNum, limitNum, offset });

    // 构建查询条件
    const where: any = {
      status: 'PENDING',
    };

    if (projectId) {
      where.timesheet = {
        project: {
          id: projectId as string,
        },
      };
    }

    if (submitterId) {
      where.timesheet = {
        ...where.timesheet,
        employee: {
          id: submitterId as string,
        },
      };
    }

    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate as string);
      if (endDate) where.submittedAt.lte = new Date(endDate as string);
    }

    // 搜索功能
    if (search) {
      where.OR = [
        {
          timesheet: {
            employee: {
              name: {
                contains: search as string,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          timesheet: {
            project: {
              name: {
                contains: search as string,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    // 排序配置
    const orderBy: any = {};
    if (sortBy === 'submittedAt') {
      orderBy.submittedAt = sortOrder;
    } else if (sortBy === 'project') {
      orderBy.timesheet = {
        project: {
          name: sortOrder,
        },
      };
    } else if (sortBy === 'submitter') {
      orderBy.timesheet = {
        employee: {
          name: sortOrder,
        },
      };
    }

    console.log('Database query where condition:', JSON.stringify(where, null, 2));
    console.log('Database query orderBy:', JSON.stringify(orderBy, null, 2));
    
    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        include: {
          timesheet: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  employeeId: true,
                  email: true,
                },
              },
              project: {
                select: {
                  id: true,
                  name: true,
                  projectCode: true,
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
        orderBy,
        skip: offset,
        take: limitNum,
      }),
      prisma.approval.count({ where }),
    ]);
    
    console.log('Database query results:', { approvalsCount: approvals.length, total });
    console.log('Sample approval:', approvals[0] ? JSON.stringify(approvals[0], null, 2) : 'No approvals found');

    const response = {
      approvals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
    
    console.log('API Response structure:', {
      approvalsCount: response.approvals.length,
      pagination: response.pagination
    });
    
    res.json(response);
  } catch (error) {
    console.error('=== Admin Pending Approvals Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 获取审批历史（管理员专用）
router.get('/history', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Approvals History API Called ===');
  console.log('User:', req.user);
  console.log('Query params:', req.query);
  
  try {
    const {
      page = '1',
      limit = '20',
      status,
      projectId,
      submitterId,
      approverId,
      startDate,
      endDate,
      search,
      sortBy = 'approvedAt',
      sortOrder = 'desc'
    } = req.query;
    
    console.log('Parsed history params:', { page, limit, status, projectId, submitterId, approverId, startDate, endDate, search, sortBy, sortOrder });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    const where: any = {
      status: 'APPROVED',
    };

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (projectId) {
      where.timesheet = {
        project: {
          id: projectId as string,
        },
      };
    }

    if (submitterId) {
      where.timesheet = {
        ...where.timesheet,
        employee: {
          id: submitterId as string,
        },
      };
    }

    if (approverId) {
      where.approverId = approverId as string;
    }

    if (startDate || endDate) {
      where.approvedAt = {};
      if (startDate) where.approvedAt.gte = new Date(startDate as string);
      if (endDate) where.approvedAt.lte = new Date(endDate as string);
    }

    // 搜索功能
    if (search) {
      where.OR = [
        {
          timesheet: {
            employee: {
              name: {
                contains: search as string,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          timesheet: {
            project: {
              name: {
                contains: search as string,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          approver: {
            name: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // 排序配置
    const orderBy: any = {};
    if (sortBy === 'approvedAt') {
      orderBy.approvedAt = sortOrder;
    } else if (sortBy === 'submittedAt') {
      orderBy.submittedAt = sortOrder;
    } else if (sortBy === 'project') {
      orderBy.timesheet = {
        project: {
          name: sortOrder,
        },
      };
    } else if (sortBy === 'submitter') {
      orderBy.timesheet = {
        employee: {
          name: sortOrder,
        },
      };
    }

    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        include: {
          timesheet: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  employeeId: true,
                  email: true,
                },
              },
              project: {
                select: {
                  id: true,
                  name: true,
                  projectCode: true,
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
          approver: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: limitNum,
      }),
      prisma.approval.count({ where }),
    ]);

    const response = {
      approvals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
    
    console.log('History API Response:', {
      approvalsCount: response.approvals.length,
      pagination: response.pagination
    });
    
    res.json(response);
  } catch (error) {
    console.error('=== Admin Approval History Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 批量审批（管理员专用）
router.put('/batch-approve', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { approvalIds, comments } = req.body;

    if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({ error: 'Approval IDs are required' });
    }

    // 验证所有审批记录都存在且状态为PENDING
    const approvals = await prisma.approval.findMany({
      where: {
        id: { in: approvalIds },
        status: 'PENDING',
      },
      include: {
        timesheet: true,
      },
    });

    if (approvals.length !== approvalIds.length) {
      return res.status(400).json({ error: 'Some approvals not found or already processed' });
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
    console.error('Admin batch approve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 批量拒绝（管理员专用）
router.put('/batch-reject', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { approvalIds, comments } = req.body;

    if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({ error: 'Approval IDs are required' });
    }

    if (!comments || comments.trim() === '') {
      return res.status(400).json({ error: 'Comments are required for rejection' });
    }

    // 验证所有审批记录都存在且状态为PENDING
    const approvals = await prisma.approval.findMany({
      where: {
        id: { in: approvalIds },
        status: 'PENDING',
      },
      include: {
        timesheet: true,
      },
    });

    if (approvals.length !== approvalIds.length) {
      return res.status(400).json({ error: 'Some approvals not found or already processed' });
    }

    // 批量更新审批状态和工时状态
    const timesheetIds = approvals.map(approval => approval.timesheetId);

    await prisma.$transaction([
      // 删除审批记录（表示拒绝）
      prisma.approval.deleteMany({
        where: {
          id: { in: approvalIds },
          status: 'PENDING',
        },
      }),
      // 将工时表状态重置为草稿
      prisma.timesheet.updateMany({
        where: {
          id: { in: timesheetIds },
        },
        data: {
          status: 'DRAFT',
        },
      }),
    ]);

    res.json({
      message: `${approvals.length} timesheets rejected successfully`,
      rejectedCount: approvals.length,
    });
  } catch (error) {
    console.error('Admin batch reject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取审批统计（管理员专用）
router.get('/stats', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  console.log('=== Admin Approvals Stats API Called ===');
  console.log('User:', req.user);
  console.log('Query params:', req.query);
  
  try {
    const { startDate, endDate, projectId } = req.query;
    console.log('Stats params:', { startDate, endDate, projectId });

    const where: any = {};

    if (projectId) {
      where.timesheet = {
        projectId: projectId as string,
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

    // 获取待审批的审批记录及其关联的工时表
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        ...where,
        status: 'PENDING',
      },
      include: {
        timesheet: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
              },
            },
          },
        },
      },
    });

    // 按项目统计待审批数量
    const projectStatsMap = new Map<string, { project: any; count: number }>();
    pendingApprovals.forEach(approval => {
      const project = approval.timesheet.project;
      if (project) {
        const existing = projectStatsMap.get(project.id);
        if (existing) {
          existing.count++;
        } else {
          projectStatsMap.set(project.id, { project, count: 1 });
        }
      }
    });
    const projectStats = Array.from(projectStatsMap.values());

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

    const response = {
      statusStats,
      projectStats: projectStats.map(stat => ({
        project: stat.project,
        _count: { id: stat.count },
      })),
      approverStats: approverStats.map(stat => ({
        ...stat,
        approver: approvers.find(approver => approver.id === stat.approverId),
      })),
      averageApprovalTimeHours: Math.round(averageApprovalTime * 100) / 100,
      totalRecords: statusStats.reduce((sum, stat) => sum + stat._count.id, 0),
    };
    
    console.log('Stats API Response:', {
      statusStatsCount: response.statusStats.length,
      projectStatsCount: response.projectStats.length,
      approverStatsCount: response.approverStats.length,
      totalRecords: response.totalRecords
    });
    
    res.json(response);
  } catch (error) {
    console.error('=== Admin Approval Stats Error ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 获取审批详情（管理员专用）
router.get('/:id', authenticateToken, requireLevel2Manager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        timesheet: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeId: true,
                email: true,
                position: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
                description: true,
              },
            },
            stage: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
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
    });

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(approval);
  } catch (error) {
    console.error('Get admin approval detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;