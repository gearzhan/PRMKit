import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateToken, authenticateToken, AuthenticatedRequest, requireAdmin, isLevel1Admin } from '../lib/jwt.js';
import { Role } from '@prisma/client';

const router = Router();

// 用户登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // 验证输入
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // 查找用户
    const user = await prisma.employee.findUnique({
      where: { email },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        password: true,
        role: true,
        position: true,
        isActive: true,
      },
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // 生成JWT令牌
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    });
    
    // 返回用户信息和令牌（不包含密码）
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.employee.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 创建新用户（仅管理员）
router.post('/users', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      employeeId,
      name,
      email,
      password,
      role = 'EMPLOYEE',
      position,
    } = req.body;
    
    // 验证必填字段
    if (!employeeId || !name || !email || !password) {
      return res.status(400).json({ error: 'Employee ID, name, email, and password are required' });
    }
    
    // 检查邮箱和员工ID是否已存在
    const existingUser = await prisma.employee.findFirst({
      where: {
        OR: [
          { email },
          { employeeId },
        ],
      },
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Email or employee ID already exists' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户
    const newUser = await prisma.employee.create({
      data: {
        employeeId,
        name,
        email,
        password: hashedPassword,
        role: role as Role,
        position,
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
      },
    });
    
    res.status(201).json({
      message: 'User created successfully',
      user: newUser,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有用户（仅管理员和经理）
router.get('/users', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 检查权限 - 只有Level 1管理员可以查看所有用户
    if (!isLevel1Admin(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const users = await prisma.employee.findMany({
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新用户信息
router.put('/users/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      role,
      position,
      isActive,
    } = req.body;
    
    // 检查权限：只有Level 1管理员可以修改其他用户，用户只能修改自己的基本信息
    if (!isLevel1Admin(req.user!.role) && req.user!.userId !== id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // 普通用户不能修改角色和激活状态
    const updateData: any = {
      name,
      email,
      position,
    };
    
    if (isLevel1Admin(req.user!.role)) {
      updateData.role = role;
      updateData.isActive = isActive;
    }
    
    // 移除undefined值
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const updatedUser = await prisma.employee.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        updatedAt: true,
      },
    });
    
    res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 修改密码
router.put('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    // 获取当前用户
    const user = await prisma.employee.findUnique({
      where: { id: req.user!.userId },
      select: { password: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await prisma.employee.update({
      where: { id: req.user!.userId },
      data: { password: hashedNewPassword },
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 重置用户密码（仅管理员）
router.put('/users/:id/reset-password', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // 检查用户是否存在
    const user = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, name: true, employeeId: true },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 更新密码
    await prisma.employee.update({
      where: { id },
      data: { password: hashedPassword },
    });
    
    res.json({ 
      message: 'Password reset successfully',
      user: {
        id: user.id,
        name: user.name,
        employeeId: user.employeeId,
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除用户（仅管理员）
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 检查用户是否存在
    const user = await prisma.employee.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            timesheets: true,
            approvals: true,
          },
        },
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 防止删除自己
    if (user.id === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // 删除用户（级联删除相关数据）
    await prisma.employee.delete({
      where: { id },
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;