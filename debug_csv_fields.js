import fs from 'fs';
import csv from 'csv-parser';
import { Readable } from 'stream';

/**
 * 调试CSV文件字段映射问题
 */
async function debugCsvFields() {
  try {
    console.log('🔍 调试CSV文件字段映射...');
    
    // 读取CSV文件
    const csvPath = '/Users/gearzhan/cProjects/PRMKit/TIMESHEET_2025-09-05_copy.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('📄 CSV文件前500个字符:');
    console.log(csvContent.substring(0, 500));
    console.log('\n' + '='.repeat(50));
    
    // 解析CSV并检查前几行数据
    const rows = [];
    const stream = Readable.from([csvContent]);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          rows.push(data);
          if (rows.length >= 5) {
            // 只处理前5行用于调试
            return;
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`\n📊 解析到 ${rows.length} 行数据`);
    
    // 检查第一行的所有字段
    if (rows.length > 0) {
      console.log('\n🔍 第一行原始数据的所有字段:');
      const firstRow = rows[0];
      Object.keys(firstRow).forEach((key, index) => {
        console.log(`  ${index + 1}. 字段名: "${key}" => 值: "${firstRow[key]}"`);
      });
      
      // 检查关键字段
      console.log('\n🎯 关键字段检查:');
      const keyFields = ['Employee ID', 'Project Code', 'Stage ID', 'Date', 'Hours'];
      keyFields.forEach(field => {
        const value = firstRow[field];
        console.log(`  - ${field}: ${value !== undefined ? `"${value}"` : '❌ 未找到'}`);
      });
      
      // 模拟字段映射函数
      console.log('\n🔄 模拟字段映射过程:');
      const getFieldValue = (data, fieldName) => {
        // 尝试直接匹配
        if (data[fieldName] !== undefined && data[fieldName] !== null && data[fieldName] !== '') {
          return data[fieldName];
        }
        
        // 尝试不区分大小写匹配
        const lowerFieldName = fieldName.toLowerCase();
        for (const key in data) {
          if (key.toLowerCase() === lowerFieldName && data[key] !== undefined && data[key] !== null && data[key] !== '') {
            return data[key];
          }
        }
        
        // 尝试部分匹配
        const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
        for (const key in data) {
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
          if (normalizedKey.includes(normalizedFieldName) || normalizedFieldName.includes(normalizedKey)) {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
              return data[key];
            }
          }
        }
        
        return undefined;
      };
      
      keyFields.forEach(field => {
        const mappedValue = getFieldValue(firstRow, field);
        console.log(`  - ${field} => ${mappedValue !== undefined ? `"${mappedValue}"` : '❌ 映射失败'}`);
      });
      
      // 检查前3行数据的Employee ID映射
      console.log('\n👥 前3行Employee ID映射检查:');
      rows.slice(0, 3).forEach((row, index) => {
        const employeeId = getFieldValue(row, 'Employee ID');
        console.log(`  行 ${index + 1}: Employee ID = ${employeeId !== undefined ? `"${employeeId}"` : '❌ undefined'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 调试CSV字段映射失败:', error);
  }
}

// 运行调试
debugCsvFields();