/* 一次性拆分脚本：把 index.html 按行区间切到 src/，不改变任何代码 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const hadTrailing = raw.endsWith('\n');
const lines = raw.split('\n');
if (hadTrailing) lines.pop();

const SRC = path.join(ROOT, 'src');
fs.mkdirSync(SRC, { recursive: true });

const take = (a, b) => lines.slice(a - 1, b).join('\n') + '\n';

/* shell：<script> 之前 + </script> 之后 */
fs.writeFileSync(path.join(SRC, '00-shell-head.html'), take(1, 406));
fs.writeFileSync(path.join(SRC, '99-shell-tail.html'), lines.slice(4898).join('\n') + (hadTrailing ? '\n' : ''));

const CHUNKS = [
  ['10-core.js',          407,  465],
  ['20-sprites.js',       466,  674],
  ['30-icons.js',         675,  831],
  ['42-weapons.js',       832, 1328],
  ['44-relics.js',       1329, 1482],
  ['45-fusion.js',       1483, 1675],
  ['46-enemies.js',      1676, 1740],
  ['50-state.js',        1741, 1861],
  ['55-audio.js',        1862, 2038],
  ['60-fx.js',           2039, 2055],
  ['62-combat.js',       2056, 2494],
  ['64-update.js',       2495, 3013],
  ['66-ai.js',           3014, 3389],
  ['70-render.js',       3390, 4289],
  ['80-ui.js',           4290, 4766],
  ['90-loop.js',         4767, 4898]
];

for (const [file, a, b] of CHUNKS) {
  fs.writeFileSync(path.join(SRC, file), take(a, b));
}

/* 构建清单：顺序即拼接顺序 */
fs.writeFileSync(path.join(SRC, 'manifest.json'), JSON.stringify(
  CHUNKS.map(c => c[0]),
  null, 2
) + '\n');

console.log('split ok:', CHUNKS.length, 'chunks');
