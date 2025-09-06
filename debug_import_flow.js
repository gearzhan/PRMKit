import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';
import { Readable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// 复制csv-management.ts中的辅助函数
const cleanFieldName = (fieldName) => {
  return fieldName.replace(/^\uFEFF/, '').trim();
};

const getFieldValue = (data, fieldName) => {
  // 直接匹配
  if (data[fieldName] !== undefined) {
    return data[fieldName];
  }
  
  // 尝试匹配带BOM的字段名
  const bomFieldName = '\uFEFF' + fieldName;
  if (data[bomFieldName] !== undefined) {
    return data[bomFieldName];
  }
  
  // 尝试在所有字段中找到清理后匹配的字段
  for (const key in data) {
    if (cleanFieldName(key) === fieldName) {
      return data[key];
    }
  }
  
  return undefined;
};

// 复制mapCsvFields函数的TIMESHEET部分
const mapCsvFields = (data, dataType) => {
  const mappedData = {};
  
  if (dataType === 'TIMESHEET') {
    // 工时数据字段映射
    if (getFieldValue(data, 'Employee ID')) mappedData.employeeId = getFieldValue(data, 'Employee ID');
    if (getFieldValue(data, 'Project Code')) mappedData.projectCode = getFieldValue(data, 'Project Code');
    if (getFieldValue(data, 'Stage ID')) mappedData.stageId = getFieldValue(data, 'Stage ID');
    if (getFieldValue(data, 'Date')) mappedData.date = getFieldValue(data, 'Date');
    if (getFieldValue(data, 'Hours')) {
      const hoursValue = parseFloat(getFieldValue(data, 'Hours'));
      if (!isNaN(hoursValue)) {
        mappedData.hours = hoursValue;
      }
    }
    if (getFieldValue(data, 'Duration')) {
      const durationValue = parseFloat(getFieldValue(data, 'Duration'));
      if (!isNaN(durationValue)) {
        mappedData.duration = durationValue;
      }
    }
    if (getFieldValue(data, 'Description')) mappedData.description = getFieldValue(data, 'Description');
    if (getFieldValue(data, 'Status')) mappedData.status = getFieldValue(data, 'Status');
  }
  
  return mappedData;
};

// 模拟importTimesheetRow函数的关键部分
const simulateImportTimesheetRow = async (row) => {
  console.log('\n=== 模拟导入单行数据 ===');
  console.log('输入行数据:', JSON.stringify(row, null, 2));
  
  const { employeeId, projectCode, stageId, date, hours, duration, description, status } = row;
  
  console.log('解构后的字段:');
  console.log('- employeeId:', employeeId, '(类型:', typeof employeeId, ')');
  console.log('- projectCode:', projectCode, '(类型:', typeof projectCode, ')');
  console.log('- stageId:', stageId, '(类型:', typeof stageId, ')');
  console.log('- date:', date);
  console.log('- hours:', hours);
  console.log('- duration:', duration);
  
  // 检查employeeId是否为undefined
  if (employeeId === undefined) {
    console.log('❌ employeeId为undefined，这会导致数据库查询失败');
    return { success: false, error: 'employeeId is undefined' };
  }
  
  try {
    // 模拟数据库查询（不实际执行）
    console.log('\n准备执行数据库查询:');
    console.log('prisma.employee.findUnique({ where: { employeeId:', JSON.stringify(employeeId), '} })');
    
    // 实际执行查询来验证
    const employee = await prisma.employee.findUnique({
      where: { employeeId: employeeId }
    });
    
    if (!employee) {
      console.log('❌ 员工不存在:', employeeId);
      return { success: false, error: 'Employee not found' };
    }
    
    console.log('✅ 员工查询成功:', employee.name);
    return { success: true, employee };
    
  } catch (error) {
    console.log('❌ 数据库查询错误:', error.message);
    return { success: false, error: error.message };
  }
};

async function debugImportFlow() {
  try {
    console.log('=== 调试CSV导入流程 ===\n');
    
    // 读取CSV文件
    const csvPath = path.join(__dirname, 'TIMESHEET_2025-09-05_copy.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    console.log('CSV文件前500字符:');
    console.log(csvContent.substring(0, 500));
    console.log('\n');
    
    // 解析CSV
    const rows = [];
    let rowNumber = 0;
    
    const stream = Readable.from([csvContent]);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          console.log(`\n--- 处理第${rowNumber}行原始数据 ---`);
          console.log('原始数据:', JSON.stringify(data, null, 2));
          
          // 应用字段映射
          const mappedData = mapCsvFields(data, 'TIMESHEET');
          console.log('映射后数据:', JSON.stringify(mappedData, null, 2));
          
          // 添加行号
          const finalData = { ...mappedData, rowNumber };
          rows.push(finalData);
          
          // 只处理前3行进行调试
          if (rowNumber >= 3) {
            resolve();
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log('\n=== 开始模拟导入过程 ===');
    
    // 模拟导入每一行
    for (const row of rows) {
      console.log(`\n\n>>> 处理第${row.rowNumber}行 <<<`);
      const result = await simulateImportTimesheetRow(row);
      console.log('导入结果:', result);
    }
    
  } catch (error) {
    console.error('调试过程出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugImportFlow();