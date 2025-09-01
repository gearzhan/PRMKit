-- 在远程服务器数据库中创建管理员用户的SQL命令
-- 解决CSV导入时"Operator not found in database"错误

-- 插入管理员用户记录
-- 注意：密码是 'admin0258' 的bcrypt哈希值
INSERT INTO employees (
  id,
  employeeId,
  name,
  email,
  password,
  role,
  position,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'clz1234567890admin',  -- 固定的管理员ID
  'SAIYU_001',           -- 员工工号
  'Admin User',          -- 姓名
  'gzhan@saiyu.com.au',  -- 邮箱
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- 密码哈希 (admin0258)
  'LEVEL1',              -- 管理员角色
  'Director',            -- 职位
  1,                     -- 激活状态
  datetime('now'),       -- 创建时间
  datetime('now')        -- 更新时间
);

-- 验证插入是否成功
SELECT * FROM employees WHERE employeeId = 'SAIYU_001';

-- 如果需要删除这个管理员用户，可以使用以下命令：
-- DELETE FROM employees WHERE employeeId = 'SAIYU_001';