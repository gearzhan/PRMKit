import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 检查最近的CSV导入日志和错误信息
 */
async function checkImportLogs() {
  try {
    console.log('🔍 检查最近的CSV导入日志...');
    
    // 获取最近的timesheet导入日志
    const recentLogs = await prisma.csvImportLog.findMany({
      where: {
        dataType: 'TIMESHEET'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      include: {
        operator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`\n📊 找到 ${recentLogs.length} 条最近的timesheet导入日志:`);
    
    for (const log of recentLogs) {
      console.log(`\n--- 导入日志 ID: ${log.id} ---`);
      console.log(`文件名: ${log.fileName}`);
      console.log(`数据类型: ${log.dataType}`);
      console.log(`总行数: ${log.totalRows}`);
      console.log(`成功行数: ${log.successRows}`);
      console.log(`错误行数: ${log.errorRows}`);
      console.log(`状态: ${log.status}`);
      console.log(`操作员: ${log.operator.name} (${log.operator.email})`);
      console.log(`创建时间: ${log.createdAt}`);
      
      // 获取该日志的错误详情
      const errors = await prisma.csvImportError.findMany({
        where: {
          logId: log.id
        },
        orderBy: {
          rowNumber: 'asc'
        },
        take: 10 // 只显示前10个错误
      });
      
      if (errors.length > 0) {
        console.log(`\n❌ 错误详情 (显示前10个):`);
        errors.forEach((error, index) => {
          console.log(`  ${index + 1}. 行号 ${error.rowNumber}: ${error.message}`);
        });
        
        if (errors.length === 10) {
          const totalErrors = await prisma.csvImportError.count({
            where: { logId: log.id }
          });
          console.log(`  ... 还有 ${totalErrors - 10} 个错误`);
        }
      } else {
        console.log('✅ 无错误记录');
      }
    }
    
    // 检查最近失败的导入
    const failedLog = recentLogs.find(log => log.status === 'FAILED');
    if (failedLog) {
      console.log(`\n🔍 分析最近失败的导入 (ID: ${failedLog.id}):`);
      
      // 获取所有错误信息
      const allErrors = await prisma.csvImportError.findMany({
        where: {
          logId: failedLog.id
        },
        orderBy: {
          rowNumber: 'asc'
        }
      });
      
      // 统计错误类型
      const errorTypes = {};
      allErrors.forEach(error => {
        const errorType = error.message.split(':')[0] || error.message.substring(0, 50);
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });
      
      console.log('\n📈 错误类型统计:');
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} 次`);
      });
      
      // 显示前5个具体错误
      console.log('\n🔍 前5个具体错误:');
      allErrors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. 行号 ${error.rowNumber}:`);
        console.log(`     错误: ${error.message}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 检查导入日志失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行检查
checkImportLogs();