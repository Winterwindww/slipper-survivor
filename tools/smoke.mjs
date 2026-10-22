/* 冒烟测试：把全部系统都开一遍并强制渲染，专门抓渲染/UI 里的运行时错误
   用法：node tools/smoke.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const els = new Map();
const mkEl = () => ({
  classList:{ add(){}, remove(){}, toggle(){}, contains(){ return true; } },
  style:{ setProperty(){}, width:'', height:'' },
  appendChild(){}, addEventListener(){}, querySelector(){ return mkEl(); },
  textContent:'', innerHTML:'', width:0, height:0, title:'', offsetWidth:1,
  getContext(){ return new Proxy({}, { get(){ return () => ({ addColorStop(){} }); }, set(){ return true; } }); }
});
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, mkEl()); return els.get(id); },
  createElement(){ return mkEl(); },
  querySelector(){ return mkEl(); },
  addEventListener(){},
  body: mkEl()
};
const sandbox = {
  console, document,
  performance:{ now: () => Date.now() },
  requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
  setTimeout(){ return 0; }, clearTimeout(){},
  setInterval(){ return 0; }, clearInterval(){},
  localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
  innerWidth:1280, innerHeight:720, addEventListener(){}, removeEventListener(){}
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx, { filename:'game.js' });
const SS = ctx.__SS;

let fails = 0;
const chars = SS.chars();
for (const ch of chars) {
  try {
    SS.start(ch);
    SS.state.mode = 'playing';
    const w = ['slipper','banana','candy','bubble','tomato','bolt','popcorn','aura','fan','beam','mine','hole','chain','missile','frost','gun','snipe','pan','turret','pet','flamer','dice','boomerang','totem'];
    for (let i = 0; i < w.length; i++) SS.giveWeapon(w[i], 1 + (i % 5));
    const relics = ['ember','sparkplug','chaincrit','turretcrit','petelem','meltsurge','killshot','dodgeprism','bloodrage','thornsplate','killchain','ricochet','frostbite','voltcoil','scavenger','burstcore','packleader','singularity','echoheart','soulharvest','statuesmash','overclock','elementalist','gamblersoul','thunderlord','frostheart','sacrifice','glassheart','greedpact','bloodoath','heavycurse','chaosdice'];
    for (const r of relics) SS.giveRelic(r);
    for (let i = 0; i < 40; i++) SS.spawn(['slime','carrot','bat','shooter','bomb','pudding','burger','ghost','frog','bee','mushroom','iron','ant'][i % 13]);
    for (let i = 0; i < 600; i++) {
      if (SS.state.mode === 'levelup' || SS.state.mode === 'modpick') { let g = 0; while ((SS.state.mode === 'levelup' || SS.state.mode === 'modpick') && g++ < 60) SS.autoPick(); }
      SS.step(1/60);
      SS.render();
    }
    const s = SS.snapshot();
    console.log(`ok  ${ch.padEnd(9)} t=${s.time}s en=${s.enemies} bul=${s.bullets} ally=${s.allies} part=${s.particles} kills=${s.kills}`);
  } catch (e) {
    fails++;
    console.error(`FAIL ${ch}:`, e && e.stack ? e.stack.split('\n').slice(0,4).join('\n') : e);
  }
}
/* 标题界面也要能画 */
try { SS.title(); console.log('ok  title screen'); } catch(e){ fails++; console.error('FAIL title:', e.message); }
console.log(fails ? `\n${fails} 项失败` : '\n冒烟测试通过');
process.exit(fails ? 1 : 0);
