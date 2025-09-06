import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟修复后的字段处理函数
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

// 模拟修复后的字段映射函数
const mapCsvFields = (data, dataType) => {
  const mappedData = {}; // 只返回映射后的字段
  
  if (dataType === 'TIMESHEET') {
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
    if (getFieldValue(data, 'Description')) mappedData.description = getFieldValue(data, 'Description');
  }
  
  return mappedData;
};

// 测试修复后的导入逻辑
async function testFixedImport() {
  console.log('🔧 测试修复后的CSV导入逻辑...');
  
  const csvFilePath = path.join(__dirname, 'TIMESHEET_2025-09-05_copy.csv');
  
  if (!fs.existsSync(csvFilePath)) {
    console.log('❌ CSV文件不存在:', csvFilePath);
    return;
  }
  
  const results = [];
  let rowCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        rowCount++;
        
        // 只处理前5行数据进行测试
        if (rowCount <= 5) {
          console.log(`\n--- 第${rowCount}行原始数据 ---`);
          console.log('原始字段名:', Object.keys(data));
          console.log('Employee ID 原始值:', data['Employee ID']);
          
          // 使用修复后的映射函数
          const mappedData = mapCsvFields(data, 'TIMESHEET');
          console.log('映射后数据:', mappedData);
          
          // 检查关键字段
          console.log('✅ 检查结果:');
          console.log('  - employeeId:', mappedData.employeeId || '❌ undefined');
          console.log('  - projectCode:', mappedData.projectCode || '❌ undefined');
          console.log('  - stageId:', mappedData.stageId || '❌ undefined');
          
          results.push(mappedData);
        }
      })
      .on('end', () => {
        console.log(`\n📊 测试完成，共处理 ${Math.min(rowCount, 5)} 行数据`);
        console.log('\n🎯 修复效果总结:');
        
        const successCount = results.filter(r => r.employeeId && r.projectCode).length;
        console.log(`  - 成功映射字段的行数: ${successCount}/${results.length}`);
        
        if (successCount === results.length) {
          console.log('✅ 修复成功！所有测试行的字段都正确映射了');
        } else {
          console.log('❌ 仍有问题，部分行的字段映射失败');
        }
        
        resolve();
      })
      .on('error', (error) => {
        console.error('❌ 读取CSV文件时出错:', error);
        reject(error);
      });
  });
}

testFixedImport().catch(console.error);