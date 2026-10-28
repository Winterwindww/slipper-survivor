/* 遗物 DPS 探针：一件一件测"相对无遗物基准的伤害倍率"，用来抓超标件。
   用法：
     node tools/relicdps.mjs                    # 全部遗物，骑士，10 秒
     node tools/relicdps.mjs --char keeper --sec 8
     node tools/relicdps.mjs --only heartsteel,steelheart,tankengine

   为什么要有它：funcgate 只测武器，没人测"遗物单独拿一件会不会直接翻倍"。
   60 个遗物里只要有一个 ×3，整局的卡池权重就白设计了。
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const SEC = Number(arg('sec', 10));
const CHAR = arg('char', 'knight');
const ONLY = arg('only', '');
/* --close：把怪贴到脸上，用来测"承伤"（默认是拉开距离测"输出"） */
const CLOSE = argv.includes('--close');
const R0 = CLOSE ? 9 : 34;
const DT = 1 / 60;

function makeCtx(){
  const target = {};
  return new Proxy(target, {
    get(t, k){
      if(k in t) return t[k];
      if(k === 'canvas') return { width: 16, height: 16 };
      if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
      if(k === 'createPattern') return () => ({});
      if(k === 'measureText') return () => ({ width: 10 });
      if(k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      return () => {};
    },
    set(t, k, v){ t[k] = v; return true; }
  });
}
function makeEl(tag){
  return {
    tagName: (tag || 'div').toUpperCase(),
    id: '', className: '', textContent: '', innerHTML: '', title: '',
    offsetWidth: 100, width: 16, height: 16,
    style: { setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; } },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl('canvas'); },
    querySelectorAll(){ return []; },
    getContext(){ return makeCtx(); },
    focus(){}, blur(){}, click(){}
  };
}
function createEnv(seed){
  const elements = new Map();
  const document = {
    getElementById(id){
      if(!elements.has(id)){ const e = makeEl('div'); e.id = id; elements.set(id, e); }
      return elements.get(id);
    },
    createElement(tag){ return makeEl(tag); },
    querySelector(){ return makeEl('div'); },
    addEventListener(){},
    body: makeEl('body'),
    documentElement: makeEl('html')
  };
  const sandbox = {
    console,
    document,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame(){ return 0; },
    cancelAnimationFrame(){},
    setTimeout(){ return 0; },
    clearTimeout(){},
    setInterval(){ return 0; },
    clearInterval(){},
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener(){},
    removeEventListener(){}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.__slipperSeed = seed;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(`
    (function(){
      let a = (__slipperSeed >>> 0) || 1;
      Math.random = function(){
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })();
  `, ctx);
  return ctx;
}
function extractScript(html){
  const a = html.indexOf('<script>');
  const b = html.lastIndexOf('</script>');
  return html.slice(a + 8, b);
}

const CODE = extractScript(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));

/* 一次测量：给一个遗物（null = 基准），站桩 60 只史莱姆，统计稳态伤害 */
function measure(relicId){
  const ctx = createEnv(12345);
  vm.runInContext(CODE, ctx, { filename: 'slipper.js' });
  const SS = ctx.__SS;
  SS.start(CHAR);
  SS.state.mode = 'playing';
  if(relicId){
    SS.giveRelic(relicId);
    SS.state.mode = 'playing';
    if(process.env.DBG) console.log('DBG', relicId, 'has=', !!SS.P.relics[relicId], 'dmgMul=', SS.ST.dmgMul.toFixed(3), 'flatDR=', SS.ST.flatDR);
  }
  const total = Math.round(SEC / DT);
  const warm = Math.round(2 / DT);
  let spawnedAt = -99;
  let dmg0 = 0, hurt0 = 0;
  for(let i = 0; i < total; i++){
    if(i === warm){ dmg0 = SS.state.dmgDealt || 0; hurt0 = SS.state.hurtAcc || 0; }
    /* 保持场面：每 2 秒补到 60 只 */
    if(i - spawnedAt > 10){
      spawnedAt = i;
      const need = Math.max(0, 80 - SS.enemies.length);
      if(need > 0) SS.spawn('slime', need);
      /* 站位固定在场地中心，避免被推着走导致覆盖范围变化 */
      SS.P.x = SS.arena.w / 2; SS.P.y = SS.arena.h / 2;
      /* 把怪摆到玩家周围的环上：不然近战武器一下都打不到，基准会是 0 */
      let k = 0;
      for(const e of SS.enemies){
        if(e.dead) continue;
        if(e.maxHp < 1e8){ e.maxHp = 1e9; e.hp = 1e9; }
        const a = (k / Math.max(1, SS.enemies.length)) * Math.PI * 2;
        const r = R0 + (k % 5) * (CLOSE ? 3 : 14);
        e.x = SS.P.x + Math.cos(a) * r;
        e.y = SS.P.y + Math.sin(a) * r;
        k++;
      }
      SS.P.hp = Math.min(SS.P.maxHp, SS.P.hp + SS.P.maxHp * 0.2);
    }
    /* 关键：不选卡。否则"经验 +20%"这类遗物会因为升级更快而虚高伤害，
       测出来的就不是遗物本身，而是"它让你多拿了几张卡"。 */
    if(SS.state.mode === 'levelup' || SS.state.mode === 'modpick'){
      SS.state.mode = 'playing';
    }
    SS.step(DT);
    if(SS.P.hp <= 0) SS.P.hp = SS.P.maxHp;
    /* 木桩化：血设成 1e9，怪不会死，伤害不会因为"死太快、目标变少"而回落。
       否则"伤害越高→杀得越快→场上目标越少→总伤害越低"，测出来是反的。 */
    for(const e of SS.enemies) if(!e.dead && e.maxHp < 1e8){ e.maxHp = 1e9; e.hp = 1e9; }
  }
  return {
    out: (SS.state.dmgDealt || 0) - dmg0,
    taken: Math.max(0, (SS.state.hurtAcc || 0) - hurt0)
  };
}

function allRelicIds(){
  const c = createEnv(1);
  vm.runInContext(CODE, c, { filename: 'x.js' });
  return c.__SS.relicIcons().map(x => x.id);
}
const ids = ONLY ? ONLY.split(',') : allRelicIds();

const base = measure(null);
const rows = [];
for(const id of ids){
  let v;
  try{ v = measure(id); }
  catch(e){ rows.push({ id, out: NaN, taken: NaN, err: String(e && e.message || e).slice(0, 60) }); continue; }
  rows.push({
    id,
    out: base.out > 0 ? v.out / base.out : 0,
    taken: base.taken > 0 ? v.taken / base.taken : 0
  });
}
rows.sort((a, b) => (b.out || 0) - (a.out || 0));

console.log(`基准（无遗物·${CHAR}·站桩 ${SEC}s，木桩配置${CLOSE ? '贴脸' : '拉开'}）= ${Math.round(base.out)} 伤害`);
console.log('注意：木桩不会死，所以"击杀触发类"遗物在这里必然读 1.00（它们要靠击杀），');
console.log('      免伤类同理读 1.00 —— 这一列只看"单件能直接把输出抬多少"。');
console.log('倍率   遗物');
for(const r of rows){
  if(r.err){ console.log('  ?    ' + r.id.padEnd(12) + ' ERROR ' + r.err); continue; }
  const flag = r.out >= 1.8 ? '  ⚠ 输出超标' : (r.out >= 1.4 ? '  ▲ 偏高' : '');
  console.log(r.out.toFixed(2).padStart(5) + '  ' + r.id.padEnd(12) + flag);
}
