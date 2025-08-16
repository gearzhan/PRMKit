import { Router, Response } from 'express';
import { PrismaClient, Role, ProjectStatus, TimesheetStatus, CsvDataType, CsvImportStatus } from '@prisma/client';
import { authenticateToken, requireLevel1Admin, AuthenticatedRequest } from '../lib/jwt';
import multer from 'multer';
import csv from 'csv-parser';
import Joi from 'joi';
import { Readable } from 'stream';
import prisma from '../lib/prisma';

const router = Router();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// CSV字段验证模式
const employeeSchema = Joi.object({
  employeeId: Joi.string().required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid(...Object.values(Role)).required(),
  position: Joi.string().allow(''),
  isActive: Joi.boolean().default(true),
});

const projectSchema = Joi.object({
  projectCode: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  nickname: Joi.string().allow(''),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null),
  status: Joi.string().valid(...Object.values(ProjectStatus)).default('ACTIVE'),
});

const timesheetSchema = Joi.object({
  employeeId: Joi.string().required(),
  projectCode: Joi.string().required(),
  stageId: Joi.string().allow(''),
  date: Joi.date().required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  hours: Joi.number().min(0).max(24).required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid(...Object.values(TimesheetStatus)).default('DRAFT'),
});

// 导出员工数据为CSV
router.get('/export/employees', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        employeeId: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { employeeId: 'asc' },
    });

    const csvData = employees.map(emp => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      position: emp.position || '',
      isActive: emp.isActive,
      createdAt: emp.createdAt.toISOString(),
      updatedAt: emp.updatedAt.toISOString(),
    }));

    const filename = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // 手动构建CSV内容
    const header = 'Employee ID,Name,Email,Role,Position,Is Active,Created At,Updated At\n';
    const rows = csvData.map(row => 
      `"${row.employeeId}","${row.name}","${row.email}","${row.role}","${row.position}","${row.isActive}","${row.createdAt}","${row.updatedAt}"`
    ).join('\n');
    
    res.send(header + rows);
  } catch (error) {
    console.error('Export employees error:', error);
    res.status(500).json({ error: 'Failed to export employees data' });
  }
});

// 导出项目数据为CSV
router.get('/export/projects', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      select: {
        projectCode: true,
        name: true,
        description: true,
        nickname: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { projectCode: 'asc' },
    });

    const csvData = projects.map(proj => ({
      projectCode: proj.projectCode,
      name: proj.name,
      description: proj.description || '',
      nickname: proj.nickname || '',
      startDate: proj.startDate.toISOString().split('T')[0],
      endDate: proj.endDate ? proj.endDate.toISOString().split('T')[0] : '',
      status: proj.status,
      createdAt: proj.createdAt.toISOString(),
      updatedAt: proj.updatedAt.toISOString(),
    }));

    const filename = `projects_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const header = 'Project Code,Name,Description,Nickname,Start Date,End Date,Status,Created At,Updated At\n';
    const rows = csvData.map(row => 
      `"${row.projectCode}","${row.name}","${row.description}","${row.nickname}","${row.startDate}","${row.endDate}","${row.status}","${row.createdAt}","${row.updatedAt}"`
    ).join('\n');
    
    res.send(header + rows);
  } catch (error) {
    console.error('Export projects error:', error);
    res.status(500).json({ error: 'Failed to export projects data' });
  }
});

// 导出工时数据为CSV
router.get('/export/timesheets', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const timesheets = await prisma.timesheet.findMany({
      include: {
        employee: { select: { employeeId: true } },
        project: { select: { projectCode: true } },
        stage: { select: { taskId: true } },
      },
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
    });

    const csvData = timesheets.map(ts => ({
      employeeId: ts.employee.employeeId,
      projectCode: ts.project.projectCode,
      stageId: ts.stage?.taskId || '',
      date: ts.date.toISOString().split('T')[0],
      startTime: ts.startTime.toISOString(),
      endTime: ts.endTime.toISOString(),
      hours: ts.hours,
      description: ts.description || '',
      status: ts.status,
      createdAt: ts.createdAt.toISOString(),
      updatedAt: ts.updatedAt.toISOString(),
    }));

    const filename = `timesheets_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const header = 'Employee ID,Project Code,Stage ID,Date,Start Time,End Time,Hours,Description,Status,Created At,Updated At\n';
    const rows = csvData.map(row => 
      `"${row.employeeId}","${row.projectCode}","${row.stageId}","${row.date}","${row.startTime}","${row.endTime}","${row.hours}","${row.description}","${row.status}","${row.createdAt}","${row.updatedAt}"`
    ).join('\n');
    
    res.send(header + rows);
  } catch (error) {
    console.error('Export timesheets error:', error);
    res.status(500).json({ error: 'Failed to export timesheets data' });
  }
});

// 下载CSV模板
router.get('/template/:dataType', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dataType } = req.params;
    
    let header = '';
    let sampleRow = '';
    let filename = '';
    
    switch (dataType) {
      case 'employees':
        header = 'Employee ID,Name,Email,Role,Position,Is Active';
        sampleRow = 'EMP001,John Doe,john.doe@company.com,ARCHITECT,Senior Architect,true';
        filename = 'employees_template.csv';
        break;
      case 'projects':
        header = 'Project Code,Name,Description,Nickname,Start Date,End Date,Status';
        sampleRow = 'PROJ001,Sample Project,Project description,Sample,2024-01-01,2024-12-31,ACTIVE';
        filename = 'projects_template.csv';
        break;
      case 'timesheets':
        header = 'Employee ID,Project Code,Stage ID,Date,Start Time,End Time,Hours,Description,Status';
        sampleRow = 'EMP001,PROJ001,TD.01.00,2024-01-01,2024-01-01T09:00:00Z,2024-01-01T17:00:00Z,8,Daily work,DRAFT';
        filename = 'timesheets_template.csv';
        break;
      default:
        return res.status(400).json({ error: 'Invalid data type' });
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`${header}\n${sampleRow}`);
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({ error: 'Failed to download template' });
  }
});

// CSV导入验证
router.post('/import/validate', authenticateToken, requireLevel1Admin, upload.single('csvFile'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const { dataType } = req.body;
    if (!dataType || !['employees', 'projects', 'timesheets'].includes(dataType)) {
      return res.status(400).json({ error: 'Invalid data type' });
    }

    const csvContent = req.file.buffer.toString('utf8');
    const rows: any[] = [];
    const errors: any[] = [];
    let rowNumber = 0;

    // 解析CSV内容
    const stream = Readable.from([csvContent]);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          rows.push({ ...data, rowNumber });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 验证每一行数据
    const schema = dataType === 'employees' ? employeeSchema : 
                  dataType === 'projects' ? projectSchema : timesheetSchema;

    for (const row of rows) {
      const { error } = schema.validate(row, { abortEarly: false });
      if (error) {
        errors.push({
          rowNumber: row.rowNumber,
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          })),
        });
      }
    }

    // 业务逻辑验证
    if (dataType === 'employees') {
      await validateEmployeesData(rows, errors);
    } else if (dataType === 'projects') {
      await validateProjectsData(rows, errors);
    } else if (dataType === 'timesheets') {
      await validateTimesheetsData(rows, errors);
    }

    res.json({
      totalRows: rows.length,
      validRows: rows.length - errors.length,
      errorRows: errors.length,
      errors,
      preview: rows.slice(0, 5), // 预览前5行
    });
  } catch (error) {
    console.error('CSV validation error:', error);
    res.status(500).json({ error: 'Failed to validate CSV file' });
  }
});

// CSV导入执行
router.post('/import/execute', authenticateToken, requireLevel1Admin, upload.single('csvFile'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const { dataType } = req.body;
    if (!dataType || !['employees', 'projects', 'timesheets'].includes(dataType)) {
      return res.status(400).json({ error: 'Invalid data type' });
    }

    // 创建导入日志
    const importLog = await prisma.csvImportLog.create({
      data: {
        fileName: req.file.originalname,
        dataType: dataType.toUpperCase() as CsvDataType,
        operatorId: req.user!.userId,
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
        status: CsvImportStatus.PROCESSING,
      },
    });

    const csvContent = req.file.buffer.toString('utf8');
    const rows: any[] = [];
    const errors: any[] = [];
    let successCount = 0;
    let rowNumber = 0;

    // 解析CSV内容
    const stream = Readable.from([csvContent]);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          rows.push({ ...data, rowNumber });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 执行数据导入
    for (const row of rows) {
      try {
        if (dataType === 'employees') {
          await importEmployeeRow(row);
        } else if (dataType === 'projects') {
          await importProjectRow(row);
        } else if (dataType === 'timesheets') {
          await importTimesheetRow(row);
        }
        successCount++;
      } catch (error: any) {
        errors.push({
          rowNumber: row.rowNumber,
          field: null,
          value: null,
          message: error.message,
        });
        
        // 记录错误到数据库
        await prisma.csvImportError.create({
          data: {
            logId: importLog.id,
            rowNumber: row.rowNumber,
            message: error.message,
          },
        });
      }
    }

    // 更新导入日志
    const finalStatus = errors.length === 0 ? CsvImportStatus.SUCCESS : 
                       successCount > 0 ? CsvImportStatus.PARTIAL : CsvImportStatus.FAILED;

    await prisma.csvImportLog.update({
      where: { id: importLog.id },
      data: {
        totalRows: rows.length,
        successRows: successCount,
        errorRows: errors.length,
        status: finalStatus,
        endTime: new Date(),
      },
    });

    res.json({
      importId: importLog.id,
      totalRows: rows.length,
      successRows: successCount,
      errorRows: errors.length,
      status: finalStatus,
      message: `Import completed. ${successCount} rows imported successfully, ${errors.length} rows failed.`,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import CSV file' });
  }
});

// 获取导入日志
router.get('/import/logs', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const logs = await prisma.csvImportLog.findMany({
      include: {
        operator: {
          select: {
            name: true,
            employeeId: true,
          },
        },
        errors: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    });

    const total = await prisma.csvImportLog.count();

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get import logs error:', error);
    res.status(500).json({ error: 'Failed to get import logs' });
  }
});

// 获取导入日志详情
router.get('/import/logs/:id', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const log = await prisma.csvImportLog.findUnique({
      where: { id },
      include: {
        operator: {
          select: {
            name: true,
            employeeId: true,
          },
        },
        errors: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!log) {
      return res.status(404).json({ error: 'Import log not found' });
    }

    res.json({ log });
  } catch (error) {
    console.error('Get import log detail error:', error);
    res.status(500).json({ error: 'Failed to get import log detail' });
  }
});

// 辅助函数：验证员工数据
async function validateEmployeesData(rows: any[], errors: any[]) {
  const employeeIds = rows.map(row => row.employeeId).filter(Boolean);
  const emails = rows.map(row => row.email).filter(Boolean);
  
  // 检查数据库中是否已存在
  const existingEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeId: { in: employeeIds } },
        { email: { in: emails } },
      ],
    },
    select: { employeeId: true, email: true },
  });
  
  const existingEmployeeIds = new Set(existingEmployees.map(e => e.employeeId));
  const existingEmails = new Set(existingEmployees.map(e => e.email));
  
  rows.forEach(row => {
    if (existingEmployeeIds.has(row.employeeId)) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'employeeId', message: 'Employee ID already exists', value: row.employeeId }],
      });
    }
    if (existingEmails.has(row.email)) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'email', message: 'Email already exists', value: row.email }],
      });
    }
  });
}

// 辅助函数：验证项目数据
async function validateProjectsData(rows: any[], errors: any[]) {
  const projectCodes = rows.map(row => row.projectCode).filter(Boolean);
  
  const existingProjects = await prisma.project.findMany({
    where: { projectCode: { in: projectCodes } },
    select: { projectCode: true },
  });
  
  const existingProjectCodes = new Set(existingProjects.map(p => p.projectCode));
  
  rows.forEach(row => {
    if (existingProjectCodes.has(row.projectCode)) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'projectCode', message: 'Project code already exists', value: row.projectCode }],
      });
    }
  });
}

// 辅助函数：验证工时数据
async function validateTimesheetsData(rows: any[], errors: any[]) {
  const employeeIds = [...new Set(rows.map(row => row.employeeId).filter(Boolean))];
  const projectCodes = [...new Set(rows.map(row => row.projectCode).filter(Boolean))];
  
  // 验证员工是否存在
  const existingEmployees = await prisma.employee.findMany({
    where: { employeeId: { in: employeeIds } },
    select: { employeeId: true },
  });
  const validEmployeeIds = new Set(existingEmployees.map(e => e.employeeId));
  
  // 验证项目是否存在
  const existingProjects = await prisma.project.findMany({
    where: { projectCode: { in: projectCodes } },
    select: { projectCode: true },
  });
  const validProjectCodes = new Set(existingProjects.map(p => p.projectCode));
  
  rows.forEach(row => {
    if (!validEmployeeIds.has(row.employeeId)) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'employeeId', message: 'Employee not found', value: row.employeeId }],
      });
    }
    if (!validProjectCodes.has(row.projectCode)) {
      errors.push({
        rowNumber: row.rowNumber,
        errors: [{ field: 'projectCode', message: 'Project not found', value: row.projectCode }],
      });
    }
  });
}

// 辅助函数：导入员工行
async function importEmployeeRow(row: any) {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('123456', 10); // 默认密码
  
  await prisma.employee.create({
    data: {
      employeeId: row.employeeId,
      name: row.name,
      email: row.email,
      password: hashedPassword,
      role: row.role as Role,
      position: row.position || null,
      isActive: row.isActive === 'true' || row.isActive === true,
    },
  });
}

// 辅助函数：导入项目行
async function importProjectRow(row: any) {
  await prisma.project.create({
    data: {
      projectCode: row.projectCode,
      name: row.name,
      description: row.description || null,
      nickname: row.nickname || null,
      startDate: new Date(row.startDate),
      endDate: row.endDate ? new Date(row.endDate) : null,
      status: (row.status as ProjectStatus) || ProjectStatus.ACTIVE,
    },
  });
}

// 辅助函数：导入工时行
async function importTimesheetRow(row: any) {
  // 获取员工和项目ID
  const employee = await prisma.employee.findUnique({
    where: { employeeId: row.employeeId },
    select: { id: true },
  });
  
  const project = await prisma.project.findUnique({
    where: { projectCode: row.projectCode },
    select: { id: true },
  });
  
  if (!employee || !project) {
    throw new Error('Employee or project not found');
  }
  
  let stageId = null;
  if (row.stageId) {
    const stage = await prisma.stage.findUnique({
      where: { taskId: row.stageId },
      select: { id: true },
    });
    stageId = stage?.id || null;
  }
  
  await prisma.timesheet.create({
    data: {
      employeeId: employee.id,
      projectId: project.id,
      stageId,
      date: new Date(row.date),
      startTime: new Date(row.startTime),
      endTime: new Date(row.endTime),
      hours: parseFloat(row.hours),
      description: row.description || null,
      status: (row.status as TimesheetStatus) || TimesheetStatus.DRAFT,
    },
  });
}

export default router;