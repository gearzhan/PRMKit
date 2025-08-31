#!/usr/bin/env node

/**
 * 健康检查脚本
 * 用于监控生产环境服务状态
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

// 配置
const config = {
  url: process.env.HEALTH_CHECK_URL || 'http://localhost:3001/api/health',
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3,
  interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 1000
};

/**
 * 执行健康检查
 */
function performHealthCheck(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.get(url, {
      timeout: timeout,
      headers: {
        'User-Agent': 'Health-Check/1.0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            status: 'healthy',
            statusCode: res.statusCode,
            response: data,
            timestamp: new Date().toISOString()
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`请求超时 (${timeout}ms)`));
    });
  });
}

/**
 * 带重试的健康检查
 */
async function healthCheckWithRetry() {
  let lastError;
  
  for (let attempt = 1; attempt <= config.retries; attempt++) {
    try {
      console.log(`🔍 健康检查 (尝试 ${attempt}/${config.retries})...`);
      
      const result = await performHealthCheck(config.url, config.timeout);
      
      console.log('✅ 服务健康状态良好');
      console.log(`📊 状态码: ${result.statusCode}`);
      console.log(`⏰ 时间戳: ${result.timestamp}`);
      
      if (result.response) {
        try {
          const parsed = JSON.parse(result.response);
          console.log('📋 响应数据:', JSON.stringify(parsed, null, 2));
        } catch {
          console.log('📋 响应数据:', result.response.substring(0, 200));
        }
      }
      
      return 0; // 成功退出码
      
    } catch (error) {
      lastError = error;
      console.error(`❌ 健康检查失败 (尝试 ${attempt}/${config.retries}):`, error.message);
      
      if (attempt < config.retries) {
        console.log(`⏳ ${config.interval}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, config.interval));
      }
    }
  }
  
  console.error('💀 所有健康检查尝试均失败');
  console.error('🔧 最后一次错误:', lastError.message);
  return 1; // 失败退出码
}

/**
 * 连续监控模式
 */
async function continuousMonitoring() {
  const monitorInterval = parseInt(process.env.MONITOR_INTERVAL) || 30000;
  
  console.log(`🔄 启动连续监控模式，间隔: ${monitorInterval}ms`);
  console.log('按 Ctrl+C 停止监控\n');
  
  while (true) {
    const exitCode = await healthCheckWithRetry();
    
    if (exitCode !== 0) {
      console.log('⚠️  服务异常，继续监控...\n');
    } else {
      console.log('✅ 监控正常\n');
    }
    
    await new Promise(resolve => setTimeout(resolve, monitorInterval));
  }
}

// 主函数
async function main() {
  console.log('🏥 PRMKit 健康检查工具');
  console.log(`🎯 目标URL: ${config.url}`);
  console.log(`⏱️  超时时间: ${config.timeout}ms`);
  console.log(`🔄 重试次数: ${config.retries}`);
  console.log('---');
  
  const args = process.argv.slice(2);
  const isMonitorMode = args.includes('--monitor') || args.includes('-m');
  
  try {
    if (isMonitorMode) {
      await continuousMonitoring();
    } else {
      const exitCode = await healthCheckWithRetry();
      process.exit(exitCode);
    }
  } catch (error) {
    console.error('💥 健康检查工具异常:', error.message);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，正在退出...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在退出...');
  process.exit(0);
});

// 启动
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { performHealthCheck, healthCheckWithRetry };