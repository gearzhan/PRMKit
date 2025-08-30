# PRMKit - 项目资源管理工具包

## 📋 项目概述

PRMKit是专业的企业工时管理系统，支持15分钟增量工时录入、多级审批流程、实时数据分析和CSV数据管理。

### 核心功能
- 🕐 **工时管理**: 15分钟增量精确录入，支持批量操作 ✅
- 🔍 **实时搜索**: 项目名称、代码、描述全文搜索 ✅
- 👥 **三级权限**: Admin/Manager/Worker角色权限管理 ✅
- 📊 **数据可视化**: Recharts图表，支持钻取分析 ✅
- 📈 **管理仪表板**: 月度统计、项目分析、工时趋势 ✅
- 📋 **审批流程**: 批量审批、状态跟踪、历史记录 ✅
- 👤 **员工详情**: 员工项目参与情况、工时统计钻取分析 ✅
- 📁 **CSV管理**: 数据导入导出、模板下载、操作日志 ✅
- 🔐 **安全认证**: JWT身份验证、数据权限隔离 ✅

### 用户角色
- **Level 1 Admin**: 系统全局管理、CSV数据管理
- **Level 2 Manager**: 工时审批、团队管理
- **Level 3 Worker**: 个人工时录入

## 🛠 技术栈

### 前端技术
- **React 18** + **TypeScript** - 现代化前端框架
- **Vite** - 快速构建工具
- **Ant Design 5.26.7** - 企业级UI组件库
- **TailwindCSS 3** - 原子化CSS框架
- **Zustand** - 轻量级状态管理
- **React Router** - 前端路由管理
- **Axios** - HTTP客户端
- **Recharts** - 现代化数据可视化库
- **实时搜索** - 优化的搜索体验

### 后端技术
- **Node.js** + **Express 4** - 服务端框架
- **TypeScript** - 类型安全的JavaScript
- **Prisma 5.x** - 现代化ORM
- **SQLite** - 轻量级数据库
- **JWT** + **bcryptjs** - 身份验证和密码加密

### 开发工具
- **ESLint** + **Prettier** - 代码质量检查和格式化
- **Nodemon** - 开发环境热重载
- **Concurrently** - 并发运行前后端服务

## 🚀 环境配置

### 系统要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- 操作系统: macOS, Windows, Linux

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd PRMKit
```

2. **安装依赖**
```bash
npm install
```

3. **环境变量配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

环境变量说明：
```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="24h"

# 服务器配置
PORT=3001
NODE_ENV=development

# CORS配置
CLIENT_URL="http://localhost:5173"
```

4. **数据库初始化**

**方式一：一键重置（推荐用于开发环境）**
```bash
# 重置数据库并填充测试数据
npm run db:reset
```

**方式二：分步执行**
```bash
# 生成Prisma客户端
npm run db:generate

# 推送数据库结构（开发环境）
npm run db:push

# 填充测试数据
npm run db:seed
```

**方式三：使用数据库迁移（推荐用于生产环境）**
```bash
# 生成Prisma客户端
npm run db:generate

# 创建并应用迁移（开发环境）
npm run db:migrate:dev

# 或者仅应用迁移（生产环境）
npm run db:migrate:deploy

# 填充测试数据
npm run db:seed
```

**数据库管理工具**
```bash
# 打开数据库管理界面
npm run db:studio

# 查看迁移状态
npm run db:migrate:status

# 重置所有迁移（谨慎使用）
npm run db:migrate:reset
```

## 🧪 测试环境操作

### 启动开发环境

**方式一：同时启动前后端服务**
```bash
npm run dev
```
这将并发启动：
- 前端服务: http://localhost:5173
- 后端API: http://localhost:3001

**方式二：分别启动服务**
```bash
# 启动前端服务
npm run client:dev

# 启动后端服务（新终端窗口）
npm run server:dev
```

### 停止开发环境

**停止所有服务**
```bash
# 在运行npm run dev的终端中按 Ctrl+C
# 或者找到对应进程并终止
pkill -f "npm run dev"
```

**分别停止服务**
```bash
# 在对应终端中按 Ctrl+C
# 或者终止特定端口进程
lsof -ti:5173 | xargs kill  # 停止前端
lsof -ti:3001 | xargs kill  # 停止后端
```

### 重置开发环境

**重置数据库**
```bash
# 完全重置数据库和数据
npm run db:reset

# 或者重置迁移（保留迁移历史）
npm run db:migrate:reset
```

**清理并重新安装**
```bash
rm -rf node_modules package-lock.json
npm install
npm run db:reset
```

## 🐛 调试指南

### 常见问题排查

#### 1. 端口占用问题
```bash
# 检查端口占用
lsof -i :5173  # 前端端口
lsof -i :3001  # 后端端口

# 终止占用进程
kill -9 <PID>
```

#### 2. 数据库连接问题
```bash
# 检查数据库文件
ls -la prisma/dev.db

# 重新生成数据库（开发环境）
npm run db:push
npm run db:seed

# 或使用迁移方式（推荐）
npm run db:migrate:dev
npm run db:seed

# 查看迁移状态
npm run db:migrate:status
```

#### 3. 依赖安装问题
```bash
# 清理缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules
npm install
```

#### 4. TypeScript类型错误
```bash
# 运行类型检查
npm run check

# 生成Prisma类型
npm run db:generate
```

### 调试工具和方法

#### 前端调试
1. **浏览器开发者工具**
   - Network面板：检查API请求
   - Console面板：查看错误日志
   - React DevTools：组件状态调试

2. **Vite开发服务器**
   - 热重载：代码修改自动刷新
   - 错误覆盖：编译错误直接显示在页面

#### 后端调试
1. **日志系统**
   ```bash
   # 查看日志文件
   tail -f logs/combined.log
   tail -f logs/error.log
   ```

2. **API测试**
   ```bash
   # 使用curl测试API
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"employeeId":"OFFICE001","password":"admin123"}'
   ```

3. **数据库调试**
   ```bash
   # 使用Prisma Studio
   npx prisma studio
   ```

   **数据库命令对比说明**
   | 命令 | 用途 | 适用场景 | 数据保留 |
   |------|------|----------|----------|
   | `npm run db:push` | 直接同步schema到数据库 | 开发环境快速原型 | 保留现有数据 |
   | `npm run db:migrate:dev` | 创建并应用迁移 | 开发环境版本控制 | 保留现有数据 |
   | `npm run db:migrate:deploy` | 仅应用迁移 | 生产环境部署 | 保留现有数据 |
   | `npm run db:reset` | 完全重置数据库 | 开发环境重新开始 | **清空所有数据** |
   | `npm run db:migrate:reset` | 重置迁移历史 | 迁移文件冲突解决 | **清空所有数据** |

   3.1 Prisma Studio 使用方法
   - 前置条件
     - 确认数据库为本地 SQLite，.env 中的 DATABASE_URL 指向文件：
       ```env
       # 示例（请根据实际情况确认）
       DATABASE_URL="file:./prisma/dev.db"
       ```
     - 建议先备份数据库再做修改：
       ```bash
       mkdir -p prisma/backup
       cp prisma/dev.db prisma/backup/dev-$(date +%Y%m%d%H%M).db
       ```
   - 启动与访问
     - 在项目根目录运行：
       ```bash
       npx prisma studio
       ```
     - 浏览器访问提示的地址（默认 http://localhost:5555），在左侧选择目标表进行增删改查。
     - 若端口被占用，可指定端口：
       ```bash
       npx prisma studio --port 5556
       ```
   - 常见操作
     - 查看/筛选：进入表后可按列筛选、排序，支持分页查看。
     - 新增：点击“Add record”新增行，填写字段后保存。
     - 编辑：双击单元格或点“Edit”修改字段，保存自动生效。
     - 删除：勾选记录后点击“Delete”删除。
     - 关系：含外键字段的表可直接跳转查看关联记录。
   - 安全与注意事项
     - 请勿将本地数据库文件提交到 Git（当前已忽略 prisma/dev.db）。
     - 不建议直接修改生产环境数据，若需批量/可追溯的修改请改用脚本或迁移。
     - 修改关键业务字段前请先备份，避免误操作导致数据不一致。
   - 故障排查
     - 提示“command not found: prisma”或 Studio 无法启动：
       ```bash
       npm i -D prisma
       ```
     - 打不开页面：检查终端输出的访问地址与端口，或更换端口重试。
     - 数据库无法读取：确认 .env 的 DATABASE_URL 正确，且 dev.db 文件存在且无权限问题。

### 错误代码对照

| 错误代码 | 描述 | 解决方案 |
|---------|------|----------|
| EADDRINUSE | 端口被占用 | 更换端口或终止占用进程 |
| ECONNREFUSED | 数据库连接失败 | 检查数据库配置和文件权限 |
| JWT_INVALID | JWT令牌无效 | 检查JWT_SECRET配置 |
| PRISMA_ERROR | 数据库操作错误 | 检查数据模型和查询语句 |

### 主要功能模块
- ✅ **认证系统**: JWT身份验证、角色权限控制
- ✅ **工时管理**: 录入、编辑、删除、状态管理、批量操作
- ✅ **搜索功能**: 实时搜索、多条件筛选
- ✅ **数据可视化**: Dashboard图表、项目钻取分析
- ✅ **审批流程**: 批量审批、历史记录、状态跟踪
- ✅ **员工管理**: 员工列表、详情查看、项目参与统计
- ✅ **CSV管理**: 数据导入导出、模板下载、操作日志
- ✅ **权限控制**: 数据隔离、个人数据过滤
- ✅ **响应式UI**: 桌面端和移动端适配

### 性能指标
- API响应时间: < 500ms
- 数据库查询: < 200ms
- 前端渲染: < 100ms
- 数据安全: 100%隔离

## 📚 项目结构

```
PRMKit/
├── api/                    # 后端代码
│   ├── routes/            # API路由
│   │   ├── admin-dashboard.ts  # 管理员仪表板API
│   │   ├── auth.ts        # 认证相关API
│   │   ├── csv.ts         # CSV数据管理API
│   │   ├── projects.ts    # 项目管理API
│   │   └── timesheets.ts  # 工时管理API
│   ├── lib/               # 工具库
│   └── app.ts             # Express应用
├── src/                   # 前端代码
│   ├── components/        # React组件
│   ├── pages/            # 页面组件
│   │   ├── AdminApprovals.tsx     # 管理员审批页面
│   │   ├── AdminDashboard.tsx     # 管理员仪表板
│   │   ├── AdminEmployeeList.tsx  # 员工列表管理
│   │   ├── CSVManagement.tsx      # CSV数据管理
│   │   ├── EmployeeDrilldown.tsx  # 员工详情钻取页面
│   │   ├── Login.tsx              # 登录页面
│   │   ├── ProjectDrilldown.tsx   # 项目钻取分析
│   │   └── Timesheets.tsx         # 工时录入页面
│   ├── lib/              # 工具库
│   ├── stores/           # 状态管理
│   └── hooks/            # 自定义Hook
├── prisma/               # 数据库
│   ├── schema.prisma     # 数据模型
│   └── seed.ts           # 测试数据
├── public/               # 静态资源
└── logs/                 # 日志文件
```

## 🔗 相关文档

- [产品需求文档](.trae/documents/PRMKit产品需求文档.md)
- [技术架构文档](.trae/documents/PRMKit技术架构文档.md)
- [开发环境API](http://localhost:3001/api-docs)


## 📝 开发规范

- 代码提交前运行 `npm run check` 进行类型检查
- 遵循ESLint规则，保持代码风格一致
- 组件文件使用英文命名，注释使用中文
- API接口遵循RESTful设计规范
- 数据库操作使用Prisma ORM

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
