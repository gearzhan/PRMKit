#!/bin/bash

# PRMKit 一键安装脚本
# 用途: 全新项目安装，包含环境检查、依赖安装、数据库初始化等
# 使用方法: ./install.sh [--dry-run]

set -e  # 遇到错误立即退出

# 配置变量
PROJECT_NAME="PRMKit"
LOG_FILE="logs/install_$(date +"%Y%m%d_%H%M%S").log"
DRY_RUN=false
REQUIRED_NODE_VERSION="18"

# 检查参数
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "未知参数: $arg"
            echo "使用方法: $0 [--dry-run]"
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
    log "安装失败，请检查日志: $LOG_FILE"
    exit 1
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# 检查Node.js版本
check_node_version() {
    if ! check_command node; then
        error_exit "Node.js 未安装，请先安装 Node.js $REQUIRED_NODE_VERSION 或更高版本"
    fi
    
    local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt "$REQUIRED_NODE_VERSION" ]; then
        error_exit "Node.js 版本过低 (当前: v$node_version)，需要 v$REQUIRED_NODE_VERSION 或更高版本"
    fi
    
    log "✓ Node.js 版本检查通过: $(node -v)"
}

# 检查npm
check_npm() {
    if ! check_command npm; then
        error_exit "npm 未安装，请先安装 npm"
    fi
    log "✓ npm 版本: $(npm -v)"
}

# 检查git
check_git() {
    if ! check_command git; then
        error_exit "git 未安装，请先安装 git"
    fi
    log "✓ git 版本: $(git --version)"
}

# 检查系统环境
check_system() {
    log "检查系统环境..."
    
    # 检查操作系统
    case "$(uname -s)" in
        Darwin*)
            log "✓ 操作系统: macOS"
            ;;
        Linux*)
            log "✓ 操作系统: Linux"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            log "✓ 操作系统: Windows"
            ;;
        *)
            log "⚠ 未知操作系统: $(uname -s)"
            ;;
    esac
    
    # 检查磁盘空间 (至少需要1GB)
    local available_space=$(df . | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 1048576 ]; then  # 1GB = 1048576 KB
        error_exit "磁盘空间不足，至少需要 1GB 可用空间"
    fi
    log "✓ 磁盘空间充足"
}

# 检查生产环境要求
check_production_requirements() {
    log "检查生产环境要求..."
    
    # 检查PM2是否安装
    if ! check_command pm2; then
        log "⚠ PM2 未安装，将使用 npm start 启动"
    else
        log "✓ PM2 已安装: $(pm2 -v)"
    fi
    
    # 检查环境变量文件
    if [ ! -f ".env.production" ]; then
        log "⚠ .env.production 文件不存在，请确保生产环境配置正确"
    fi
    
    # 检查NODE_ENV
    if [ -z "$NODE_ENV" ]; then
        log "⚠ NODE_ENV 未设置，建议设置为 production"
    fi
    
    log "✓ 生产环境检查完成"
}

# 创建必要的目录结构
create_directories() {
    log "创建必要的目录结构..."
    
    local dirs=("logs" "backups" "uploads" "prisma/migrations")
    
    for dir in "${dirs[@]}"; do
        if [ "$DRY_RUN" = false ]; then
            mkdir -p "$dir"
        fi
        log "✓ 创建目录: $dir"
    done
}

# 安装依赖
install_dependencies() {
    log "安装项目依赖..."
    
    if [ "$DRY_RUN" = false ]; then
        # 清理可能存在的node_modules
        if [ -d "node_modules" ]; then
            log "清理现有 node_modules..."
            rm -rf node_modules
        fi
        
        # 清理npm缓存
        npm cache clean --force || log "⚠ npm缓存清理失败，继续安装..."
        
        # 安装依赖
        npm install || error_exit "依赖安装失败"
    fi
    
    log "✓ 依赖安装完成"
}

# 初始化数据库
init_database() {
    log "初始化数据库..."
    
    if [ "$DRY_RUN" = false ]; then
        # 加载生产环境变量
        if [ -f ".env.production" ]; then
            log "加载生产环境变量文件..."
            # 导出.env.production中的环境变量
            set -a  # 自动导出所有变量
            source .env.production || error_exit "加载.env.production文件失败"
            set +a  # 关闭自动导出
            log "✓ 环境变量加载完成"
        else
            error_exit ".env.production文件不存在，无法初始化数据库"
        fi
        
        # 验证关键环境变量
        if [ -z "$DATABASE_URL" ]; then
            error_exit "DATABASE_URL环境变量未设置，请检查.env.production文件"
        fi
        log "✓ 数据库连接配置验证通过: $DATABASE_URL"
        
        # 生成Prisma客户端
        npx prisma generate || error_exit "Prisma客户端生成失败"
        
        # 检查是否有迁移文件存在
        if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
            # 有迁移文件，使用migrate deploy
            log "执行数据库迁移..."
            npx prisma migrate deploy || error_exit "数据库迁移失败"
        else
            # 没有迁移文件，跳过迁移步骤（将在后续检查中处理）
            log "未发现迁移文件，将在后续步骤中处理..."
        fi
        
        # 检查是否为首次安装（通过检查数据库中是否有用户表以及数据）
        log "检查是否为首次安装..."
        
        # 首先检查employees表是否存在
        if npx prisma db execute --stdin <<< "SELECT name FROM sqlite_master WHERE type='table' AND name='employees';" 2>/dev/null | grep -q "employees"; then
            # 表存在，检查是否有数据
            employee_count=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM employees;" 2>/dev/null | tail -n 1 | tr -d '\r\n ')
            if [ "$employee_count" = "0" ] || [ -z "$employee_count" ]; then
                log "检测到employees表存在但无数据，执行种子数据初始化..."
                npm run db:seed || error_exit "种子数据初始化失败"
            else
                log "检测到已有员工数据($employee_count条记录)，跳过种子数据初始化"
            fi
        else
            # 表不存在，说明是首次安装，需要先生成初始迁移
            log "检测到employees表不存在，这是首次安装，生成初始迁移..."
            npx prisma migrate dev --name init || error_exit "初始迁移生成失败"
            log "执行种子数据初始化..."
            npm run db:seed || error_exit "种子数据初始化失败"
        fi
    fi
    
    log "✓ 数据库初始化完成"
}

# 构建项目
build_project() {
    log "构建项目..."
    
    if [ "$DRY_RUN" = false ]; then
        npm run build || error_exit "项目构建失败"
    fi
    
    log "✓ 项目构建完成"
}

# 验证安装
verify_installation() {
    log "验证安装结果..."
    
    # 检查关键文件
    local required_files=("package.json" "prisma/schema.prisma" ".env.production")
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error_exit "缺少关键文件: $file"
        fi
        log "✓ 文件存在: $file"
    done
    
    # 检查构建输出
    if [ "$DRY_RUN" = false ]; then
        if [ ! -d "dist" ]; then
            error_exit "构建输出目录不存在"
        fi
        
        if [ ! -f "dist/server.js" ]; then
            error_exit "服务器构建文件不存在"
        fi
    fi
    
    log "✓ 安装验证通过"
}

# 生成启动脚本
generate_start_script() {
    log "生成启动脚本..."
    
    if [ "$DRY_RUN" = false ]; then
        # 生产环境启动脚本
        cat > start.sh << 'EOF'
#!/bin/bash

# 设置环境变量
export NODE_ENV=production

# 检查PM2是否可用
if command -v pm2 >/dev/null 2>&1; then
    echo "使用PM2启动应用..."
    pm2 start ecosystem.config.js
else
    echo "使用npm启动应用..."
    npm run start
fi
EOF
        
        chmod +x start.sh
    fi
    
    log "✓ 启动脚本生成完成"
}

# 主安装流程
main() {
    log "开始 $PROJECT_NAME 一键安装 (生产环境模式)..."
    if [ "$DRY_RUN" = true ]; then
        log "*** DRY RUN 模式 - 不会执行实际操作 ***"
    fi
    
    # 环境检查
    check_system
    check_node_version
    check_npm
    check_git
    check_production_requirements
    
    # 项目初始化
    create_directories
    install_dependencies
    init_database
    build_project
    
    # 验证和完成
    verify_installation
    generate_start_script
    
    # 显示完成信息
    echo "\n=== 安装完成 ==="
    echo "✓ PRMKit 生产环境安装完成！"
    echo ""
    echo "后续步骤："
    echo "1. 配置 .env.production 文件中的生产环境变量"
    echo "2. 运行 ./start.sh 启动应用"
    echo "3. 使用 PM2 监控应用状态（如果已安装）"
    echo ""
    echo "重要文件："
    echo "- .env.production: 生产环境变量配置"
    echo "- ecosystem.config.js: PM2配置文件"
    echo "- start.sh: 启动脚本"
    echo ""
    echo "⚠ 注意：请确保生产环境的安全配置！"
    
    if [ "$DRY_RUN" = true ]; then
        log "*** DRY RUN 完成 - 没有执行实际操作 ***"
    fi
}

# 信号处理
trap 'log "收到中断信号，正在安全退出..."; exit 1' INT TERM

# 执行主流程
main "$@"