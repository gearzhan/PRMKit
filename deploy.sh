#!/bin/bash

# 远程服务器部署脚本
# 使用方法: ./deploy.sh
# 功能: 安全地从git拉取更新，保持数据库文件不变

echo "开始部署更新..."

# 检查是否在git仓库中
if [ ! -d ".git" ]; then
    echo "错误: 当前目录不是git仓库"
    exit 1npm
fi

# 备份重要的数据库文件（如果存在）
echo "备份数据库文件..."
if [ -f "prisma/data.db" ]; then
    cp prisma/data.db prisma/data.db.backup
    echo "已备份 prisma/data.db"
fi

# 备份migrations目录（如果存在）
if [ -d "prisma/migrations" ]; then
    cp -r prisma/migrations prisma/migrations.backup
    echo "已备份 prisma/migrations"
fi

# 拉取最新代码
echo "拉取最新代码..."
git fetch --all
git reset --hard origin/main
git clean -fd

# 恢复数据库文件
echo "恢复数据库文件..."
if [ -f "prisma/data.db.backup" ]; then
    mv prisma/data.db.backup prisma/data.db
    echo "已恢复 prisma/data.db"
fi

if [ -f "prisma/dev.db.backup" ]; then
    mv prisma/dev.db.backup prisma/dev.db
    echo "已恢复 prisma/dev.db"
fi

# 恢复migrations目录
if [ -d "prisma/migrations.backup" ]; then
    rm -rf prisma/migrations
    mv prisma/migrations.backup prisma/migrations
    echo "已恢复 prisma/migrations"
fi

# 安装依赖
echo "安装依赖..."
npm install

# 构建项目
echo "构建项目..."
npm run build

# 检查数据库连接
echo "检查数据库状态..."
npx prisma db push --accept-data-loss=false

echo "部署完成！"
echo "现在可以运行: npm start"