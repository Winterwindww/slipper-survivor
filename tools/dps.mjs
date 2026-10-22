/* 采集"人群 DPS 中位数"用于标定固定的 BOSS 血量曲线
   用法：node tools/dps.mjs --minutes 11 --seeds 2 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const MIN = Number(arg('minutes', 11));
const SEEDS = Number(arg('seeds', 2));
const CHARS = ['ranger','knight','engineer','keeper','chef'];
const ROOT = path.resolve(import.meta.dirname, '..');
const MARKS = [110, 188, 266, 344, 422, 500, 578, 660];

const series = [];
for (const ch of CHARS) {
  for (let s = 0; s < SEEDS; s++) {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools/sim.mjs'),
      '--minutes', String(MIN), '--runs', '1', '--char', ch, '--seed', String(1000 + s * 4211), '--json'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const r = JSON.parse(out)[0];
    series.push({ ch, log: r.snap.dpsLog || [], died: r.gameOverAt || null });
  }
}
const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
console.log('时间   DPS中位   P75     样本');
for (const t of MARKS) {
  const vals = [];
  for (const r of series) {
    const hit = r.log.find(x => x[0] >= t);
    if (hit) vals.push(hit[1]);
  }
  if (!vals.length) { console.log(`${t}s  —`); continue; }
  const p75 = vals.slice().sort((a,b)=>a-b)[Math.floor(vals.length*0.75)];
  console.log(`${String(t).padStart(4)}s ${String(med(vals)).padStart(8)} ${String(p75).padStart(8)} ${String(vals.length).padStart(5)}`);
}
