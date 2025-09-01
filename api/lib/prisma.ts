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

// 工时计算工具函数
export const calculateHours = (startTime: string, endTime: string): number => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  // 计算时间差（毫秒）
  const diffMs = end.getTime() - start.getTime();
  
  // 转换为小时
  const hours = diffMs / (1000 * 60 * 60);
  
  // 四舍五入到最近的15分钟（0.25小时）
  return Math.round(hours * 4) / 4;
};

// 验证工时是否符合规则
export const validateTimesheet = (startTime: string, endTime: string): { isValid: boolean; error?: string } => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  // 检查结束时间是否晚于开始时间
  if (end <= start) {
    return { isValid: false, error: 'End time must be after start time' };
  }
  
  // 计算工时
  const hours = calculateHours(startTime, endTime);
  
  // 检查最小时间单位（15分钟）
  if (hours < 0.25) {
    return { isValid: false, error: 'Minimum time unit is 15 minutes (0.25 hours)' };
  }
  
  return { isValid: true };
};