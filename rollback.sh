#!/bin/bash

# 回滚脚本
# 用途: 回滚到指定的备份状态
# 使用方法: ./rollback.sh <backup_timestamp> [--dry-run]
# 示例: ./rollback.sh 20240101_120000

set -e  # 遇到错误立即退出

# 配置变量
SERVICE_NAME="prmkit"  # 根据实际服务名称调整
LOG_FILE="logs/rollback_$(date +"%Y%m%d_%H%M%S").log"
DRY_RUN=false

# 检查参数
if [ $# -lt 1 ]; then
    echo "使用方法: $0 <backup_timestamp> [--dry-run]"
    echo "示例: $0 20240101_120000"
    echo "可用备份:"
    ls -la backups/ 2>/dev/null || echo "没有找到备份目录"
    exit 1
fi

BACKUP_TIMESTAMP="$1"
BACKUP_DIR="backups/$BACKUP_TIMESTAMP"

if [ "$2" = "--dry-run" ]; then
    DRY_RUN=true
fi

# 日志函数
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message"
    if [ "$DRY_RUN" = false ]; then
        mkdir -p logs
        echo "$message" >> "$LOG_FILE"
    fi
}

# 错误处理函数
error_exit() {
    log "错误: $1"
    log "回滚失败，请检查日志: $LOG_FILE"
    exit 1
}

log "开始回滚操作..."
if [ "$DRY_RUN" = true ]; then
    log "*** DRY RUN 模式 - 不会执行实际操作 ***"
fi

# 检查备份目录是否存在
if [ ! -d "$BACKUP_DIR" ]; then
    error_exit "备份目录不存在: $BACKUP_DIR"
fi

log "使用备份: $BACKUP_DIR"

# 停止服务（如果正在运行）
log "检查并停止服务..."
if command -v pm2 >/dev/null 2>&1; then
    if [ "$DRY_RUN" = false ]; then
        pm2 stop "$SERVICE_NAME" 2>/dev/null || log "服务未运行或停止失败"
    fi
    log "已停止 PM2 服务"
elif command -v systemctl >/dev/null 2>&1; then
    if [ "$DRY_RUN" = false ]; then
        sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || log "服务未运行或停止失败"
    fi
    log "已停止 systemd 服务"
else
    log "未检测到服务管理器，跳过服务停止"
fi

# 创建紧急备份（回滚前的当前状态）
EMERGENCY_BACKUP_DIR="backups/emergency_$(date +"%Y%m%d_%H%M%S")"
log "创建紧急备份: $EMERGENCY_BACKUP_DIR"
if [ "$DRY_RUN" = false ]; then
    mkdir -p "$EMERGENCY_BACKUP_DIR"
fi

# 备份当前数据库文件
if [ -f "prisma/data.db" ]; then
    if [ "$DRY_RUN" = false ]; then
        cp "prisma/data.db" "$EMERGENCY_BACKUP_DIR/data.db"
    fi
    log "已紧急备份当前 prisma/data.db"
fi

# 恢复数据库文件
log "恢复数据库文件..."
if [ -f "$BACKUP_DIR/data.db" ]; then
    if [ "$DRY_RUN" = false ]; then
        cp "$BACKUP_DIR/data.db" "prisma/data.db"
    fi
    log "已恢复 prisma/data.db"
else
    log "警告: 备份中没有找到 data.db 文件"
fi

# 恢复环境变量文件
log "恢复环境变量文件..."
for env_file in .env .env.local .env.production; do
    if [ -f "$BACKUP_DIR/$env_file" ]; then
        if [ "$DRY_RUN" = false ]; then
            cp "$BACKUP_DIR/$env_file" .
        fi
        log "已恢复 $env_file"
    fi
done

# 恢复migrations目录
log "恢复migrations目录..."
if [ -d "$BACKUP_DIR/migrations" ]; then
    if [ "$DRY_RUN" = false ]; then
        rm -rf prisma/migrations
        cp -r "$BACKUP_DIR/migrations" prisma/
    fi
    log "已恢复 prisma/migrations"
else
    log "警告: 备份中没有找到 migrations 目录"
fi

# 恢复依赖文件
log "恢复依赖文件..."
for dep_file in package.json package-lock.json; do
    if [ -f "$BACKUP_DIR/$dep_file" ]; then
        if [ "$DRY_RUN" = false ]; then
            cp "$BACKUP_DIR/$dep_file" .
        fi
        log "已恢复 $dep_file"
    fi
done

# 重新安装依赖
log "重新安装依赖..."
if [ "$DRY_RUN" = false ]; then
    npm ci || error_exit "npm install 失败"
fi

# 生成Prisma客户端
log "生成Prisma客户端..."
if [ "$DRY_RUN" = false ]; then
    npx prisma generate || error_exit "Prisma generate 失败"
fi

# 重新构建项目
log "重新构建项目..."
if [ "$DRY_RUN" = false ]; then
    npm run build || error_exit "项目构建失败"
fi

# 启动服务
log "启动服务..."
if command -v pm2 >/dev/null 2>&1; then
    if [ "$DRY_RUN" = false ]; then
        pm2 start "$SERVICE_NAME" || pm2 restart "$SERVICE_NAME" || log "服务启动失败"
    fi
    log "已启动 PM2 服务"
elif command -v systemctl >/dev/null 2>&1; then
    if [ "$DRY_RUN" = false ]; then
        sudo systemctl start "$SERVICE_NAME" || log "服务启动失败"
    fi
    log "已启动 systemd 服务"
else
    log "未检测到服务管理器，请手动启动服务"
fi

log "回滚完成！"
log "已回滚到备份: $BACKUP_TIMESTAMP"
log "紧急备份位置: $EMERGENCY_BACKUP_DIR"
if [ "$DRY_RUN" = false ]; then
    log "日志文件: $LOG_FILE"
else
    log "*** DRY RUN 完成 - 没有执行实际操作 ***"
fi