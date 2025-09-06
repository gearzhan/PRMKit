import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化Prisma客户端
const prisma = new PrismaClient();

/**
 * 解析CSV文件内容
 * @param {string} filePath - CSV文件路径
 * @returns {Array} 解析后的数据数组
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * 检查数据库中现有的Employee数据
 */
async function checkEmployees() {
  console.log('\n=== 检查Employee数据 ===');
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeId: true,
      name: true,
      isActive: true
    }
  });
  
  console.log(`数据库中共有 ${employees.length} 个员工:`);
  employees.forEach(emp => {
    console.log(`- ${emp.employeeId}: ${emp.name} (${emp.isActive ? '激活' : '未激活'})`);
  });
  
  return employees.map(emp => emp.employeeId);
}

/**
 * 检查数据库中现有的Project数据
 */
async function checkProjects() {
  console.log('\n=== 检查Project数据 ===');
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      projectCode: true,
      name: true,
      status: true
    }
  });
  
  console.log(`数据库中共有 ${projects.length} 个项目:`);
  projects.forEach(proj => {
    console.log(`- ${proj.projectCode}: ${proj.name} (${proj.status})`);
  });
  
  return projects.map(proj => proj.projectCode);
}

/**
 * 检查数据库中现有的Stage数据
 */
async function checkStages() {
  console.log('\n=== 检查Stage数据 ===');
  const stages = await prisma.stage.findMany({
    select: {
      id: true,
      taskId: true,
      name: true,
      category: true,
      isActive: true
    }
  });
  
  console.log(`数据库中共有 ${stages.length} 个阶段:`);
  stages.forEach(stage => {
    console.log(`- ${stage.taskId}: ${stage.name} (${stage.category}, ${stage.isActive ? '激活' : '未激活'})`);
  });
  
  return stages.map(stage => stage.taskId);
}

/**
 * 分析CSV文件数据
 */
function analyzeCSVData(csvData) {
  console.log('\n=== 分析CSV文件数据 ===');
  console.log(`CSV文件共有 ${csvData.length} 条记录`);
  
  // 统计唯一的Employee ID
  const uniqueEmployeeIds = [...new Set(csvData.map(row => row['Employee ID']).filter(id => id))];
  console.log(`\n唯一的Employee ID (${uniqueEmployeeIds.length}个):`);
  uniqueEmployeeIds.forEach(id => console.log(`- ${id}`));
  
  // 统计唯一的Project Code
  const uniqueProjectCodes = [...new Set(csvData.map(row => row['Project Code']).filter(code => code))];
  console.log(`\n唯一的Project Code (${uniqueProjectCodes.length}个):`);
  uniqueProjectCodes.forEach(code => console.log(`- ${code}`));
  
  // 统计唯一的Stage ID
  const uniqueStageIds = [...new Set(csvData.map(row => row['Stage ID']).filter(id => id))];
  console.log(`\n唯一的Stage ID (${uniqueStageIds.length}个):`);
  uniqueStageIds.forEach(id => console.log(`- ${id}`));
  
  return {
    employeeIds: uniqueEmployeeIds,
    projectCodes: uniqueProjectCodes,
    stageIds: uniqueStageIds
  };
}

/**
 * 对比数据库和CSV数据，找出不匹配的记录
 */
function compareData(dbEmployeeIds, dbProjectCodes, dbStageIds, csvData) {
  console.log('\n=== 数据对比分析 ===');
  
  const csvAnalysis = analyzeCSVData(csvData);
  
  // 检查不存在的Employee ID
  const missingEmployeeIds = csvAnalysis.employeeIds.filter(id => !dbEmployeeIds.includes(id));
  console.log(`\n❌ 数据库中不存在的Employee ID (${missingEmployeeIds.length}个):`);
  missingEmployeeIds.forEach(id => console.log(`- ${id}`));
  
  // 检查不存在的Project Code
  const missingProjectCodes = csvAnalysis.projectCodes.filter(code => !dbProjectCodes.includes(code));
  console.log(`\n❌ 数据库中不存在的Project Code (${missingProjectCodes.length}个):`);
  missingProjectCodes.forEach(code => console.log(`- ${code}`));
  
  // 检查不存在的Stage ID
  const missingStageIds = csvAnalysis.stageIds.filter(id => !dbStageIds.includes(id));
  console.log(`\n❌ 数据库中不存在的Stage ID (${missingStageIds.length}个):`);
  missingStageIds.forEach(id => console.log(`- ${id}`));
  
  // 统计受影响的记录数
  let affectedRecords = 0;
  csvData.forEach((row, index) => {
    const employeeId = row['Employee ID'];
    const projectCode = row['Project Code'];
    const stageId = row['Stage ID'];
    
    if (missingEmployeeIds.includes(employeeId) || 
        missingProjectCodes.includes(projectCode) || 
        missingStageIds.includes(stageId)) {
      affectedRecords++;
    }
  });
  
  console.log(`\n📊 总结:`);
  console.log(`- CSV总记录数: ${csvData.length}`);
  console.log(`- 受影响记录数: ${affectedRecords}`);
  console.log(`- 可能成功记录数: ${csvData.length - affectedRecords}`);
  
  return {
    missingEmployeeIds,
    missingProjectCodes,
    missingStageIds,
    affectedRecords,
    totalRecords: csvData.length
  };
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🔍 开始排查timesheet导入失败原因...');
    
    // 1. 检查数据库中现有数据
    const dbEmployeeIds = await checkEmployees();
    const dbProjectCodes = await checkProjects();
    const dbStageIds = await checkStages();
    
    // 2. 解析CSV文件
    const csvFilePath = path.join(__dirname, 'TIMESHEET_2025-09-05_copy.csv');
    console.log(`\n📄 解析CSV文件: ${csvFilePath}`);
    const csvData = parseCSV(csvFilePath);
    
    // 3. 对比数据
    const comparison = compareData(dbEmployeeIds, dbProjectCodes, dbStageIds, csvData);
    
    // 4. 分析失败原因并给出建议
    console.log('\n💡 解决建议:');
    
    if (comparison.missingEmployeeIds.length > 0) {
      console.log('\n1. Employee ID问题:');
      console.log('   - 需要先在系统中创建这些员工账户');
      console.log('   - 或者检查CSV中的Employee ID是否正确');
    }
    
    if (comparison.missingProjectCodes.length > 0) {
      console.log('\n2. Project Code问题:');
      console.log('   - 需要先在系统中创建这些项目');
      console.log('   - 或者检查CSV中的Project Code是否正确');
    }
    
    if (comparison.missingStageIds.length > 0) {
      console.log('\n3. Stage ID问题:');
      console.log('   - 需要先在系统中创建这些阶段');
      console.log('   - 或者检查CSV中的Stage ID是否正确');
    }
    
    if (comparison.affectedRecords === comparison.totalRecords) {
      console.log('\n⚠️  所有记录都受到影响，建议优先解决上述数据不匹配问题。');
    } else if (comparison.affectedRecords > 0) {
      console.log(`\n⚠️  ${comparison.affectedRecords}条记录受到影响，${comparison.totalRecords - comparison.affectedRecords}条记录可能可以成功导入。`);
    } else {
      console.log('\n✅ 数据匹配检查通过，导入失败可能由其他原因造成（如数据格式、业务逻辑等）。');
    }
    
  } catch (error) {
    console.error('❌ 排查过程中出现错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主函数
main();