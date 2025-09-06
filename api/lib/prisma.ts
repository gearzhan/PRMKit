import { PrismaClient } from '@prisma/client';

// 全局Prisma客户端实例
// 在开发环境中防止热重载时创建多个实例
declare global {
  var __prisma: PrismaClient | undefined;
}

// 创建Prisma客户端实例
const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 在开发环境中将实例保存到全局变量
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

export default prisma;

// 验证工时是否符合规则
export const validateTimesheet = (hours: number): { isValid: boolean; error?: string } => {
  // 检查工时是否为正数
  if (hours <= 0) {
    return { isValid: false, error: 'Hours must be greater than 0' };
  }
  
  // 检查最小时间单位（0.25小时）
  if (hours < 0.25) {
    return { isValid: false, error: 'Minimum time unit is 0.25 hours' };
  }
  
  return { isValid: true };
};