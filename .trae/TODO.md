# TODO:

- [x] examine_backend_search: 检查api/routes/timesheets.ts中GET /路由的当前实现 (priority: High)
- [x] add_search_parameter: 在后端timesheets.ts的getList路由中添加search参数处理 (priority: High)
- [x] implement_search_logic: 实现搜索逻辑，支持按项目名称、项目代码、描述等字段搜索 (priority: High)
- [x] fix_sqlite_compatibility: 修复api/routes/timesheets.ts中的SQLite兼容性问题，移除mode: insensitive参数 (priority: High)
- [x] test_search_functionality: 测试前端搜索功能，确保实时搜索和按回车搜索都能正常工作 (priority: Medium)
