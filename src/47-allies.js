/* =========================================================
   4.7 友方单位
   ---------------------------------------------------------
   宠物和炮台是两套完全不同的东西：

   宠物 = 一支围绕主人的小队
     · 有队形槽位，主要待在玩家周围，只在短距离内追击
     · 超过牵引距离会主动放弃目标、返回主人身边
     · 彼此分离，不会挤成一个点
     · 8 种 AI：追击撕咬 / 空中射击 / 护卫拍击 / 吸收分裂 /
       喷火 / 冰弹 / 连锁电击 / 自爆再召唤

   炮台 = 一套自动化武器系统
     · 固定部署，有存在时间与数量上限，不会追着敌人跑
     · 真实子弹、炮口火光、命中反馈；激光/电弧是特例
     · 8 种定位：机枪 / 火箭 / 激光 / 冰冻 / 闪电 / 喷火 / 地雷工厂 / 维修
   ========================================================= */
let allies = [];
const ALLY_CAP = 26;   /* 引擎层面的同屏单位上限（防爆帧），不是玩法上限 */

/* 【4.2】炮台不再有"每种最多 N 座"的上限。
   ---------------------------------------------------------
   用户："工程师不应该设计炮台上限，就是随时部署炮台，
           只是把炮台的持续时间大幅降低。"
   这个改动是对的：上限让"我该放几座"变成一个隐性算术题，
   而且炮台满了之后 deployTurret 会**悄悄顶掉最旧的一座**，
   玩家看到的是"炮台在消失"，却不知道为什么。
   现在：想放几座放几座，炮台自己会很快到期消失（见 TURRET_LIFE），
   于是"场上几座"由**你的部署速度**决定，而不是一个藏起来的数字。
   唯一的硬约束是 ALLY_CAP（引擎层面的同屏单位上限，防止爆帧）。 */
const TURRET_NO_CAP = 999;
function turretLimitOf(ttype){ return TURRET_NO_CAP; }
function turretCountOf(ttype){
  let n = 0;
  for(let i = 0; i < allies.length; i++){
    const a = allies[i];
    if(a.kind === 'turret' && !a.dead && a.ttype === ttype) n++;
  }
  return n;
}
/* 某类炮台满了：替换掉这一类里最旧的一座，而不是直接放弃部署 */
function retireOldestTurret(ttype){
  let oldest = null;
  for(let i = 0; i < allies.length; i++){
    const a = allies[i];
    if(a.kind !== 'turret' || a.dead || a.ttype !== ttype) continue;
    if(!oldest || a.life < oldest.life) oldest = a;
  }
  if(oldest){ oldest.dead = true; oldest.life = 0; }
}
/* 兼容旧调用：总上限（只用于 UI 展示） */
function turretLimit(){ return turretLimitOf('mg'); }
/* 宠物上限：和炮台一样，**按 petType 分别计算**。
   旧版是所有宠物共享一个总额，狗和鸟先占满，后面的猫/史莱姆就永远不出现。 */
function petLimitOf(type){
  let n = 2;                                   /* 每种宠物基础 2 只 */
  if(CHAR.petLimit && CHAR.petLimit() > 3) n = 4;   /* 饲养员每种 4 只 */
  n += (relicStat().petBonus || 0);
  if(gemLv('packhorn') >= 2) n += 1;
  if(archTier('beast') >= 2) n += 1;
  return Math.min(6, n);
}
/* 总上限（UI 展示 + 兜底） */
function petLimit(){
  let n = 3;
  if(CHAR.petLimit) n = CHAR.petLimit();
  n += (relicStat().petBonus || 0);
  if(gemLv('packhorn') >= 2) n += 1;
  return Math.min(10, n);
}
function allyCount(kind){
  let n = 0;
  for(let i = 0; i < allies.length; i++){
    const a = allies[i];
    if(a.dead) continue;
    if(!kind || a.kind === kind) n++;
  }
  return n;
}

/* =========================================================
   炮台类型表
   ========================================================= */
const TURRETS = {
  mg:     { name:'机枪塔', col:'#ffe066', hp:110, rate:0.40, range:250, dmg:1.45,
            kind:'bullet', speed:640, spread:0.05, burst:1 },
  rocket: { name:'火箭炮台', col:'#ff8f6b', hp:130, rate:1.55, range:300, dmg:2.6,
            kind:'missile', speed:150, spread:0, burst:1, aoe:52 },
  laser:  { name:'激光炮台', col:'#ff7ae0', hp:90, rate:0.90, range:290, dmg:1.8,
            kind:'beam', spread:0, burst:1 },
  frost:  { name:'冰冻炮台', col:'#8fe8ff', hp:100, rate:0.75, range:230, dmg:1.15,
            kind:'bullet', speed:420, spread:0.06, burst:1, elem:'ice' },
  tesla:  { name:'闪电塔', col:'#9fe8ff', hp:85, rate:0.80, range:235, dmg:1.4,
            kind:'chain', spread:0, burst:1, jumps:3 },
  flame:  { name:'喷火塔', col:'#ff8a3d', hp:120, rate:0.32, range:150, dmg:0.55,
            kind:'flame', spread:0.28, burst:3, elem:'fire' },
  factory:{ name:'地雷工厂', col:'#ff5f8f', hp:140, rate:2.2, range:170, dmg:1.0,
            kind:'mine', spread:0, burst:1 },
  repair: { name:'维修机', col:'#8ee6b3', hp:120, rate:2.6, range:210, dmg:0,
            kind:'repair', spread:0, burst:1 }
};

function deployTurret(type, x, y, lv, dmg, dur){
  if(allies.length >= ALLY_CAP) return null;
  const T = TURRETS[type] || TURRETS.mg;
  const rate = (CHAR.turretRate ? CHAR.turretRate() : 1) * (ST.turretRate || 1) * (1 + (P.turretOverclock || 0));
  /* 阵地协同：每多一座炮台，所有炮台伤害 +8%（最多 +40%） */
  const gridBonus = 1 + Math.min(5, Math.max(0, allyCount('turret'))) * 0.08;
  const life = dur * relicStat().turretLife;
  const a = {
    id: uid++, kind:'turret', ttype: type, name: T.name, col: T.col,
    x: clamp(x, 20, ARENA.w - 20), y: clamp(y, 20, ARENA.h - 20),
    hp: T.hp + lv * 34 + (P.level || 1) * 9, maxHp: T.hp + lv * 34 + (P.level || 1) * 9, r: 8,
    dmg: dmg * T.dmg * allyTimeScale() * gridBonus * (CHAR.turretDmg ? CHAR.turretDmg() : 1),
    /* 【原来这里只算了基础冷却】炮台的「加速 / 增殖」改造卡从来没生效过——
       cd 直接取 T.rate / rate，改造卡等于不存在。现在接上 wCdMul（加速 −20%），
       弹道数按等级成长（每 2 级 +1 发），增殖再 +1 发。 */
    cd: T.rate / rate * wCdMul('turret'),
    burst: (T.burst || 1) + (hasMod('turret', 'count') ? 1 : 0) + Math.floor(Math.max(0, lv - 1) / 2),
    t: rand(0, 0.25),
    life: life, maxLife: life, lv: lv, dead: false, flash: 0, muzzle: 0,
    range: T.range + lv * 6, ang: -Math.PI / 2, seed: rand(0, 10)
  };
  allies.push(a);
  rings.push({ x:a.x, y:a.y, r0:2, r1:24, life:0.22, max:0.22, col:T.col, w:2 });
  sfx('deploy');
  return a;
}

/* =========================================================
   宠物类型表
   ========================================================= */
const PET_TYPES = {
  dog:    { name:'小狗', col:'#e6c17a', hp:74, spd:170, cd:0.30, range:30, leash:230,
            mode:'melee', role:'chase', dmg:2.6 },
  bird:   { name:'机械鸟', col:'#9fe0ff', hp:50, spd:200, cd:0.44, range:230, leash:260,
            mode:'shot', role:'hover', dmg:2.5 },
  cat:    { name:'胖猫', col:'#ffb0c4', hp:120, spd:126, cd:0.62, range:48, leash:170,
            mode:'sweep', role:'guard', dmg:2.9 },
  slime:  { name:'小史莱姆', col:'#a8f5af', hp:160, spd:104, cd:0.58, range:34, leash:180,
            mode:'melee', role:'guard', dmg:2.5, split:true },
  lizard: { name:'喷火蜥蜴', col:'#ff8a3d', hp:72, spd:136, cd:0.64, range:165, leash:230,
            mode:'cone', role:'chase', dmg:2.4, elem:'fire' },
  penguin:{ name:'冰企鹅', col:'#8fe8ff', hp:86, spd:124, cd:0.54, range:210, leash:240,
            mode:'shot', role:'hover', dmg:2.4, elem:'ice' },
  hamster:{ name:'闪电仓鼠', col:'#ffe066', hp:58, spd:215, cd:0.48, range:135, leash:240,
            mode:'chain', role:'chase', dmg:2.3, elem:'volt' },
  bomb:   { name:'自爆蘑菇', col:'#ff6b8b', hp:44, spd:210, cd:1.05, range:20, leash:260,
            mode:'suicide', role:'chase', dmg:3.0 },
};

const PET_ORDER = ['dog', 'bird', 'cat', 'slime', 'lizard', 'penguin', 'hamster', 'bomb'];

/* 召唤物的伤害补正：它们的伤害只跟武器等级走，
   而小怪血量按 3 次方涨，不补就会被甩开。这里按时间给一条温和的补偿曲线。 */
function allyTimeScale(){
  return 1 + Math.max(0, state.time) / 300;
}

function spawnPet(x, y, lv, dmg, life, forceType, srcId){
  if(allies.length >= ALLY_CAP) return null;
  let type = forceType;
  if(!type){
    /* 等级越高，能出场的宠物种类越多 */
    const pool = lv >= 5 ? PET_ORDER
      : (lv >= 4 ? PET_ORDER.slice(0, 6)
      : (lv >= 3 ? PET_ORDER.slice(0, 5)
      : (lv >= 2 ? PET_ORDER.slice(0, 3) : ['dog'])));
    type = pickOne(pool);
  }
  const def = PET_TYPES[type];
  const hp = def.hp + lv * 16 + (P.level || 1) * 14;
  /* 宠物改造卡按"类别"生效：
       近战 → 移速 / 伤害 / 冷却
       AOE  → 范围 / 冷却
       远程 → 弹道 / 冷却
     原来宠物根本不知道自己属于哪把武器，改造卡对它们等于不存在。 */
  const src = srcId || null;
  /* 「狼群」分支：狗狗移速 +50% */
  const packSpd = (P && P.evoFlag && src && P.evoFlag[src] === 'packSpeed') ? 1.5 : 1;
  const mSpd  = (src && hasMod(src, 'swift') ? 1.25 : 1) * packSpd;
  const mCd   = src ? wCdMul(src) : 1;
  const mSize = src && hasMod(src, 'size') ? 1.30 : 1;
  const a = {
    id: uid++, kind:'pet', ptype: type, name: def.name, col: def.col,
    x, y, vx:0, vy:0, hp, maxHp: hp, r: 7,
    dmg: dmg * ST.petMul * def.dmg * allyTimeScale(), cd: def.cd * mCd, t: rand(0, 0.5),
    spd: def.spd * mSpd, mode: def.mode, role: def.role, range: def.range * mSize, src,
    leash: def.leash, elem: def.elem || null, lv: lv,
    life: life || 0, maxLife: life || 0, seed: rand(0, 10),
    dead: false, flash: 0, hitCd: 0, ang: rand(0, TAU), anim: 0,
    state:'follow', slot: allyCount('pet'), tgt: null, tgtT: 0
  };
  allies.push(a);
  burst(a.x, a.y, def.col, 8, 90, 0);
  sfx('deploy');
  return a;
}

function onAllyDeath(a, silentBoom){
  const col = a.col || '#8ee6b3';
  burst(a.x, a.y, col, 10, 110, 0);
  sfx('petDie');
  emit('allyDeath', a);
  if(a.kind === 'pet'){
    /* 【P0 修复】自爆蘑菇原来是"攻击时炸一次 → 死亡处理再炸一次 → 立即可重生"，
       而且重生出来的蘑菇攻击间隔是 0，下一帧又炸。三处叠加成一条无限循环，
       funcgate 里它 20 秒打出了 10.5 万伤害（是第二名的 8 倍）。
       现在：爆炸只由攻击入口触发一次（silentBoom），死亡处理不再重复结算，
       重生交给武器自己的补员节奏（不再无延迟立即复活）。 */
    if(a.ptype === 'bomb'){
      /* 自爆蘑菇本身就是一次性单位，和流派无关 */
      if(!silentBoom) explode(a.x, a.y, 58, a.dmg * 0.8 + 6, '#ff6b8b', false, 'pet');
    } else if(CHAR.onPetDeath){
      CHAR.onPetDeath(a);
    } else if(archTier('sacrifice') >= 1){
      explode(a.x, a.y, 30, 12 + P.level * 3, col, true, 'pet');
    }
  }
}

/* =========================================================
   每帧更新
   ========================================================= */
function updateAllies(dt){
  for(let i = allies.length - 1; i >= 0; i--){
    const a = allies[i];
    if(a.dead) continue;
    if(a.flash > 0) a.flash -= dt;
    if(a.muzzle > 0) a.muzzle -= dt;
    if(a.life > 0){
      a.life -= dt;
      if(a.life <= 0){
        if(a.kind === 'turret'){ burst(a.x, a.y, a.col, 8, 80, 0); a.dead = true; continue; }
        if(a.kind === 'pet' && a.maxLife > 0){ a.dead = true; continue; }
      }
    }
    if(a.kind === 'turret') updateTurret(a, dt);
    else if(a.kind === 'pet') updatePet(a, dt);
  }
  separateAllies();
  let any = false;
  for(let i = 0; i < allies.length; i++) if(allies[i].dead){ any = true; break; }
  if(any) allies = allies.filter(a => !a.dead);
}

/* ---------------- 炮台 ---------------- */
function turretTarget(a){
  /* 火力网：优先打别的炮台也在打的敌人，形成交叉覆盖 */
  const t = nearestEnemy(a.x, a.y, a.range);
  if(!t) return null;
  const marked = state.turretMark;
  if(marked && !marked.dead && dist(a.x, a.y, marked.x, marked.y) <= a.range) return marked;
  return t;
}

/* 阵地协同：相邻炮台互相超频。
   炮台挨得越密火力越猛，于是"先摆哪、摆多密"变成真正的决策，
   而不是随便丢在地上各打各的。 */
function turretAdjMul(a){
  let n = 0;
  for(let i = 0; i < allies.length; i++){
    const o = allies[i];
    if(o === a || o.dead || o.kind !== 'turret') continue;
    if(dist(a.x, a.y, o.x, o.y) < 120) n++;
  }
  return 1 + Math.min(3, n) * 0.18;
}

function updateTurret(a, dt){
  const T = TURRETS[a.ttype] || TURRETS.mg;
  a.t -= dt * turretAdjMul(a);
  const tgt = turretTarget(a);
  if(!tgt){
    a.ang += dt * 0.6;                      /* 待机时缓慢巡视 */
    return;
  }
  /* 转向瞄准：不是瞬间对准，有一个可见的转角 */
  const want = Math.atan2(tgt.y - a.y, tgt.x - a.x);
  let df = want - a.ang;
  while(df > Math.PI) df -= TAU;
  while(df < -Math.PI) df += TAU;
  a.ang += clamp(df, -7 * dt, 7 * dt);
  if(Math.abs(df) > 0.35) return;           /* 没对准之前不开火 */

  if(a.t > 0) return;
  a.t = a.cd;
  a.muzzle = 0.08;
  state.turretMark = tgt;

  const crit = relic('turretcrit') ? ST.crit : ST.crit * 0.4;
  /* 防线协同：相邻的【不同类型】炮台会把彼此的元素串过来。
     冰塔挨着机枪，机枪子弹就带冰；电塔挨着机枪就带感电。
     不需要任何按键，是"摆放"本身产生的结果——这才是摆一片阵地的意义。 */
  let el = T.elem ? [T.elem].concat(modElems('turret')) : modElems('turret').slice();
  for(let ti = 0; ti < allies.length; ti++){
    const o = allies[ti];
    if(o === a || o.dead || o.kind !== 'turret' || o.ttype === a.ttype) continue;
    if(dist(a.x, a.y, o.x, o.y) > 120) continue;
    const ot = TURRETS[o.ttype];
    if(ot && ot.elem && el.indexOf(ot.elem) < 0) el.push(ot.elem);
  }

  if(T.kind === 'bullet'){
    /* 「散射」改造：弹道翻倍 + 扇面拉宽。屏幕上直接多出一片弹幕，
       这是工程师版的"看得见的爽"，和游侠的散射是同一套语言。 */
    const scatter = hasMod('turret', 'scatter');
    const shots = (a.burst || T.burst || 1) * (scatter ? 2 : 1);
    const spreadMul = scatter ? 2.4 : 1;
    for(let k = 0; k < shots; k++){
      const ang = a.ang + rand(-T.spread * spreadMul, T.spread * spreadMul);
      bullets.push({
        type:'tshot', x:a.x, y:a.y,
        vx: Math.cos(ang) * T.speed, vy: Math.sin(ang) * T.speed,
        r:3.4, dmg:a.dmg, life:0.8, pierce:0, range:a.range + 40,
        hitSet:new Set(), hitCount:0, rot:ang, spin:0,
        col:a.col, src:'turret', elem: el, critChance:crit
      });
    }
    sfx('turret');
  } else if(T.kind === 'missile'){
    bullets.push({
      type:'missile', x:a.x, y:a.y,
      vx: Math.cos(a.ang) * T.speed, vy: Math.sin(a.ang) * T.speed,
      r:5, dmg:a.dmg, life:3.2, pierce:0, homing:120, range:a.range + 120,
      boom: T.aoe * ST.blast, hitSet:new Set(), hitCount:0,
      rot:a.ang, spin:0, col:a.col, src:'turret', elem: el, critChance:crit
    });
    sfx('shoot');
  } else if(T.kind === 'beam'){
    fireBeam(a.x, a.y, a.ang, a.range, 4 + a.lv, a.dmg, 'turret');
    sfx('zap');
  } else if(T.kind === 'chain'){
    let cur = tgt, fx = a.x, fy = a.y, dmg = a.dmg;
    const hit = new Set();
    for(let j = 0; j < (T.jumps + a.lv); j++){
      if(!cur) break;
      hit.add(cur.id);
      dealDamage(cur, dmg, { src:'turret', critChance:crit });
      if(el.length) elemOnHit(cur, el, dmg, 'turret');
      beams.push({ x:fx, y:fy, ang: Math.atan2(cur.y - fy, cur.x - fx),
        len: dist(fx, fy, cur.x, cur.y), width:2, life:0.1, max:0.1, col:a.col, src:'turret' });
      fx = cur.x; fy = cur.y;
      dmg *= 0.8;
      let best = null, bd = 1e9;
      eachNear(fx, fy, 150, function(o){
        if(hit.has(o.id)) return;
        const d = dist(fx, fy, o.x, o.y);
        if(d < bd){ bd = d; best = o; }
      });
      cur = best;
    }
    sfx('zap');
  } else if(T.kind === 'flame'){
    for(let k = 0; k < T.burst; k++){
      const ang = a.ang + rand(-T.spread, T.spread);
      bullets.push({
        type:'flame', x:a.x, y:a.y,
        vx: Math.cos(ang) * rand(170, 230), vy: Math.sin(ang) * rand(170, 230),
        r:7, dmg:a.dmg, life:0.42, pierce:4, range:a.range,
        hitSet:new Set(), hitCount:0, rot:ang, spin:0,
        col:'#ff8a3d', src:'turret', elem:['fire'], critChance:crit
      });
    }
    sfx('splat');
  } else if(T.kind === 'mine'){
    if(mines.length < 54){
      mines.push({
        x: clamp(a.x + rand(-34, 34), 16, ARENA.w - 16),
        y: clamp(a.y + rand(-34, 34), 16, ARENA.h - 16),
        r: 15, dmg: a.dmg * 2.2, boom: 46 * ST.blast, arm: 0.3,
        life: 16, seed: rand(0, 10), evo: a.lv >= 5, src:'mine'
      });
    }
    sfx('deploy');
  } else if(T.kind === 'repair'){
    let n = 0;
    for(let i = 0; i < allies.length && n < 3; i++){
      const o = allies[i];
      if(o.kind !== 'turret' || o === a || o.dead) continue;
      if(dist(a.x, a.y, o.x, o.y) > T.range) continue;
      n++;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25);
      o.t = Math.max(0, o.t - 0.35);
      rings.push({ x:o.x, y:o.y, r0:4, r1:16, life:0.2, max:0.2, col:'#8ee6b3', w:1.5 });
    }
    sfx('bubble');
  }
  if(CHAR.onAllyKill && tgt.dead) CHAR.onAllyKill(a, tgt);
}

/* ---------------- 宠物：跟随 / 索敌 / 短追 / 攻击 / 返回 ---------------- */
function petSlot(a){
  const n = Math.max(1, allyCount('pet'));
  const idx = Math.min(a.slot < 0 ? 0 : a.slot, n - 1);
  const base = P.facing > 0 ? Math.PI : 0;        /* 默认躲在身后 */
  const spread = Math.min(Math.PI * 1.5, 0.7 + n * 0.22);
  const ang = base + (n === 1 ? 0 : (idx / (n - 1) - 0.5) * spread);
  const rad = 40 + (idx % 3) * 12;
  return { x: P.x + Math.cos(ang) * rad, y: P.y + Math.sin(ang) * rad };
}

/* 你带了几把宠物武器：兽群协同的强度来源 */
function petWeaponCount(){
  let n = 0;
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(w && w.petType) n++;
  }
  return n;
}

function updatePet(a, dt){
  a.anim += dt * 6;
  if(a.hitCd > 0) a.hitCd -= dt;
  if(a.tgtT > 0) a.tgtT -= dt;
  if(a.tgt && (a.tgt.dead || a.tgtT <= 0)){ a.tgt = null; a.tgtT = 0; }

  const dPlayerX = P.x - a.x, dPlayerY = P.y - a.y;
  const dPlayer = Math.hypot(dPlayerX, dPlayerY);

  /* 1) 没有目标就找一个：只找主人附近的敌人，绝不追半张地图 */
  if(!a.tgt && a.tgtT <= 0){
    let best = null, bd = 1e9;
    eachNear(P.x, P.y, a.leash * 1.15, function(e){
      if(e.dead) return;
      const dP = dist(P.x, P.y, e.x, e.y);
      const dS = dist(a.x, a.y, e.x, e.y);
      /* 护卫型优先打靠近主人的，追击型优先打离自己近的 */
      const score = a.role === 'guard' ? dP + dS * 0.4 : dP * 0.4 + dS;
      if(score < bd){ bd = score; best = e; }
    });
    if(best){ a.tgt = best; a.tgtT = 2.4; }
  }

  /* 2) 牵引：目标离主人太远，或者自己跑太远 → 放弃并回防 */
  if(a.tgt && dist(P.x, P.y, a.tgt.x, a.tgt.y) > a.leash) a.tgt = null;
  if(dPlayer > a.leash * 1.25) a.tgt = null;

  let tx, ty, stop;
  if(a.tgt && dist(a.x, a.y, a.tgt.x, a.tgt.y) < a.range + (a.tgt.r || 6)){
    a.state = 'attack';
    tx = a.tgt.x; ty = a.tgt.y; stop = 0;
  } else if(a.tgt){
    a.state = 'chase';
    tx = a.tgt.x; ty = a.tgt.y; stop = a.range * 0.75;
  } else {
    a.state = dPlayer > 24 ? 'return' : 'follow';
    const sl = petSlot(a);
    tx = sl.x; ty = sl.y; stop = 6;
  }

  /* 3) 平滑移动：速度插值，不会有瞬移和抖动 */
  const d = Math.hypot(tx - a.x, ty - a.y);
  let wantVx = 0, wantVy = 0;
  if(d > stop){
    const sp = a.spd * (a.hp < a.maxHp * 0.35 ? 0.9 : 1);
    wantVx = (tx - a.x) / d * sp;
    wantVy = (ty - a.y) / d * sp;
  }
  const k = 1 - Math.pow(0.001, dt);
  a.vx = lerp(a.vx, wantVx, k);
  a.vy = lerp(a.vy, wantVy, k);
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  a.x = clamp(a.x, 10, ARENA.w - 10);
  a.y = clamp(a.y, 10, ARENA.h - 10);
  if(Math.abs(a.vx) + Math.abs(a.vy) > 8) a.ang = Math.atan2(a.vy, a.vx);

  /* 4) 攻击 */
  if(a.state !== 'attack' || !a.tgt) return;
  a.t -= dt;
  if(a.t > 0) return;
  /* 兽群协同：每多一把宠物武器，全体宠物冷却 -7%（最多 -29%） */
  const sync = 1 + Math.min(5, petWeaponCount() - 1) * 0.08;
  a.t = a.cd / sync;
  attackPet(a, a.tgt);
}

function attackPet(a, tgt){
  const crit = (CHAR.petCrit ? CHAR.petCrit() : ST.crit * 0.5) + ST.crit * 0.2;
  let el = a.elem ? [a.elem].concat(modElems('pet')) : modElems('pet');
  /* 兽性元素：宠物攻击必定附加你最近一次用过的元素 */
  if(relic('petelem') && P.lastElem && el.indexOf(P.lastElem) < 0) el = el.concat([P.lastElem]);
  /* 同类宠物目睹同伴死亡后变凶：每层 +8%，最多 5 层（由 onPetDeath 累加） */
  const rage = 0;   /* 旧的 petRage 已被「献祭」流派的 sacStack 取代 */
  /* 饲养员专属技能「兽群狂化」：6 秒内全体宠物 +60% 伤害 */
  const fury = (P && P.packFury > 0) ? 1.6 : 1;
  const dmg = a.dmg * (1 + rage * 0.08) * fury;

  if(a.mode === 'shot'){
    /* 远程宠物的「散射」：一次三发扇形。这是远程宠物唯一的"弹道"成长轴。 */
    const fan = (a.src && hasMod(a.src, 'scatter')) ? [-0.16, 0, 0.16] : [0];
    for(const off of fan){
      const ang = a.ang + off;
      bullets.push({
        type:'tshot', x:a.x, y:a.y,
        vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380,
        r:4, dmg: dmg * (fan.length > 1 ? 0.62 : 0.85), life:0.9, pierce:0, range: a.range + 60,
        hitSet:new Set(), hitCount:0, rot:ang, spin:0,
        col:a.col, src:'pet', elem: el, critChance:crit
      });
    }
    sfx('pop');
  } else if(a.mode === 'chain'){
    let cur = tgt, fx = a.x, fy = a.y, d = dmg;
    const hit = new Set();
    for(let j = 0; j < 3; j++){
      if(!cur) break;
      hit.add(cur.id);
      dealDamage(cur, d, { src:'pet', critChance:crit });
      if(el.length) elemOnHit(cur, el, d, 'pet');
      beams.push({ x:fx, y:fy, ang: Math.atan2(cur.y - fy, cur.x - fx),
        len: dist(fx, fy, cur.x, cur.y), width:2, life:0.1, max:0.1, col:a.col, src:'pet' });
      fx = cur.x; fy = cur.y; d *= 0.75;
      let best = null, bd = 1e9;
      eachNear(fx, fy, 130, function(o){
        if(hit.has(o.id)) return;
        const dd = dist(fx, fy, o.x, o.y);
        if(dd < bd){ bd = dd; best = o; }
      });
      cur = best;
    }
    sfx('zap');
  } else if(a.mode === 'cone'){
    for(let i = 0; i < 4; i++){
      const ang = a.ang + rand(-0.28, 0.28);
      bullets.push({
        type:'flame', x:a.x, y:a.y,
        vx: Math.cos(ang) * rand(180, 240), vy: Math.sin(ang) * rand(180, 240),
        r:6, dmg: dmg * 0.55, life:0.4, pierce:4, range:a.range,
        hitSet:new Set(), hitCount:0, rot:ang, spin:0,
        col:'#ff8a3d', src:'pet', elem: el, critChance:crit
      });
    }
    sfx('splat');
  } else if(a.mode === 'sweep'){
    eachNear(a.x, a.y, 40, function(e){
      dealDamage(e, dmg * 0.9, { src:'pet', critChance:crit });
      if(el.length) elemOnHit(e, el, dmg, 'pet');
    });
    rings.push({ x:a.x, y:a.y, r0:6, r1:40, life:0.2, max:0.2, col:a.col, w:2 });
    sfx('pop');
  } else if(a.mode === 'suicide'){
    /* 自爆只在这里结算一次；死亡处理用 silentBoom 跳过重复爆炸 */
    /* 【3.0 修复】原来这里写的是固定 26 + lv*8，完全不读 a.dmg —— 
       自爆蘑菇吃了武器等级、改造卡、BALANCE 校准全部不生效，
       所以它永远是全场最低的 DPS。现在按 a.dmg 结算。 */
    explode(a.x, a.y, 58, a.dmg * 0.8 + 6, '#ff6b8b', false, 'pet');
    a.dead = true;
    onAllyDeath(a, true);
    return;
  } else {
    dealDamage(tgt, dmg, { src:'pet', critChance:crit });
    if(el.length) elemOnHit(tgt, el, dmg, 'pet');
    /* 【4.2】「献祭」流派改成「爆裂」：宠物不再死亡，所以原来的
       "死亡爆炸"没有触发条件了。现在宠物每次攻击都附带一圈小爆炸，
       层数越高爆炸越大越狠。 */
    if(typeof archTier === 'function' && archTier('sacrifice') >= 1){
      const t = archTier('sacrifice');
      explode(tgt.x, tgt.y, 26 + t * 12, dmg * (0.35 + t * 0.15), '#ff6b8b', true, 'pet');
    }
    if(PET_TYPES[a.ptype] && PET_TYPES[a.ptype].split && a.hp < a.maxHp * 0.5 && Math.random() < 0.25){
      /* 史莱姆被打破会分裂出小史莱姆 */
      if(allies.length < ALLY_CAP) spawnPet(a.x + rand(-16, 16), a.y + rand(-16, 16), Math.max(1, a.lv - 1), a.dmg * 0.5, 8, 'slime');
    }
    burst(tgt.x, tgt.y, a.col, 3, 70, 0);
    sfx('hit');
  }
}

/* ---------------- 队形分离：别挤成一个点 ---------------- */
function separateAllies(){
  const n = allies.length;
  if(n < 2) return;
  for(let i = 0; i < n; i++){
    const a = allies[i];
    if(a.dead) continue;
    for(let j = i + 1; j < n; j++){
      const b = allies[j];
      if(b.dead) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      const mr = (a.r + b.r) * 1.4;
      if(d2 < mr * mr && d2 > 0.0001){
        const d = Math.sqrt(d2);
        const push = (mr - d) * 0.35;
        a.x += (dx / d) * push; a.y += (dy / d) * push;
        b.x -= (dx / d) * push; b.y -= (dy / d) * push;
      }
    }
  }
}

/* 敌人贴身会揍宠物 / 炮台 */
function alliesTakeContact(dt){
  if(!allies.length) return;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead) continue;
    for(let j = 0; j < allies.length; j++){
      const a = allies[j];
      /* 宠物不参与承伤（见 12-engine 的 damageAlly） */
      if(a.dead || a.hitCd > 0 || a.kind === 'pet') continue;
      const dx = e.x - a.x, dy = e.y - a.y;
      const rr = e.r + a.r;
      if(dx * dx + dy * dy > rr * rr) continue;
      a.hitCd = 0.7;
      damageAlly(a, (e.dmg || 8) * 0.22 + 2.5);
      if(a.dead) break;
    }
  }
}
