# Timesheet系统移除Start/End Time改为Hours选择的修改计划

## 1. 当前系统分析

### 1.1 数据库结构分析
当前Timesheet表结构（Prisma Schema）：
```prisma
model Timesheet {
  id          String          @id @default(cuid())
  employeeId  String          // 员工ID
  projectId   String          // 项目ID
  stageId     String?         // 阶段ID（可选）
  date        DateTime        // 工作日期
  startTime   DateTime        // 开始时间 ⚠️ 需要修改
  endTime     DateTime        // 结束时间 ⚠️ 需要修改
  hours       Float           // 工时（小时）✅ 保留
  description String?         // 工作描述
  status      TimesheetStatus @default(DRAFT)
  // ... 其他字段
}
```

### 1.2 前端组件分析
- **TimeEntryRow组件**：使用Select组件选择开始和结束时间
- **TimesheetEntryItem接口**：包含startTime和endTime的Dayjs对象
- **时间选项生成**：15分钟间隔的时间选项（00:00-23:45）
- **工时计算逻辑**：基于startTime和endTime的差值计算

### 1.3 当前问题
- 时区转换问题导致时间显示不准确
- 用户需要选择两个时间点，操作复杂
- start/end time的验证逻辑复杂
- 时间计算可能产生精度问题

## 2. 修改目标

### 2.1 核心目标
- ✅ 移除start time和end time的用户选择界面
- ✅ 改为直接选择hours（15分钟增量：0, 0.25, 0.5, 0.75, 1.0, ..., 10.0）
- ✅ 简化用户操作流程
- ✅ 减少时区相关的bug
- ✅ 提高数据准确性

### 2.2 业务规则
- Hours选择范围：0 - 10小时
- 最小增量：15分钟（0.25小时）
- 保持现有的项目、阶段、描述字段不变

## 3. 前端修改计划

### 3.1 接口修改
**文件：`src/hooks/useTimesheetEntries.ts`**
```typescript
// 修改前
interface TimesheetEntryItem {
  id: string;
  projectId: string;
  stageId: string;
  startTime: Dayjs;    // ❌ 移除
  endTime: Dayjs;      // ❌ 移除
  description: string;
  hours?: number;      // ✅ 改为必需字段
}

// 修改后
interface TimesheetEntryItem {
  id: string;
  projectId: string;
  stageId: string;
  hours: number;       // ✅ 必需字段，默认0
  description: string;
}
```

### 3.2 组件修改
**文件：`src/components/TimeEntryRow.tsx`**
- 移除Start Time和End Time的Select组件
- 添加Hours选择器（Select组件）
- 移除时间计算相关逻辑
- 简化布局（减少2列）

**修改要点：**
```typescript
// 生成hours选项（0-10小时，15分钟增量）
const generateHoursOptions = () => {
  const options = [];
  for (let i = 0; i <= 40; i++) { // 0到10小时，每0.25递增
    const hours = i * 0.25;
    options.push({
      label: `${hours.toFixed(2)}h`,
      value: hours
    });
  }
  return options;
};
```

### 3.3 Hook修改
**文件：`src/hooks/useTimesheetEntries.ts`**
- 移除`generateTimeOptions`函数
- 移除`calculateHours`函数
- 修改`createDefaultEntries`函数
- 简化`updateEntry`函数
- 移除时间相关的验证逻辑

**文件：`src/hooks/useTimesheetSubmission.ts`**
- 移除startTime和endTime的ISO格式转换
- 简化提交数据结构
- 更新验证逻辑（只需验证hours > 0）

### 3.4 页面修改
**文件：`src/pages/TimesheetEntry.tsx`**
- 更新`canSubmit`验证条件
- 移除时间相关的props传递

## 4. 数据库修改计划

### 4.1 Schema修改
**文件：`prisma/schema.prisma`**
```prisma
model Timesheet {
  id          String          @id @default(cuid())
  employeeId  String
  projectId   String
  stageId     String?
  date        DateTime
  startTime   DateTime?       // ✅ 改为可选，向后兼容
  endTime     DateTime?       // ✅ 改为可选，向后兼容
  hours       Float           // ✅ 保持必需，作为主要工时字段
  description String?
  status      TimesheetStatus @default(DRAFT)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  
  // 关联关系保持不变
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stage    Stage?   @relation(fields: [stageId], references: [id], onDelete: SetNull)
  approval Approval?

  @@unique([employeeId, projectId, date, hours]) // ✅ 修改唯一约束
  @@map("timesheets")
}
```

### 4.2 迁移步骤
1. 生成migration文件
2. 将startTime和endTime字段改为可选
3. 修改唯一约束条件
4. 保持现有数据完整性

## 5. 数据迁移计划

### 5.1 迁移策略
- **保守策略**：保留现有startTime/endTime数据，但前端不再使用
- **确保hours字段完整性**：对于缺少hours的记录，基于startTime/endTime计算补全
- **向后兼容**：旧数据仍可通过API查询，但新数据只使用hours字段

### 5.2 迁移脚本
```sql
-- 1. 备份现有数据
CREATE TABLE timesheets_backup AS SELECT * FROM timesheets;

-- 2. 补全缺失的hours字段
UPDATE timesheets 
SET hours = (
  CASE 
    WHEN startTime IS NOT NULL AND endTime IS NOT NULL 
    THEN ROUND((julianday(endTime) - julianday(startTime)) * 24 * 4) / 4.0
    ELSE hours
  END
)
WHERE hours IS NULL OR hours = 0;

-- 3. 验证数据完整性
SELECT COUNT(*) as missing_hours_count 
FROM timesheets 
WHERE hours IS NULL OR hours <= 0;
```

### 5.3 回滚方案
- 保留备份表`timesheets_backup`
- 如需回滚，可恢复原schema和数据
- 前端代码使用feature flag控制新旧版本切换

## 6. API修改计划

### 6.1 Timesheet API修改
**文件：`api/routes/timesheets.ts`**
- 修改创建和更新接口，startTime/endTime改为可选
- 简化验证逻辑，重点验证hours字段
- 保持响应格式兼容性

### 6.2 CSV导入逻辑修改
**文件：`api/routes/csv-management.ts`**
- 修改`timesheetSchema`验证规则
- 更新`convertTimesheetData`函数
- 优先使用hours字段，startTime/endTime作为备用

### 6.3 报表API修改
- 所有统计和报表逻辑改为基于hours字段
- 移除基于时间段的计算逻辑
- 确保历史数据的统计准确性

## 7. 测试计划

### 7.1 单元测试
- [ ] `useTimesheetEntries` hook测试
- [ ] `useTimesheetSubmission` hook测试
- [ ] `TimeEntryRow`组件测试
- [ ] Hours选择器功能测试
- [ ] 数据验证逻辑测试

### 7.2 集成测试
- [ ] Timesheet CRUD操作测试
- [ ] CSV导入功能测试
- [ ] 报表生成测试
- [ ] 数据迁移测试

### 7.3 用户验收测试
- [ ] 工时录入流程测试
- [ ] 数据准确性验证
- [ ] 性能对比测试
- [ ] 用户体验评估

## 8. 实施时间线

### Phase 1: 准备阶段（1-2天）
- [ ] 数据库备份
- [ ] 创建feature branch
- [ ] 环境准备

### Phase 2: 后端修改（2-3天）
- [ ] Prisma schema修改
- [ ] 数据迁移脚本
- [ ] API接口修改
- [ ] 后端测试

### Phase 3: 前端修改（3-4天）
- [ ] 接口和组件修改
- [ ] Hook逻辑重构
- [ ] UI/UX优化
- [ ] 前端测试

### Phase 4: 集成测试（1-2天）
- [ ] 端到端测试
- [ ] 性能测试
- [ ] 用户验收测试

### Phase 5: 部署上线（1天）
- [ ] 生产环境部署
- [ ] 数据迁移执行
- [ ] 监控和回滚准备

## 9. 风险评估与缓解

### 9.1 主要风险
1. **数据丢失风险**：迁移过程中可能丢失历史数据
   - 缓解：完整备份 + 分步迁移 + 验证脚本

2. **用户适应性风险**：用户习惯改变可能影响使用
   - 缓解：用户培训 + 渐进式发布 + 反馈收集

3. **性能影响风险**：新逻辑可能影响系统性能
   - 缓解：性能测试 + 监控告警 + 优化准备

### 9.2 回滚策略
- 保留完整的数据备份
- 准备快速回滚脚本
- 设置监控指标和告警
- 制定应急响应流程

## 10. 总结

本修改计划将显著简化timesheet系统的用户操作流程，通过移除复杂的时间选择改为直接的工时选择，可以有效减少bug并提高用户体验。整个修改过程采用渐进式和向后兼容的策略，确保系统稳定性和数据安全性。