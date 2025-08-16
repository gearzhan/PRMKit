import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

// JWT载荷接口
export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  employeeId: string;
}

// 扩展Request接口以包含用户信息
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// 生成JWT令牌
export const generateToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any,
  };
  
  return jwt.sign(payload, secret, options);
};

// 验证JWT令牌
export const verifyToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  return jwt.verify(token, secret) as JwtPayload;
};

// 认证中间件
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }
  
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// 角色授权中间件
export const authorizeRoles = (...roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};

// 角色系统级别定义
export const ROLE_LEVELS = {
  // Level 1 - Admin (Full Access)
  LEVEL1: 1,
  
  // Level 2 - Manager (Time Sheets + Management)
  LEVEL2: 2,
  
  // Level 3 - Worker (Time Sheets Only)
  LEVEL3: 3,
} as const;

// 检查角色是否有足够的权限级别
export const hasPermissionLevel = (userRole: Role, requiredLevel: number): boolean => {
  const userLevel = ROLE_LEVELS[userRole];
  return userLevel <= requiredLevel; // 数字越小权限越高
};

// 检查是否为Level 1管理员（全权限）
export const isLevel1Admin = (role: Role): boolean => {
  return ROLE_LEVELS[role] === 1;
};

// 检查是否为Level 2经理（时间表权限）
export const isLevel2Manager = (role: Role): boolean => {
  return ROLE_LEVELS[role] === 2;
};

// 检查是否为Level 3员工（时间表权限）
export const isLevel3Worker = (role: Role): boolean => {
  return ROLE_LEVELS[role] === 3;
};

// 权限级别中间件
export const requirePermissionLevel = (requiredLevel: number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!hasPermissionLevel(req.user.role, requiredLevel)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};

// Level 1管理员权限（全权限）
export const requireLevel1Admin = authorizeRoles('LEVEL1');

// Level 2经理权限（时间表权限）- 包括Level 1管理员
export const requireLevel2Manager = authorizeRoles('LEVEL1', 'LEVEL2');

// Level 3员工权限（时间表权限）
export const requireLevel3Worker = authorizeRoles('LEVEL3');

// 时间表访问权限（Level 2和Level 3）
export const requireTimesheetAccess = authorizeRoles(
  'LEVEL2', 'LEVEL3'
);

// 任何员工权限
export const requireAnyEmployee = authorizeRoles('LEVEL1', 'LEVEL2', 'LEVEL3');

// 管理员访问权限（Level 1）
export const requireAdminAccess = requireLevel1Admin;

// 兼容性别名
export const requireManagerOrAdmin = requireLevel1Admin;
export const requireAdmin = requireLevel1Admin;