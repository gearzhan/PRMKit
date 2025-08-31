import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel1Admin, isLevel1Admin, isLevel3Worker } from '../lib/jwt.js';
import { ProjectStatus } from '@prisma/client';

const router = Router();

// 获取项目列表
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit, status, search, sortBy = 'projectCode', sortOrder = 'desc' } = req.query;
    
    // 如果没有提供page和limit参数，则不应用分页
    const shouldPaginate = page !== undefined && limit !== undefined;
    const pageNum = shouldPaginate ? parseInt(page as string) : 1;
    const limitNum = shouldPaginate ? parseInt(limit as string) : undefined;
    const skip = shouldPaginate ? (pageNum - 1) * limitNum : 0;
    
    // 构建查询条件
    const where: any = {};
    
    // 项目和阶段对全公司共享，不区分权限
    // 移除了Level 3员工的权限限制
    
    if (status) where.status = status;
    
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { projectCode: { contains: search as string } },
        { description: { contains: search as string } },
        { nickname: { contains: search as string } },
      ];
    }
    
    // 构建排序条件
    let orderBy: any = {};
    const sortField = sortBy as string;
    const sortDirection = sortOrder as string;
    
    // 支持的排序字段映射
    const sortFieldMap: { [key: string]: string } = {
      'projectCode': 'projectCode',
      'name': 'name', 
      'nickname': 'nickname',
      'status': 'status',
      'startDate': 'startDate',
      'endDate': 'endDate',
      'timesheets': 'timesheets' // 特殊处理
    };
    
    if (sortField === 'timesheets') {
      // 对于timesheets计数排序，需要特殊处理
      orderBy = {
        timesheets: {
          _count: sortDirection === 'asc' ? 'asc' : 'desc'
        }
      };
    } else if (sortFieldMap[sortField]) {
      orderBy[sortFieldMap[sortField]] = sortDirection === 'asc' ? 'asc' : 'desc';
    } else {
      // 默认排序
      orderBy = { projectCode: 'desc' };
    }
    
    // 构建查询选项
    const queryOptions: any = {
      where,
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
      orderBy,
    };
    
    // 只在需要分页时添加skip和take
    if (shouldPaginate) {
      queryOptions.skip = skip;
      queryOptions.take = limitNum;
    }
    
    const [projects, total] = await Promise.all([
      prisma.project.findMany(queryOptions),
      prisma.project.count({ where }),
    ]);
    
    res.json({
      projects,
      pagination: {
        page: pageNum,
        limit: shouldPaginate ? limitNum : total,
        total,
        pages: shouldPaginate ? Math.ceil(total / limitNum!) : 1,
      },
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个项目详情
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 项目详情对全公司共享，不区分权限
    // 移除了Level 3员工的权限限制
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }
    
    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 创建项目（Level 1管理员）
router.post('/', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      projectCode,
      name,
      description,
      nickname,
      startDate,
      endDate,

    } = req.body;
    
    // 验证必填字段
    if (!projectCode || !name || !startDate) {
      return res.status(400).json({ error: 'Project code, name, and start date are required' });
    }
    
    // 检查项目编码是否已存在
    const existingProject = await prisma.project.findUnique({
      where: { projectCode },
    });
    
    if (existingProject) {
      return res.status(409).json({ error: 'Project code already exists' });
    }
    
    // 创建项目
    const project = await prisma.project.create({
      data: {
        projectCode,
        name,
        description,
        nickname,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,

        status: 'ACTIVE',
      },
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新项目（Level 1管理员）
router.put('/:id', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      nickname,
      startDate,
      endDate,
      status,

    } = req.body;
    
    // 构建更新数据
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (status) updateData.status = status as ProjectStatus;

    
    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    res.json({
      message: 'Project updated successfully',
      project,
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// 获取项目阶段
router.get('/:id/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    
    // 项目阶段对全公司共享，不区分权限
    // 移除了Level 3员工的权限限制
    
    // Stage模型已更改为通用任务类型，不再与项目直接关联
    const stages = await prisma.stage.findMany({
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    res.json({ stages });
  } catch (error) {
    console.error('Get project stages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 创建项目阶段（Level 1管理员）
router.post('/:id/stages', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const {
      name,
      description,
      startDate,
      endDate,

    } = req.body;
    
    // 验证必填字段
    if (!name || !startDate) {
      return res.status(400).json({ error: 'Stage name and start date are required' });
    }
    
    // 检查项目是否存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Stage模型已更改，不再支持项目特定阶段创建
    return res.status(400).json({ error: 'Stage creation has been moved to general stage management' });
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新项目阶段（Level 1管理员）
router.put('/:id/stages/:stageId', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: projectId, stageId } = req.params;
    const {
      name,
      description,
      startDate,
      endDate,
      status,

    } = req.body;
    
    // 检查阶段是否存在
    const existingStage = await prisma.stage.findUnique({
      where: {
        id: stageId,
      },
    });

    if (!existingStage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    
    // 构建更新数据
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    
    const stage = await prisma.stage.update({
      where: { id: stageId },
      data: updateData,
    });
    
    res.json({
      message: 'Stage updated successfully',
      stage,
    });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新项目（管理员和经理）
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 只有Level 1管理员可以更新项目
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { id } = req.params;
    const {
      name,
      description,
      projectCode,
      startDate,
      endDate,
      budget,
      status,
      clientName,
      clientContact,
    } = req.body;
    
    // 检查项目是否存在
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });
    
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 如果更新项目代码，检查是否已存在
    if (projectCode && projectCode !== existingProject.projectCode) {
      const codeExists = await prisma.project.findUnique({
        where: { projectCode },
      });
      if (codeExists) {
        return res.status(400).json({ error: 'Project code already exists' });
      }
    }
    
    // 构建更新数据
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (projectCode) updateData.projectCode = projectCode;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    if (status) updateData.status = status as ProjectStatus;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientContact !== undefined) updateData.clientContact = clientContact;
    
    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    res.json({
      message: 'Project updated successfully',
      project,
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除项目（仅管理员）
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 只有Level 1管理员可以删除项目
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Only Level 1 administrators can delete projects' });
    }
    
    const { id } = req.params;
    
    // 检查项目是否存在
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 删除项目（级联删除相关数据）
    await prisma.project.delete({
      where: { id },
    });
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有阶段（管理员专用）
router.get('/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 只有Level 1管理员可以查看所有阶段
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { search, category } = req.query;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    if (category) where.category = category;
    
    const stages = await prisma.stage.findMany({
      where,
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    res.json({ stages });
  } catch (error) {
    console.error('Get all stages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 创建阶段（管理员专用，不限制项目）
router.post('/stages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 只有 Level 1 管理员可以创建阶段
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const {
      taskId,
      name,
      description,
      category,
    } = req.body;

    // 验证必填字段
    if (!taskId || !name || !category) {
      return res.status(400).json({ error: 'Task ID, stage name and category are required' });
    }

    // 创建阶段
    const stage = await prisma.stage.create({
      data: {
        taskId,
        name,
        description,
        category,
      },
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    res.status(201).json({
      message: 'Stage created successfully',
      stage,
    });
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新阶段（管理员专用）
router.put('/stages/:stageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 只有 Level 1 管理员可以更新阶段
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { stageId } = req.params;
    const {
      name,
      description,
      startDate,
      endDate,
      status,
      budget,
    } = req.body;
    
    // 检查阶段是否存在
    const existingStage = await prisma.stage.findUnique({
      where: { id: stageId },
    });
    
    if (!existingStage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    
    // 构建更新数据
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    const stage = await prisma.stage.update({
      where: { id: stageId },
      data: updateData,
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    res.json({
      message: 'Stage updated successfully',
      stage,
    });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除阶段（仅管理员）
router.delete('/stages/:stageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 只有 Level 1 管理员可以删除阶段
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Only administrators can delete stages' });
    }
    
    const { stageId } = req.params;
    
    // 检查阶段是否存在
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        _count: {
          select: {
            timesheets: true,
          },
        },
      },
    });
    
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    
    // 删除阶段（级联删除相关数据）
    await prisma.stage.delete({
      where: { id: stageId },
    });
    
    res.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Delete stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;