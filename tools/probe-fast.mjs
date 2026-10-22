/* 并行版压力测试：每个角色一个子进程，跑完再汇总。
   用法：node tools/probe-fast.mjs --minutes 11 --seeds 3
        node tools/probe-fast.mjs --minutes 11 --seeds 3 --jobs 5

   为什么要这个：probe.mjs 本身已经是 ~35 倍速（11 分钟一局只要 20 秒），
   慢的原因不在单局速度，而在 **15 局串行跑**。这里把角色拆到不同进程，
   墙钟时间直接除以核数。 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const MINUTES = arg('minutes', '11');
const SEEDS = arg('seeds', '3');
const CHARS = arg('chars', 'knight,ranger,engineer,keeper,chef').split(',');
const JOBS = Math.max(1, Math.min(CHARS.length, Number(arg('jobs', CHARS.length))));

function runChar(c){
  return new Promise(resolve => {
    const p = spawn(process.execPath, [
      path.join(ROOT, 'tools/probe.mjs'),
      '--minutes', MINUTES, '--seeds', SEEDS, '--chars', c, '--quiet'
    ], { cwd: ROOT });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('close', () => {
      const runs = [];
      const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
      for(const line of out.split('\n')){
        const m = line.match(/^__RUN__ (\{.*\})$/);
        if(m){
          try{ runs.push(JSON.parse(m[1])); }catch(e){}
        }
      }
      const row = out.split('\n').find(l => l.startsWith(c + ' ') && l.includes('/'));
      resolve({ c, runs, row: row || '', text: out });
    });
  });
}

const t0 = Date.now();
const results = [];
for(let i = 0; i < CHARS.length; i += JOBS){
  const batch = CHARS.slice(i, i + JOBS);
  const got = await Promise.all(batch.map(runChar));
  for(const g of got) results.push(g);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const all = [];
for(const r of results) for(const x of r.runs) all.push(x.t);
all.sort((a, b) => a - b);
const overall = all.length ? all[Math.floor(all.length / 2)] : 0;
const clears = all.filter(t => t >= 600).length;
const early = all.filter(t => t < 180).length;
const bossWall = all.filter(t => t >= 150 && t < 240).length;
const preBoss = all.filter(t => t < 150).length;

console.log('\n=== 并行复测（' + MINUTES + ' 分钟 × ' + SEEDS + ' 种子，' + JOBS + ' 进程并行，耗时 ' + secs + 's）===\n');
for(const r of results) console.log(r.row);
console.log('\n>>> AI 合并中位存活 ' + overall + 's（目标 260~300s）· 通关 ' +
  clears + '/' + all.length + ' · 3 分钟前死亡 ' + early + '/' + all.length);
console.log('>>> 首 BOSS 阵亡 ' + bossWall + '/' + all.length + '（' +
  Math.round(bossWall / Math.max(1, all.length) * 100) + '%，目标 25%）· BOSS 前阵亡 ' +
  preBoss + '/' + all.length + '（' + Math.round(preBoss / Math.max(1, all.length) * 100) + '%）');
