/* 武器清单导出：从构建产物里读真实数据，而不是靠文档抄。
   用法：node tools/listarms.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

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
    tagName: (tag || 'div').toUpperCase(), id:'', className:'', textContent:'', innerHTML:'', title:'',
    offsetWidth:100, width:16, height:16,
    style:{ setProperty(){}, removeProperty(){}, getPropertyValue(){ return ''; } },
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl('canvas'); }, querySelectorAll(){ return []; },
    getContext(){ return makeCtx(); }, focus(){}, blur(){}, click(){}
  };
}
function createEnv(){
  const elements = new Map();
  const document = {
    getElementById(id){ if(!elements.has(id)){ const e = makeEl('div'); e.id = id; elements.set(id, e); } return elements.get(id); },
    createElement(tag){ return makeEl(tag); },
    querySelector(){ return makeEl('div'); },
    addEventListener(){}, body: makeEl('body'), documentElement: makeEl('html')
  };
  const sandbox = {
    console, document,
    performance:{ now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
    innerWidth:1280, innerHeight:720, devicePixelRatio:1,
    addEventListener(){}, removeEventListener(){}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  return vm.createContext(sandbox);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const s = html.indexOf('<script>'), e = html.lastIndexOf('</script>');
const ctx = createEnv();
vm.runInContext(html.slice(s + 8, e), ctx, { filename: 'slipper-survivor.js' });

const SS = ctx.__SS;
const rows = SS.weaponCatalog();
const idOrder = Object.keys(ctx.WEAPONS || {});

console.log('武器总数:', rows.length);
const bySchool = {};
for(const r of rows){ (bySchool[r.school] = bySchool[r.school] || []).push(r); }
console.log('流派分布:', Object.keys(bySchool).map(k => k + ':' + bySchool[k].length).join('  '));
console.log('');

for(const sch in bySchool){
  console.log('=== ' + sch + ' ===');
  for(const r of bySchool[sch]){
    console.log([r.id.padEnd(12), r.name.padEnd(8), (r.owner || '通用').padEnd(9),
      ('dmg ' + (r.dmg1==null?'-':Math.round(r.dmg1)) + '→' + (r.dmgMax==null?'-':Math.round(r.dmgMax))).padEnd(16),
      r.awaken].join(' | '));
  }
  console.log('');
}

console.log('=== 每角色可抽武器池 ===');
for(const cid of SS.chars()){
  SS.start(cid);
  const pool = SS.weaponPool();
  const own = rows.filter(r => r.owner === cid).length;
  console.log(cid.padEnd(10), '池子', String(pool.length).padStart(3),
              '（专属', own, '/ 通用', pool.length - own, '）');
}
