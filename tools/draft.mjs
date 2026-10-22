/* 抽卡模拟：只跑升级池，不打怪。用来验证"不同角色的流派倾向是否真的不同"
   用法：node tools/draft.mjs --levels 14 --seeds 30 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const LEVELS = Number(arg('levels', 14));
const SEEDS = Number(arg('seeds', 30));
const CHARS = (arg('chars', 'ranger,knight,engineer,keeper,chef')).split(',');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function boot(seed){
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
  vm.runInContext(`(function(){let a=${seed}|0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`, ctx);
  vm.runInContext(code, ctx, { filename:'game.js' });
  return ctx.__SS;
}

const SCHOOL_NAME = { barrage:'弹幕', pierce:'穿甲', blast:'爆破', melee:'近战', fire:'灼烧',
  ice:'霜寒', volt:'感电', venom:'剧毒', beast:'兽群', fort:'阵地', crit:'暴击', orbit:'环绕' };

console.log('角色        主流派分布（前 3）                      武器数  平均等级');
for (const ch of CHARS) {
  const agg = {};
  let wsum = 0, lsum = 0;
  for (let s = 0; s < SEEDS; s++) {
    const SS = boot(1000 + s * 977);
    SS.start(ch);
    SS.state.mode = 'playing';
    for (let i = 0; i < LEVELS; i++) {
      SS.forceLevel();
      let guard = 0;
      while (SS.state.mode === 'levelup' && guard++ < 40) SS.autoPick();
    }
    const snap = SS.snapshot();
    const top = (snap.schools || [])[0] || '';
    const id = String(top).replace(/\d+$/, '');
    agg[id] = (agg[id] || 0) + 1;
    wsum += Object.keys(snap.weapons).length;
    lsum += snap.level;
  }
  const list = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => (SCHOOL_NAME[k] || k) + ' ' + Math.round(v / SEEDS * 100) + '%').join(' / ');
  console.log(`${ch.padEnd(10)} ${list.padEnd(38)} ${(wsum / SEEDS).toFixed(1)}     ${(lsum / SEEDS).toFixed(0)}`);
}
