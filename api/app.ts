/**
 * This is a API server
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import winston from 'winston';
import { fileURLToPath } from 'url';

// 导入路由
import authRoutes from './routes/auth.js';
import timesheetRoutes from './routes/timesheets.js';
import projectRoutes from './routes/projects.js';
import approvalRoutes from './routes/approvals.js';
import reportRoutes from './routes/reports.js';
import stageRoutes from './routes/stages.js';

// for esm mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load env
dotenv.config();

// 配置日志
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

const app: express.Application = express();

// 中间件
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  next();
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stages', stageRoutes);

/**
 * health
 */
app.use('/api/health', (req: Request, res: Response, next: NextFunction): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * 404 handler
 */
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
  });
});

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
});

export default app;