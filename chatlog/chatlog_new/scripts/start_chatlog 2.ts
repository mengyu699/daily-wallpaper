#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

function checkChatlogInstalled() {
  try {
    const version = execSync('chatlog --version', { encoding: 'utf8' }).trim();
    console.log(`✅ chatlog version: ${version}`);
  } catch (error) {
    throw new Error('chatlog is not installed. Please install: npm install -g @chatlog/cli');
  }
}

function getWechatDbPath(): string {
  const dbPath = process.env.WECHAT_DB_PATH;
  if (!dbPath) {
    throw new Error('WECHAT_DB_PATH is not set in .env file');
  }
  if (!existsSync(dbPath)) {
    throw new Error(`WeChat database not found at: ${dbPath}`);
  }
  return dbPath;
}

function decryptDatabase(dbPath: string) {
  console.log('🔓 Decrypting WeChat database...');
  const outputPath = './data/wechat.db';
  try {
    execSync(`chatlog decrypt wechat "${dbPath}" --out ${outputPath}`, { 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    console.log('✅ Database decrypted successfully');
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to decrypt database: ${error}`);
  }
}

function startChatlogServer(dbPath: string) {
  console.log('🚀 Starting chatlog server...');
  try {
    execSync(`chatlog serve --db ${dbPath} --port 3030`, {
      stdio: 'inherit',
      encoding: 'utf8'
    });
  } catch (error) {
    throw new Error(`Failed to start chatlog server: ${error}`);
  }
}

function main() {
  try {
    checkChatlogInstalled();
    const dbPath = getWechatDbPath();
    const decryptedPath = decryptDatabase(dbPath);
    startChatlogServer(decryptedPath);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}