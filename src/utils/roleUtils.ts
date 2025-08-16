import type { Role } from '@prisma/client';

/**
 * 检查是否为 Level 1 管理员（具有完全访问权限）
 * @param role 用户角色
 * @returns 是否为 Level 1 管理员
 */
export const isLevel1Admin = (role: string): boolean => {
  return role === 'LEVEL1';
};

/**
 * 检查是否为 Level 2 管理员（具有工时表访问权限）
 * @param role 用户角色
 * @returns 是否为 Level 2 管理员
 */
export const isLevel2Manager = (role: string): boolean => {
  return role === 'LEVEL2';
};

/**
 * 检查是否为 Level 3 员工（仅具有工时表访问权限）
 * @param role 用户角色
 * @returns 是否为 Level 3 员工
 */
export const isLevel3Worker = (role: string): boolean => {
  return role === 'LEVEL3';
};

/**
 * 检查是否具有管理员或经理权限（Level 1 + Level 2）
 * @param role 用户角色
 * @returns 是否具有管理员或经理权限
 */
export const isManagerOrAdmin = (role: Role): boolean => {
  return isLevel1Admin(role) || isLevel2Manager(role);
};

/**
 * 检查是否可以访问工时表功能（所有级别）
 * @param role 用户角色
 * @returns 是否可以访问工时表
 */
export const canAccessTimesheets = (role: Role): boolean => {
  return isLevel1Admin(role) || isLevel2Manager(role) || isLevel3Worker(role);
};

/**
 * 检查是否可以管理项目（Level 1 管理员）
 * @param role 用户角色
 * @returns 是否可以管理项目
 */
export const canManageProjects = (role: Role): boolean => {
  return isLevel1Admin(role);
};

/**
 * 检查是否可以审批工时表（Level 1 + Level 2）
 * @param role 用户角色
 * @returns 是否可以审批工时表
 */
export const canApproveTimesheets = (role: Role): boolean => {
  return isLevel1Admin(role) || isLevel2Manager(role);
};