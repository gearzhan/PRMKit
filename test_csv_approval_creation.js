import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 测试CSV导入时为不同状态创建approval记录的逻辑
 */
async function testApprovalCreation() {
  console.log('=== 测试CSV导入时approval记录创建逻辑 ===\n');
  
  try {
    // 1. 检查是否存在默认审批人 PSEC-000
    const defaultApprover = await prisma.employee.findUnique({
      where: { employeeId: 'PSEC-000' },
      select: { id: true, name: true, employeeId: true }
    });
    
    if (!defaultApprover) {
      console.log('❌ 默认审批人 PSEC-000 不存在，需要先创建');
      return;
    }
    
    console.log('✅ 找到默认审批人:', defaultApprover);
    
    // 2. 查找一个测试员工和项目
    const testEmployee = await prisma.employee.findFirst({
      where: {
        employeeId: { not: 'PSEC-000' }
      },
      select: { id: true, employeeId: true, name: true }
    });
    
    const testProject = await prisma.project.findFirst({
      select: { id: true, projectCode: true, name: true }
    });
    
    if (!testEmployee || !testProject) {
      console.log('❌ 找不到测试用的员工或项目');
      return;
    }
    
    console.log('✅ 测试员工:', testEmployee);
    console.log('✅ 测试项目:', testProject);
    
    // 3. 模拟创建不同状态的timesheet记录并检查approval创建
    const testCases = [
      { status: 'DRAFT', description: 'DRAFT状态不应创建approval记录' },
      { status: 'SUBMITTED', description: 'SUBMITTED状态应创建PENDING approval记录' },
      { status: 'APPROVED', description: 'APPROVED状态应创建APPROVED approval记录' }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n--- 测试案例 ${i + 1}: ${testCase.description} ---`);
      
      // 创建测试用的timesheet记录
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + i); // 每个测试用不同日期避免冲突
      
      const timesheetData = {
        employeeId: testEmployee.id,
        projectId: testProject.id,
        date: testDate,
        hours: 8,
        description: `测试${testCase.status}状态`,
        status: testCase.status
      };
      
      console.log('创建timesheet记录:', {
        employee: testEmployee.employeeId,
        project: testProject.projectCode,
        date: testDate.toISOString().split('T')[0],
        status: testCase.status
      });
      
      // 先删除可能存在的测试记录
      await prisma.approval.deleteMany({
        where: {
          timesheet: {
            employeeId: testEmployee.id,
            projectId: testProject.id,
            date: testDate
          }
        }
      });
      
      await prisma.timesheet.deleteMany({
        where: {
          employeeId: testEmployee.id,
          projectId: testProject.id,
          date: testDate
        }
      });
      
      // 创建timesheet记录
      const createdTimesheet = await prisma.timesheet.create({
        data: timesheetData
      });
      
      console.log('✅ Timesheet创建成功, ID:', createdTimesheet.id);
      
      // 模拟CSV导入逻辑：根据状态创建approval记录
      if (testCase.status === 'SUBMITTED' || testCase.status === 'APPROVED') {
        const approvalData = {
          timesheetId: createdTimesheet.id,
          submitterId: testEmployee.id,
          approverId: defaultApprover.id,
          comments: 'Test approval recor