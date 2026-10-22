/* 角色坦度/输出对比：同等级、同样自动选卡，看真实属性差
   用法：node tools/duel.mjs --level 30 --seeds 3 --chars knight,ranger */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LEVEL = Number(arg('level', 30));
const SEEDS = Number(arg('seeds', 3));
const CHARS = (arg('chars', 'knight,ranger,chef')).split(',');

function makeCtx(){
  const t = {};
  return new Proxy(t, {
    get(o, k){
      if(k in o) return o[k];
      if(k === 'canvas') return { width: 16, height: 16 };
      if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
      if(k === 'createPattern') return () => ({});
      if(k === 'measureText') return () => ({ width: 10 });
      if(k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      return () => {};
    },
    set(o, k, v){ o[k] = v; return true; }
  });
}
function makeEl(tag){
  return {
    tagName: (tag || 'div').toUpperCase(), id: '', className: '', textContent: '', innerHTML: '', title: '',
    offsetWidth: 100, width: 16, height: 16,
    style: { setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; } },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl('canvas'); }, querySelectorAll(){ return []; },
    getContext(){ return makeCtx(); }, focus(){}, blur(){}, click(){}
  };
}
function boot(seed){
  const els = new Map();
  const sandbox = {
    console,
    document: {
      getElementById(id){ if(!els.has(id)){ const e = makeEl('div'); e.id = id; els.set(id, e); } return els.get(id); },
      createElement(tag){ return makeEl(tag); },
      querySelector(){ return makeEl('div'); },
      addEventListener(){}, body: makeEl('body'), documentElement: makeEl('html')
    },
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener(){}, removeEventListener(){}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
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
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const s = html.indexOf('<script>'), e = html.lastIndexOf('</script>');
  vm.runInContext(html.slice(s + 8, e), ctx, { filename: 'slipper.js' });
  return ctx.__SS;
}

/* 升到指定等级，全部自动选卡（= "都选了若干进化"） */
function levelTo(SS, target){
  let guard = 0;
  SS.start(SS.char && SS.char.id);
  SS.state.mode = 'playing';
  while(SS.P.level < target && guard++ < target * 6){
    SS.forceLevel();
    let g2 = 0;
    while((SS.state.mode === 'levelup' || SS.state.mode === 'modpick') && g2++ < 20) SS.autoPick();
  }
}

const rows = [];
for(const ch of CHARS){
  const samples = [];
  for(let s = 0; s < SEEDS; s++){
    const SS = boot(1000 + s * 7919);
    SS.start(ch);
    SS.state.mode = 'playing';
    let guard = 0;
    while(SS.P.level < LEVEL && guard++ < LEVEL * 8){
      SS.forceLevel();
      let g2 = 0;
      while((SS.state.mode === 'levelup' || SS.state.mode === 'modpick') && g2++ < 20) SS.autoPick();
    }
    const ST = SS.ST;
    const hp = SS.P.maxHp;
    const armor = ST.armor || 0;
    const dodge = ST.dodge || 0;
    /* 骑士格挡：22% 概率挡 55%，平均减伤 */
    let blockAvg = 0;
    if(ch === 'knight') blockAvg = 0.18 * 0.50;
    /* 有效生命 = 血量 / 所有减伤连乘 */
    const ehp = hp / Math.max(0.05, (1 - armor) * (1 - dodge) * (1 - blockAvg));
    samples.push({
      hp, armor, dodge, blockAvg, ehp,
      dmgMul: ST.dmgMul, crit: ST.crit, critMul: ST.critMul,
      multi: ST.multi, pierce: ST.pierce, thorns: ST.thorns,
      weapons: Object.entries(SS.P.weapons).map(([k, v]) => k + v).join(' '),
      wmods: Object.values(SS.P.wmod).reduce((n, a) => n + a.length, 0),
      relics: Object.keys(SS.P.relics).length,
      passives: Object.values(SS.P.passives).reduce((n, v) => n + v, 0)
    });
  }
  const med = k => {
    const a = samples.map(s => s[k]).sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)];
  };
  rows.push({
    ch,
    hp: Math.round(med('hp')),
    armor: med('armor'),
    dodge: med('dodge'),
    block: med('blockAvg'),
    ehp: Math.round(med('ehp')),
    dmgMul: med('dmgMul').toFixed(2),
    crit: (med('crit') * 100).toFixed(0) + '%',
    multi: med('multi'),
    thorns: Math.round(med('thorns')),
    wmods: med('wmods'),
    relics: med('relics'),
    passives: med('passives'),
    sample: samples[0]
  });
}

const pad = (s, n) => String(s).padEnd(n, ' ');
console.log(`\n=== Lv.${LEVEL}（${SEEDS} 个种子取中位，全部自动选卡）===\n`);
console.log(pad('项目', 14) + rows.map(r => pad(r.ch, 12)).join(''));
console.log('-'.repeat(14 + rows.length * 12));
const line = (label, key, fmt) => console.log(pad(label, 14) + rows.map(r => pad(fmt ? fmt(r[key]) : r[key], 12)).join(''));
line('最大生命', 'hp');
line('护甲减伤', 'armor', v => (v * 100).toFixed(1) + '%');
line('闪避', 'dodge', v => (v * 100).toFixed(1) + '%');
line('格挡均值', 'block', v => (v * 100).toFixed(1) + '%');
line('有效生命', 'ehp');
line('伤害倍率', 'dmgMul');
line('暴击率', 'crit');
line('额外弹道', 'multi');
line('反伤', 'thorns');
line('改造卡数', 'wmods');
line('遗物数', 'relics');
line('结晶总级', 'passives');
console.log('\n武器（首个种子样本）：');
for(const r of rows) console.log('  ' + pad(r.ch, 10) + r.sample.weapons + '   改造:' + r.sample.wmods + '  遗物:' + r.sample.relics);
