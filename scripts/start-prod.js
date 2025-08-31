#!/usr/bin/env node

/**
 * 生产环境启动脚本
 * 提供更好的错误处理、日志记录和进程管理
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 设置环境变量
process.env.NODE_ENV = 'production';

// 加载生产环境配置
const envPath = path.join(process.cwd(), '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  });
  console.log('✅ 已加载生产环境配置文件');
} else {
  console.warn('⚠️  未找到 .env.production 文件，使用默认环境变量');
}

// 检查必要文件是否存在
const serverPath = path.join(process.cwd(), 'dist', 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ 服务器文件不存在，请先运行 npm run build');
  process.exit(1);
}

// 检查环境变量
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}

console.log('🚀 启动生产环境服务器...');
console.log(`📁 工作目录: ${process.cwd()}`);
console.log(`🌍 环境: ${process.env.NODE_ENV}`);
console.log(`🔗 数据库: ${process.env.DATABASE_URL ? '已配置' : '未配置'}`);

// 启动服务器
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ 服务器启动失败:', error.message);
  process.exit(1);
});

server.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`❌ 服务器异常退出，代码: ${code}, 信号: ${signal}`);
    process.exit(code);
  }
  console.log('✅ 服务器正常关闭');
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('\n🛑 收到 SIGTERM 信号，正在关闭服务器...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('\n🛑 收到 SIGINT 信号，正在关闭服务器...');
  server.kill('SIGINT');
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获异常:', error);
  server.kill('SIGTERM');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  server.kill('SIGTERM');
  process.exit(1);
});