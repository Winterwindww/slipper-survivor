/* 数值审计：跑一局，按时间采样「每秒击杀 / 每秒受伤 / 每秒回血」，
   再对照上限，看哪些限制形同虚设、哪些系统互相打架。
   用法：node tools/audit.mjs --char ranger --minutes 9 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const CHAR = arg('char', 'ranger');
const MIN = Number(arg('minutes', 9));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const els = new Map();
const mkEl = () => ({
  classList:{ add(){}, remove(){}, toggle(){}, contains(){ return true; } },
  style:{ setProperty(){} }, appendChild(){}, addEventListener(){},
  querySelector(){ return mkEl(); }, textContent:'', innerHTML:'', width:0, height:0,
  getContext(){ return new Proxy({}, { get(){ return () => ({ addColorStop(){} }); }, set(){ return true; } }); }
});
const sandbox = {
  console, document: {
    getElementById(id){ if(!els.has(id)) els.set(id, mkEl()); return els.get(id); },
    createElement(){ return mkEl(); }, querySelector(){ return mkEl(); },
    addEventListener(){}, body: mkEl()
  },
  performance:{ now: () => 0 }, requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
  setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
  localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
  innerWidth:1280, innerHeight:720, addEventListener(){}, removeEventListener(){}
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
let sd = 424242;
vm.runInContext(`(function(){let a=${sd}|0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`, ctx);
vm.runInContext(code, ctx, { filename:'game.js' });
const SS = ctx.__SS;
SS.start(CHAR);
SS.state.mode = 'playing';

/* 走位 AI：和 sim.mjs 同一套，否则站桩会 1 分钟就死，采样毫无意义 */
const keys = SS.keys;
const ARENA = SS.arena;
const DIRS = [];
for (let i = 0; i < 8; i++) DIRS.push([Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
let aiT = 0, lastDx = 0, lastDy = 0;
function steer(dt) {
  aiT -= dt;
  if (aiT > 0) return;
  aiT = 0.06;
  const p = SS.P, list = SS.enemies, gemList = SS.gems, step = 52;
  let gx = 0, gy = 0, gd = 1e9;
  for (let i = 0; i < gemList.length; i++) {
    const g = gemList[i];
    const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d < gd) { gd = d; gx = g.x; gy = g.y; }
  }
  gd = Math.sqrt(gd);
  let best = 0, bestScore = -1e9;
  for (let k = 0; k < 8; k++) {
    const nx = p.x + DIRS[k][0] * step, ny = p.y + DIRS[k][1] * step;
    let minD = 9999, crowd = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const dx = nx - e.x, dy = ny - e.y, d2 = dx * dx + dy * dy;
      if (d2 > 260 * 260) continue;
      const d = Math.sqrt(d2);
      if (d < minD) minD = d;
      crowd += 1 / (d2 + 400);
    }
    let score = minD - crowd * 2200;
    if (nx < 34 || nx > ARENA.w - 34 || ny < 34 || ny > ARENA.h - 34) score -= 420;
    const dc = Math.hypot(nx - ARENA.w / 2, ny - ARENA.h / 2);
    score -= Math.max(0, dc - 380) * 0.9;
    if (gd < 1e8 && minD > 52 && SS.P.hp > SS.P.maxHp * 0.45) {
      score += (step - Math.hypot(nx - gx, ny - gy)) * 1.6;
    }
    score += (DIRS[k][0] * lastDx + DIRS[k][1] * lastDy) * 34;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  keys['w'] = keys['a'] = keys['s'] = keys['d'] = false;
  lastDx = DIRS[best][0]; lastDy = DIRS[best][1];
  if (DIRS[best][0] > 0.2) keys['d'] = true;
  if (DIRS[best][0] < -0.2) keys['a'] = true;
  if (DIRS[best][1] > 0.2) keys['s'] = true;
  if (DIRS[best][1] < -0.2) keys['w'] = true;
}

const steps = Math.round(MIN * 60 / (1/60));
let peakEnemy = 0, peakBullet = 0;
for (let i = 0; i < steps; i++) {
  if (SS.state.mode === 'levelup') { let g = 0; while (SS.state.mode === 'levelup' && g++ < 60) SS.autoPick(); }
  if (SS.state.mode === 'gameover') break;
  steer(1/60);
  SS.step(1/60);
  if (SS.enemies.length > peakEnemy) peakEnemy = SS.enemies.length;
  if (SS.bullets.length > peakBullet) peakBullet = SS.bullets.length;
}
const a = SS.audit();
const rate = a.rate;

console.log(`角色 ${CHAR} · 存活 ${Math.round(SS.state.time)}s · Lv${a.level}`);
console.log('时间   击杀/秒  受伤/秒  回血/秒   血/上限    净血/秒');
const marks = [60, 120, 180, 240, 300, 360, 420, 480, 540];
for (const t of marks) {
  const row = rate.find(r => r[0] === t);
  if (!row) continue;
  const [rt, kill, hurt, heal, hp, maxHp] = row;
  console.log(
    (rt + 's').padEnd(6) +
    String(kill).padStart(7) + '  ' +
    String(hurt).padStart(7) + '  ' +
    String(heal).padStart(7) + '  ' +
    (hp + '/' + maxHp).padStart(10) + '  ' +
    String(heal - hurt).padStart(7)
  );
}
const seg = rate.filter(r => r[0] >= 120);
const avgKill = seg.reduce((s, r) => s + r[1], 0) / Math.max(1, seg.length);
const avgHurt = seg.reduce((s, r) => s + r[2], 0) / Math.max(1, seg.length);
const avgHeal = seg.reduce((s, r) => s + r[3], 0) / Math.max(1, seg.length);
console.log(`\n2 分钟后均值：每秒击杀 ${avgKill.toFixed(1)} · 受伤 ${Math.round(avgHurt)} · 回血 ${Math.round(avgHeal)}`);
console.log(`回血/受伤 = ${(avgHeal / Math.max(1, avgHurt) * 100).toFixed(1)}%`);
console.log(`\n峰值：敌人 ${peakEnemy} · 子弹 ${peakBullet} · 友军 ${a.allies}`);
console.log('属性：crit ' + (a.st.crit * 100).toFixed(0) + '% · critMul ×' + a.st.critMul.toFixed(2)
  + ' · cdMul ×' + a.st.cdMul.toFixed(3) + ' · multi +' + a.st.multi + ' · pierce +' + a.st.pierce
  + ' · area ×' + a.st.area.toFixed(2) + ' · armor ' + (a.st.armor * 100).toFixed(0) + '%'
  + ' · dmgMul ×' + a.st.dmgMul.toFixed(2));
