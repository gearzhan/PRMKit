import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireLevel1Admin } from '../lib/jwt.js';

const router = Router();

/**
 * 获取阶段列表
 * 支持搜索和分页功能
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = '1', limit = '50', search, category } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    const where: any = {
      isActive: true, // 只显示激活的阶段
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { taskId: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    const [stages, total] = await Promise.all([
      prisma.stage.findMany({
        where,
        orderBy: [
          { taskId: 'asc' }, // 按任务ID排序
        ],
        skip,
        take: limitNum,
      }),
      prisma.stage.count({ where }),
    ]);
    
    res.json({
      stages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get stage templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 获取所有类别列表
 */
router.get('/categories/list', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 获取所有活跃的stages
    const stages = await prisma.stage.findMany({
      where: {
        isActive: true,
      },
      select: {
        category: true,
      },
    });
    
    // 在JavaScript中过滤和去重categories
    const categorySet = new Set<string>();
    stages.forEach(stage => {
      if (stage.category && stage.category.trim()) {
        categorySet.add(stage.category);
      }
    });
    
    const categoryList = Array.from(categorySet).sort();
    
    res.json({ categories: categoryList });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 获取单个阶段详情
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const stage = await prisma.stage.findUnique({
      where: { id },
    });
    
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    
    res.json({ stage });
  } catch (error) {
    console.error('Get stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 创建阶段（Level 1管理员）
 */
router.post('/', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      taskId,
      name,
      description,
      category,
    } = req.body;
    
    // 验证必填字段
    if (!taskId || !name) {
      return res.status(400).json({ error: 'Task ID and name are required' });
    }
    
    // 检查任务ID是否已存在
    const existingStage = await prisma.stage.findUnique({
      where: { taskId },
    });
    
    if (existingStage) {
      return res.status(409).json({ error: 'Task ID already exists' });
    }
    
    // 创建阶段
    const stage = await prisma.stage.create({
      data: {
        taskId,
        name,
        description,
        category,
        isActive: true,
      },
    });
    
    res.status(201).json({ stage });
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 更新阶段（Level 1管理员）
 */
router.put('/:id', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      taskId,
      name,
      description,
      category,
      isActive,
    } = req.body;
    
    // 验证必填字段
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // 检查阶段是否存在
    const existingStage = await prisma.stage.findUnique({
      where: { id },
    });
    
    if (!existingStage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    
    // 如果更新taskId，检查是否与其他阶段冲突
    if (taskId && taskId !== existingStage.taskId) {
      const conflictStage = await prisma.stage.findUnique({
        where: { taskId },
      });
      
      if (conflictStage) {
        return res.status(409).json({ error: 'Task ID already exists' });
      }
    }
    
    // 更新阶段
    const stage = await prisma.stage.update({
      where: { id },
      data: {
        ...(taskId && { taskId }),
        name,
        description,
        category,
        ...(typeof isActive === 'boolean' && { isActive }),
      },
    });
    
    res.json({ stage });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 删除阶段（Level 1管理员）
 */
router.delete('/:id', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 检查阶段是否存在
    const existingStage = await prisma.stage.findUnique({
      where: { id },
    });
    
    if (!existingStage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    
    // 软删除：设置为非激活状态
    await prisma.stage.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
    
    res.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Delete stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;