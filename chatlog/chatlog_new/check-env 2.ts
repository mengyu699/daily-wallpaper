#!/usr/bin/env ts-node

import { execSync } from 'child_process';

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  if (major < 18) {
    throw new Error(`Node.js version ${version} is too old. Please install Node.js 18 or later.`);
  }
  console.log(`✅ Node.js version: ${version}`);
}

function checkPnpm() {
  try {
    const version = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ pnpm version: ${version}`);
  } catch (error) {
    throw new Error('pnpm is not installed. Please install pnpm: npm install -g pnpm');
  }
}

function main() {
  try {
    checkNodeVersion();
    checkPnpm();
    console.log('env ok');
    process.exit(0);
  } catch (error) {
    console.error('❌ Environment check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}