const fs = require('fs');
const path = './src/version.ts';

// 读取当前版本
let content = fs.readFileSync(path, 'utf8');
let buildNumber = parseInt(content.match(/BUILD_NUMBER = (\d+)/)[1]);

// 递增并更新时间
buildNumber++;
const newTime = new Date().toLocaleString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).replace(/\//g, '-');

const newContent = content.replace(/BUILD_NUMBER = \d+/, `BUILD_NUMBER = ${buildNumber}`)
                          .replace(/BUILD_TIME = '.*?'/, `BUILD_TIME = '${newTime}'`);

fs.writeFileSync(path, newContent);
console.log(`✓ 版本已更新: Build #${buildNumber} (${newTime})`);
