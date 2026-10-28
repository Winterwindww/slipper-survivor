/* =========================================================
   1.5 内核 · 事件总线
   ---------------------------------------------------------
   所有武器 / 角色 / 遗物只做两件事：发事件、听事件。
   组合不是写死的配方，而是监听者叠加出来的结果。
   为了不被"暴击→雷→击杀→爆炸→击杀..."打成死循环：
     - 递归深度上限 4 层
     - 每帧对 kill / reaction / boom 设预算，超了就静默丢弃
   ========================================================= */
const EV = {
  h: Object.create(null),
  depth: 0,
  maxDepth: 4,
  budget: Object.create(null),
  count: Object.create(null)      /* 调试统计 */
};

function on(evt, fn){
  (EV.h[evt] || (EV.h[evt] = [])).push(fn);
  return fn;
}

function emit(evt, a, b){
  const arr = EV.h[evt];
  if(arr === undefined || arr.length === 0) return;
  if(EV.depth >= EV.maxDepth) return;
  EV.depth++;
  EV.count[evt] = (EV.count[evt] || 0) + 1;
  for(let i = 0; i < arr.length; i++) arr[i](a, b);
  EV.depth--;
}

/* 预算：返回 true 表示这次还能触发 */
function spend(kind, n){
  const v = EV.budget[kind];
  if(v === undefined) return true;
  if(v <= 0) return false;
  EV.budget[kind] = v - (n || 1);
  return true;
}

function resetBudget(){
  EV.budget.kill = 30;
  /* 反应预算从 22 降到 10：22/帧 × 60fps = 1320 次/秒，
     每一次还要溅射一圈，这是"后期一帧几百次结算"的主要来源。
     10/帧（600 次/秒）对任何构筑都绰绰有余，但不会再失控。 */
  EV.budget.react = 22;
  EV.budget.boom = 12;
  EV.budget.summon = 8;
  EV.budget.crit = 120;
  /* 弹射预算：弹射是"伤害扩散"，不是免费的触发倍增器 */
  EV.budget.chain = 18;
  EV.depth = 0;
}

/* 清空监听（重开一局时调用，避免上一局的闭包残留） */
function clearBus(){
  EV.h = Object.create(null);
  EV.count = Object.create(null);
  resetBudget();
}

/* =========================================================
   1.6 空间网格：把 O(n²) 的邻居查询压成 O(n)
   ========================================================= */
const GRID = { cell: 44, cols: 0, rows: 0, cells: [] };

function gridInit(){
  GRID.cols = Math.ceil(ARENA.w / GRID.cell) + 2;
  GRID.rows = Math.ceil(ARENA.h / GRID.cell) + 2;
  GRID.cells = new Array(GRID.cols * GRID.rows);
  for(let i = 0; i < GRID.cells.length; i++) GRID.cells[i] = [];
}

function gridBuild(){
  if(!GRID.cells.length) gridInit();
  const cells = GRID.cells;
  for(let i = 0; i < cells.length; i++) if(cells[i].length) cells[i].length = 0;
  const cell = GRID.cell, cols = GRID.cols, rows = GRID.rows;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead) continue;
    let cx = (e.x / cell) | 0, cy = (e.y / cell) | 0;
    if(cx < 0) cx = 0; else if(cx >= cols) cx = cols - 1;
    if(cy < 0) cy = 0; else if(cy >= rows) cy = rows - 1;
    cells[cy * cols + cx].push(e);
  }
}

/* 遍历半径内的敌人（回调式，不分配数组） */
function eachNear(x, y, r, fn){
  if(!GRID.cells.length){ for(let i = 0; i < enemies.length; i++) fn(enemies[i]); return; }
  const cell = GRID.cell, cols = GRID.cols;
  const x0 = Math.max(0, ((x - r) / cell) | 0), x1 = Math.min(GRID.cols - 1, ((x + r) / cell) | 0);
  const y0 = Math.max(0, ((y - r) / cell) | 0), y1 = Math.min(GRID.rows - 1, ((y + r) / cell) | 0);
  for(let cy = y0; cy <= y1; cy++){
    for(let cx = x0; cx <= x1; cx++){
      const arr = GRID.cells[cy * cols + cx];
      for(let i = 0; i < arr.length; i++){
        const e = arr[i];
        if(e.dead) continue;
        const dx = e.x - x, dy = e.y - y;
        if(dx * dx + dy * dy <= (r + e.r) * (r + e.r)) fn(e);
      }
    }
  }
}

/* 半径内计数（判断该不该放技能） */
function countNear(x, y, r){
  let n = 0;
  eachNear(x, y, r, function(){ n++; });
  return n;
}

/* =========================================================
   1.7 元素状态与反应
   ========================================================= */
const ELEM_COL = {
  fire:  '#ff8a3d',
  ice:   '#8fe8ff',
  venom: '#a6e05a',
  volt:  '#ffe066'
};
const ELEM_NAME = { fire:'燃烧', ice:'冰缓', venom:'中毒', volt:'感电' };

function stInit(e){
  if(!e.st) e.st = { fire:0, fireDmg:0, ice:0, venom:0, venomDmg:0, volt:0, reactCd:0, bleed:0, bleedDmg:0 };
  return e.st;
}

/* 给敌人挂元素。dur = 持续秒数，hit = 触发这次元素的伤害（用来换算 DOT 与反应威力） */
function applyElem(e, elem, dur, hit, src){
  if(!e || e.dead) return;
  /* 进化计数器：元素命中总次数（冰封 / 雷池 / 冰柜等件的条件） */
  evoAdd('elem', 1);
  if(!e || e.dead || !elem) return;
  const st = stInit(e);
  const h = hit || 10;
  /* 元素使：元素持续时间 +50% */
  if(relic('elementalist')) dur *= 1.5;
  if(st.reactCd > 0){                        /* 刚反应过，短时间内不再连锁，防爆炸式递归 */
    if(elem === 'fire'){ st.fire = Math.max(st.fire, dur * 0.5); }
    return;
  }
  if(elem === 'fire'){
    /* 【6.0】火候Ⅲ「燃烧持续 +80%」——原来是空档位，现在真的生效 */
    const fireDur = dur * ((typeof archTier === 'function' && archTier('heat') >= 3) ? 1.8 : 1);
    st.fire = Math.max(st.fire, fireDur);
    st.fireDmg = Math.max(st.fireDmg, h * 0.30);
  } else if(elem === 'ice'){
    /* 冷冻Ⅱ：冻结（冰缓）时长 +1 秒；冰封：再 +0.5 秒 */
    const iceBonus = (ST.freezeTier >= 2 ? 1 : 0) + (relic('icebind') ? 0.5 : 0);
    /* 冰缓时长 = (基础 + 档位加成) × iceMul（冷冻Ⅰ +30% / 冷冻机 +20%） */
    st.ice = Math.max(st.ice, (dur + iceBonus) * (ST.iceMul || 1));
    /* 控制递减：首次附着给完整时长，之后每次刷新最多只续 0.2 秒。
       原来每次都是 Math.max(slowT, 1.6)，而后期命中频率是每秒几十次，
       等于把减速永久钉死在 1.6 秒——现在只要停手 0.2 秒就会解控。 */
    const durCap = Math.min(1.6, dur);
    e.slowT = e.slowT > 0 ? Math.min(durCap, e.slowT + 0.2) : durCap;
  } else if(elem === 'venom'){
    st.venom = Math.max(st.venom, dur);
    st.venomDmg = Math.max(st.venomDmg, h * 0.24);
  } else if(elem === 'volt'){
    /* 【6.0】电网Ⅰ「感电持续时间 +40%」——原来是空档位（chainJump 从未被读取） */
    st.volt = Math.max(st.volt, dur * ((typeof archTier === 'function' && archTier('grid') >= 1) ? 1.4 : 1));
  }
  /* =========================================================
     【6.0 修复】厨师的「调和」：冰火交替会自动补上缺少的那一层
     ---------------------------------------------------------
     这句话一直写在角色说明里（40-chars.js:205），但代码里从来没有实现过：
     reactionMaster 只做了两件事——反应伤害 ×1.3、元素改造卡必出。

     后果：厨师开局只有一把火焰武器，敌人身上永远只有火，凑不出"火+冰"，
     他从第 1 分钟到第 5 分钟一次反应都打不出来，整条身份是空的。
     实测他每秒击杀 10.6（骑士 22.1 / 工程师 23.6），五个角色里最弱，
     死得也最早（142 秒）。

     这里把缺的那一层补上。但不是"每一发都反应"——那等于凭空 ×1.4 伤害。
     每个目标 0.9 秒最多补一次，也就是"火在烧的时候，冰会自己贴上来一层"，
     节奏上像是真的在交替，而不是白送一发。
     只补计时器，不补 dot / 减速：不给隐藏的燃烧伤害，也不给隐藏的控场。
     ========================================================= */
  if(CHAR && CHAR.reactionMaster && (elem === 'fire' || elem === 'ice')){
    const other = elem === 'fire' ? 'ice' : 'fire';
    if(!(st[other] > 0) && (state.time - (e.masterFillT || -99)) > 0.9){
      e.masterFillT = state.time;
      st[other] = 0.9;
      /* 补上的那层冰是**真的冰**：带标准冰缓（走原有的 0.2 秒刷新上限）。
         这不是隐藏减伤——它是调和的字面意思：你的火带着寒气。
         厨师是全角色射程最短的，必须在怪堆和 BOSS 面前站桩，
         没有任何一种自保手段；实测他三个种子全部死在第一个 BOSS
         出场后 7 秒（BOSS 一口 24~36，他站不住三口）。 */
      if(other === 'ice') e.slowT = e.slowT > 0 ? Math.min(1.6, e.slowT + 0.2) : 0.9;
    }
  }
  react(e, elem, h, src);
}

/* 元素反应：冰+火 融化 / 毒+火 毒爆 / 冰+电 超导 / 毒+电 导电 */
/* 溅射上限：一次反应最多影响 6 个目标。
   以前是"半径内有多少打多少"，318 只怪堆在一起时一次反应就结算 300 次伤害，
   再叠上弹射就是后期一帧几百次结算、直接卡死的来源。 */
function splashHit(x, y, radius, dmg, src, after){
  let n = 0;
  eachNear(x, y, radius, function(o){
    if(o.dead || n >= 28) return;
    n++;
    dealDamage(o, dmg, { src: src || 'react' });
    if(after) after(o);
  });
  return n;
}

function react(e, elem, hit, src){
  const st = e.st;
  let kind = null;
  if(elem === 'fire' && st.ice > 0) kind = 'melt';
  else if(elem === 'ice' && st.fire > 0) kind = 'melt';
  else if(elem === 'fire' && st.venom > 0) kind = 'toxblast';
  else if(elem === 'venom' && st.fire > 0) kind = 'toxblast';
  else if(elem === 'volt' && st.ice > 0) kind = 'superconduct';
  else if(elem === 'ice' && st.volt > 0) kind = 'superconduct';
  else if(elem === 'volt' && st.venom > 0) kind = 'conduct';
  else if(elem === 'venom' && st.volt > 0) kind = 'conduct';
  if(!kind) return;
  if(!spend('react')) return;
  evoAdd('react', 1);
  if(P) P.lastElem = elem;

  /* 元素使：反应不再有连锁冷却（0.14 → 0.04） */
  st.reactCd = relic('elementalist') ? 0.04 : 0.14;
  /* 【设计修正】这里原来是"厨师 1.0 倍 + 有溅射 / 其它角色 0.45 倍 + 只打单体"。
     用同一个机制的不同数字去区分角色，是最偷懒的做法：玩家只会觉得"我这个角色被削了"。
     现在改成：**所有角色都能打出完整反应与溅射**，强度靠"抽得到多少元素、怎么组合"来分，
     厨师拿到的是别人没有的机制（反应传染），而不是一个更高的系数。 */
  const splash = true;
  const master = !!(CHAR && CHAR.reactionMaster);
  /* 融化冲击：反应伤害 +50% */
  const surge = relic('meltsurge') ? 1.5 : 1;
  /* 【6.0】BOSS 领域：被压的那一族反应打五折。
     不是禁用——你仍然能打，但这一场不是这条路的舒适区。 */
  let banMul = 1;
  if(state.ban && state.ban.k === 'elem'){
    const bk = state.ban.key;
    const hit = (bk === 'fire'  && (kind === 'melt' || kind === 'toxblast'))
             || (bk === 'ice'   && (kind === 'melt' || kind === 'superconduct'))
             || (bk === 'volt'  && (kind === 'superconduct' || kind === 'conduct'))
             || (bk === 'venom' && (kind === 'toxblast' || kind === 'conduct'));
    if(hit) banMul = 0.5;
  }
  const mul = (REACT_MUL[kind] || 1) * (master ? 1.30 : 1) * surge * (archTier('elem') >= 2 ? 1.20 : 1) * banMul;
  /* 反应伤害原来是"触发伤害 ×1.15"，还要再溅射一圈 55%~60%。
     等于元素构筑白拿一发群体版自己的主武器，结算面板里反应常年第一，
     武器反而像配件。现在降到 ×0.55：反应负责控场 / 清残血 / 连接。 */
  const base = Math.max(10, (hit || 10) * 0.95) * mul;

  if(kind === 'melt'){
    st.ice = 0; st.fire = 0; e.slowT = 0;
    burst(e.x, e.y, '#ffd0a0', 14, 150);
    rings.push({ x:e.x, y:e.y, r0:10, r1:46, life:0.28, max:0.28, col:'#ffcf7a', w:3 });
    if(splash) splashHit(e.x, e.y, 34 * (archTier('elem') >= 3 ? 1.3 : 1), base * 0.32, src);
    dealDamage(e, base, { src: src || 'react' });
    addText(e.x, e.y - 12, '融化', '#ffcf7a', 10);
  } else if(kind === 'toxblast'){
    st.venom = 0; st.fire = 0;
    burst(e.x, e.y, '#b6ff6b', 16, 170);
    rings.push({ x:e.x, y:e.y, r0:8, r1:58, life:0.3, max:0.3, col:'#a6e05a', w:3 });
    dealDamage(e, base, { src: src || 'react' });
    if(splash) splashHit(e.x, e.y, 45 * (archTier('elem') >= 3 ? 1.3 : 1), base * 0.36, src, function(o){
      if(o !== e) applyElem(o, 'venom', 2.2, base * 0.2, src);
    });
    addText(e.x, e.y - 12, '毒爆', '#b6ff6b', 10);
  } else if(kind === 'superconduct'){
    st.ice = 0; st.volt = 0;
    burst(e.x, e.y, '#a8d8ff', 16, 190);
    rings.push({ x:e.x, y:e.y, r0:8, r1:64, life:0.3, max:0.3, col:'#9fe8ff', w:3 });
    dealDamage(e, base, { src: src || 'react' });
    if(splash) splashHit(e.x, e.y, 50 * (archTier('elem') >= 3 ? 1.3 : 1), base * 0.36, src, function(o){
      if(o !== e) o.slowT = Math.max(o.slowT || 0, 0.6);
    });
    addText(e.x, e.y - 12, '超导', '#9fe8ff', 10);
  } else {
    st.venom = 0; st.volt = 0;
    burst(e.x, e.y, '#d6ff7a', 12, 150);
    dealDamage(e, base, { src: src || 'react' });
    if(splash) splashHit(e.x, e.y, 40, base * 0.30, src);
    addText(e.x, e.y - 12, '导电', '#d6ff7a', 10);
  }

  /* 厨师独有：反应会"传染"——把这次参与反应的两种元素泼到周围 2 个敌人身上。
     【2.6】传染不能再链式：传染出去的那次 applyElem 用 src='react'，
     这里据此拒收，否则 A 传染 B、B 又传染 C，一次反应会自己长成一片森林，
     正是"选了弹射之后一帧几百次结算"的另一半来源。 */
  if(master && src !== 'react'){
    let spread = 0;
    eachNear(e.x, e.y, 88, function(o){
      if(o === e || o.dead || spread >= 2) return;
      spread++;
      const elem2 = (kind === 'melt') ? 'fire'
                  : (kind === 'toxblast') ? 'venom'
                  : (kind === 'superconduct') ? 'ice' : 'volt';
      applyElem(o, elem2, 1.8, base * 0.18, 'react');
    });
    if(spread) addText(e.x, e.y - 26, '传染 ×' + spread, '#ff8a3d', 9);
  }

  emit('reaction', { e, kind, dmg: base, src: src || 'react' });
  sfx(kind === 'melt' ? 'melt' : (kind === 'toxblast' ? 'toxblast' : (kind === 'superconduct' ? 'superconduct' : 'conduct')));
  /* 反应不震屏：一场战斗触发几百次，是"一直抖"的主要来源之一 */
}

/* 元素反应的全局倍率（遗物可以改） */
const REACT_MUL = { melt: 1, toxblast: 1, superconduct: 1, conduct: 1 };

/* 元素对已经被同元素"浸透"的目标不再重复反应，避免刷屏 */
function elemOnHit(e, list, power, src){
  if(!list || !list.length) return;
  /* 【2.6 修复】一把武器同时改造了燃 / 冰 / 毒 / 电时，原来这里 for 循环
     把 4 种元素全部挂上——一次命中就凑齐所有反应对。玩家看到的现象就是
     "只要元素触发一次，下一发必定全触发"。
     现在一次命中最多挂 1 种：优先挂目标身上还没有的那种元素。 */
  let pick = null;
  for(let i = 0; i < list.length; i++){
    const el = list[i];
    if(e.st && e.st[el] > 0) continue;
    pick = el;
    break;
  }
  if(!pick) pick = list[0];
  applyElem(e, pick, 2.4, power, src);
}

/* 跳弹沿用的是"原武器"的伤害来源，这样改造卡和流派加成仍然生效 */
function dmgSrcForRicochet(src){
  return (src && WEAPONS[src]) ? src : 'relic';
}

/* 消耗目标身上的任意状态，返回是否消耗成功（引爆用） */
function consumeAny(e, src){
  const st = e.st;
  if(!st) return false;
  if(st.venom > 0){ st.venom = 0; return true; }
  if(st.fire > 0){ st.fire = 0; return true; }
  if(st.ice > 0){ st.ice = 0; return true; }
  if(st.volt > 0){ st.volt = 0; return true; }
  return false;
}

/* 蔓延：把燃烧 / 中毒传给附近两个敌人 */
function spreadStatus(e, src){
  if(!e.st) return;
  const el = e.st.fire > 0 ? 'fire' : (e.st.venom > 0 ? 'venom' : null);
  if(!el) return;
  let n = 0;
  eachNear(e.x, e.y, 90, function(o){
    if(o === e || o.dead || n >= 2) return;
    n++;
    applyElem(o, el, 2.0, 8, src);
  });
}

/* =========================================================
   1.8 统一伤害管线
   ---------------------------------------------------------
   任何伤害都必须走这里：暴击、增伤、状态、事件、击杀都在这
   里结算。武器只负责"打了一下"。
   ========================================================= */
const HIT = { e:null, dmg:0, crit:false, src:'misc', elem:null };   /* 复用对象，处理器不要保存引用 */
const NOOPT = {};

function dealDamage(e, amount, opt){
  if(!e || e.dead || !(amount > 0)) return 0;
  opt = opt || NOOPT;

  const src = opt.src || SRC || 'misc';
  let dmg;
  if(opt.trueDmg){
    /* 真实伤害：不走全局倍率、不吃护甲。血肉流的核心口径——
       它按"最大生命百分比"计价，如果再乘一遍 dmgMul 就会指数失控。 */
    dmg = amount;
  } else {
    /* 【3.3】超载窗口的伤害加成。
       充能从"常驻"改成"节奏点"之后，超载必须真的是一段爆发，
       否则玩家感觉不到"我攒了一次超载"的价值。
       只有游侠有这条资源，others 的 P.overload 恒为 0，不会误触发。 */
    const overloadMul = (P && P.overload > 0 && (RES.overloadDmg || 0) > 0)
      ? (1 + RES.overloadDmg) : 1;
    dmg = amount * ST.dmgMul * (opt.mul === undefined ? 1 : opt.mul) * charDamageMul(e, opt) * schoolDamageMul(e, src) * overloadMul;
    /* BOSS 领域：被压流派 −35%。查的是武器自己的 school，不是"猜" */
    if(ST.banSchool && WEAPONS[src] && WEAPONS[src].school === ST.banSchool) dmg *= 0.65;
    if(P && P.bloodrageOn) dmg *= 1.2;
    /* 3.0 资源态增伤：狂战 / 超载 / 圣盾 */
    if(P && P.berserk > 0) dmg *= (ST.berserkDmg || 1.3);
    if(P && P.overload > 0){
      if(relic('chgres')) dmg *= 1.2;
      if(archTier('charge') >= 2) dmg *= 1.2;
    }
    if(relic('ragebrand') && P && P.berserk > 0) dmg *= 1.3;
    if(relic('shdaegis') && P && P.shield > 0) dmg *= 1.3;
  }
  let crit = false;

  /* 改造卡「锐利」：这把武器的暴击率 +12%、暴击伤害 +20%（走统一管线，所有来源都吃得到） */
  const sharp = hasMod(src, 'crit');
  const sharpener = (P && P.sc && P.sc.sharp) ? P.sc.sharp : 0;
  let critMul = ST.critMul + (sharp ? 0.20 : 0) + sharpener * 0.03;
  if(opt.canCrit !== false && !opt.dot && !opt.trueDmg){
    if(P && P.guaranteedCrit){ crit = true; P.guaranteedCrit = false; }
    else {
      const cc = (opt.critChance !== undefined ? opt.critChance : ST.crit) + (sharp ? 0.12 : 0) + sharpener * 0.015;
      /* 幸运草：随机判定做两次取更好的（暴击从 cc 变成 1-(1-cc)^2） */
      let roll = Math.random();
      if(relic('clover')) roll = Math.min(roll, Math.random());
      if(roll < cc) crit = true;
    }
  }
  /* 处刑者：残血目标必定暴击 */
  if(relic('executioner') && e.hp < e.maxHp * 0.25 && !opt.trueDmg) crit = true;
  /* 对流血目标的暴击额外 20%：菜刀/电锯的暴击收益不只是数字 */
  if(crit && e.st && e.st.bleed > 0) dmg *= 1.20;
  if(crit){
    /* 【2.6】暴击预算超了，这一次就"不算暴击"，而不是"算暴击但伤害打 85 折"。
       旧写法会让玩家看到满屏"暴击"，伤害却很小，观感上就是"暴击是假的"。 */
    if(!spend('crit')) crit = false;
    else dmg *= critMul;
  }
  if(e.big){
    if(ST.bossMul > 1) dmg *= ST.bossMul;
    /* 近战打 BOSS 的补偿：BOSS 会冲刺、会拉开距离，近战命中窗口远少于远程，
       不给补偿的话骑士/菜刀系打 BOSS 要一分钟以上。 */
    if(MELEE[src]) dmg *= 1.7;
    /* BOSS 力竭：打太久会越来越脆，避免弱 build 卡在 90 秒的拉锯战里 */
    if(e.fightT > 14){
      dmg *= 1 + Math.min(7.0, (e.fightT - 14) * 0.14);
      if(!e.tired && e.fightT > 14){
        e.tired = true;
        addText(e.x, e.y - e.r - 20, '力竭！', '#ffd166', 13);
        sfx('crit');
      }
    }
  }
  /* 条件型改造（先手 / 处决 / 远射 / 猎杀 / 标记）。
     它们是"对什么目标更狠"，而不是"整体再多加 20%"——
     同一把武器在不同局面下的强弱差异，才是构筑的乐趣来源。 */
  if(typeof modCondMul === 'function' && !opt.dot && !opt.trueDmg) dmg *= modCondMul(src, e);
  if(e.armor > 0 && !opt.trueDmg) dmg *= (1 - e.armor);     /* 重甲：吃伤害打折，逼你换手段 */
  /* 冲刺后的「顺势」窗口：敢冲进去的人有输出补偿。
     【4.1】破韧已删除——它会和易伤、冰缓易伤、感电易伤叠在一起，
     玩家根本算不出"这一下到底为什么这么疼"。现在易伤来源只剩元素那几条。 */
  if(P && P.flow > 0) dmg *= 1 + dashFlowDmgNow();
  /* 霜噬：冰缓 / 冻结中的敌人受到的伤害 +25% */
  if(e.st && e.st.ice > 0 && relic('frostbite')) dmg *= 1.25;
  /* 霜刃：打冰住的目标会炸开冰片（0.15 秒节流，避免高频武器刷屏） */
  if(relic('frostblade') && e.st && e.st.ice > 0 && !opt.dot &&
     state.time - (P && P.frostT || -9) > 0.15){
    if(P) P.frostT = state.time;
    if(!e.frostMark){
      e.frostMark = 1;
      eachNear(e.x, e.y, 60, function(o){
        if(o === e || o.dead) return;
        dealDamage(o, dmg * 0.25, { src:'ice', elem:'ice', dot:true, canCrit:false, noFlesh:true });
      });
      burst(e.x, e.y, '#9fe0ff', 5, 90, -0.1);
    }
  }
  /* 冷冻Ⅲ：打被冰住的目标 +40%（厨师的"冻住再打碎"） */
  if(ST.frozenVuln && e.st && e.st.ice > 0) dmg *= 1 + ST.frozenVuln;
  /* 火力网格：炮台打自己标记的目标 +25%（进化后 +40%，且你也吃一半） */
  if(e.fgMarkAt && state.time - e.fgMarkAt < 2.4 && relic('firegrid')){
    if(src === 'turret') dmg *= evoFlag('firegrid', 'fg40') ? 1.40 : 1.25;
    else if(evoFlag('firegrid', 'fgself')) dmg *= 1.15;
  }
  /* 冰封：被冰缓的敌人受到的伤害 +12%（解锁条件写在卡面上：冰封持续 +0.5 秒） */
  if(relic('icebind') && e.st && e.st.ice > 0) dmg *= 1.12;
  /* 电网Ⅲ：感电目标受到的所有伤害 +15% */
  if(ST.gridTier >= 3 && e.st && e.st.volt > 0) dmg *= 1.15;
  /* 第一口：每局第一次命中 3 倍 */
  if(relic('firstbite') && P && !opt.dot && !P.firstBiteUsed){
    P.firstBiteUsed = 1;
    dmg *= 3;
    addText(e.x, e.y - e.r - 12, '第一口！', '#ffd166', 12);
  }
  /* 【6.0】节拍类：只统计"直接命中"，持续伤害不刷计数，否则永远停在倍率上 */
  if(!opt.dot && P){
    P.hitN = (P.hitN || 0) + 1;
    if(relic('metronome') && P.hitN % 3 === 0) dmg *= 1.5;
    if(relic('quadbeat') && P.hitN % 4 === 0) dmg *= 1.9;
    if(relic('ambush') && !P.ambushUsed && !P.moving && (P.stillT || 0) > 1.2){
      dmg *= 1.6;
      P.ambushUsed = true;
    }
  }
  /* 凋零：身上 3 种以上元素的敌人受到伤害 +40% */
  if(ST.debuffVuln > 0 && elemKinds(e) >= 3) dmg *= 1 + ST.debuffVuln;
  /* 处刑：残血敌人 +25% */
  if(ST.execMul > 0 && e.hp < e.maxHp * 0.40) dmg *= 1 + ST.execMul;
  if(e.vulnMul && e.vulnMul !== 1) dmg *= e.vulnMul;

  /* 遗物伤害占比上限。
     遗物的定位是"补强"，但猎杀连锁 / 余烬 / 冰霜之心这类"按击杀或按命中触发"
     的效果会随击杀率线性叠加，9 分钟能打出上千万，结算面板里遗物永远第一，
     武器反而像配件。这里按"同时段武器伤害"给一个比例上限：
     超出部分只保留 12%，保证遗物再胡也只是补强，不会变成主输出。 */
  const isRelicSrc = src === 'relic' || (typeof src === 'string' && src.slice(0, 2) === 'r_');
  if(isRelicSrc){
    const cap = Math.max(60, (state.wpnDps || 120) * 0.5);
    if((state.relicAcc || 0) > cap) dmg *= 0.12;
    state.relicAcc = (state.relicAcc || 0) + dmg;
  }

  /* 反伤占比上限：反伤是"贴脸时多出来的一手"，武器才是主力输出。
     骑士把护甲折成反伤之后，光靠站着不动就能清场，结算面板里反伤常年第一，
     武器反而像配件。这里和遗物一样按"同时段武器伤害"封顶：
     超过同期武器 45% 的部分只保留 20%。 */
  if(src === 'thorns'){
    const tcap = Math.max(40, (state.wpnDps || 120) * 0.45);
    if((state.thornsAcc || 0) > tcap) dmg *= 0.20;
    state.thornsAcc = (state.thornsAcc || 0) + dmg;
  }

  /* --- 机制型改造 --- */
  if(!opt.dot){
    if(hasMod(src, 'overload')){
      /* 原来按"同一个目标"叠层，但杂兵活不到 5 层——这条只对 BOSS 生效，等于没有。
         改成挂在玩家身上：只要不停手就一直叠，2 秒不命中清零。 */
      if((P.ovUntil || 0) < state.time) P.ovStack = 0;
      P.ovStack = Math.min(5, (P.ovStack || 0) + 1);
      P.ovUntil = state.time + 2.0;
      dmg *= 1 + P.ovStack * 0.12;
    }
    /* 「惯性」：站定蓄力，动一下就断。原来写反了（移动时加伤）。 */
    if(hasMod(src, 'momentum') && P && !P.moving && (P.stillT || 0) > 0.5) dmg *= 1.25;
    if(hasMod(src, 'shatter') && e.st && e.st.ice > 0){
      e.st.ice = 0;
      e.st.reactCd = 0.12;
      dmg *= 1.7;
      if(spend('react')) rings.push({ x:e.x, y:e.y, r0:4, r1:34, life:0.2, max:0.2, col:'#bff0ff', w:2 });
    }
    if(hasMod(src, 'detonate') && consumeAny(e, src)) dmg *= 2.4;
    if(hasMod(src, 'spread')) spreadStatus(e, src);

    /* 元素武器的分工：有的负责"挂"，有的负责"炸"。
       引爆型武器遇到配对状态时消耗掉，打出大伤害 + 溅射，
       所以「冰霜雪糕 + 喷火枪」比「两把火」强得多。 */
    const dw = WEAPONS[src];
    if(dw && dw.detonates && spend('react')){
      for(let i = 0; i < dw.detonates.length; i++){
        const el = dw.detonates[i];
        if(e.st && e.st[el] > 0){
          e.st[el] = 0;
          e.st.reactCd = 0.15;
          dmg *= 1.95;
          rings.push({ x:e.x, y:e.y, r0:4, r1:46, life:0.22, max:0.22, col:'#ffe9b0', w:3 });
          let n = 0;
          eachNear(e.x, e.y, 62, function(o){
            if(o === e || o.dead || n >= 6) return;
            n++;
            dealDamage(o, dmg * 0.35, { src:'react', dot:true, canCrit:false });
          });
          sfx('melt');
          break;
        }
      }
    }
  }

  const real = Math.min(dmg, Math.max(0, e.hp));
  DMG[src] = (DMG[src] || 0) + real;
  if(WEAPONS[src]) state.wpnAcc = (state.wpnAcc || 0) + real;   /* 武器每秒输出，供遗物上限参考 */
  state.hitCount = (state.hitCount || 0) + 1;
  /* 弹幕Ⅲ「每 10 次命中让一把武器立刻装填」：这条也一直没实现。
     只装填"正在冷却且不是刚开火的那把"，避免无限连发自己。 */
  if(state.hitCount % 10 === 0 && typeof archTier === 'function' && archTier('barrage') >= 3 && P && P.cds){
    let best = null, bestT = 0;
    for(const wid in P.cds){
      const v = P.cds[wid] || 0;
      if(v > bestT){ bestT = v; best = wid; }
    }
    if(best) P.cds[best] = 0;
  }
  state.dmgDealt = (state.dmgDealt || 0) + real;
  state.dmgAcc = (state.dmgAcc || 0) + real;

  e.hp -= dmg;
  e.flash = 0.07;
  e.hitT = 0.1;

  /* 「标记」与「波及」在伤害落地之后结算。
     波及只做一层（opt.splash 用来掐断递归），
     否则 A 溅 B、B 溅 C 会在 200 只怪的场面里炸成连锁。 */
  if(!opt.dot && !opt.trueDmg && WEAPONS[src]){
    if(hasMod(src, 'mark') && !e.big){
      e.markT = 6;
      e.markN = Math.min(3, (e.markN || 0) + 1);
    }
    if(hasMod(src, 'splash') && !opt.splash){
      eachNear(e.x, e.y, 46, function(o){
        if(o.dead || o === e) return;
        dealDamage(o, dmg * 0.40, { src: src, splash: true, canCrit: false });
      });
    }
  }

  HIT.e = e; HIT.dmg = dmg; HIT.crit = crit; HIT.src = src; HIT.elem = opt.elem || null;
  HIT.trueDmg = !!opt.trueDmg;
  /* 浮字：只在够痛或暴击时显示，满屏时不刷屏。
     【2.6】暴击飘字补上最小门槛：遗物封顶 ×0.12、护甲折减之后会产生大量
     不足 1 点的碎伤害，原先暴击是无条件显示的，于是满屏"暴击 0"。 */
  if(!opt.trueDmg){
    if(crit && dmg >= 10) addText(e.x + rand(-4, 4), e.y - e.r - 8, '暴击 ' + fmtNum(dmg), '#ffd166', 9);
    else if(!crit && (dmg > 260 || (e.big && dmg > 90))) addText(e.x + rand(-3, 3), e.y - e.r - 4, fmtNum(dmg), '#fff3c4', 8);
  }

  /* 暴击Ⅲ：暴击伤害的 15% 溅射到周围（不递归） */
  if(crit && archTier('crit') >= 3 && !opt.dot){
    let n = 0;
    eachNear(e.x, e.y, 64, function(o){
      if(o === e || o.dead || n >= 5) return;
      n++;
      dealDamage(o, dmg * 0.15, { src: src, dot: true, canCrit:false, noFlesh:true });
    });
  }
  if(!opt.dot){
    emit('hit', HIT);
    if(crit){
      emit('crit', HIT);
      sfx('crit');
      /* 怒不可遏：暴击也是攒怒来源之一 */
      if(relic('ragecrit')) rageGainRaw(3.5);
    }
    /* --- 3.0 资源积累：怒气 / 充能 / 血肉附加 ---
       放在事件之后：角色钩子可能补一层元素，但资源只按"这一下命中"算一次。
       改造卡「蓄怒 / 蓄能」直接改这里，不需要每条弹道都带标记。 */
    if(P){
      const rm = hasMod(src, 'ragefuel') ? 1.8 : 1;
      rageGain(RES.rageGainHit * rm * (opt.rageGain || 1));
      if(!opt.noCharge){
        const cm = hasMod(src, 'chargeup') ? 2.0 : 1;
        chargeGain(RES.chargeHit * cm);
      }
      if(crit) chargeGain(RES.chargeCrit);
    }
    /* 狂战吸血：伤害的 2.5% 记账，每 0.25 秒结算一次 */
    if(!opt.dot) berserkLeech(dmg);
    if(!opt.noFlesh && !opt.trueDmg){
      fleshStrike(e, 1);
      if(hasMod(src, 'bloodpact')) bloodPactStrike(e);
    }
  }

  /* 跳弹：命中后有 35% 概率朝最近的另一个敌人弹一发（不递归） */
  if(!opt.dot && !opt.bounce && relic('ricochet') && Math.random() < 0.35 && bullets.length < 380){
    let best = null, bd = 1e9;
    eachNear(e.x, e.y, 200, function(o){
      if(o.dead || o === e) return;
      const d = dist(e.x, e.y, o.x, o.y);
      if(d < bd){ bd = d; best = o; }
    });
    if(best){
      const ang = Math.atan2(best.y - e.y, best.x - e.x);
      bullets.push({
        type:'shot', x:e.x, y:e.y,
        vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420,
        r:4, dmg: dmg * 0.55, life:0.6, pierce:0, range: bd + 40,
        hitSet:new Set([e.id]), hitCount:0, rot:ang, spin:0,
        col:'#b6f0ff', src: dmgSrcForRicochet(src), bounce:true
      });
    }
  }

  if(e.hp <= 0){
    const deadSrc = src;
    killEnemy(e, HIT);
    /* 连锁击杀：击杀时向最近的敌人弹射一次 */
    if(!opt.dot && hasMod(deadSrc, 'chainkill') && spend('kill')){
      let best = null, bd = 1e9;
      eachNear(e.x, e.y, 220, function(o){
        if(o.dead || o === e) return;
        const d = dist(e.x, e.y, o.x, o.y);
        if(d < bd){ bd = d; best = o; }
      });
      if(best){
        beams.push({ x:e.x, y:e.y, ang: Math.atan2(best.y - e.y, best.x - e.x),
          len: bd, width: 2, life: 0.12, max: 0.12, col:'#ffe066', src:'chainkill' });
        dealDamage(best, dmg * 0.6, { src: deadSrc, dot: true, canCrit: false });
      }
    }
  }
  return dmg;
}

/* 兼容旧接口：hurt(e, dmg) 自动带上当前 SRC */
function hurt(e, base){
  return dealDamage(e, base, NOOPT);
}

/* 敌对单位（宠物、炮台也会被打） */
function damageAlly(a, dmg){
  if(!a || a.dead) return;
  /* 【4.2】宠物不再受伤、不再死亡、没有血条（土豆兄弟那套）。
     ---------------------------------------------------------
     之前的宠物血量厚到根本死不掉（小狗 74 血 + 65% 减伤），
     而且死了会立刻补员——"死亡"这个事件既不会发生也不产生任何后果，
     结果就是屏幕上一堆血条，玩家却从来不需要关心它们。
     现在：宠物是永久的自动单位，只有炮台会因为时间到期消失。 */
  if(a.kind === 'pet') return;
  a.hp -= dmg;
  a.flash = 0.09;
  if(a.hp <= 0){
    a.dead = true;
    onAllyDeath(a);
  }
}
