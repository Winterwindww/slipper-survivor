/* 构建：src/ → index.html（单文件交付物，双击可玩）
   用法：node tools/build.mjs [--check]   --check 只校验不写入 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');
const checkOnly = process.argv.includes('--check');

const head = fs.readFileSync(path.join(SRC, '00-shell-head.html'), 'utf8');
const tail = fs.readFileSync(path.join(SRC, '99-shell-tail.html'), 'utf8');
const order = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));

const parts = [];
let bytes = 0;
for (const f of order) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) {
    console.error('missing chunk:', f);
    process.exit(1);
  }
  const s = fs.readFileSync(p, 'utf8');
  bytes += Buffer.byteLength(s);
  parts.push(s);
}

const banner = '<!-- built from src/ by tools/build.mjs — do not edit index.html directly -->\n';
const bare = head + parts.join('') + tail;
const out = banner + bare;

const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(banner, '') : null;

if (checkOnly) {
  if (prev === bare) {
    console.log('check ok ·', order.length, 'chunks ·', (bytes / 1024).toFixed(1) + 'KB');
    process.exit(0);
  }
  console.error('check failed: index.html is out of date with src/');
  process.exit(1);
}

fs.writeFileSync(OUT, out);
console.log('build ok ·', order.length, 'chunks ·', (bytes / 1024).toFixed(1) + 'KB', '→ index.html');
