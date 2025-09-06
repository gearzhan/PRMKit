#!/bin/bash

# PRMKit 生产环境项目更新脚本
# 用途: 生产环境远程服务器项目代码更新，构建完整前后端，确保数据安全
# 使用方法: ./update_frontend.sh [--dry-run] [--skip-backup]

set -e  # 遇到错误立即退出

# 配置变量
PROJECT_NAME="PRMKit"
BACKUP_DIR="backups/frontend_$(date +"%Y%m%d_%H%M%S")"
LOG_FILE="logs/frontend_update_$(date +"%Y%m%d_%H%M%S").log"
DRY_RUN=false
SKIP_BACKUP=false

# 检查参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "使用方法: $0 [--dry-run] [--skip-backup]"
            exit 1
            ;;
    esac
done

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
    log "项目更新失败，请检查日志: $LOG_FILE"
    if [ "$DRY_RUN" = false ]; then
        log "如需回滚，请运行: ./rollback.sh $(basename $BACKUP_DIR)"
    fi
    exit 1
}

# 快速回滚函数（仅回滚关键文件）
quick_rollback() {
    log "开始快速回滚操作..."
    if [ -d "$BACKUP_DIR" ]; then
        # 恢复package.json（最重要）
        if [ -f "$BACKUP_DIR/package.json" ]; then
            cp "$BACKUP_DIR/package.json" .
            log "已回滚 package.json"
        fi
        
        # 恢复构建输出目录（如果存在）
        if [ -d "$BACKUP_DIR/dist" ]; then
            rm -rf dist
            cp -r "$BACKUP_DIR/dist" .
            log "已回滚 dist 目录"
        fi
        
        log "快速回滚完成"
    else
        log "警告: 备份目录不存在，无法回滚"
    fi
}

# 信号处理
trap 'log "收到中断信号，正在安全退出..."; quick_rollback; exit 1' INT TERM

log "🚀 开始 $PROJECT_NAME 生产环境项目更新..."
if [ "$DRY_RUN" = true ]; then
    log "*** DRY RUN 模式 - 不会执行实际操作 ***"
fi
if [ "$SKIP_BACKUP" = true ]; then
    log "*** 跳过备份模式 - 升级速度更快但风险更高 ***"
fi

# 检查是否在git仓库中
if [ ! -d ".git" ]; then
    error_exit "当前目录不是git仓库"
fi

# 生产环境更新：跳过git状态检查，直接进行更新
log "⚡ 生产环境模式：跳过git状态检查"

# 数据安全备份（生产环境必需）
if [ "$SKIP_BACKUP" = false ]; then
    log "🔒 创建数据安全备份: $BACKUP_DIR"
    if [ "$DRY_RUN" = false ]; then
        mkdir -p "$BACKUP_DIR"
        
        # 备份关键配置文件
        cp package.json "$BACKUP_DIR/" 2>/dev/null || true
        cp package-lock.json "$BACKUP_DIR/" 2>/dev/null || true
        cp .env.production "$BACKUP_DIR/" 2>/dev/null || true
        
        # 备份数据库文件（如果存在）
        if [ -f "prisma/data.db" ]; then
            cp "prisma/data.db" "$BACKUP_DIR/" 2>/dev/null || true
            log "✓ 已备份数据库文件"
        fi
        
        # 备份上传文件目录（如果存在且不大）
        if [ -d "uploads" ] && [ $(du -s uploads 2>/dev/null | cut -f1 || echo 0) -lt 512000 ]; then  # 小于500MB
            cp -r "uploads" "$BACKUP_DIR/" 2>/dev/null || true
            log "✓ 已备份上传文件"
        fi
        
        # 备份构建输出（如果存在且不大）
        if [ -d "dist" ] && [ $(du -s dist | cut -f1) -lt 102400 ]; then  # 小于100MB
            cp -r "dist" "$BACKUP_DIR/" 2>/dev/null || true
            log "✓ 已备份构建输出"
        fi
        
        log "✓ 数据安全备份完成"
    fi
else
    log "⚠ 跳过备份模式 - 生产环境不推荐"
fi

# 拉取最新代码
log "📥 拉取并重置到最新代码..."
if [ "$DRY_RUN" = false ]; then
    git fetch --all && git reset --hard origin/main || error_exit "Git 更新失败"
fi

# 智能依赖安装（检查package.json是否有变化）
log "📦 检查依赖更新..."
if [ "$DRY_RUN" = false ]; then
    if [ "$SKIP_BACKUP" = false ] && [ -f "$BACKUP_DIR/package.json" ]; then
        if cmp -s package.json "$BACKUP_DIR/package.json"; then
            log "✓ 依赖无变化，跳过安装"
        else
            log "📦 检测到依赖变化，重新安装..."
            npm ci || error_exit "依赖安装失败"
        fi
    else
        log "📦 安装/更新依赖..."
        npm ci || error_exit "依赖安装失败"
    fi
fi

# 完整构建项目（前端+后端）
log "🔨 构建完整项目..."
if [ "$DRY_RUN" = false ]; then
    # 清理旧的构建文件
    npm run clean 2>/dev/null || rm -rf dist 2>/dev/null || true
    
    # 构建完整项目（包含前端和后端）
    npm run build || error_exit "项目构建失败"
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

# 检查PM2服务状态
log "📊 检查PM2服务状态..."
if [ "$DRY_RUN" = false ]; then
    if command -v pm2 >/dev/null 2>&1; then
        echo "\n=== PM2 服务状态 ==="
        pm2 list
        echo "==================="
    else
        log "⚠ PM2 未安装，无法显示服务状态"
    fi
fi

log "🎉 生产环境项目更新完成！"
if [ "$SKIP_BACKUP" = false ]; then
    log "📁 备份位置: $BACKUP_DIR"
fi
if [ "$DRY_RUN" = false ]; then
    log "📋 日志文件: $LOG_FILE"
    if [ "$SKIP_BACKUP" = false ]; then
        log "🔄 如需回滚，请运行: ./rollback.sh $(basename $BACKUP_DIR)"
    fi
    log "✅ 前端代码已更新，请手动管理PM2服务"
else
    log "*** DRY RUN 完成 - 没有执行实际操作 ***"
fi

# 生产环境提示
if [ "$DRY_RUN" = false ]; then
    echo
    echo "🏭 生产环境更新完成提示:"
    echo "   - 项目代码已更新并构建完成（包含前后端）"
    echo "   - 请根据需要手动重启PM2服务: pm2 restart <app_name>"
    echo "   - 检查服务状态: pm2 status"
    echo "   - 查看日志: pm2 logs"
    if [ "$SKIP_BACKUP" = false ]; then
        echo "   - 如遇问题可回滚: ./rollback.sh $(basename $BACKUP_DIR)"
    fi
    echo "   - ⚠ 重要：请确认服务正常运行后再离开"
fi