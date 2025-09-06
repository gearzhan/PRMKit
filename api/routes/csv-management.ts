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
  hours: Joi.number().min(0).max(24).required(), // 工时字段现在是必需的
  description: Joi.string().allow(''),
  status: Joi.string().valid(...Object.values(TimesheetStatus)).default('DRAFT'),
});

// Stages数据验证模式
const stageSchema = Joi.object({
  taskId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  category: Joi.string().required(),
  isActive: Joi.boolean().default(true),
});

// Timesheet数据转换工具函数
function convertTimesheetData(row: any): any {
  const convertedRow = { ...row };
  
  // 处理工时字段，支持旧数据的duration字段
  if (row.duration && !row.hours) {
    // 如果有duration字段但没有hours字段，将duration转换为hours
    convertedRow.hours = row.duration;
    console.log(`🔄 Converted duration to hours: ${row.duration}`);
  } else if (!row.hours && !row.duration) {
    // 如果既没有hours也没有duration，设置默认8小时
    convertedRow.hours = 8;
    console.log(`🔄 Set default hours: 8`);
  }
  
  // 确保工时值有效
  if (convertedRow.hours <= 0 || convertedRow.hours > 24) {
    throw new Error(`Invalid work hours: ${convertedRow.hours}`);
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
      hours: ts.hours,
      description: ts.description || '',
      status: ts.status,
      createdAt: ts.createdAt.toISOString(),
      updatedAt: ts.updatedAt.toISOString(),
    }));

    const filename = `timesheets_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const header = 'Employee ID,Project Code,Stage ID,Date,Hours,Description,Status,Created At,Updated At\n';
    const rows = csvData.map(row => 
      `"${row.employeeId}","${row.projectCode}","${row.stageId}","${row.date}","${row.hours}","${row.description}","${row.status}","${row.createdAt}","${row.updatedAt}"`
    ).join('\n');
    
    res.send(header + rows);
  } catch (error) {
    console.error('Export timesheets error:', error);
    res.status(500).json({ error: 'Failed to export timesheets data' });
  }
});

// 导出阶段数据为CSV
router.get('/export/stages', authenticateToken, requireLevel1Admin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stages = await prisma.stage.findMany({
      select: {
        taskId: true,
        name: true,
        description: true,
        category: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { taskId: 'asc' },
    });

    const csvData = stages.map(stage => ({
      taskId: stage.taskId,
      name: stage.name,
      description: stage.description || '',
      category: stage.category,
      isActive: stage.isActive,
      createdAt: stage.createdAt.toISOString(),
      updatedAt: stage.updatedAt.toISOString(),
    }));

    const filename = `stages_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const header = 'Task ID,Name,Description,Category,Is Active,Created At,Updated At\n';
    const rows = csvData.map(row => 
      `"${row.taskId}","${row.name}","${row.description}","${row.category}","${row.isActive}","${row.createdAt}","${row.updatedAt}"`
    ).join('\n');
    
    res.send(header + rows);
  } catch (error) {
    console.error('Export stages error:', error);
    res.status(500).json({ error: 'Failed to export stages data' });
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
        header = 'Employee ID,Project Code,Stage ID,Date,Hours,Description,Status';
        sampleRow = 'EMP001,PROJ001,TD.01.00,2024-01-01,8,Daily work,DRAFT';
        filename = 'timesheets_template.csv';
        break;
      case 'stages':
        header = 'Task ID,Name,Description,Category,Is Active';
        sampleRow = 'TD.01.00,Task Design,Task design description,Design,true';
        filename = 'stages_template.csv';
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
    if (!dataType || !['EMPLOYEE', 'PROJECT', 'TIMESHEET', 'STAGE'].includes(dataType)) {
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

    // 辅助函数：清理字段名中的BOM字符和空白字符
    const cleanFieldName = (fieldName: string): string => {
      return fieldName.replace(/^\uFEFF/, '').trim();
    };

    // 辅助函数：获取字段值，支持BOM字符处理
    const getFieldValue = (data: any, fieldName: string): any => {
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

    // CSV字段映射函数
    const mapCsvFields = (data: any, dataType: string) => {
      const mappedData: any = {}; // 只返回映射后的字段，不包含原始字段
      
      if (dataType === 'EMPLOYEE') {
        // 员工数据字段映射
        if (getFieldValue(data, 'Employee ID')) mappedData.employeeId = getFieldValue(data, 'Employee ID');
        if (getFieldValue(data, 'Name')) mappedData.name = getFieldValue(data, 'Name');
        if (getFieldValue(data, 'Email')) mappedData.email = getFieldValue(data, 'Email');
        if (getFieldValue(data, 'Role')) mappedData.role = getFieldValue(data, 'Role');
        if (getFieldValue(data, 'Position')) mappedData.position = getFieldValue(data, 'Position');
        if (getFieldValue(data, 'Is Active')) {
          // 处理布尔值转换
          const isActiveValue = getFieldValue(data, 'Is Active');
          if (typeof isActiveValue === 'string') {
            mappedData.isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === '1' || isActiveValue.toLowerCase() === 'active';
          } else {
            mappedData.isActive = Boolean(isActiveValue);
          }
        }
      } else if (dataType === 'PROJECT') {
        // 项目数据字段映射
        if (getFieldValue(data, 'Project Code')) mappedData.projectCode = getFieldValue(data, 'Project Code');
        if (getFieldValue(data, 'Name')) mappedData.name = getFieldValue(data, 'Name');
        if (getFieldValue(data, 'Description')) mappedData.description = getFieldValue(data, 'Description');
        if (getFieldValue(data, 'Nickname')) mappedData.nickname = getFieldValue(data, 'Nickname');
        // 日期字段需要格式转换
        if (getFieldValue(data, 'Start Date')) {
          const convertedDate = convertDateFormat(getFieldValue(data, 'Start Date'));
          if (convertedDate) {
            mappedData.startDate = convertedDate;
          }
        }
        if (getFieldValue(data, 'End Date')) {
          const convertedDate = convertDateFormat(getFieldValue(data, 'End Date'));
          if (convertedDate) {
            mappedData.endDate = convertedDate;
          }
        }
        if (getFieldValue(data, 'Status')) mappedData.status = getFieldValue(data, 'Status');
      } else if (dataType === 'TIMESHEET') {
        // 工时数据字段映射
        if (getFieldValue(data, 'Employee ID')) mappedData.employeeId = getFieldValue(data, 'Employee ID');
        if (getFieldValue(data, 'Project Code')) mappedData.projectCode = getFieldValue(data, 'Project Code');
        if (getFieldValue(data, 'Stage ID')) mappedData.stageId = getFieldValue(data, 'Stage ID');
        // 日期字段需要格式转换
        if (getFieldValue(data, 'Date')) {
          const convertedDate = convertDateFormat(getFieldValue(data, 'Date'));
          if (convertedDate) {
            mappedData.date = convertedDate;
          } else {
            console.warn(`无法转换日期格式: ${getFieldValue(data, 'Date')}`);
            mappedData.date = getFieldValue(data, 'Date'); // 保留原始值，让后续验证处理
          }
        }
        // 处理工时字段
        if (getFieldValue(data, 'Hours')) {
          const hoursValue = parseFloat(getFieldValue(data, 'Hours'));
          if (!isNaN(hoursValue)) {
            mappedData.hours = hoursValue;
          }
        }
        if (getFieldValue(data, 'Duration')) {
          const durationValue = parseFloat(getFieldValue(data, 'Duration'));
          if (!isNaN(durationValue)) {
            mappedData.duration = durationValue;
          }
        }
        if (getFieldValue(data, 'Description')) mappedData.description = getFieldValue(data, 'Description');
        if (getFieldValue(data, 'Status')) mappedData.status = getFieldValue(data, 'Status');
        
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
      } else if (dataType === 'STAGE') {
        // 阶段数据字段映射 - 支持多种字段名格式
        if (getFieldValue(data, 'Task ID') || getFieldValue(data, 'taskId')) {
          mappedData.taskId = getFieldValue(data, 'Task ID') || getFieldValue(data, 'taskId');
        }
        if (getFieldValue(data, 'Name') || getFieldValue(data, 'name')) {
          mappedData.name = getFieldValue(data, 'Name') || getFieldValue(data, 'name');
        }
        if (getFieldValue(data, 'Description') || getFieldValue(data, 'description')) {
          mappedData.description = getFieldValue(data, 'Description') || getFieldValue(data, 'description');
        }
        if (getFieldValue(data, 'Category') || getFieldValue(data, 'category')) {
          mappedData.category = getFieldValue(data, 'Category') || getFieldValue(data, 'category');
        }
        if (getFieldValue(data, 'Is Active') || getFieldValue(data, 'isActive')) {
          // 处理布尔值转换
          const isActiveValue = getFieldValue(data, 'Is Active') || getFieldValue(data, 'isActive');
          if (typeof isActiveValue === 'string') {
            mappedData.isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === '1' || isActiveValue.toLowerCase() === 'active';
          } else {
            mappedData.isActive = Boolean(isActiveValue);
          }
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
                  dataType === 'PROJECT' ? projectSchema : 
                  dataType === 'STAGE' ? stageSchema : timesheetSchema;

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
            // startTime和endTime字段已从Timesheet模型中移除
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
      } else if (dataType === 'STAGE') {
        await validateStagesData(rows, errors, duplicates);
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
    if (!dataType || !['EMPLOYEE', 'PROJECT', 'TIMESHEET', 'STAGE'].includes(dataType)) {
      return res.status(400).json({ error: 'Invalid data type' });
    }

    // 验证操作员是否存在，如果不存在则自动创建默认管理员
    let operator = await prisma.employee.findUnique({
      where: { id: req.user!.userId },
      select: { id: true }
    });
    
    if (!operator) {
      console.log(`操作员 ${req.user!.userId} 不存在，自动创建默认管理员账户`);
      
      // 自动创建默认管理员操作员
      const bcrypt = await import('bcryptjs');
      const defaultPassword = await bcrypt.hash('admin0258', 10);
      
      try {
        operator = await prisma.employee.create({
          data: {
            id: req.user!.userId, // 使用JWT中的userId作为ID
            employeeId: 'SAIYU_001', // 默认管理员工号
            name: 'System Admin',
            email: 'admin@system.local',
            password: defaultPassword,
            role: 'LEVEL1', // 管理员权限
            position: 'System Administrator',
            isActive: true,
          },
          select: { id: true }
        });
        
        console.log(`✅ 成功创建默认管理员操作员: ${operator.id}`);
      } catch (createError: any) {
        console.error('创建默认操作员失败:', createError);
        
        // 如果是唯一约束冲突（employeeId已存在），尝试使用随机工号
        if (createError.code === 'P2002') {
          const randomId = `ADMIN_${Date.now()}`;
          try {
            operator = await prisma.employee.create({
              data: {
                id: req.user!.userId,
                employeeId: randomId,
                name: 'System Admin',
                email: `admin_${Date.now()}@system.local`,
                password: defaultPassword,
                role: 'LEVEL1',
                position: 'System Administrator',
                isActive: true,
              },
              select: { id: true }
            });
            
            console.log(`✅ 使用随机工号创建默认管理员操作员: ${randomId}`);
          } catch (retryError) {
            console.error('重试创建默认操作员也失败:', retryError);
            return res.status(500).json({ 
              error: 'Failed to create default operator. Please contact administrator.' 
            });
          }
        } else {
          return res.status(500).json({ 
            error: 'Failed to create default operator. Please contact administrator.' 
          });
        }
      }
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

    // 辅助函数：清理字段名中的BOM字符和空白字符
    const cleanFieldName = (fieldName: string): string => {
      return fieldName.replace(/^\uFEFF/, '').trim();
    };

    // 辅助函数：获取字段值，支持BOM字符处理
    const getFieldValue = (data: any, fieldName: string): any => {
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

    // CSV字段映射函数（与验证路由保持一致）
    const mapCsvFields = (data: any, dataType: string) => {
      const mappedData: any = {}; // 只返回映射后的字段，不包含原始字段
      
      if (dataType === 'EMPLOYEE') {
        // 员工数据字段映射
        if (getFieldValue(data, 'Employee ID')) mappedData.employeeId = getFieldValue(data, 'Employee ID');
        if (getFieldValue(data, 'Name')) mappedData.name = getFieldValue(data, 'Name');
        if (getFieldValue(data, 'Email')) mappedData.email = getFieldValue(data, 'Email');
        if (getFieldValue(data, 'Role')) mappedData.role = getFieldValue(data, 'Role');
        if (getFieldValue(data, 'Position')) mappedData.position = getFieldValue(data, 'Position');
        if (getFieldValue(data, 'Is Active')) {
          // 处理布尔值转换
          const isActiveValue = getFieldValue(data, 'Is Active');
          if (typeof isActiveValue === 'string') {
            mappedData.isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === '1' || isActiveValue.toLowerCase() === 'active';
          } else {
            mappedData.isActive = Boolean(isActiveValue);
          }
        }
      } else if (dataType === 'PROJECT') {
        // 项目数据字段映射
        if (getFieldValue(data, 'Project Code')) mappedData.projectCode = getFieldValue(data, 'Project Code');
        if (getFieldValue(data, 'Name')) mappedData.name = getFieldValue(data, 'Name');
        if (getFieldValue(data, 'Description')) mappedData.description = getFieldValue(data, 'Description');
        if (getFieldValue(data, 'Nickname')) mappedData.nickname = getFieldValue(data, 'Nickname');
        // 日期字段需要格式转换
        if (getFieldValue(data, 'Start Date')) {
          const convertedDate = convertDateFormat(getFieldValue(data, 'Start Date'));
          if (convertedDate) {
            mappedData.startDate = convertedDate;
          }
        }
        if (getFieldValue(data, 'End Date')) {
          const convertedDate = convertDateFormat(getFieldValue(data, 'End Date'));
          if (convertedDate) {
            mappedData.endDate = convertedDate;
          }
        }
        if (getFieldValue(data, 'Status')) mappedData.status = getFieldValue(data, 'Status');
      } else if (dataType === 'TIMESHEET') {
        // 工时数据字段映射
        if (getFieldValue(data, 'Employee ID')) mappedData.employeeId = getFieldValue(data, 'Employee ID');
        if (getFieldValue(data, 'Project Code')) mappedData.projectCode = getFieldValue(data, 'Project Code');
        if (getFieldValue(data, 'Stage ID')) mappedData.stageId = getFieldValue(data, 'Stage ID');
        // 日期字段需要格式转换
        if (getFieldValue(data, 'Date')) {
          const convertedDate = convertDateFormat(getFieldValue(data, 'Date'));
          if (convertedDate) {
            mappedData.date = convertedDate;
          } else {
            console.warn(`无法转换日期格式: ${getFieldValue(data, 'Date')}`);
            mappedData.date = getFieldValue(data, 'Date'); // 保留原始值，让后续验证处理
          }
        }
        // 处理工时字段
        if (getFieldValue(data, 'Hours')) {
          const hoursValue = parseFloat(getFieldValue(data, 'Hours'));
          if (!isNaN(hoursValue)) {
            mappedData.hours = hoursValue;
          }
        }
        if (getFieldValue(data, 'Duration')) {
          const durationValue = parseFloat(getFieldValue(data, 'Duration'));
          if (!isNaN(durationValue)) {
            mappedData.duration = durationValue;
          }
        }
        if (getFieldValue(data, 'Description')) mappedData.description = getFieldValue(data, 'Description');
        if (getFieldValue(data, 'Status')) mappedData.status = getFieldValue(data, 'Status');
        
        // 应用timesheet数据转换规则
        try {
          const convertedData = convertTimesheetData(mappedData);
          Object.assign(mappedData, convertedData);
        } catch (conversionError) {
          console.error(`❌ Timesheet data conversion failed:`, conversionError);
          // 将转换错误标记到数据中，稍后在验证阶段处理
          mappedData._conversionError = {
            message: conversionError instanceof Error ? conversionError.message : 'Data conversion failed',
            field: 'date/time'
          };
        }
      } else if (dataType === 'STAGE') {
        // 阶段数据字段映射 - 支持多种字段名格式
        if (getFieldValue(data, 'Task ID') || getFieldValue(data, 'taskId')) {
          mappedData.taskId = getFieldValue(data, 'Task ID') || getFieldValue(data, 'taskId');
        }
        if (getFieldValue(data, 'Name') || getFieldValue(data, 'name')) {
          mappedData.name = getFieldValue(data, 'Name') || getFieldValue(data, 'name');
        }
        if (getFieldValue(data, 'Description') || getFieldValue(data, 'description')) {
          mappedData.description = getFieldValue(data, 'Description') || getFieldValue(data, 'description');
        }
        if (getFieldValue(data, 'Category') || getFieldValue(data, 'category')) {
          mappedData.category = getFieldValue(data, 'Category') || getFieldValue(data, 'category');
        }
        if (data['Is Active'] || data['isActive']) {
          // 处理布尔值转换
          const isActiveValue = data['Is Active'] || data['isActive'];
          if (typeof isActiveValue === 'string') {
            mappedData.isActive = isActiveValue.toLowerCase() === 'true' || isActiveValue === '1' || isActiveValue.toLowerCase() === 'active';
          } else {
            mappedData.isActive = Boolean(isActiveValue);
          }
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
        } else if (dataType === 'STAGE') {
          await importStageRow(row, rowDecision === 'replace');
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

// 辅助函数：验证阶段数据
async function validateStagesData(rows: any[], errors: any[], duplicates: any[] = []) {
  const taskIds = rows.map(row => row.taskId).filter(Boolean);
  
  // 检查数据库中是否已存在，获取完整的阶段信息用于对比
  const existingStages = await prisma.stage.findMany({
    where: { taskId: { in: taskIds } },
    select: { 
      taskId: true, 
      name: true, 
      description: true, 
      category: true, 
      isActive: true 
    },
  });
  
  const existingTaskIds = new Set(existingStages.map(s => s.taskId));
  
  // 创建映射以便快速查找现有阶段数据
  const existingStageMap = new Map();
  existingStages.forEach(stage => {
    existingStageMap.set(stage.taskId, stage);
  });
  
  rows.forEach(row => {
    if (existingTaskIds.has(row.taskId)) {
      const existingData = existingStageMap.get(row.taskId);
      
      // 添加到重复数据列表而不是错误列表
      duplicates.push({
        rowNumber: row.rowNumber,
        newData: {
          taskId: row.taskId,
          name: row.name,
          description: row.description,
          category: row.category,
          isActive: row.isActive
        },
        existingData: {
          taskId: existingData.taskId,
          name: existingData.name,
          description: existingData.description,
          category: existingData.category,
          isActive: existingData.isActive
        },
        conflictFields: ['taskId']
      });
    }
  });
}

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
        // 在验证之前先转换数据，处理空时间字段
        const convertedRow = convertTimesheetData(row);
        // 将转换后的数据合并回原行
        Object.assign(row, convertedRow);
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
        
        // 时间格式解析辅助函数
        // 支持HH:MM格式和ISO时间戳格式（如2024-11-10T22:00:00.000Z）
        function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
          if (!timeStr || timeStr.trim() === '') {
            return null;
          }
          
          const trimmedTime = timeStr.trim();
          
          // 检查是否为HH:MM格式
          const timePattern = /^\d{1,2}:\d{2}$/;
          if (timePattern.test(trimmedTime)) {
            const [hours, minutes] = trimmedTime.split(':').map(Number);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              return { hours, minutes };
            }
            return null;
          }
          
          // 检查是否为ISO时间戳格式
          try {
            const date = new Date(trimmedTime);
            if (!isNaN(date.getTime())) {
              const hours = date.getHours();
              const minutes = date.getMinutes();
              return { hours, minutes };
            }
          } catch (error) {
            // 忽略解析错误，继续尝试其他格式
          }
          
          return null;
        }
        
        // 注意：startTime和endTime字段已从Timesheet模型中移除，不再进行相关验证
        
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
  console.log(`Date: ${row.date}, Hours: ${row.hours}`);
  
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
  
  // 注意：startTime和endTime字段已从Timesheet模型中移除
  
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
    hours: hoursValue,
    description: row.description || null,
    status: (row.status as TimesheetStatus) || TimesheetStatus.DRAFT,
  };
  
  console.log('Processed timesheet data:', JSON.stringify(timesheetData, null, 2));
  console.log(`Unique constraint key: employeeId=${employee.id}, projectId=${project.id}, date=${dateValue.toISOString()}, stageId=${stageId || 'null'}`);
  
  // 检查是否存在潜在的重复记录
  const existingRecord = await prisma.timesheet.findFirst({
    where: {
      employeeId: employee.id,
      projectId: project.id,
      date: dateValue,
      stageId: stageId
    }
  });
  
  if (existingRecord && !shouldReplace) {
    console.warn(`⚠️  Found existing record with same unique key - ID: ${existingRecord.id}`);
    console.warn('Existing record details:', JSON.stringify({
      id: existingRecord.id,
      date: existingRecord.date,
      stageId: existingRecord.stageId,
      hours: existingRecord.hours
    }, null, 2));
  }
  
  // 无论是否为替换模式，都先删除可能存在的重复记录
  // 这样可以处理CSV文件内部的重复数据以及数据库中的现有数据
  const deleteCondition = {
    employeeId: employee.id,
    projectId: project.id,
    date: dateValue,
    stageId: stageId
  };
  
  console.log('Delete condition:', JSON.stringify(deleteCondition, null, 2));
  
  const deletedRecords = await prisma.timesheet.deleteMany({
    where: deleteCondition
  });
  
  if (deletedRecords.count > 0) {
    console.log(`🔄 Deleted ${deletedRecords.count} existing timesheet(s) for employee ${row.employeeId}, project ${row.projectCode}, date ${row.date}, stageId ${stageId || 'null'} (${shouldReplace ? 'replace mode' : 'duplicate prevention'})`);
  }
  
  try {
    // 在创建前再次检查是否存在冲突记录
    const conflictCheck = await prisma.timesheet.findFirst({
      where: {
        employeeId: employee.id,
        projectId: project.id,
        date: dateValue,
        stageId: stageId
      }
    });
    
    if (conflictCheck) {
      console.error(`❌ Conflict detected before create - existing record ID: ${conflictCheck.id}`);
      console.error('Conflict record details:', JSON.stringify({
        id: conflictCheck.id,
        employeeId: conflictCheck.employeeId,
        projectId: conflictCheck.projectId,
        date: conflictCheck.date,
        stageId: conflictCheck.stageId,
        hours: conflictCheck.hours
      }, null, 2));
    }
    
    // 创建工时记录
    const createdTimesheet = await prisma.timesheet.create({
      data: timesheetData,
    });
    
    // 根据状态创建相应的审批记录
    if (timesheetData.status === TimesheetStatus.SUBMITTED || timesheetData.status === TimesheetStatus.APPROVED) {
      console.log(`🔍 Status is ${timesheetData.status}, creating approval record...`);
      
      // 查找employeeId为'PSEC-000'的员工作为默认审批人
      const defaultApprover = await prisma.employee.findUnique({
        where: { employeeId: 'PSEC-000' },
        select: { id: true, name: true }
      });
      
      if (defaultApprover) {
        // 根据timesheet状态确定approval状态和相关字段
        const approvalData: any = {
          timesheetId: createdTimesheet.id,
          submitterId: employee.id, // 提交人是工时记录的员工
          approverId: defaultApprover.id, // 审批人是PSEC-000
          comments: 'Automatically created approval record during CSV import'
        };
        
        if (timesheetData.status === TimesheetStatus.APPROVED) {
          approvalData.status = 'APPROVED';
          approvalData.approvedAt = new Date(); // 当前导入时间
        } else if (timesheetData.status === TimesheetStatus.SUBMITTED) {
          approvalData.status = 'PENDING';
          approvalData.submittedAt = new Date(); // 当前导入时间
        }
        
        // 创建审批记录
        await prisma.approval.create({
          data: approvalData
        });
        
        console.log(`✅ Auto-created ${approvalData.status} approval record for timesheet ${createdTimesheet.id} with approver ${defaultApprover.name} (PSEC-000)`);
      } else {
        console.warn(`⚠️  Default approver with employeeId 'PSEC-000' not found, skipping approval record creation`);
      }
    }
    
    console.log(`✅ Timesheet for ${row.employeeId} ${shouldReplace ? 'replaced' : 'imported'} successfully`);
  } catch (error: any) {
    console.error(`❌ Create timesheet failed for row ${row.rowNumber}:`, error);
    console.error('Failed timesheet data:', JSON.stringify(timesheetData, null, 2));
    
    // 处理唯一约束冲突错误
    if (error.code === 'P2002') {
      const stageStr = stageId || '未指定阶段';
      
      // 查询所有可能冲突的记录
      const conflictingRecords = await prisma.timesheet.findMany({
        where: {
          employeeId: employee.id,
          projectId: project.id,
          date: dateValue
        },
        select: {
          id: true,
          stageId: true,
          hours: true,
          description: true
        }
      });
      
      console.error('All records for same employee/project/date:', JSON.stringify(conflictingRecords, null, 2));
      
      // 检查是否是CSV文件内部重复数据导致的问题
      const duplicateInCSV = conflictingRecords.length === 0;
      const errorMessage = duplicateInCSV 
        ? `CSV文件内部数据重复：员工 ${row.employeeId}，项目 ${row.projectCode}，日期 ${row.date}，阶段 ${stageStr}。请检查CSV文件中是否有重复的行数据。`
        : `数据库唯一约束冲突：员工 ${row.employeeId}，项目 ${row.projectCode}，日期 ${row.date}，阶段 ${stageStr}。数据库中已存在 ${conflictingRecords.length} 条相同日期的记录。建议使用"Replace All"选项来替换现有数据。`;
      
      throw new Error(errorMessage);
    }
    
    // 重新抛出其他错误
    throw error;
  }
}

// 辅助函数：导入阶段行
async function importStageRow(row: any, shouldReplace: boolean = false) {
  console.log(`\n=== ImportStageRow Debug - Row ${row.rowNumber || 'unknown'} ===`);
  console.log('Raw row data:', JSON.stringify(row, null, 2));
  console.log(`Replace mode: ${shouldReplace}`);
  console.log(`Task ID: ${row.taskId}`);
  
  // 验证必填字段
  if (!row.taskId) {
    throw new Error('Task ID is required');
  }
  
  if (!row.name) {
    throw new Error('Name is required');
  }
  
  // 处理isActive字段转换
  let isActiveValue = true; // 默认为true
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
      isActiveValue = Boolean(row.isActive);
    }
  }
  
  console.log(`Converted isActive value:`, isActiveValue);
  
  const stageData = {
    taskId: row.taskId,
    name: row.name,
    description: row.description || null,
    category: row.category || null,
    isActive: isActiveValue,
  };
  
  console.log(`Final stage data:`, JSON.stringify(stageData, null, 2));
  
  if (shouldReplace) {
    // 替换模式：先删除现有记录，再创建新记录
    await prisma.stage.deleteMany({
      where: { taskId: row.taskId }
    });
    console.log(`🔄 Existing stage with taskId ${row.taskId} deleted for replacement`);
  }
  
  await prisma.stage.create({
    data: stageData,
  });
  
  console.log(`✅ Stage ${row.taskId} ${shouldReplace ? 'replaced' : 'imported'} successfully`);
}

export default router;