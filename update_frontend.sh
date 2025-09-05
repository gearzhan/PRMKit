#!/bin/bash

# 前端更新部署脚本
# 用途: 处理前端代码更新，不涉及数据库操作
# 使用方法: ./update_frontend.sh [--dry-run]

set -e  # 遇到错误立即退出

# 配置变量
SERVICE_NAME="PRMKit"  # 根据实际服务名称调整
BACKUP_DIR="backups/frontend_$(date +"%Y%m%d_%H%M%S")"
LOG_FILE="logs/frontend_update_$(date +"%Y%m%d_%H%M%S").log"
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
    log "前端更新失败，请检查日志: $LOG_FILE"
    if [ "$DRY_RUN" = false ]; then
        log "如需回滚，请运行: ./rollback.sh $(basename $BACKUP_DIR)"
    fi
    exit 1
}

# 回滚函数
rollback() {
    log "开始回滚操作..."
    if [ -d "$BACKUP_DIR" ]; then
        # 恢复环境变量文件
        for env_file in .env .env.local .env.production; do
            if [ -f "$BACKUP_DIR/$env_file" ]; then
                cp "$BACKUP_DIR/$env_file" .
                log "已回滚 $env_file"
            fi
        done
        
        # 恢复依赖文件
        for dep_file in package.json package-lock.json; do
            if [ -f "$BACKUP_DIR/$dep_file" ]; then
                cp "$BACKUP_DIR/$dep_file" .
                log "已回滚 $dep_file"
            fi
        done
        
        # 恢复构建输出目录（如果存在）
        if [ -d "$BACKUP_DIR/dist" ]; then
            rm -rf dist
            cp -r "$BACKUP_DIR/dist" .
            log "已回滚 dist 目录"
        fi
        
        log "回滚完成"
    else
        log "警告: 备份目录不存在，无法回滚"
    fi
}

# 信号处理
trap 'log "收到中断信号，正在安全退出..."; rollback; exit 1' INT TERM

log "开始前端更新部署..."
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

# 备份当前构建输出（如果存在）
log "备份构建输出..."
if [ -d "dist" ]; then
    if [ "$DRY_RUN" = false ]; then
        cp -r "dist" "$BACKUP_DIR/"
    fi
    log "已备份 dist 目录"
fi

# 拉取最新代码
log "拉取最新代码..."
if [ "$DRY_RUN" = false ]; then
    git fetch --all || error_exit "git fetch 失败"
    git reset --hard origin/main || error_exit "git reset 失败"
fi

# 安装依赖
log "安装依赖..."
if [ "$DRY_RUN" = false ]; then
    npm ci || error_exit "npm install 失败"
fi

# 构建项目
log "构建前端项目..."
if [ "$DRY_RUN" = false ]; then
    npm run build || error_exit "前端项目构建失败"
fi

# 验证构建结果
log "验证构建结果..."
if [ "$DRY_RUN" = false ]; then
    if [ ! -d "dist" ]; then
        error_exit "构建输出目录不存在，构建可能失败"
    fi
    
    # 检查关键文件是否存在
    if [ ! -f "dist/index.html" ]; then
        error_exit "构建输出中缺少 index.html 文件"
    fi
fi

log "前端更新部署完成！"
log "备份位置: $BACKUP_DIR"
if [ "$DRY_RUN" = false ]; then
    log "日志文件: $LOG_FILE"
    log "如需回滚，请运行: ./rollback.sh $(basename $BACKUP_DIR)"
else
    log "*** DRY RUN 完成 - 没有执行实际操作 ***"
fi