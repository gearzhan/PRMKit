# 远程服务器部署指南

本文档说明如何在远程服务器上安全地部署和更新PRMKit项目，同时保持数据库数据不被重置。

## 问题背景

使用以下命令更新远程服务器时会删除数据库文件：
```bash
git fetch --all
git reset --hard origin/main
git clean -fd
```

## 解决方案

### 方案1: 使用完整部署脚本（推荐）

使用提供的 `deploy.sh` 脚本，它会自动备份和恢复数据库文件：

```bash
./deploy.sh
```

该脚本会：
1. 备份数据库文件（`prisma/data.db`）
2. 备份迁移文件（`prisma/migrations`）
3. 拉取最新代码
4. 恢复数据库文件
5. 安装依赖并构建项目
6. 验证数据库状态

### 方案2: 使用简化部署脚本

如果你已经手动拉取了代码更新，可以使用 `deploy-simple.sh`：

```bash
./deploy-simple.sh
```

该脚本只执行：
1. 安装依赖（如果需要）
2. 构建项目
3. 启动服务器

### 方案3: 手动部署

如果你更喜欢手动控制，可以按以下步骤操作：

1. **备份数据库文件**：
   ```bash
   cp prisma/data.db prisma/data.db.backup
   cp -r prisma/migrations prisma/migrations.backup
   ```

2. **拉取代码更新**：
   ```bash
   git fetch --all
   git reset --hard origin/main
   git clean -fd
   ```

3. **恢复数据库文件**：
   ```bash
   mv prisma/data.db.backup prisma/data.db
   mv prisma/migrations.backup prisma/migrations
   ```

4. **构建和启动**：
   ```bash
   npm install
   npm run build
   npm start
   ```

## Git忽略配置

项目的 `.gitignore` 文件已经配置为忽略以下数据库相关文件：

```
prisma/data.db
prisma/data.db
prisma/migrations
```

这确保了数据库文件不会被git管理，从而避免在代码更新时被覆盖。

## 注意事项

1. **首次部署**：在远程服务器首次部署时，需要运行数据库初始化：
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

2. **数据库迁移**：如果有新的数据库迁移，需要手动应用：
   ```bash
   npx prisma migrate deploy
   ```

3. **备份策略**：建议定期备份生产数据库：
   ```bash
   cp prisma/data.db backups/data-$(date +%Y%m%d-%H%M%S).db
   ```

4. **环境变量**：确保远程服务器上的环境变量配置正确，特别是数据库连接字符串。

## 故障排除

如果遇到数据库相关错误：

1. 检查数据库文件是否存在：
   ```bash
   ls -la prisma/
   ```

2. 验证数据库schema：
   ```bash
   npx prisma db push
   ```

3. 重新生成Prisma客户端：
   ```bash
   npx prisma generate
   ```

## 联系支持

如果在部署过程中遇到问题，请检查：
- 服务器日志
- 数据库连接状态
- 环境变量配置