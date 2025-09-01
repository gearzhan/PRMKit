#!/bin/bash

# 测试git更新流程是否会影响数据库文件
# 使用方法: ./test-git-update.sh

echo "开始测试git更新流程..."

# 检查数据库文件是否存在
echo "检查数据库文件状态:"
if [ -f "prisma/data.db" ]; then
    echo "✓ prisma/data.db 存在"
    DB_SIZE_BEFORE=$(stat -f%z prisma/data.db 2>/dev/null || echo "0")
    echo "  文件大小: $DB_SIZE_BEFORE bytes"
else
    echo "✗ prisma/data.db 不存在"
    DB_SIZE_BEFORE="0"
fi

if [ -d "prisma/migrations" ]; then
    echo "✓ prisma/migrations 目录存在"
    MIGRATION_COUNT_BEFORE=$(find prisma/migrations -name "*.sql" | wc -l)
    echo "  迁移文件数量: $MIGRATION_COUNT_BEFORE"
else
    echo "✗ prisma/migrations 目录不存在"
    MIGRATION_COUNT_BEFORE="0"
fi

# 测试git clean命令（dry run）
echo "\n测试 git clean -fd 命令:"
git clean -fd --dry-run

# 检查数据库文件是否在忽略列表中
echo "\n验证数据库文件是否被git忽略:"
if git check-ignore prisma/data.db >/dev/null 2>&1; then
    echo "✓ prisma/data.db 被正确忽略"
else
    echo "✗ prisma/data.db 未被忽略 - 警告!"
fi

if git check-ignore prisma/migrations >/dev/null 2>&1; then
    echo "✓ prisma/migrations 被正确忽略"
else
    echo "✗ prisma/migrations 未被忽略 - 警告!"
fi

# 模拟git更新流程（不实际执行）
echo "\n模拟git更新命令:"
echo "git fetch --all (模拟)"
echo "git reset --hard origin/main (模拟)"
echo "git clean -fd (模拟)"

# 再次检查数据库文件
echo "\n更新后检查数据库文件状态:"
if [ -f "prisma/data.db" ]; then
    echo "✓ prisma/data.db 仍然存在"
    DB_SIZE_AFTER=$(stat -f%z prisma/data.db 2>/dev/null || echo "0")
    echo "  文件大小: $DB_SIZE_AFTER bytes"
    if [ "$DB_SIZE_BEFORE" = "$DB_SIZE_AFTER" ]; then
        echo "✓ 数据库文件大小未改变"
    else
        echo "⚠ 数据库文件大小发生变化"
    fi
else
    echo "✗ prisma/data.db 已被删除 - 这不应该发生!"
fi

if [ -d "prisma/migrations" ]; then
    echo "✓ prisma/migrations 目录仍然存在"
    MIGRATION_COUNT_AFTER=$(find prisma/migrations -name "*.sql" | wc -l)
    echo "  迁移文件数量: $MIGRATION_COUNT_AFTER"
    if [ "$MIGRATION_COUNT_BEFORE" = "$MIGRATION_COUNT_AFTER" ]; then
        echo "✓ 迁移文件数量未改变"
    else
        echo "⚠ 迁移文件数量发生变化"
    fi
else
    echo "✗ prisma/migrations 目录已被删除 - 这不应该发生!"
fi

echo "\n测试完成!"
echo "如果看到任何 ✗ 标记，说明配置可能有问题。"
echo "如果所有检查都显示 ✓，说明数据库文件在git更新时是安全的。"