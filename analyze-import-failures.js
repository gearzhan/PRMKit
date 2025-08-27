// 分析最后两次导入失败的原因
// 这个脚本会查询数据库中的导入日志，找出失败的记录并分析错误详情

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeImportFailures() {
  try {
    console.log('🔍 正在分析最后两次导入失败的原因...');
    console.log('=' .repeat(60));
    
    // 1. 获取所有导入日志，按创建时间倒序排列
    const allLogs = await prisma.csvImportLog.findMany({
      include: {
        operator: {
          select: {
            name: true,
            employeeId: true,
            email: true
          }
        },
        errors: {
          orderBy: { rowNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 总共找到 ${allLogs.length} 条导入记录`);
    
    // 2. 筛选出失败或部分成功的记录
    const failedLogs = allLogs.filter(log => 
      log.status === 'FAILED' || log.status === 'PARTIAL'
    );
    
    console.log(`❌ 其中 ${failedLogs.length} 条记录存在失败`);
    
    if (failedLogs.length === 0) {
      console.log('✅ 没有发现失败的导入记录！');
      return;
    }
    
    // 3. 取最近的两条失败记录
    const lastTwoFailures = failedLogs.slice(0, 2);
    
    console.log('\n📋 最近两次失败的导入记录详情:');
    console.log('=' .repeat(60));
    
    // 4. 分析每条失败记录
    for (let i = 0; i < lastTwoFailures.length; i++) {
      const log = lastTwoFailures[i];
      console.log(`\n🔸 失败记录 #${i + 1}:`);
      console.log(`   📁 文件名: ${log.fileName}`);
      console.log(`   📊 数据类型: ${log.dataType}`);
      console.log(`   👤 操作员: ${log.operator.name} (${log.operator.employeeId})`);
      console.log(`   📅 导入时间: ${log.createdAt.toLocaleString('zh-CN')}`);
      console.log(`   ⏱️  处理时长: ${log.endTime ? Math.round((log.endTime.getTime() - log.startTime.getTime()) / 1000) : '未完成'} 秒`);
      console.log(`   📈 状态: ${log.status}`);
      console.log(`   📊 统计: 总计 ${log.totalRows} 行, 成功 ${log.successRows} 行, 失败 ${log.errorRows} 行`);
      
      // 分析错误详情
      if (log.errors && log.errors.length > 0) {
        console.log(`\n   🚨 错误详情 (共 ${log.errors.length} 个错误):`);
        
        // 按错误类型分组
        const errorsByType = {};
        const errorsByRow = {};
        
        log.errors.forEach(error => {
          // 按错误消息分组
          if (!errorsByType[error.message]) {
            errorsByType[error.message] = [];
          }
          errorsByType[error.message].push(error);
          
          // 按行号分组
          if (!errorsByRow[error.rowNumber]) {
            errorsByRow[error.rowNumber] = [];
          }
          errorsByRow[error.rowNumber].push(error);
        });
        
        console.log('\n   📊 错误类型统计:');
        Object.entries(errorsByType).forEach(([message, errors]) => {
          console.log(`      • ${message}: ${errors.length} 次`);
          if (errors.length <= 3) {
            errors.forEach(error => {
              console.log(`        - 第 ${error.rowNumber} 行${error.field ? ` (字段: ${error.field})` : ''}${error.value ? ` (值: ${error.value})` : ''}`);
            });
          } else {
            console.log(`        - 影响行号: ${errors.slice(0, 3).map(e => e.rowNumber).join(', ')} 等 ${errors.length} 行`);
          }
        });
        
        console.log('\n   🔍 问题行详情 (前5行):');
        const sortedRows = Object.keys(errorsByRow).sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 5);
        sortedRows.forEach(rowNumber => {
          const rowErrors = errorsByRow[rowNumber];
          console.log(`      第 ${rowNumber} 行:`);
          rowErrors.forEach(error => {
            console.log(`        • ${error.message}${error.field ? ` (字段: ${error.field})` : ''}${error.value ? ` (值: ${error.value})` : ''}`);
          });
        });
      }
      
      // 提供解决方案建议
      console.log('\n   💡 可能的解决方案:');
      
      if (log.dataType === 'EMPLOYEE') {
        console.log('      • 检查员工ID格式是否正确（应为唯一标识符）');
        console.log('      • 确认邮箱格式是否有效且唯一');
        console.log('      • 验证角色字段是否为有效值 (LEVEL1, LEVEL2, LEVEL3)');
        console.log('      • 检查必填字段是否都有值');
      } else if (log.dataType === 'PROJECT') {
        console.log('      • 检查项目编码格式是否正确且唯一');
        console.log('      • 确认日期格式是否正确 (YYYY-MM-DD)');
        console.log('      • 验证项目状态是否为有效值 (ACTIVE, COMPLETED, SUSPENDED, CANCELLED)');
        console.log('      • 检查开始日期是否早于结束日期');
      } else if (log.dataType === 'TIMESHEET') {
        console.log('      • 检查员工ID是否存在于系统中');
        console.log('      • 确认项目编码是否存在于系统中');
        console.log('      • 验证日期和时间格式是否正确');
        console.log('      • 检查开始时间是否早于结束时间');
        console.log('      • 确认工时计算是否正确（15分钟为最小单位）');
      }
      
      console.log('      • 检查CSV文件编码是否为UTF-8');
      console.log('      • 确认CSV文件格式是否符合模板要求');
      console.log('      • 验证数据中是否存在特殊字符或格式问题');
    }
    
    // 5. 总结分析
    console.log('\n' + '=' .repeat(60));
    console.log('📋 分析总结:');
    
    const totalErrors = lastTwoFailures.reduce((sum, log) => sum + log.errorRows, 0);
    const totalRows = lastTwoFailures.reduce((sum, log) => sum + log.totalRows, 0);
    const errorRate = totalRows > 0 ? ((totalErrors / totalRows) * 100).toFixed(2) : 0;
    
    console.log(`   • 最近两次失败导入共涉及 ${totalRows} 行数据`);
    console.log(`   • 总错误数: ${totalErrors} 个`);
    console.log(`   • 错误率: ${errorRate}%`);
    
    // 分析主要错误类型
    const allErrors = lastTwoFailures.flatMap(log => log.errors || []);
    const errorTypeCount = {};
    allErrors.forEach(error => {
      errorTypeCount[error.message] = (errorTypeCount[error.message] || 0) + 1;
    });
    
    const sortedErrorTypes = Object.entries(errorTypeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    console.log('\n   🔝 主要错误类型:');
    sortedErrorTypes.forEach(([message, count], index) => {
      console.log(`   ${index + 1}. ${message} (${count} 次)`);
    });
    
    console.log('\n💡 建议的改进措施:');
    console.log('   1. 在导入前使用数据验证功能检查文件格式');
    console.log('   2. 提供更详细的CSV模板和填写说明');
    console.log('   3. 增加数据预处理步骤，自动修正常见格式问题');
    console.log('   4. 考虑分批导入大文件，减少单次失败影响');
    console.log('   5. 增强错误提示信息，帮助用户快速定位问题');
    
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行分析
analyzeImportFailures()
  .then(() => {
    console.log('\n✅ 分析完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 分析失败:', error);
    process.exit(1);
  });