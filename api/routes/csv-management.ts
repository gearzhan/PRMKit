import { Router, Response } from 'express';
import { PrismaClient, Role, ProjectStatus, TimesheetStatus, CsvDataType, CsvImportStatus } from '@prisma/client';
import { authenticateToken, requireLevel1Admin, AuthenticatedRequest } from '../lib/jwt.js';
import multer from 'multer';
import csv from 'csv-parser';
import Joi from 'joi';
import { Readable } from 'stream';
import prisma from '../lib/prisma.js';

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
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  hours: Joi.number().min(0).max(24).optional(),
  duration: Joi.number().min(0).max(24).optional(), // 支持旧数据的duration字段
  description: Joi.string().allow(''),
  status: Joi.string().valid(...Object.values(TimesheetStatus)).default('DRAFT'),
});

// Timesheet数据转换工具函数
function convertTimesheetData(row: any): any {
  const convertedRow = { ...row };
  
  // 处理旧数据格式转换
  if (!row.startTime && !row.endTime && (row.hours || row.duration)) {
    // 如果没有开始和结束时间，但有工作时长，则默认从上午9点开始
    const dateStr = row.date;
    
    // 验证日期字符串是否有效
    let startTime: Date;
    try {
      // 尝试解析日期，支持多种格式
      if (typeof dateStr === 'string') {
        // 如果是字符串，尝试不同的日期格式
        if (dateStr.includes('T') || dateStr.includes('Z')) {
          // 已经是ISO格式
          startTime = new Date(dateStr);
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD格式，添加时间部分（使用本地时间而不是UTC）
          startTime = new Date(`${dateStr}T09:00:00`);
        } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // DD/MM/YYYY格式，转换为标准格式
          const [day, month, year] = dateStr.split('/');
          startTime = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T09:00:00`);
          console.log(`🔄 Converted DD/MM/YYYY date: ${dateStr} -> ${startTime.toISOString()}`);
        } else {
          // 其他格式，尝试直接解析
          startTime = new Date(dateStr);
          if (!isNaN(startTime.getTime())) {
            startTime.setHours(9, 0, 0, 0);
          }
        }
      } else if (dateStr instanceof Date) {
        // 如果已经是Date对象
        startTime = new Date(dateStr);
        startTime.setHours(9, 0, 0, 0);
      } else {
        throw new Error('Invalid date format');
      }
      
      // 检查日期是否有效
      if (isNaN(startTime.getTime())) {
        throw new Error('Invalid date value');
      }
    } catch (error) {
      console.error(`❌ Invalid date in timesheet data: ${dateStr}`, error);
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    // 使用duration或hours字段计算结束时间
    const workHours = row.duration || row.hours;
    if (!workHours || workHours <= 0) {
      throw new Error(`Invalid work hours: ${workHours}`);
    }
    
    const endTime = new Date(startTime);
    
    // 处理0.1小时到15分钟的转换
    // 将小时转换为分钟，然后四舍五入到最近的15分钟
    const totalMinutes = Math.round((workHours * 60) / 15) * 15;
    endTime.setMinutes(endTime.getMinutes() + totalMinutes);
    
    convertedRow.startTime = startTime.toISOString();
    convertedRow.endTime = endTime.toISOString();
    convertedRow.hours = totalMinutes / 60; // 转换回小时
    
    console.log(`🔄 Converted legacy timesheet data:`);
    console.log(`  - Original date: ${dateStr}`);
    console.log(`  - Original duration/hours: ${workHours}`);
    console.log(`  - Converted to: ${startTime.toISOString()} - ${endTime.toISOString()}`);
    console.log(`  - Final hours: ${convertedRow.hours}`);
  } else if (row.startTime && row.endTime) {
    // 如果已有开始和结束时间，则忽略duration字段，重新计算hours
    let start: Date, end: Date;
    try {
      start = new Date(row.startTime);
      end = new Date(row.endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid start or end time');
      }
    } catch (error) {
      console.error(`❌ Invalid start/end time in timesheet data:`, { startTime: row.startTime, endTime: row.endTime }, error);
      throw new Error(`Invalid start/end time format`);
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // 四舍五入到最近的0.25小时（15分钟）
    convertedRow.hours = Math.round(diffHours * 4) / 4;
    
    console.log(`✅ Using provided start/end times, calculated hours: ${convertedRow.hours}`);
  }
  
  // 清理不需要的字段
  delete convertedRow.duration;
  
  return convertedRow;
}

// 时间单位转换函数：将0.1小时转换为15分钟单位
function convertTimeUnit(hours: number): number {
  // 将小时转换为分钟，然后四舍五入到最近的15分钟，再转换回小时
  const minutes = Math.round((hours * 60) / 15) * 15;
  return minutes / 60;
}

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

    const { dataType, duplicateDecisions } = req.body;
    if (!dataType || !['EMPLOYEE', 'PROJECT', 'TIMESHEET'].includes(dataType)) {
      return res.status(400).json({ error: 'Invalid data type' });
    }
    
    // 解析重复数据决策
    let decisions: { [key: number]: 'skip' | 'replace' } = {};
    if (duplicateDecisions) {
      try {
        decisions = JSON.parse(duplicateDecisions);
        console.log('Parsed duplicate decisions:', decisions);
      } catch (error) {
        console.error('Failed to parse duplicate decisions:', error);
      }
    }

    const csvContent = req.file.buffer.toString('utf8');
    const rows: any[] = [];
    const errors: any[] = [];
    let rowNumber = 0;

    // 日期格式转换函数：将DD/M/YYYY或D/M/YYYY格式转换为YYYY-MM-DD
    const convertDateFormat = (dateStr: string): string | null => {
      if (!dateStr || dateStr.trim() === '') return null;
      
      try {
        // 匹配DD/M/YYYY或D/M/YYYY格式
        const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          // 补零并格式化为YYYY-MM-DD
          const formattedMonth = month.padStart(2, '0');
          const formattedDay = day.padStart(2, '0');
          return `${year}-${formattedMonth}-${formattedDay}`;
        }
        
        // 如果已经是标准格式，直接返回
        const isoMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) {
          return dateStr;
        }
        
        console.warn(`无法解析日期格式: ${dateStr}`);
        return null;
      } catch (error) {
        console.error(`日期转换错误: ${dateStr}`, error);
        return null;
      }
    };

    // CSV字段映射函数
    const mapCsvFields = (data: any, dataType: string) => {
      const mappedData: any = {}; // 只返回映射后的字段，不包含原始字段
      
      if (dataType === 'EMPLOYEE') {
        // 员工数据字段映射
        if (data['Employee ID']) mappedData.employeeId = data['Employee ID'];
        if (data['Name']) mappedData.name = data['Name'];
        if (data['Email']) mappedData.email = data['Email'];
        if (data['Role']) mappedData.role = data['Role'];
        if (data['Position']) mappedData.position = data['Position'];
        if (data['Is Active']) {
          // 处理布尔值转换
          const isActiveValue = data['Is Active'];
          if (typeof isActiveValue === 'string') {
            mappedData.isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === '1' || isActiveValue.toLowerCase() === 'active';
          } else {
            mappedData.isActive = Boolean(isActiveValue);
          }
        }
      } else if (dataType === 'PROJECT') {
        // 项目数据字段映射
        if (data['Project Code']) mappedData.projectCode = data['Project Code'];
        if (data['Name']) mappedData.name = data['Name'];
        if (data['Description']) mappedData.description = data['Description'];
        if (data['Nickname']) mappedData.nickname = data['Nickname'];
        // 日期字段需要格式转换
        if (data['Start Date']) {
          const convertedDate = convertDateFormat(data['Start Date']);
          if (convertedDate) {
            mappedData.startDate = convertedDate;
          }
        }
        if (data['End Date']) {
          const convertedDate = convertDateFormat(data['End Date']);
          if (convertedDate) {
            mappedData.endDate = convertedDate;
          }
        }
        if (data['Status']) mappedData.status = data['Status'];
      } else if (dataType === 'TIMESHEET') {
        // 工时数据字段映射
        if (data['Employee ID']) mappedData.employeeId = data['Employee ID'];
        if (data['Project Code']) mappedData.projectCode = data['Project Code'];
        if (data['Stage ID']) mappedData.stageId = data['Stage ID'];
        // 日期字段需要格式转换
        if (data['Date']) {
          const convertedDate = convertDateFormat(data['Date']);
          if (convertedDate) {
            mappedData.date = convertedDate;
          } else {
            console.warn(`无法转换日期格式: ${data['Date']}`);
            mappedData.date = data['Date']; // 保留原始值，让后续验证处理
          }
        }
        // 处理时间字段，只有非空值才设置
        if (data['Start Time'] && data['Start Time'].trim() !== '') {
          mappedData.startTime = data['Start Time'];
        }
        if (data['End Time'] && data['End Time'].trim() !== '') {
          mappedData.endTime = data['End Time'];
        }
        if (data['Hours']) {
          const hoursValue = parseFloat(data['Hours']);
          if (!isNaN(hoursValue)) {
            mappedData.hours = hoursValue;
          }
        }
        if (data['Duration']) {
          const durationValue = parseFloat(data['Duration']);
          if (!isNaN(durationValue)) {
            mappedData.duration = durationValue;
          }
        }
        if (data['Description']) mappedData.description = data['Description'];
        if (data['Status']) mappedData.status = data['Status'];
        
        // 应用timesheet数据转换规则
        try {
          const convertedData = convertTimesheetData(mappedData);
          Object.assign(mappedData, convertedData);
        } catch (conversionError) {
          console.error(`❌ Timesheet data conversion failed for row ${rowNumber}:`, conversionError);
          // 将转换错误标记到数据中，稍后在验证阶段处理
          mappedData._conversionError = {
            message: conversionError instanceof Error ? conversionError.message : 'Data conversion failed',
            field: 'date/time'
          };
        }
      }
      
      return mappedData;
    };

    // 解析CSV内容
    const stream = Readable.from([csvContent]);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          // 应用字段映射
          const mappedData = mapCsvFields(data, dataType);
          rows.push({ ...mappedData, rowNumber });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 验证每一行数据
    const schema = dataType === 'EMPLOYEE' ? employeeSchema : 
                  dataType === 'PROJECT' ? projectSchema : timesheetSchema;

    console.log(`\n=== CSV Validation Debug Info ===`);
    console.log(`Data Type: ${dataType}`);
    console.log(`Total Rows: ${rows.length}`);
    console.log(`Schema being used:`, schema.describe());
    
    if (dataType === 'EMPLOYEE') {
      console.log(`Role enum values:`, Object.values(Role));
    }

    for (const row of rows) {
      console.log(`\n--- Validating Row ${row.rowNumber} ---`);
      console.log(`Row data:`, JSON.stringify(row, null, 2));
      
      // 检查是否有转换错误
      if (row._conversionError) {
        console.log(`❌ Data conversion failed for row ${row.rowNumber}:`, row._conversionError.message);
        errors.push({
          rowNumber: row.rowNumber,
          errors: [{
            field: row._conversionError.field,
            message: row._conversionError.message,
            value: 'conversion_failed',
          }],
        });
        continue; // 跳过Joi验证，因为转换已经失败
      }
      
      // 从验证数据中移除rowNumber和_conversionError字段，因为它们不在Joi schema中
      const { rowNumber, _conversionError, ...validationData } = row;
      const { error, value } = schema.validate(validationData, { abortEarly: false });
      
      if (error) {
        console.log(`❌ Validation failed for row ${row.rowNumber}:`);
        error.details.forEach(detail => {
          console.log(`  - Field: ${detail.path.join('.')}`);
          console.log(`  - Message: ${detail.message}`);
          console.log(`  - Value: ${JSON.stringify(detail.context?.value)}`);
          console.log(`  - Context:`, detail.context);
        });
        
        // 创建用户友好的错误信息
        const friendlyErrors = error.details.map(detail => {
          const field = detail.path.join('.');
          let friendlyMessage = detail.message;
          
          // 根据字段和错误类型提供更友好的错误信息
          switch (field) {
            case 'employeeId':
              if (detail.type === 'any.required') {
                friendlyMessage = '员工ID不能为空';
              }
              break;
            case 'projectCode':
              if (detail.type === 'any.required') {
                friendlyMessage = '项目代码不能为空';
              }
              break;
            case 'date':
              if (detail.type === 'date.base') {
                friendlyMessage = `日期格式无效: ${detail.context?.value}。请使用DD/MM/YYYY格式（如：11/11/2024）`;
              } else if (detail.type === 'any.required') {
                friendlyMessage = '日期不能为空';
              }
              break;
            case 'hours':
              if (detail.type === 'number.base') {
                friendlyMessage = `工时必须是数字: ${detail.context?.value}`;
              } else if (detail.type === 'number.min') {
                friendlyMessage = '工时不能小于0';
              } else if (detail.type === 'number.max') {
                friendlyMessage = '工时不能超过24小时';
              }
              break;
            case 'startTime':
              if (detail.type === 'date.base') {
                friendlyMessage = `开始时间格式无效: ${detail.context?.value}`;
              }
              break;
            case 'endTime':
              if (detail.type === 'date.base') {
                friendlyMessage = `结束时间格式无效: ${detail.context?.value}`;
              }
              break;
            case 'status':
              if (detail.type === 'any.only') {
                friendlyMessage = `状态值无效: ${detail.context?.value}。允许的值: DRAFT, SUBMITTED, APPROVED`;
              }
              break;
          }
          
          return {
            field,
            message: friendlyMessage,
            value: detail.context?.value,
            originalMessage: detail.message
          };
        });
        
        errors.push({
          rowNumber: row.rowNumber,
          errors: friendlyErrors,
        });
      } else {
        console.log(`✅ Row ${row.rowNumber} validation passed`);
        console.log(`Validated value:`, JSON.stringify(value, null, 2));
      }
    }
    
    console.log(`\n=== Validation Summary ===`);
    console.log(`Total errors: ${errors.length}`);
    console.log(`Valid rows: ${rows.length - errors.length}`);

    // 业务逻辑验证
    const duplicates: any[] = [];
    if (dataType === 'EMPLOYEE') {
        await validateEmployeesData(rows, errors, duplicates);
      } else if (dataType === 'PROJECT') {
        await validateProjectsData(rows, errors, duplicates);
      } else if (dataType === 'TIMESHEET') {
        await validateTimesheetsData(rows, errors, duplicates);
      }

    res.json({
      totalRows: rows.length,
      validRows: rows.length - errors.length - duplicates.length,
      errorRows: errors.length,
      duplicateRows: duplicates.length,
      errors,
      duplicates,
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
    if (!dataType || !['EMPLOYEE', 'PROJECT', 'TIMESHEET'].includes(dataType)) {
      return res.status(400).json({ error: 'Invalid data type' });
    }

    // 创建导入日志
    const importLog = await prisma.csvImportLog.create({
      data: {
        fileName: req.file.originalname,
        dataType: dataType as CsvDataType,
        operatorId: req.user!.userId,
        totalRows: 0,
        successRows: 0,
        errorRows: 0,
        status: CsvImportStatus.PROCESSING,
      },
    });

    // 解析重复数据决策
    let duplicateDecisions: { [key: number]: 'skip' | 'replace' } = {};
    if (req.body.duplicateDecisions) {
      try {
        duplicateDecisions = JSON.parse(req.body.duplicateDecisions);
        console.log('Parsed duplicate decisions:', duplicateDecisions);
      } catch (error) {
        console.error('Failed to parse duplicate decisions:', error);
      }
    }

    const csvContent = req.file.buffer.toString('utf8');
    const rows: any[] = [];
    const errors: any[] = [];
    let successCount = 0;
    let rowNumber = 0;

    // 日期格式转换函数：将DD/M/YYYY或D/M/YYYY格式转换为YYYY-MM-DD
    const convertDateFormat = (dateStr: string): string | null => {
      if (!dateStr || dateStr.trim() === '') return null;
      
      try {
        // 匹配DD/M/YYYY或D/M/YYYY格式
        const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          // 补零并格式化为YYYY-MM-DD
          const formattedMonth = month.padStart(2, '0');
          const formattedDay = day.padStart(2, '0');
          return `${year}-${formattedMonth}-${formattedDay}`;
        }
        
        // 如果已经是标准格式，直接返回
        const isoMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) {
          return dateStr;
        }
        
        console.warn(`无法解析日期格式: ${dateStr}`);
        return null;
      } catch (error) {
        console.error(`日期转换错误: ${dateStr}`, error);
        return null;
      }
    };

    // CSV字段映射函数（与验证路由保持一致）
    const mapCsvFields = (data: any, dataType: string) => {
      const mappedData = { ...data };
      
      if (dataType === 'EMPLOYEE') {
        // 员工数据字段映射
        if (data['Employee ID']) mappedData.employeeId = data['Employee ID'];
        if (data['Name']) mappedData.name = data['Name'];
        if (data['Email']) mappedData.email = data['Email'];
        if (data['Role']) mappedData.role = data['Role'];
        if (data['Position']) mappedData.position = data['Position'];
        if (data['Is Active']) {
          // 处理布尔值转换
          const isActiveValue = data['Is Active'];
          if (typeof isActiveValue === 'string') {
            mappedData.isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === '1' || isActiveValue.toLowerCase() === 'active';
          } else {
            mappedData.isActive = Boolean(isActiveValue);
          }
        }
      } else if (dataType === 'PROJECT') {
        // 项目数据字段映射
        if (data['Project Code']) mappedData.projectCode = data['Project Code'];
        if (data['Name']) mappedData.name = data['Name'];
        if (data['Description']) mappedData.description = data['Description'];
        if (data['Nickname']) mappedData.nickname = data['Nickname'];
        // 日期字段需要格式转换
        if (data['Start Date']) {
          const convertedDate = convertDateFormat(data['Start Date']);
          if (convertedDate) {
            mappedData.startDate = convertedDate;
          }
        }
        if (data['End Date']) {
          const convertedDate = convertDateFormat(data['End Date']);
          if (convertedDate) {
            mappedData.endDate = convertedDate;
          }
        }
        if (data['Status']) mappedData.status = data['Status'];
      } else if (dataType === 'TIMESHEET') {
        // 工时数据字段映射
        if (data['Employee ID']) mappedData.employeeId = data['Employee ID'];
        if (data['Project Code']) mappedData.projectCode = data['Project Code'];
        if (data['Stage ID']) mappedData.stageId = data['Stage ID'];
        if (data['Date']) mappedData.date = data['Date'];
        if (data['Start Time']) mappedData.startTime = data['Start Time'];
        if (data['End Time']) mappedData.endTime = data['End Time'];
        if (data['Hours']) mappedData.hours = parseFloat(data['Hours']);
        if (data['Duration']) mappedData.duration = parseFloat(data['Duration']);
        if (data['Description']) mappedData.description = data['Description'];
        if (data['Status']) mappedData.status = data['Status'];
        
        // 应用timesheet数据转换规则
        const convertedData = convertTimesheetData(mappedData);
        Object.assign(mappedData, convertedData);
      }
      
      return mappedData;
    };

    // 解析CSV内容
    const stream = Readable.from([csvContent]);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          // 应用字段映射
          const mappedData = mapCsvFields(data, dataType);
          rows.push({ ...mappedData, rowNumber });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 执行数据导入
    for (const row of rows) {
      try {
        // 检查是否为重复数据且用户选择跳过
        const rowDecision = duplicateDecisions[row.rowNumber];
        if (rowDecision === 'skip') {
          console.log(`Skipping row ${row.rowNumber} as per user decision`);
          continue;
        }
        
        if (dataType === 'EMPLOYEE') {
          await importEmployeeRow(row, rowDecision === 'replace');
        } else if (dataType === 'PROJECT') {
          await importProjectRow(row, rowDecision === 'replace');
        } else if (dataType === 'TIMESHEET') {
          await importTimesheetRow(row, rowDecision === 'replace');
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
async function validateEmployeesData(rows: any[], errors: any[], duplicates: any[] = []) {
  const employeeIds = rows.map(row => row.employeeId).filter(Boolean);
  const emails = rows.map(row => row.email).filter(Boolean);
  
  // 检查数据库中是否已存在，获取完整的员工信息用于对比
  const existingEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeId: { in: employeeIds } },
        { email: { in: emails } },
      ],
    },
    select: { 
      employeeId: true, 
      email: true, 
      name: true, 
      role: true, 
      position: true, 
      isActive: true 
    },
  });
  
  const existingEmployeeIds = new Set(existingEmployees.map(e => e.employeeId));
  const existingEmails = new Set(existingEmployees.map(e => e.email));
  
  // 创建映射以便快速查找现有员工数据
  const existingEmployeeMap = new Map();
  existingEmployees.forEach(emp => {
    if (emp.employeeId) existingEmployeeMap.set(emp.employeeId, emp);
    if (emp.email) existingEmployeeMap.set(emp.email, emp);
  });
  
  rows.forEach(row => {
    let isDuplicate = false;
    let existingData = null;
    
    if (existingEmployeeIds.has(row.employeeId)) {
      isDuplicate = true;
      existingData = existingEmployeeMap.get(row.employeeId);
    } else if (existingEmails.has(row.email)) {
      isDuplicate = true;
      existingData = existingEmployeeMap.get(row.email);
    }
    
    if (isDuplicate && existingData) {
      // 添加到重复数据列表而不是错误列表
      duplicates.push({
        rowNumber: row.rowNumber,
        newData: {
          employeeId: row.employeeId,
          name: row.name,
          email: row.email,
          role: row.role,
          position: row.position,
          isActive: row.isActive
        },
        existingData: {
          employeeId: existingData.employeeId,
          name: existingData.name,
          email: existingData.email,
          role: existingData.role,
          position: existingData.position,
          isActive: existingData.isActive
        },
        conflictFields: [
          ...(existingEmployeeIds.has(row.employeeId) ? ['employeeId'] : []),
          ...(existingEmails.has(row.email) ? ['email'] : [])
        ]
      });
    }
  });
}

// 辅助函数：验证项目数据
async function validateProjectsData(rows: any[], errors: any[], duplicates: any[] = []) {
  const projectCodes = rows.map(row => row.projectCode).filter(Boolean);
  
  // 检查数据库中是否已存在，获取完整的项目信息用于对比
  const existingProjects = await prisma.project.findMany({
    where: { projectCode: { in: projectCodes } },
    select: { 
      projectCode: true, 
      name: true, 
      description: true, 
      nickname: true, 
      startDate: true, 
      endDate: true, 
      status: true 
    },
  });
  
  const existingProjectCodes = new Set(existingProjects.map(p => p.projectCode));
  
  // 创建映射以便快速查找现有项目数据
  const existingProjectMap = new Map();
  existingProjects.forEach(project => {
    existingProjectMap.set(project.projectCode, project);
  });
  
  rows.forEach(row => {
    if (existingProjectCodes.has(row.projectCode)) {
      const existingData = existingProjectMap.get(row.projectCode);
      
      // 添加到重复数据列表而不是错误列表
      duplicates.push({
        rowNumber: row.rowNumber,
        newData: {
          projectCode: row.projectCode,
          name: row.name,
          description: row.description,
          nickname: row.nickname,
          startDate: row.startDate,
          endDate: row.endDate,
          status: row.status
        },
        existingData: {
          projectCode: existingData.projectCode,
          name: existingData.name,
          description: existingData.description,
          nickname: existingData.nickname,
          startDate: existingData.startDate?.toISOString().split('T')[0],
          endDate: existingData.endDate?.toISOString().split('T')[0],
          status: existingData.status
        },
        conflictFields: ['projectCode']
      });
    }
  });
}

// 辅助函数：验证工时数据
async function validateTimesheetsData(rows: any[], errors: any[], duplicates: any[] = []) {
  try {
    // 过滤掉无效的行数据
    const validRows = rows.filter(row => 
      row && 
      row.employeeId && 
      row.projectCode && 
      row.date
    );
    
    if (validRows.length === 0) {
      console.log('No valid rows found for timesheet validation');
      return;
    }
    
    const employeeIds = [...new Set(validRows.map(row => row.employeeId).filter(Boolean))];
    const projectCodes = [...new Set(validRows.map(row => row.projectCode).filter(Boolean))];
    
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
    
    // 检查重复的工时记录（基于员工ID + 项目代码 + 日期的组合）
    // 使用更简单的方法：获取所有相关的工时记录，然后在内存中进行匹配
    let existingTimesheets = [];
    
    if (validRows.length > 0 && employeeIds.length > 0 && projectCodes.length > 0) {
      try {
        // 获取所有相关员工和项目的工时记录
        existingTimesheets = await prisma.timesheet.findMany({
          where: {
            AND: [
              { employee: { employeeId: { in: employeeIds } } },
              { project: { projectCode: { in: projectCodes } } }
            ]
          },
          select: {
            employee: { select: { employeeId: true } },
            project: { select: { projectCode: true } },
            date: true,
            hours: true,
            description: true,
            status: true
          }
        });
      } catch (error) {
        console.error('Error fetching existing timesheets:', error);
        // 如果查询失败，继续处理但不检查重复项
        existingTimesheets = [];
      }
    }

    // 验证每一行数据
    rows.forEach(row => {
      try {
        // 验证必填字段
        if (!row.employeeId) {
          errors.push({
            rowNumber: row.rowNumber,
            errors: [{ field: 'employeeId', message: 'Employee ID is required', value: row.employeeId }],
          });
        } else if (!validEmployeeIds.has(row.employeeId)) {
          errors.push({
            rowNumber: row.rowNumber,
            errors: [{ field: 'employeeId', message: 'Employee not found', value: row.employeeId }],
          });
        }
        
        if (!row.projectCode) {
          errors.push({
            rowNumber: row.rowNumber,
            errors: [{ field: 'projectCode', message: 'Project code is required', value: row.projectCode }],
          });
        } else if (!validProjectCodes.has(row.projectCode)) {
          errors.push({
            rowNumber: row.rowNumber,
            errors: [{ field: 'projectCode', message: 'Project not found', value: row.projectCode }],
          });
        }
        
        // 验证日期格式
        if (!row.date) {
          errors.push({
            rowNumber: row.rowNumber,
            errors: [{ field: 'date', message: 'Date is required', value: row.date }],
          });
        } else {
          let dateObj;
          try {
            // 支持DD/MM/YYYY格式
            if (typeof row.date === 'string') {
              const dateMatch = row.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (dateMatch) {
                const [, day, month, year] = dateMatch;
                dateObj = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
              } else {
                dateObj = new Date(row.date);
              }
            } else {
              dateObj = new Date(row.date);
            }
            
            if (isNaN(dateObj.getTime())) {
              errors.push({
                rowNumber: row.rowNumber,
                errors: [{ field: 'date', message: 'Invalid date format. Expected DD/MM/YYYY or YYYY-MM-DD', value: row.date }],
              });
            }
          } catch (error) {
            errors.push({
              rowNumber: row.rowNumber,
              errors: [{ field: 'date', message: 'Date parsing failed. Expected DD/MM/YYYY or YYYY-MM-DD', value: row.date }],
            });
          }
        }
        
        // 验证工时
        if (row.hours !== undefined && row.hours !== null) {
          const hoursValue = parseFloat(row.hours);
          if (isNaN(hoursValue) || hoursValue < 0) {
            errors.push({
              rowNumber: row.rowNumber,
              errors: [{ field: 'hours', message: 'Invalid hours value. Must be a positive number', value: row.hours }],
            });
          } else if (hoursValue > 24) {
            errors.push({
              rowNumber: row.rowNumber,
              errors: [{ field: 'hours', message: 'Hours cannot exceed 24 per day', value: row.hours }],
            });
          }
        } else {
          errors.push({
            rowNumber: row.rowNumber,
            errors: [{ field: 'hours', message: 'Hours is required', value: row.hours }],
          });
        }
        
        // 验证开始时间格式（可选字段）
        if (row.startTime && row.startTime.trim() !== '') {
          const timePattern = /^\d{1,2}:\d{2}$/;
          if (!timePattern.test(row.startTime)) {
            errors.push({
              rowNumber: row.rowNumber,
              errors: [{ field: 'startTime', message: 'Invalid start time format. Expected HH:MM', value: row.startTime }],
            });
          } else {
            const [hours, minutes] = row.startTime.split(':').map(Number);
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              errors.push({
                rowNumber: row.rowNumber,
                errors: [{ field: 'startTime', message: 'Invalid start time. Hours: 0-23, Minutes: 0-59', value: row.startTime }],
              });
            }
          }
        }
        
        // 验证结束时间格式（可选字段）
        if (row.endTime && row.endTime.trim() !== '') {
          const timePattern = /^\d{1,2}:\d{2}$/;
          if (!timePattern.test(row.endTime)) {
            errors.push({
              rowNumber: row.rowNumber,
              errors: [{ field: 'endTime', message: 'Invalid end time format. Expected HH:MM', value: row.endTime }],
            });
          } else {
            const [hours, minutes] = row.endTime.split(':').map(Number);
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              errors.push({
                rowNumber: row.rowNumber,
                errors: [{ field: 'endTime', message: 'Invalid end time. Hours: 0-23, Minutes: 0-59', value: row.endTime }],
              });
            }
          }
        }
        
        // 验证开始时间和结束时间的逻辑关系
        if (row.startTime && row.endTime && row.startTime.trim() !== '' && row.endTime.trim() !== '') {
          try {
            const [startHours, startMinutes] = row.startTime.split(':').map(Number);
            const [endHours, endMinutes] = row.endTime.split(':').map(Number);
            const startTotalMinutes = startHours * 60 + startMinutes;
            const endTotalMinutes = endHours * 60 + endMinutes;
            
            if (startTotalMinutes >= endTotalMinutes) {
              errors.push({
                rowNumber: row.rowNumber,
                errors: [{ field: 'endTime', message: 'End time must be after start time', value: `${row.startTime} - ${row.endTime}` }],
              });
            }
          } catch (error) {
            // 时间格式错误已在上面处理
          }
        }
        
        // 检查重复的工时记录
        if (row.employeeId && row.projectCode && row.date) {
          try {
            const rowDate = new Date(row.date);
            if (!isNaN(rowDate.getTime())) {
              // 在现有工时记录中查找匹配项
              const matchingTimesheet = existingTimesheets.find(timesheet => {
                const timesheetDate = new Date(timesheet.date);
                return timesheet.employee.employeeId === row.employeeId &&
                       timesheet.project.projectCode === row.projectCode &&
                       timesheetDate.toISOString().split('T')[0] === rowDate.toISOString().split('T')[0];
              });
              
              if (matchingTimesheet) {
                // 添加到重复数据列表而不是错误列表
                duplicates.push({
                  rowNumber: row.rowNumber,
                  newData: {
                    employeeId: row.employeeId,
                    projectCode: row.projectCode,
                    date: row.date,
                    hours: row.hours,
                    description: row.description,
                    status: row.status
                  },
                  existingData: {
                    employeeId: matchingTimesheet.employee.employeeId,
                    projectCode: matchingTimesheet.project.projectCode,
                    date: matchingTimesheet.date.toISOString().split('T')[0],
                    hours: matchingTimesheet.hours,
                    description: matchingTimesheet.description,
                    status: matchingTimesheet.status
                  },
                  conflictFields: ['employeeId', 'projectCode', 'date']
                });
              }
            }
          } catch (dateError) {
            console.warn(`Error processing date for duplicate check in row ${row.rowNumber}:`, dateError);
          }
        }
      } catch (error) {
        console.error(`Error validating row ${row.rowNumber}:`, error);
        errors.push({
          rowNumber: row.rowNumber,
          errors: [{ field: 'general', message: 'Row validation failed', value: error.message }],
        });
      }
    });
  } catch (error) {
    console.error('Error in validateTimesheetsData:', error);
    throw new Error(`Timesheet validation failed: ${error.message}`);
  }
}

// 辅助函数：导入员工行
async function importEmployeeRow(row: any, shouldReplace: boolean = false) {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('123456', 10); // 默认密码
  
  // 详细的isActive字段转换逻辑和日志
  console.log(`\n=== ImportEmployeeRow Debug - Row ${row.rowNumber || 'unknown'} ===`);
  console.log(`Original isActive value:`, row.isActive);
  console.log(`Type of isActive:`, typeof row.isActive);
  console.log(`Should replace:`, shouldReplace);
  
  // 更完善的布尔值转换逻辑
  let isActiveValue = false;
  if (row.isActive !== undefined && row.isActive !== null) {
    if (typeof row.isActive === 'boolean') {
      isActiveValue = row.isActive;
    } else if (typeof row.isActive === 'string') {
      const lowerValue = row.isActive.toLowerCase().trim();
      isActiveValue = lowerValue === 'true' || 
                     lowerValue === '1' || 
                     lowerValue === 'yes' || 
                     lowerValue === 'active' || 
                     lowerValue === 'on';
    } else if (typeof row.isActive === 'number') {
      isActiveValue = row.isActive !== 0;
    } else {
      // 对于其他类型，尝试转换为布尔值
      isActiveValue = Boolean(row.isActive);
    }
  }
  
  console.log(`Converted isActive value:`, isActiveValue);
  
  const employeeData = {
    employeeId: row.employeeId,
    name: row.name,
    email: row.email,
    password: hashedPassword,
    role: row.role as Role,
    position: row.position || null,
    isActive: isActiveValue,
  };
  
  console.log(`Final employee data:`, JSON.stringify(employeeData, null, 2));
  
  if (shouldReplace) {
    // 替换模式：先删除现有记录，再创建新记录
    await prisma.employee.deleteMany({
      where: {
        OR: [
          { employeeId: row.employeeId },
          { email: row.email }
        ]
      }
    });
    console.log(`🔄 Existing employee with ID ${row.employeeId} or email ${row.email} deleted for replacement`);
  }
  
  await prisma.employee.create({
    data: employeeData,
  });
  
  console.log(`✅ Employee ${row.employeeId} ${shouldReplace ? 'replaced' : 'imported'} successfully`);
}

// 辅助函数：导入项目行
async function importProjectRow(row: any, shouldReplace: boolean = false) {
  if (shouldReplace) {
    // 替换模式：先删除现有记录，再创建新记录
    await prisma.project.deleteMany({
      where: { projectCode: row.projectCode }
    });
    console.log(`🔄 Existing project with code ${row.projectCode} deleted for replacement`);
  }
  
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
  
  console.log(`✅ Project ${row.projectCode} ${shouldReplace ? 'replaced' : 'imported'} successfully`);
}

// 辅助函数：导入工时行
async function importTimesheetRow(row: any, shouldReplace: boolean = false) {
  console.log(`\n=== ImportTimesheetRow Debug - Row ${row.rowNumber || 'unknown'} ===`);
  console.log('Raw row data:', JSON.stringify(row, null, 2));
  console.log(`Replace mode: ${shouldReplace}`);
  console.log(`Employee ID: ${row.employeeId}, Project Code: ${row.projectCode}`);
  console.log(`Date: ${row.date}, StartTime: ${row.startTime}, EndTime: ${row.endTime}, Hours: ${row.hours}`);
  
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
    throw new Error(`Employee (${row.employeeId}) or project (${row.projectCode}) not found`);
  }
  
  let stageId = null;
  if (row.stageId) {
    const stage = await prisma.stage.findUnique({
      where: { taskId: row.stageId },
      select: { id: true },
    });
    stageId = stage?.id || null;
  }
  
  // 处理日期转换
  let dateValue: Date;
  try {
    if (typeof row.date === 'string') {
      // 处理DD/MM/YYYY格式
      const dateMatch = row.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        dateValue = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      } else {
        dateValue = new Date(row.date);
      }
    } else {
      dateValue = new Date(row.date);
    }
    
    if (isNaN(dateValue.getTime())) {
      throw new Error(`Invalid date format: ${row.date}`);
    }
  } catch (error) {
    throw new Error(`Date conversion failed for: ${row.date}`);
  }
  
  // 处理时间字段 - 允许为空
  let startTimeValue: Date | null = null;
  let endTimeValue: Date | null = null;
  
  if (row.startTime && row.startTime.trim() !== '') {
    try {
      // 如果startTime是时间格式(HH:mm)，需要结合日期
      if (typeof row.startTime === 'string' && row.startTime.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = row.startTime.split(':');
        startTimeValue = new Date(dateValue);
        startTimeValue.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        startTimeValue = new Date(row.startTime);
      }
      
      if (isNaN(startTimeValue.getTime())) {
        console.warn(`Invalid start time: ${row.startTime}, setting to null`);
        startTimeValue = null;
      }
    } catch (error) {
      console.warn(`Start time conversion failed: ${row.startTime}, setting to null`);
      startTimeValue = null;
    }
  }
  
  if (row.endTime && row.endTime.trim() !== '') {
    try {
      // 如果endTime是时间格式(HH:mm)，需要结合日期
      if (typeof row.endTime === 'string' && row.endTime.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = row.endTime.split(':');
        endTimeValue = new Date(dateValue);
        endTimeValue.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        endTimeValue = new Date(row.endTime);
      }
      
      if (isNaN(endTimeValue.getTime())) {
        console.warn(`Invalid end time: ${row.endTime}, setting to null`);
        endTimeValue = null;
      }
    } catch (error) {
      console.warn(`End time conversion failed: ${row.endTime}, setting to null`);
      endTimeValue = null;
    }
  }
  
  // 验证hours字段
  let hoursValue: number;
  try {
    hoursValue = parseFloat(row.hours);
    if (isNaN(hoursValue) || hoursValue < 0) {
      throw new Error(`Invalid hours value: ${row.hours}`);
    }
  } catch (error) {
    throw new Error(`Hours conversion failed: ${row.hours}`);
  }
  
  const timesheetData = {
    employeeId: employee.id,
    projectId: project.id,
    stageId,
    date: dateValue,
    startTime: startTimeValue,
    endTime: endTimeValue,
    hours: hoursValue,
    description: row.description || null,
    status: (row.status as TimesheetStatus) || TimesheetStatus.DRAFT,
  };
  
  console.log('Processed timesheet data:', JSON.stringify(timesheetData, null, 2));
  console.log(`Unique constraint key: employeeId=${employee.id}, projectId=${project.id}, date=${dateValue.toISOString()}, startTime=${startTimeValue ? startTimeValue.toISOString() : 'null'}`);
  
  // 检查是否存在潜在的重复记录
  const existingRecord = await prisma.timesheet.findFirst({
    where: {
      employeeId: employee.id,
      projectId: project.id,
      date: dateValue,
      startTime: startTimeValue
    }
  });
  
  if (existingRecord && !shouldReplace) {
    console.warn(`⚠️  Found existing record with same unique key - ID: ${existingRecord.id}`);
    console.warn('Existing record details:', JSON.stringify({
      id: existingRecord.id,
      date: existingRecord.date,
      startTime: existingRecord.startTime,
      hours: existingRecord.hours
    }, null, 2));
  }
  
  // 无论是否为替换模式，都先删除可能存在的重复记录
  // 这样可以处理CSV文件内部的重复数据以及数据库中的现有数据
  const deleteCondition = {
    employeeId: employee.id,
    projectId: project.id,
    date: dateValue,
    startTime: startTimeValue
  };
  
  console.log('Delete condition:', JSON.stringify(deleteCondition, null, 2));
  
  const deletedRecords = await prisma.timesheet.deleteMany({
    where: deleteCondition
  });
  
  if (deletedRecords.count > 0) {
    console.log(`🔄 Deleted ${deletedRecords.count} existing timesheet(s) for employee ${row.employeeId}, project ${row.projectCode}, date ${row.date}, startTime ${startTimeValue ? startTimeValue.toISOString() : 'null'} (${shouldReplace ? 'replace mode' : 'duplicate prevention'})`);
  }
  
  try {
    // 在创建前再次检查是否存在冲突记录
    const conflictCheck = await prisma.timesheet.findFirst({
      where: {
        employeeId: employee.id,
        projectId: project.id,
        date: dateValue,
        startTime: startTimeValue
      }
    });
    
    if (conflictCheck) {
      console.error(`❌ Conflict detected before create - existing record ID: ${conflictCheck.id}`);
      console.error('Conflict record details:', JSON.stringify({
        id: conflictCheck.id,
        employeeId: conflictCheck.employeeId,
        projectId: conflictCheck.projectId,
        date: conflictCheck.date,
        startTime: conflictCheck.startTime,
        hours: conflictCheck.hours
      }, null, 2));
    }
    
    await prisma.timesheet.create({
      data: timesheetData,
    });
    
    console.log(`✅ Timesheet for ${row.employeeId} ${shouldReplace ? 'replaced' : 'imported'} successfully`);
  } catch (error: any) {
    console.error(`❌ Create timesheet failed for row ${row.rowNumber}:`, error);
    console.error('Failed timesheet data:', JSON.stringify(timesheetData, null, 2));
    
    // 处理唯一约束冲突错误
    if (error.code === 'P2002') {
      const startTimeStr = startTimeValue ? startTimeValue.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '未指定';
      
      // 查询所有可能冲突的记录
      const conflictingRecords = await prisma.timesheet.findMany({
        where: {
          employeeId: employee.id,
          projectId: project.id,
          date: dateValue
        },
        select: {
          id: true,
          startTime: true,
          hours: true,
          description: true
        }
      });
      
      console.error('All records for same employee/project/date:', JSON.stringify(conflictingRecords, null, 2));
      
      // 检查是否是CSV文件内部重复数据导致的问题
      const duplicateInCSV = conflictingRecords.length === 0;
      const errorMessage = duplicateInCSV 
        ? `CSV文件内部数据重复：员工 ${row.employeeId}，项目 ${row.projectCode}，日期 ${row.date}，开始时间 ${startTimeStr}。请检查CSV文件中是否有重复的行数据。`
        : `数据库唯一约束冲突：员工 ${row.employeeId}，项目 ${row.projectCode}，日期 ${row.date}，开始时间 ${startTimeStr}。数据库中已存在 ${conflictingRecords.length} 条相同日期的记录。建议使用"Replace All"选项来替换现有数据。`;
      
      throw new Error(errorMessage);
    }
    
    // 重新抛出其他错误
    throw error;
  }
}

export default router;