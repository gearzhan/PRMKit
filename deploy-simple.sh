#!/bin/bash

# 简化版远程服务器部署脚本
# 使用方法: ./deploy-simple.sh
# 功能: 快速部署，只执行 npm run build && npm start

echo "开始简化部署..."

# 检查package.json是否存在
if [ ! -f "package.json" ]; then
    echo "错误: 未找到package.json文件"
    exit 1
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

# 构建项目
echo "构建项目..."
npm run build

if [ $? -eq 0 ]; then
    echo "构建成功！"
    echo "启动服务器..."
    npm start
else
    echo "构建失败！"
    exit 1
fi