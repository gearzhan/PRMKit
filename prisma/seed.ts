import { PrismaClient, Role, ProjectStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据填充 (使用upsert策略) ...');
  console.log('如果主键重复则覆盖更新，如果主键为新则添加...');

  // 创建新的Admin账户 - 使用新的角色层级系统
  const adminPassword = await bcrypt.hash('admin0258', 10);
  const userPassword = await bcrypt.hash('02580258', 10);

  const admin = await prisma.employee.upsert({
    where: { employeeId: 'SAIYU_001' },
    update: {
      email: 'gzhan@saiyu.com.au',
      password: adminPassword,
      name: 'Admin User',
      role: 'LEVEL1' as Role, // Level 1 Admin - Full Access
      position: 'Director',
      isActive: true,
    },
    create: {
      employeeId: 'SAIYU_001',
      email: 'gzhan@saiyu.com.au',
      password: adminPassword,
      name: 'Admin User',
      role: 'LEVEL1' as Role, // Level 1 Admin - Full Access
      position: 'Director',
      isActive: true,
    },
  });

  // 创建示例员工账户 - 展示不同角色层级
  const sampleEmployees = [
    {
      employeeId: 'PSEC_101',
      email: 'associate@prmkit.com',
      password: userPassword,
      name: 'John Associate',
      role: 'LEVEL1' as Role, // Level 1 Admin - Full Access
      position: 'Associate Partner',
    },
  ];

  // 批量创建示例员工（使用upsert）
  for (const employeeData of sampleEmployees) {
    await prisma.employee.upsert({
      where: { employeeId: employeeData.employeeId },
      update: {
        ...employeeData,
        isActive: true,
      },
      create: {
        ...employeeData,
        isActive: true,
      },
    });
  }

  // 创建阶段数据 - 根据用户提供的任务表格
  console.log('创建阶段数据...');
  const stageData = [
    // 管理和休假类别 (TD.00.xx)
    {
      taskId: 'TD.00.00',
      name: 'Administration',
      description: 'e.g. Extended Lunch break, Morning and Afternoon Tea, Toilet break',
      category: 'Administration',
    },
    {
      taskId: 'TD.00.01',
      name: 'Sick Leave',
      description: 'Sick Leave',
      category: 'Leave',
    },
    {
      taskId: 'TD.00.02',
      name: 'Annual Leave / Public Holidays',
      description: 'Annual Leave / Public Holidays',
      category: 'Leave',
    },
    {
      taskId: 'TD.00.03',
      name: 'Leave - Other entitlements',
      description: 'personal and carer\'s leave, compassionate leave, family and domestic violence leave, community service leave, long service leave',
      category: 'Leave',
    },
    {
      taskId: 'TD.00.04',
      name: 'Office Management',
      description: 'e.g. IT issue, Annual Fire Safety Event',
      category: 'Administration',
    },
    // 设计和建筑类别 (TD.01.xx)
    {
      taskId: 'TD.01.00',
      name: 'SK',
      description: 'Sketch Design / Concept Design Work',
      category: 'Design',
    },
    {
      taskId: 'TD.01.01',
      name: 'DA / CDC',
      description: 'Development Application / Complying Development Certificate Work',
      category: 'Design',
    },
    {
      taskId: 'TD.01.02',
      name: 'CC',
      description: 'Construction Certificate Application Work',
      category: 'Design',
    },
    {
      taskId: 'TD.01.03',
      name: 'CD',
      description: 'Construction Documentation Work',
      category: 'Design',
    },
    {
      taskId: 'TD.01.04',
      name: 'ID',
      description: 'Interior Design Work',
      category: 'Design',
    },
    {
      taskId: 'TD.01.09',
      name: 'MK',
      description: 'Marketing Material Work (e.g. Marketing Plans, Inclusions Lists, CGIs)',
      category: 'Marketing',
    },
    {
      taskId: 'TD.01.10',
      name: 'OW',
      description: 'Other Consulting Work (e.g. Feasibility Studies, Planning Portal Assistance, Design / Document Reviews)',
      category: 'Consulting',
    },
    // 项目管理类别 (TD.02.xx)
    {
      taskId: 'TD.02.01',
      name: 'PM',
      description: 'General Project Management Work',
      category: 'Management',
    },
    {
      taskId: 'TD.02.02',
      name: 'OC',
      description: 'Occupation Certificate Application Work',
      category: 'Management',
    },
    {
      taskId: 'TD.02.03',
      name: 'POC',
      description: 'Post OC Work (e.g. Final Certificate Assessment, SBBIS)',
      category: 'Management',
    },
    {
      taskId: 'TD.02.04',
      name: 'CA',
      description: 'Contract Administration Work',
      category: 'Management',
    },
  ];

  // 批量创建阶段数据（使用upsert）
  for (const stage of stageData) {
    await prisma.stage.upsert({
      where: { taskId: stage.taskId },
      update: {
        ...stage,
        isActive: true,
      },
      create: {
        ...stage,
        isActive: true,
      },
    });
  }

  // 创建示例项目数据
  console.log('创建示例项目数据...');
  const projectData = [
    {
      projectCode: 'OA',
      name: 'Office Admin',
      description: 'Admin Work',
      startDate: new Date(),
      status: ProjectStatus.ACTIVE,
    },
  ];

  // 批量创建项目数据（使用upsert）
  for (const project of projectData) {
    await prisma.project.upsert({
      where: { projectCode: project.projectCode },
      update: project,
      create: project,
    });
  }

  console.log('Admin账户、示例员工和阶段数据创建完成');
  console.log('种子数据填充完成！');
  console.log('\n=== 账户信息 ===');
  console.log('\n主管理员账户 (LEVEL1 - Level 1):');
  console.log('邮箱: gzhan@saiyu.com.au');
  console.log('密码: admin0258');
  console.log('\n其他示例账户 (密码均为: 02580258):');
  console.log('\n角色权限说明:');
  console.log('- Level 1 (LEVEL1): 全权限访问');
  console.log('- Level 2 (Project Manager): 时间表权限');
  console.log('- Level 3 (LEVEL3): 时间表权限');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });