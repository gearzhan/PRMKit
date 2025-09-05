#!/bin/bash

# 数据库升级部署脚本
# 用途: 处理数据库结构更新，包含完整的数据安全保护
# 使用方法: ./upgrade_data.sh [--dry-run]

set -e  # 遇到错误立即退出

# 配置变量
SERVICE_NAME="prmkit"  # 根据实际服务名称调整
BACKUP_DIR="backups/$(date +"%Y%m%d_%H%M%S")"
LOG_FILE="logs/upgrade_$(date +"%Y%m%d_%H%M%S").log"
DRY_RUN=false

# 检查参数
if [ "$1" = "--dry-run" ]; then
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
    log "数据库升级失败，请检查日志: $LOG_FILE"
    if [ "$DRY_RUN" = false ]; then
        log "如需回滚，请运行: ./rollback.sh $(basename $BACKUP_DIR)"
    fi
    exit 1
}

# 回滚函数
rollback() {
    log "开始回滚操作..."
    if [ -d "$BACKUP_DIR" ]; then
        # 恢复数据库文件
        if [ -f "$BACKUP_DIR/data.db" ]; then
            cp "$BACKUP_DIR/data.db" "prisma/data.db"
            log "已回滚 prisma/data.db"
        fi
        
        # 恢复环境变量文件
        for env_file in .env .env.local .env.production; do
            if [ -f "$BACKUP_DIR/$env_file" ]; then
                cp "$BACKUP_DIR/$env_file" .
                log "已回滚 $env_file"
            fi
        done
        
        # 恢复migrations目录
        if [ -d "$BACKUP_DIR/migrations" ]; then
            rm -rf prisma/migrations
            cp -r "$BACKUP_DIR/migrations" prisma/
            log "已回滚 prisma/migrations"
        fi
        
        log "回滚完成"
    else
        log "警告: 备份目录不存在，无法回滚"
    fi
}

# 信号处理
trap 'log "收到中断信号，正在安全退出..."; rollback; exit 1' INT TERM

log "开始数据库升级部署..."
if [ "$DRY_RUN" = true ]; then
    log "*** DRY RUN 模式 - 不会执行实际操作 ***"
fi

# 检查是否在git仓库中
if [ ! -d ".git" ]; then
    error_exit "当前目录不是git仓库"
fi

# 创建备份目录
log "创建备份目录: $BACKUP_DIR"
if [ "$DRY_RUN" = false ]; then
    mkdir -p "$BACKUP_DIR"
fi

# 备份数据库文件
log "备份数据库文件..."
if [ -f "prisma/data.db" ]; then
    if [ "$DRY_RUN" = false ]; then
        cp "prisma/data.db" "$BACKUP_DIR/data.db"
    fi
    log "已备份 prisma/data.db"
fi

# 备份环境变量文件
log "备份环境变量文件..."
for env_file in .env .env.local .env.production; do
    if [ -f "$env_file" ]; then
        if [ "$DRY_RUN" = false ]; then
            cp "$env_file" "$BACKUP_DIR/"
        fi
        log "已备份 $env_file"
    fi
done

# 备份migrations目录
log "备份migrations目录..."
if [ -d "prisma/migrations" ]; then
    if [ "$DRY_RUN" = false ]; then
        cp -r "prisma/migrations" "$BACKUP_DIR/"
    fi
    log "已备份 prisma/migrations"
fi

# 备份依赖文件
log "备份依赖文件..."
for dep_file in package.json package-lock.json; do
    if [ -f "$dep_file" ]; then
        if [ "$DRY_RUN" = false ]; then
            cp "$dep_file" "$BACKUP_DIR/"
        fi
        log "已备份 $dep_file"
    fi
done

# 拉取最新代码
log "拉取最新代码..."
if [ "$DRY_RUN" = false ]; then
    git pull origin main || error_exit "git pull 失败"
fi

# 安装依赖
log "安装依赖..."
if [ "$DRY_RUN" = false ]; then
    npm ci || error_exit "npm install 失败"
fi

# 生成Prisma客户端
log "生成Prisma客户端..."
if [ "$DRY_RUN" = false ]; then
    npx prisma generate || error_exit "Prisma generate 失败"
fi

# 验证数据库连接
log "验证数据库连接..."
if [ "$DRY_RUN" = false ]; then
    npx prisma db pull --force || error_exit "数据库连接验证失败"
fi

# 运行数据库迁移
log "运行数据库迁移..."
if [ "$DRY_RUN" = false ]; then
    npx prisma migrate deploy || error_exit "数据库迁移失败"
fi

# 构建项目
log "构建项目..."
if [ "$DRY_RUN" = false ]; then
    npm run build || error_exit "项目构建失败"
fi

# 验证部署结果
log "验证部署结果..."
if [ "$DRY_RUN" = false ]; then
    npx prisma db pull --force || error_exit "部署验证失败"
fi

log "数据库升级部署完成！"
log "备份位置: $BACKUP_DIR"
if [ "$DRY_RUN" = false ]; then
    log "日志文件: $LOG_FILE"
    log "如需回滚，请运行: ./rollback.sh $(basename $BACKUP_DIR)"
else
    log "*** DRY RUN 完成 - 没有执行实际操作 ***"
fi