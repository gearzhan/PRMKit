/**
 * PM2 生态系统配置文件
 * 用于生产环境进程管理和监控
 */

module.exports = {
  apps: [
    {
      name: 'prmkit-server',
      script: './dist/server.js',
      cwd: './',
      
      // 实例配置
      instances: process.env.PM2_INSTANCES || 'max', // 使用所有CPU核心
      exec_mode: 'cluster', // 集群模式
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // 生产环境配置
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      
      // 监控和重启配置
      watch: false, // 生产环境不监听文件变化
      ignore_watch: ['node_modules', 'logs', 'dist'],
      
      // 内存和CPU限制
      max_memory_restart: '1G', // 内存超过1GB时重启
      
      // 重启策略
      restart_delay: 4000, // 重启延迟4秒
      max_restarts: 10, // 最大重启次数
      min_uptime: '10s', // 最小运行时间
      
      // 日志配置
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 进程配置
      kill_timeout: 5000, // 强制杀死进程的超时时间
      listen_timeout: 3000, // 监听超时时间
      
      // 健康检查
      health_check_grace_period: 3000,
      
      // 自动重启条件
      autorestart: true,
      
      // 源码映射支持
      source_map_support: true,
      
      // 实例变量
      instance_var: 'INSTANCE_ID',
      
      // 进程标题
      name: 'prmkit-server'
    }
  ],
  
  // 部署配置
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'deploy',
      host: process.env.DEPLOY_HOST || 'localhost',
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO || 'git@github.com:username/prmkit.git',
      path: process.env.DEPLOY_PATH || '/var/www/prmkit',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};