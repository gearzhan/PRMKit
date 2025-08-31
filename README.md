# PRMKit - 个人资源管理工具包

## 项目概述

PRMKit（Personal Resource Management Kit）是一个现代化的个人资源管理平台，帮助用户高效管理各类个人资源。

## 核心功能

- **用户管理**: 注册登录、个人资料、权限控制
- **资源管理**: 文件上传存储、分类标签、搜索筛选
- **数据管理**: CSV 导入导出、数据可视化、统计分析
- **系统功能**: 响应式设计、实时通知、数据备份

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + TypeScript + Prisma
- **数据库**: PostgreSQL + Supabase
- **认证**: JWT + bcryptjs
- **文件处理**: Multer + CSV Parser

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 环境变量配置

创建 `.env` 文件：

```env
DATABASE_URL="your-database-url"
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
PORT=3001
```

### 安装与启动

```bash
# 1. 安装依赖
npm install

# 2. 数据库初始化
npx prisma generate
npx prisma db push

# 3. 开发环境
npm run dev          # 前端开发服务器 (http://localhost:5173)
npm run server:dev   # 后端开发服务器 (http://localhost:3001)
```

## 🚀 生产环境部署

### 自动化构建与启动

```bash
# 1. 一键构建（自动编译前后端代码）
npm run build

# 2. 启动生产服务器
npm start
```

**构建流程说明**：
- 自动清理 `dist` 目录
- 生成 Prisma 客户端
- 构建前端静态资源（Vite）
- 自动编译后端 TypeScript 代码
- 输出完整的生产环境文件到 `dist/`

### 生产环境特性

- ✅ **单端口部署** (3001) - 前后端统一服务
- ✅ **自动化构建** - 无需手动编译 TypeScript
- ✅ **静态文件优化** - Vite 生产级打包
- ✅ **API 服务集成** - Express 后端服务
- ✅ **环境配置隔离** - 支持 `.env.production`

## 开发工具

```bash
# 代码检查与格式化
npm run lint         # ESLint 检查
npm run lint:fix     # 自动修复
npm run format       # Prettier 格式化

# 测试
npm test            # 运行测试
npm run test:watch  # 监听模式
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
ls -la prisma/prod.db

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

## 项目结构

```
PRMKit/
├── src/                   # 前端源码
│   ├── components/        # React 组件
│   ├── pages/            # 页面组件
│   ├── hooks/            # 自定义 Hooks
│   └── utils/            # 工具函数
├── api/                  # 后端源码
│   ├── routes/           # API 路由
│   ├── lib/              # 工具库
│   └── middleware/       # 中间件
├── prisma/               # 数据库
│   ├── schema.prisma     # 数据库模式
│   └── migrations/       # 迁移文件
├── dist/                 # 生产构建输出
└── public/               # 静态资源
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

---

**PRMKit** - 让个人资源管理变得简单高效 🚀
