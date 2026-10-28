/* 死因解剖：用与 charpower 相同的走位 AI，每 30 秒采样
   - 击杀/秒、血/上限、护甲、场上敌人、贴身数、武器/遗物数
   - 受伤来源拆分：掉血的那一帧如果 state.biteN>0（引擎里"贴身咬人"的计数）
     记为接触伤，否则记为其它（弹幕/爆炸）。
   用法：node tools/deathcause.mjs [char] [seed] */
import fs from 'node:fs';
import vm from 'node:vm';

const CH = process.argv[2] || 'keeper';
const SEED = Number(process.argv[3] || 5211);
const html = fs.readFileSync('index.html', 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function boot(seed) {
  const els = new Map();
  const mkEl = () => ({
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return true; } },
    style:{ setProperty(){} }, appendChild(){}, addEventListener(){},
    querySelector(){ return mkEl(); }, textContent:'', innerHTML:'', width:0, height:0,
    getContext(){ return new Proxy({}, { get(){ return () => ({ addColorStop(){} }); }, set(){ return true; } }); }
  });
  const sb = {
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
  sb.window = sb; sb.globalThis = sb;
  const ctx = vm.createContext(sb);
  vm.runInContext(`(function(){let a=${seed}|0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`, ctx);
  vm.runInContext(code, ctx, { filename:'g.js' });
  return ctx.__SS;
}

const S = boot(SEED);
S.start(CH);
if (process.argv[4] === 'noboss') S.state.bossAt = 1e9;
if (process.argv[4] === 'noelite') S.state.eliteAt = 1e9;

const keys = S.keys, ARENA = S.arena;
const DIRS = [];
for(let i = 0; i < 8; i++) DIRS.push([Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4)]);
let lastDx = 0, lastDy = 0;

function steer(){
  const p = S.P, list = S.enemies, gemList = S.gems;
  const step = 52;
  let gx = 0, gy = 0, gd = 1e9;
  for(let i = 0; i < gemList.length; i++){
    const g = gemList[i];
    const d = (g.x-p.x)**2 + (g.y-p.y)**2;
    if(d < gd){ gd = d; gx = g.x; gy = g.y; }
  }
  gd = Math.sqrt(gd);
  let best = 0, bestScore = -1e9;
  for(let k = 0; k < 8; k++){
    const nx = p.x + DIRS[k][0]*step, ny = p.y + DIRS[k][1]*step;
    let minD = 9999, crowd = 0;
    for(let i = 0; i < list.length; i++){
      const en = list[i];
      if(en.dead) continue;
      const dx = nx-en.x, dy = ny-en.y, d2 = dx*dx+dy*dy;
      if(d2 > 260*260) continue;
      const d = Math.sqrt(d2);
      if(d < minD) minD = d;
      crowd += 1/(d2+400);
    }
    let score = minD - crowd*2200;
    const eb = S.ebullets;
    for(let i = 0; i < eb.length; i++){
      const b = eb[i];
      for(let tt = 0; tt <= 0.5; tt += 0.1){
        const bx = b.x+b.vx*tt, by = b.y+b.vy*tt;
        const dd = Math.hypot(nx-bx, ny-by);
        if(dd < 46) score -= (46-dd)*(0.5-tt)*0.5;
      }
    }
    if(nx < 34 || nx > ARENA.w-34 || ny < 34 || ny > ARENA.h-34) score -= 420;
    const dc = Math.hypot(nx-ARENA.w/2, ny-ARENA.h/2);
    score -= Math.max(0, dc-380)*0.9;
    if(gd < 1e8 && minD > 52 && p.hp > p.maxHp*0.45) score += (step - Math.hypot(nx-gx, ny-gy))*1.6;
    score += (DIRS[k][0]*lastDx + DIRS[k][1]*lastDy)*34;
    if(score > bestScore){ bestScore = score; best = k; }
  }
  keys['w']=keys['a']=keys['s']=keys['d']=false;
  lastDx = DIRS[best][0]; lastDy = DIRS[best][1];
  if(DIRS[best][0] > 0.2) keys['d'] = true;
  if(DIRS[best][0] < -0.2) keys['a'] = true;
  if(DIRS[best][1] > 0.2) keys['s'] = true;
  if(DIRS[best][1] < -0.2) keys['w'] = true;
}

const DT = 1/60;
let lastT = 0, lastKills = 0;
let cAcc = 0, oAcc = 0, prevHp = 0;
const rows = [];
const traj = [];
let trajT = 0;
for (let i = 0; i < 60*600; i++) {
  steer();
  prevHp = S.P.hp;
  if (S.state.mode === 'levelup') S.autoPick();
  S.step(DT);
  if (S.state.mode === 'gameover') {
    console.log('--- 死亡前血量轨迹（每 0.5 秒）---');
    for (const x of traj) console.log('  ' + x);
    break;
  }
  if (S.state.time > S.state.time - 1) {} /* noop */
  if (S.state.time >= (trajT || 0) + 0.5) { trajT = S.state.time;
  traj.push(Math.round(S.state.time) + 's hp=' + Math.round(S.P.hp) + '/' + Math.round(S.P.maxHp)
    + ' 场上' + S.enemies.length + ' boss=' + (S.enemies.some(e => e.type === 'boss' && !e.dead) ? '有' : '无')
    + ' 贴身' + (S.state.biteN || 0)); }
  if (traj.length > 20) traj.shift();
  const dropped = prevHp - S.P.hp;
  if (dropped > 0) {
    if ((S.state.biteN || 0) > 0) cAcc += dropped; else oAcc += dropped;
  }
  if (S.state.time >= lastT + 30) {
    lastT = S.state.time;
    const dt = 30;
    rows.push({
      t: Math.round(S.state.time),
      kps: +((S.state.kills-lastKills)/dt).toFixed(1),
      hp: Math.round(S.P.hp), maxHp: Math.round(S.P.maxHp),
      armor: S.ST ? Math.round((S.ST.armor||0)*100) : 0,
      enemies: S.enemies.length,
      contact: Math.round(cAcc/dt*10)/10,
      other: Math.round(oAcc/dt*10)/10,
      weapons: Object.keys(S.P.weapons).length,
      relics: Object.keys(S.P.relics).length
    });
    cAcc = 0; oAcc = 0;
    lastKills = S.state.kills;
  }
}
console.log(CH + ' seed' + SEED + ' 存活 ' + Math.round(S.state.time) + 's Lv' + S.P.level + ' 武器' + Object.keys(S.P.weapons).length + ' 遗物' + Object.keys(S.P.relics).length);
console.log('时间  击杀/秒  血/上限      护甲%  场上  接触伤/秒  其它伤/秒  武器 遗物');
for (const r of rows) {
  console.log(String(r.t+'s').padStart(5), String(r.kps).padStart(6),
    (r.hp+'/'+r.maxHp).padStart(12), String(r.armor).padStart(5),
    String(r.enemies).padStart(4),
    String(r.contact).padStart(7), String(r.other).padStart(9),
    String(r.weapons).padStart(4), String(r.relics).padStart(4));
}
