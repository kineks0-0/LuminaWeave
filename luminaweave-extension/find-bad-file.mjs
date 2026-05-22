import fs from 'fs';
import path from 'path';

// 修改为你存放 vue 文件的主要目录
const TARGET_DIR = './src';

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.vue')) {
      const buffer = fs.readFileSync(fullPath);
      try {
        // 开启 fatal: true，遇到非 UTF-8 字符会直接抛出错误
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch (e) {
        console.error('🚨 抓到元凶！包含非 UTF-8 字符的文件:', fullPath);
      }
    }
  }
}

console.log('开始扫描非 UTF-8 文件...');
scanDirectory(TARGET_DIR);
console.log('扫描结束。');