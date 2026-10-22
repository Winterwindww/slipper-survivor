/* 上线守卫：判断 index.html 是否比上一次上线时更新了
   用法：
     node tools/deploy-guard.mjs --check   → 打印 SKIP 或 DEPLOY
     node tools/deploy-guard.mjs --mark    → 记录当前 index.html 的版本（上线成功后调用）
   记录文件：.deploy-hash（不进 git） */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'index.html');
const STAMP = path.join(ROOT, '.deploy-hash');
const mode = process.argv.includes('--mark') ? 'mark' : 'check';

if (!fs.existsSync(OUT)) {
  console.log('MISSING index.html');
  process.exit(0);
}
const hash = crypto.createHash('sha1').update(fs.readFileSync(OUT)).digest('hex').slice(0, 12);

if (mode === 'mark') {
  fs.writeFileSync(STAMP, hash + '\n');
  console.log('MARKED ' + hash);
  process.exit(0);
}

const prev = fs.existsSync(STAMP) ? fs.readFileSync(STAMP, 'utf8').trim() : '';
if (prev === hash) {
  console.log('SKIP ' + hash + ' 已经在线，无需重新发布');
} else {
  console.log('DEPLOY ' + hash + ' 与线上版本 ' + (prev || '(无记录)') + ' 不同');
}
