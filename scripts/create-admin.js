#!/usr/bin/env node

/**
 * 远程服务器初始管理员用户创建脚本
 * 用于解决 "Operator not found in database" 错误
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🚀 开始创建初始管理员