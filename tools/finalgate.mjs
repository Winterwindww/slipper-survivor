/* 终局回归测试：验证「10 分钟 → 拖鞋之王 → 通关 → 继续无尽」这条链路
   用法：node tools/finalgate.mjs
   为什么要单独测：这条链路是这一版新增的"目标感"，一旦被后面的改动断开
   （比如 BOSS key 写错、胜利条件没触发、continueEndless 没恢复 playing），
   冒烟测试是发现不了的——它只保证"不崩溃"。 */
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
function ok(cond, label, extra){
  if(cond) console.log('  ✓ ' + label);
  else { fails++; console.log('  ✗ ' + label + (extra ? '  → ' + extra : '')); }
}
const DT = 1 / 60;
function step(sec){
  const n = Math.round(sec / DT);
  for(let i = 0; i < n; i++) SS.step(DT);
}
function findFinal(){
  const list = SS.enemies;
  for(let i = 0; i < list.length; i++){
    if(list[i] && list[i].final && !list[i].dead) return list[i];
  }
  return null;
}

console.log('终局链路测试');
SS.start('ranger');
SS.state.mode = 'playing';
step(1);
ok(SS.state.finalSpawned !== true, '10 分钟之前不会刷终局 BOSS');

/* 直接推进时钟到 9:59.5，让 director 自然触发 */
SS.state.time = 599.4;
step(1.2);
ok(SS.state.finalSpawned === true, '进入第四幕会刷出终局 BOSS');

const boss = findFinal();
ok(!!boss, '终局 BOSS 带 final 标记', boss ? '' : '没找到 final 敌人');
ok(boss && boss.name === '拖鞋之王', 'BOSS 名称正确', boss ? boss.name : '');
ok(boss && boss.maxHp > 0, 'BOSS 有血量', boss ? String(Math.round(boss.maxHp)) : '');
ok(SS.state.bossAt > 1e8, '终局之后不再排常规 BOSS');

/* 打死它：走统一伤害管线，触发 killEnemy → 通关标记 */
if(boss){
  SS.hurt(boss, 1e9);
  ok(SS.state.won === true, '击杀终局 BOSS 会置通关标记');
  ok(SS.state.winT > 0, '进入 1.4 秒庆祝计时');
  step(2.0);
  ok(SS.state.mode === 'victory', '庆祝结束后进入通关结算', SS.state.mode);
} else {
  fails += 2;
}

/* 继续无尽 */
if(SS.state.mode === 'victory'){
  SS.continueEndless();
  ok(SS.state.mode === 'playing', '「继续无尽」能回到战斗');
  ok(SS.state.endless === true, '无尽标记已设置');
  step(3);
  ok(SS.state.finalSpawned === true, '继续无尽不会重复刷终局 BOSS');
}

/* 第二局必须完全重置 */
SS.start('knight');
ok(SS.state.won === false, '重开一局不会残留"已通关"');
ok(SS.state.finalSpawned === false, '重开一局会重置终局标记');
ok(SS.state.time < 1, '重开一局时间归零');

console.log(fails ? ('\n终局链路测试失败：' + fails + ' 项') : '\n终局链路测试通过');
process.exit(fails ? 1 : 0);
