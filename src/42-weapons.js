/* =========================================================
   3. 武器
   ---------------------------------------------------------
   每把武器 = 独立机制 + 标签 + 4 张改造卡（Lv2 / Lv4 各选 1）。
   改造卡是通用的攻击修饰器（散射/穿透/点燃/爆裂/分裂…），
   所以同一把飞拖鞋这局可能是散射流，下局是点燃爆炸流。
   Lv5 觉醒：在已选改造的基础上再上一档。
   ========================================================= */

/* ---------------- 通用改造卡 ---------------- */
const MODS = {
  scatter: { name:'散射', desc:'扇形 5 连发（单发 50% 伤害）' },
  pierce:  { name:'穿透', desc:'穿透 +1' },
  bounce:  { name:'弹跳', desc:'命中后弹向附近敌人 +3 次' },
  blast:   { name:'爆裂', desc:'命中时炸开（25% 伤害）' },
  burn:    { name:'点燃', desc:'命中附加燃烧' },
  chill:   { name:'冰缓', desc:'命中附加冰缓' },
  venom:   { name:'淬毒', desc:'命中附加中毒' },
  volt:    { name:'感电', desc:'命中附加感电' },
  haste:   { name:'加速', desc:'冷却 -20%' },
  heavy:   { name:'重击', desc:'伤害 +22%，击退更强' },
  split:   { name:'分裂', desc:'命中后分裂出 3 枚子弹' },
  echo:    { name:'回响', desc:'50% 概率连发两次' },
  crit:    { name:'锐利', desc:'暴击率 +15%，暴击伤害 +40%' },
  size:    { name:'膨胀', desc:'攻击范围 +25%' },
  count:   { name:'增殖', desc:'数量 +1~3（视武器而定）' },
  knock:   { name:'冲击', desc:'击退大幅提升，命中有概率眩晕' },
  reach:   { name:'延伸', desc:'挥击 / 爆炸范围 +25%' },
  /* ---- 机制型改造：改变打法，不只是加数字 ---- */
  overload:{ name:'过载', desc:'不停手就一直叠，每层 +12% 伤害（最多 5 层），2 秒不命中清零' },
  shatter: { name:'碎冰', desc:'命中被冻住 / 冰缓的目标时，把冰打碎造成 1.7 倍爆裂伤害' },
  spread:  { name:'蔓延', desc:'命中的燃烧 / 中毒会传给附近 2 个敌人' },
  detonate:{ name:'引爆', desc:'命中带状态的敌人时消耗状态，造成 2.4 倍伤害' },
  chainkill:{ name:'连锁击杀', desc:'击杀时向最近的敌人弹射一次（60% 伤害）' },
  momentum:{ name:'惯性', desc:'站定 0.5 秒后伤害 +25%，一移动就失效' },
  combo:   { name:'连打', desc:'攻击间隔 -18%，连击更快' },
  bleed:   { name:'割裂', desc:'命中附加流血（持续掉血）' },
  swift:   { name:'疾走', desc:'召唤物 / 本体移速 +25%' },
  flank:   { name:'双翼', desc:'发射时向左右各再加一发弹道' },
  /* ---- 3.0 资源型改造：把一把武器接到怒气 / 充能 / 血肉线上 ---- */
  ragefuel:{ name:'蓄怒', desc:'这把武器的命中额外 +80% 怒气获取' },
  chargeup:{ name:'蓄能', desc:'这把武器的命中额外 +100% 充能获取' },
  bloodpact:{ name:'血契', desc:'命中附加 0.5% 最大生命的真实伤害（无视护甲，每 0.12 秒一次）' },

  /* ---- 条件型改造：不再是"再多加一点伤害" ----
     它们让同一把武器在不同局面下的表现完全不同：
     打小怪、打大怪、贴脸、远程，该拿的卡不是同一张。 */
  opener:  { name:'先手',   desc:'对满血目标伤害 +80%（开局与非满血残兵是两种手感）' },
  execute: { name:'处决',   desc:'对生命低于 35% 的目标伤害 +70%' },
  longshot:{ name:'远射',   desc:'距离超过 260 时伤害 +45%' },
  hunter:  { name:'猎杀',   desc:'对 BOSS 与精英伤害 +45%' },
  splash:  { name:'波及',   desc:'命中时对周围 46 范围内其它敌人造成 40% 伤害' },
  mark:    { name:'标记',   desc:'命中给目标挂 8% 易伤，最多叠 3 层（团队增伤）' }
};

const EMPTY_ARR = [];
/* 【3.0 卡池归属】有些武器天生属于某个角色：
     炮台 / 图腾类 → 工程师
     宠物类       → 饲养员
   其他人抽不到，但改造卡与通用遗物还是共享的。
   这样"选角色"真的会改变你这一局能抽到什么。 */
const WEAPON_OWNER = {
  meatmaul:'knight', guillotine:'knight', claymore:'knight',
  hive:'keeper', prism:'ranger', drum:'engineer', ember:'chef',
  crossbow:'ranger', chakram:'ranger', shotgun:'ranger', railgun:'ranger', rain:'ranger',
  cooker:'chef', spatula:'chef',
  turret:'engineer', tesla:'engineer', rocket:'engineer',
  lasertower:'engineer', frosttower:'engineer', minefactory:'engineer',
  pet:'keeper', petbird:'keeper', petcat:'keeper', petslime:'keeper',
  petlizard:'keeper', petpenguin:'keeper', pethamster:'keeper', petbomb:'keeper'
};
function weaponOwner(id){ return WEAPON_OWNER[id] || null; }

/* 【6.0】通用武器收口
   ---------------------------------------------------------
   原来 56 把武器里只有 28 把有归属，另外 28 把对**所有角色**开放。
   结果工程师的池子里 80% 是通用件：他抽不到炮台，却一路拿到泡泡糖和番茄——
   这正是"玩工程师还是拿到一堆跟自己没关系的东西"的根因。

   现在每把通用武器只对 1~2 个角色开放（共 28 把，每个角色 6 把）。
   **不是删武器，是让"选角色"真的决定你能抽到什么。**
   已有武器不受影响；交换 / 改造 / 精炼照常。 */
const GENERIC_FOR = {
  knight:  ['pan', 'bat', 'chainsaw', 'nunchaku', 'pizzacutter', 'bubble'],
  ranger:  ['slipper', 'snipe', 'gun', 'dice', 'boomerang', 'candy'],
  engineer:['mine', 'missile', 'chain', 'beam', 'hole', 'bolt'],
  keeper:  ['banana', 'tomato', 'popcorn', 'aura', 'mop', 'fan'],
  chef:    ['flamer', 'frost', 'ladle', 'cleaver', 'bubble', 'fan']
};
function weaponForChar(id){
  const o = WEAPON_OWNER[id];
  if(o) return o === (CHAR && CHAR.id);
  const list = GENERIC_FOR[CHAR && CHAR.id];
  if(!list) return true;
  return list.indexOf(id) >= 0;
}

function wmods(id){ return (P && P.wmod && P.wmod[id]) || EMPTY_ARR; }

/* 条件型改造的伤害系数。
   放在 42-weapons 里是因为它只跟"哪把武器带了这个改造"有关，
   不改变伤害管线本身的顺序（仍然只乘一次）。 */
function modCondMul(src, e){
  let m = 1;
  if(!e) return m;
  const wm = wmods(src);
  for(let i = 0; i < wm.length; i++){
    const k = wm[i];
    if(k === 'opener'){ if(e.hp >= e.maxHp - 0.01) m *= 1.80; }
    else if(k === 'execute'){ if(e.hp < e.maxHp * 0.35) m *= 1.70; }
    else if(k === 'longshot'){ if(P && dist(P.x, P.y, e.x, e.y) > 260) m *= 1.45; }
    else if(k === 'hunter'){ if(e.big || e.elite) m *= 1.45; }
    else if(k === 'mark'){ if((e.markT || 0) > 0) m *= 1 + 0.08 * Math.min(3, e.markN || 1); }
  }
  return m;
}
function hasMod(id, m){ const a = wmods(id); for(let i = 0; i < a.length; i++) if(a[i] === m) return true; return false; }

/* =========================================================
   分支觉醒
   ---------------------------------------------------------
   原来的 Lv5 觉醒是"一把武器只有一种未来"。现在角色的起始武器
   到 Lv5 时二选一：两条路线改变的是**怎么打**，不是加多少伤害。
   A 路线 = 保留原来的觉醒行为；B 路线关掉原行为，换成另一种打法。
   ========================================================= */
const BRANCHES = {
  slipper: [
    { id:'A', name:'巨型拖鞋', desc:'穿透 +2，每次命中都炸开',
      mods:['pierce', 'blast'] },
    { id:'B', name:'弹射拖鞋', desc:'弹跳 +3、25% 连发；放弃穿透与爆裂',
      mods:['bounce', 'echo'], noEvo:true, cd:0.90 }
  ],
  pan: [
    { id:'A', name:'巨锅', desc:'挥击从扇形变成整整一圈',
      mods:[] },
    { id:'B', name:'连锅', desc:'冷却 -23%、伤害 -5%；放弃转圈',
      mods:['combo'], noEvo:true, dmg:0.95, cd:0.70 }
  ],
  turret: [
    { id:'A', name:'要塞模式', desc:'炮台改双管，并附带爆裂',
      mods:[] },
    { id:'B', name:'蜂群', desc:'弹道 +1、冷却 -17%；放弃双管爆裂',
      mods:['count', 'haste'], noEvo:true, cd:0.85 }
  ],
  pet: [
    { id:'A', name:'兽王', desc:'三只一起上，死亡时必定爆炸',
      mods:[] },
    { id:'B', name:'狼群', desc:'狗狗移速 +50%、伤害 +15%；放弃死亡爆炸',
      mods:[], noEvo:true, dmg:1.15, flag:'packSpeed' }
  ],
  flamer: [
    { id:'A', name:'龙息', desc:'火舌变成一片持续燃烧的火墙',
      mods:[] },
    { id:'B', name:'冰焰', desc:'附带冰缓，自己能搓融化；伤害 -10%',
      mods:['chill'], noEvo:true, dmg:0.90 }
  ],
  dice: [
    { id:'A', name:'双倍', desc:'摇到 6 就炸开',
      mods:[] },
    { id:'B', name:'常胜', desc:'押注 90% 是增益，但伤害增幅 -30%',
      mods:[], noEvo:true, dmg:1.05, flag:'luckyGamble' }
  ]
};

function branchOf(id, bid){
  const arr = BRANCHES[id];
  if(!arr) return null;
  for(let i = 0; i < arr.length; i++) if(arr[i].id === bid) return arr[i];
  return null;
}
/* 武器在 lv>=5 时是否吃"原来的单一觉醒"；选了 B 路线就关掉 */
function evoOn(w, lv){
  if(lv < 5) return false;
  const id = w && w.id;
  const bid = (P && P.evoB) ? P.evoB[id] : null;
  if(bid){
    const b = branchOf(id, bid);
    if(b && b.noEvo) return false;
  }
  return true;
}

/* 改造卡对伤害 / 冷却的乘区 */
/* ---------------------------------------------------------
   武器强度校准（两层）
   ---------------------------------------------------------
   1) 曲线压缩 normalizeWeaponCurves()
      原来自各武器的伤害是 a + b*lv + c*lv²，有的 Lv1→Lv5 涨 100 倍、
      有的只涨 3 倍。这里统一压到 1 → 3.2 倍：
      "每级变强"由数量和冷却承担，"单发变强"不再失控。
   2) 全局缩放 + 每把武器的轻微修正 BALANCE
      GLOBAL_DMG 把单发数字拉到合理量级（几十，而不是几百上千），
      BALANCE 只做 0.5~2 倍的小修正，不再出现 27 倍的极端值。
   --------------------------------------------------------- */
const GLOBAL_DMG = 0.45;

/* ---------------------------------------------------------
   3.0 武器校准表（全部由 tools/weapondps.mjs 实测反推）
   ---------------------------------------------------------
   2.x 的 BALANCE 是空的：42 把武器的单发伤害、冷却、命中数
   各写各的，实测同等级"群体 DPS"从 113 到 13,788，差 122 倍。
   玩家感受到的不是"武器有特色"，而是"抽到某几把就赢，抽到其它的就废"。

   这里按**角色定位**给每把武器一个目标 DPS，再反推 s 系数：
     群体型（喷火 / 番茄 / 拖鞋 / 平底锅）  ≈ 3,200 ~ 3,800
     单体型（狙击 / 机枪 / 射线 / 电链）    ≈ 2,600 ~ 3,200（打 BOSS 有额外价值）
     召唤型（炮台 / 宠物）                 ≈ 2,600 ~ 3,000（同时提供挡刀与仇恨）

   k 保持 1：等级曲线由 normalizeWeaponCurves 负责，
   校准只调"这一把武器整体有多强"，不改变它的成长手感。
   改完必须重跑 weapondps 复核，不要凭感觉手改。
   --------------------------------------------------------- */
const BALANCE = {
  meatmaul:   { s:2.95, k:1.00 },
  guillotine: { s:1.42, k:1.00 },

  /* --- 4.0 新武器（实测 weapondps 反推） --- */
  hive:       { s:2.00, k:1.00 },
  prism:      { s:1.40, k:1.00 },
  drum:       { s:1.20, k:1.00 },
  ember:      { s:1.50, k:1.00 },
  claymore:   { s:1.15, k:1.00 },

  /* --- 3.2 角色专属 --- */
  /* --- 游侠新武器 --- */
  shotgun:    { s:0.66, k:1.00 },
  railgun:    { s:0.76, k:1.00 },
  rain:       { s:1.30, k:1.00 },
  crossbow:   { s:0.80, k:1.00 },
  chakram:    { s:0.81, k:1.00 },
  cooker:     { s:0.45, k:1.00 },
  spatula:    { s:1.15, k:1.00 },

  /* --- 群体 / 范围 --- */
  flamer:     { s:1.02, k:1.00 },
  candy:      { s:0.31, k:1.00 },
  tomato:     { s:0.33, k:1.00 },
  slipper:    { s:0.34, k:1.00 },
  popcorn:    { s:0.37, k:1.00 },
  nunchaku:   { s:0.37, k:1.00 },
  cleaver:    { s:0.39, k:1.00 },
  pan:        { s:0.59, k:1.00 },
  boomerang:  { s:0.53, k:1.00 },
  mine:       { s:0.54, k:1.00 },
  ladle:      { s:0.40, k:1.00 },
  banana:     { s:0.58, k:1.00 },
  mop:        { s:0.70, k:1.00 },
  pizzacutter:{ s:1.02, k:1.00 },
  bubble:     { s:1.05, k:1.00 },
  chainsaw:   { s:1.90, k:1.00 },
  aura:       { s:1.96, k:1.00 },
  hole:       { s:2.55, k:1.00 },
  bat:        { s:2.39, k:1.00 },
  fan:        { s:4.75, k:1.00 },

  /* --- 单体 / 直伤 --- */
  snipe:      { s:0.47, k:1.00 },
  dice:       { s:0.34, k:1.00 },
  frost:      { s:0.98, k:1.00 },
  missile:    { s:0.82, k:1.00 },
  rocket:     { s:0.83, k:1.00 },
  beam:       { s:0.85, k:1.00 },
  bolt:       { s:0.93, k:1.00 },
  gun:        { s:2.98, k:1.00 },
  chain:      { s:6.09, k:1.00 },

  /* --- 召唤 / 阵地 --- */
  turret:     { s:2.14, k:1.00 },
  lasertower: { s:1.90, k:1.00 },
  frosttower: { s:9.95, k:1.00 },
  minefactory:{ s:2.41, k:1.00 },
  tesla:      { s:5.58, k:1.00 },
  pet:        { s:2.41, k:1.00 },
  petbird:    { s:5.62, k:1.00 },
  petcat:     { s:0.18, k:1.00 },
  petslime:   { s:5.62, k:1.00 },
  petlizard:  { s:0.44, k:1.00 },
  petpenguin: { s:6.77, k:1.00 },
  pethamster: { s:2.36, k:1.00 },
  petbomb:    { s:0.84, k:1.00 }
};

/* 把每把武器的单发伤害成长压平到 1 → 3.2 倍 */
function normalizeWeaponCurves(){
  for(const id in WEAPONS){
    const w = WEAPONS[id];
    if(!w) continue;
    w.id = id;                      /* 分支觉醒要反查武器 id */
    if(BRANCHES[id]) w.branches = BRANCHES[id];   /* 供 UI / 目录导出使用 */
    if(!w.stats || w._norm) continue;
    const raw = w.stats;
    let d1 = 0, d5 = 0;
    try{ d1 = raw(1).dmg || 0; d5 = raw(5).dmg || 0; }catch(e){ continue; }
    if(!(d1 > 0)) continue;
    const ratio = clamp(d5 / d1, 1, 3.2);
    w.stats = function(lv){
      const s = raw(lv);
      s.dmg = d1 * (1 + (ratio - 1) * (lv - 1) / 4);
      return s;
    };
    w._norm = true;
  }
}

function hasSameSchoolRelic(w){
  if(!P || !P.relics) return false;
  for(const rid in P.relics){
    const r = RELICS[rid];
    if(r && r.tags && r.tags.indexOf(w.school) >= 0) return true;
  }
  return false;
}

function wDmgMul(id){
  let m = GLOBAL_DMG;
  if(hasMod(id, 'heavy')) m *= 1.22;
  const b = BALANCE[id];
  if(b){
    const lv = (P && P.weapons && P.weapons[id]) ? P.weapons[id] : 1;
    m *= b.s * Math.pow(b.k, lv - 1);
  }
  if(P && P.wevo && P.wevo[id]) m *= 1.35;   /* 进化：+35% 伤害 */
  /* 分支觉醒自带的乘区 */
  if(P && P.evoB && P.evoB[id]){
    const b = branchOf(id, P.evoB[id]);
    if(b && b.dmg) m *= b.dmg;
  }
  /* 【抄 Vampire Survivors 的 Limit Break】满级之后还能继续精炼 */
  if(P && P.refine && P.refine[id]) m *= 1 + 0.10 * P.refine[id];
  return m;
}

function wCdMul(id){
  let m = 1;
  if(hasMod(id, 'haste')) m *= 0.80;
  if(P && P.wevo && P.wevo[id]) m *= 0.85;   /* 进化：冷却 -15% */
  if(P && P.evoB && P.evoB[id]){
    const b = branchOf(id, P.evoB[id]);
    if(b && b.cd) m *= b.cd;
  }
  return m;
}
/* 每个流派固定能抽到的两张"机制型"改造卡 —— 保证升级不只是加数字 */
const SCHOOL_MODS = {
  melee:   ['execute', 'shatter'],
  barrage: ['overload', 'longshot'],
  pierce:  ['opener', 'chainkill'],
  blast:   ['splash', 'spread'],
  fire:    ['detonate', 'spread'],
  ice:     ['shatter', 'spread'],
  volt:    ['chainkill', 'overload'],
  venom:   ['spread', 'detonate'],
  beast:   ['hunter', 'mark'],
  fort:    ['overload', 'chainkill'],
  crit:    ['execute', 'hunter'],
  orbit:   ['overload', 'shatter']
};

/* 改造卡带来的额外元素（近战 / 炮台 / 光环走这条） */
function modElems(id){
  const out = [];
  if(hasMod(id, 'burn')) out.push('fire');
  if(hasMod(id, 'chill')) out.push('ice');
  if(hasMod(id, 'venom')) out.push('venom');
  if(hasMod(id, 'volt')) out.push('volt');
  return out;
}

/* 投射物统一入口：改造卡在这里生效，武器自己只管"发一颗" */
function addBullet(b){
  const src = b.src;
  if(!b.dmg) b.dmg = 1;
  b.dmg *= wDmgMul(src);
  if(hasMod(src, 'pierce')) b.pierce = (b.pierce || 0) + 1;
  if(hasMod(src, 'bounce')) b.bounces = (b.bounces || 0) + 2;
  if(hasMod(src, 'blast')){
    b.boom = Math.max(b.boom || 0, 22);
    b.boomMul = Math.max(b.boomMul || 0, 0.25);
  }
  if(hasMod(src, 'split')) b.split = (b.split || 0) + 3;
  if(hasMod(src, 'size')) b.r = (b.r || 4) * 1.25;
  /* 「双翼」：发射瞬间左右各多一发，屏幕上立刻变宽。
     直接 push，不再走 addBullet，避免改造叠加时无限递归。 */
  if(hasMod(src, 'flank') && !b._flank){
    const sp0 = Math.hypot(b.vx || 0, b.vy || 0);
    if(sp0 > 1){
      const a0 = Math.atan2(b.vy, b.vx);
      for(let k = -1; k <= 1; k += 2){
        const a = a0 + k * Math.PI / 2;
        bullets.push(Object.assign({}, b, {
          vx: Math.cos(a) * sp0, vy: Math.sin(a) * sp0,
          dmg: b.dmg * 0.8, rot: a, _flank: true,
          hitSet: new Set(), hitCount: 0, trav: 0
        }));
      }
    }
  }
  if(hasMod(src, 'heavy')) b.knock = (b.knock || 0) + 16;
  const el = modElems(src);
  if(el.length){
    if(!b.elem) b.elem = [];
    for(let i = 0; i < el.length; i++) if(b.elem.indexOf(el[i]) < 0) b.elem.push(el[i]);
  }
  if(b.elem && b.elem.length && P) P.lastElem = b.elem[0];
  if(hasMod(src, 'scatter')){
    /* 散射是"看得见的爽"：从原来左右各一发（3 连）改成扇形 5 连。
       单发伤害压到 72%，但屏幕上直接多出一片弹幕——这是玩家能立刻感知的变化，
       比任何 +% 都直观。 */
    const sp = Math.hypot(b.vx || 0, b.vy || 0);
    if(sp > 1){
      const a0 = Math.atan2(b.vy, b.vx);
      for(let k = -2; k <= 2; k++){
        if(k === 0) continue;
        const a = a0 + k * 0.17;
        bullets.push(Object.assign({}, b, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          dmg: b.dmg * 0.50, rot: a,
          hitSet: new Set(), hitCount: 0, trav: 0
        }));
      }
      b.dmg *= 0.50;
    }
  }
  if(bullets.length > 500) return null;
  bullets.push(b);
  return b;
}

/* 近战 / 光环 / 炮台的命中附加（元素 + 爆裂） */
function hitMods(e, src, dmg){
  const el = modElems(src);
  /* 【2.6】走 elemOnHit 统一入口：一次命中最多挂 1 种元素。
     原来这里是 for 循环把改造过的元素全挂上，"一发命中直接凑齐所有反应对"，
     玩家看到的就是"元素只要触发一次就全触发"。 */
  if(el.length) elemOnHit(e, el, dmg * 0.22, src);
  if(hasMod(src, 'heavy') && !e.big){
    const a = Math.atan2(e.y - P.y, e.x - P.x);
    e.x += Math.cos(a) * 14; e.y += Math.sin(a) * 14;
  }
}

/* ---------------- 武器表 ---------------- */
const WEAPONS = {

  /* ============ 3.2 角色专属武器 ============
     每把都只有一个角色能抽到（WEAPON_OWNER），
     并且围绕该角色的专属资源 / 流派设计，而不是"通用武器换个名字"。 */

  /* ---- 游侠 · 连发弩：给「充能」一个高频来源 ---- */
  crossbow: {
    name:'连发弩', school:'barrage', blurb:'三连穿透弩矢。超载期间改成整圈齐射。',
    color:'#8fe8ff', icon:'crossbow', max:5,
    tags:['proj', 'pierce', 'multi', 'rapid'],
    mods:['pierce', 'count', 'haste', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', count:'连发' },
    stats: lv => ({
      dmg: 22 + 10*lv + 2.8*lv*lv,
      cd: Math.max(0.40, 0.92 - 0.09*lv),
      count: 2 + Math.floor(lv * 0.8)
    }),
    awaken:'暴雨弩：连发 +2、穿透 +2',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      /* 【3.6】补上 ST.multi。
         游侠的角色描述写的是"所有投射类武器额外 +1 弹道"，
         但它的两把专属武器（连发弩 / 回旋轮）当初漏了这一项——
         通用武器（飞拖鞋、番茄酱…）都吃到了，唯独专属不吃。
         结果就是"抽到本命武器反而不涨"：实测游侠 4 分钟输出
         652，只有骑士 1028 的 63%，一半锅在这个加号的缺失上。 */
      const n = s.count + ST.multi + (evo ? 2 : 0);
      const R = wRange(400, lv);
      /* 【4.1】超载**不再改写弹道**。
         ---------------------------------------------------------
         原来超载窗口里连发弩会从"扇形"变成"整圈"：视觉上很热闹，
         但同一份伤害被摊到 360°，单体输出其实**掉了**——
         一个"大招"反而让你打 BOSS 更慢，玩家只会觉得莫名其妙。
         超载现在只做两件不改变弹道的事：冷却减半 + 全武器齐射一轮。 */
      const tgt = nearestEnemy(P.x, P.y, R);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      for(let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.14;
        addBullet({
          type:'shot', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          r: 4, dmg: s.dmg, life: 0.72,
          pierce: 2 + (evo ? 2 : 0) + Math.min(4, ST.pierce),
          hitCount: 0, hitSet: new Set(),
          rot: a, spin: 0, col: '#8fe8ff', src: 'crossbow', range: R
        });
      }
      sfx('shoot');
    }
  },

  /* ============ 游侠的三把新武器 ============
     用户的原话："一共就几把武器可选，把把都差不多，
     强化也无外乎加加弹道和穿透。"
     这三把不是"再加一条弹道"，而是三种完全不同的开火方式：
       霰弹筒  贴脸才有全额伤害 —— 逼你往怪堆里钻
       轨道钉  一次一发、慢、穿透全场 —— 逼你瞄准、走位找角度
       铅笔雨  打的是"落点区域"而不是"方向" —— 逼你预判刷新点
     ============================================ */

  /* ---- 霰弹筒：近距离扇形喷射，距离越远越散 ---- */
  shotgun: {
    name:'霰弹筒', school:'barrage', blurb:'贴脸喷一片。射程短，但近距离没有武器比它更疼。',
    color:'#ffb066', icon:'fan', max:5,
    tags:['proj', 'multi', 'close'],
    mods:['scatter', 'heavy', 'burn', 'execute'],
    labels:{ dmg:'单颗伤害', cd:'冷却', count:'弹丸数' },
    stats: lv => ({
      dmg: 13 + 5.5*lv + 1.4*lv*lv,
      cd: Math.max(0.55, 1.45 - 0.16*lv),
      count: 4 + Math.floor(lv * 1.2)
    }),
    awaken:'双管霰弹：弹丸 +4，命中附带爆裂',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + (evo ? 4 : 0) + ST.multi;
      const R = wRange(210, lv);
      const tgt = nearestEnemy(P.x, P.y, R);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      for(let i = 0; i < n; i++){
        const a = base + rand(-0.34, 0.34);
        addBullet({
          type:'shot', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * rand(520, 660), vy: Math.sin(a) * rand(520, 660),
          r: 3.5, dmg: s.dmg, life: 0.34,
          pierce: 1, hitSet:new Set(), hitCount:0, rot:a, spin:0,
          col:'#ffb066', src:'shotgun', range: R,
          boom: evo ? 18 : 0, boomMul: evo ? 0.30 : 0
        });
      }
      /* 开火后座：把玩家往后推一点。贴脸武器总得有代价 */
      P.x = clamp(P.x - Math.cos(base) * 6, 14, ARENA.w - 14);
      P.y = clamp(P.y - Math.sin(base) * 6, 14, ARENA.h - 14);
      sfx('pop');
    }
  },

  /* ---- 轨道钉：极慢、极高伤、穿透全场的一根钉子 ---- */
  railgun: {
    name:'轨道钉', school:'pierce', blurb:'慢速充能，一发穿透整条线。打的是角度，不是频率。',
    color:'#8fe8ff', icon:'pierce', max:5,
    tags:['proj', 'pierce', 'heavy'],
    mods:['pierce', 'crit', 'hunter', 'opener'],
    labels:{ dmg:'钉伤', cd:'冷却', count:'钉数' },
    stats: lv => ({
      dmg: 90 + 40*lv + 16*lv*lv,
      cd: Math.max(0.85, 2.00 - 0.23*lv),
      count: 1 + Math.floor(lv / 2)
    }),
    awaken:'贯穿：钉子命中后向两侧各弹一发 60% 的副钉',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = wRange(620, lv);
      const tgt = nearestEnemy(P.x, P.y, R);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      const n = s.count + (evo ? 1 : 0);
      for(let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.09;
        addBullet({
          type:'rail', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 760, vy: Math.sin(a) * 760,
          /* 【6.0】原来是 99（无限穿），穿透属性对它完全无效。
             改成 4 + 属性，既保留"贯穿一条线"的身份，也让「穿透 +1」有收益。 */
          r: 8, dmg: s.dmg, life: 1.10, pierce: 4 + Math.min(8, ST.pierce),
          hitSet:new Set(), hitCount:0, rot:a, spin:0,
          col:'#cdf6ff', src:'railgun', range: R, trail: true,
          onHitSide: evo ? 0.60 : 0
        });
      }
      if(rings.length < 30) rings.push({ x:P.x, y:P.y, r0:3, r1:22, life:0.14, max:0.14, col:'#cdf6ff', w:2 });
      state.shake = Math.max(state.shake, 1.4);
      sfx('shoot');
    }
  },

  /* ---- 铅笔雨：不看方向，打"一片区域" ---- */
  rain: {
    name:'铅笔雨', school:'barrage', blurb:'在最近的敌人头顶落下一阵笔尖。范围伤害，不需要瞄准。',
    color:'#c9d4e2', icon:'snipe', max:5,
    tags:['proj', 'aoe', 'multi'],
    mods:['size', 'burn', 'splash', 'haste'],
    labels:{ dmg:'单支伤害', cd:'冷却', count:'落点' },
    stats: lv => ({
      dmg: 24 + 11*lv + 2.6*lv*lv,
      cd: Math.max(1.0, 2.2 - 0.20*lv),
      count: 3 + Math.floor(lv * 0.8)
    }),
    awaken:'笔冢：落点 +3，每支笔落地后再炸开一小圈',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + (evo ? 3 : 0) + Math.floor(ST.multi / 2);
      const R = wRange(420, lv);
      for(let i = 0; i < n; i++){
        const tgt = nearestEnemy(P.x + rand(-140, 140), P.y + rand(-140, 140), R);
        const bx = clamp((tgt ? tgt.x : P.x + rand(-120, 120)) + rand(-26, 26), 10, ARENA.w - 10);
        const by = clamp((tgt ? tgt.y : P.y + rand(-120, 120)) + rand(-26, 26), 10, ARENA.h - 10);
        addBullet({
          type:'rain', x:bx + rand(-8, 8), y:by - 150,
          vx: rand(-14, 14), vy: 640,
          r: 6, dmg: s.dmg, life: 0.42, pierce: 1,
          hitSet:new Set(), hitCount:0, rot: Math.PI / 2, spin:0,
          col:'#c9d4e2', src:'rain', range: R,
          boom: evo ? 26 : 0, boomMul: evo ? 0.35 : 0
        });
      }
      sfx('shoot');
    }
  },

  /* ---- 游侠 · 回旋轮：去程刮一遍、回程再刮一遍 ---- */
  chakram: {
    name:'回旋轮', school:'barrage', blurb:'甩出去、绕回来。回程伤害更高。',
    color:'#ffc46b', icon:'boomerang', max:5,
    tags:['proj', 'return', 'multi'],
    mods:['bounce', 'pierce', 'haste', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', count:'数量' },
    stats: lv => ({
      dmg: 26 + 12*lv + 3.4*lv*lv,
      cd: Math.max(0.50, 1.10 - 0.11*lv),
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'千刃回旋：一次三枚，回程伤害 ×2',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      /* 【3.6】同连发弩：专属武器必须吃到游侠的 +1 弹道 */
      const n = s.count + ST.multi + (evo ? 2 : 0);
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : rand(0, TAU);
      for(let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.45;
        addBullet({
          type:'boomerang', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
          /* 【6.0 修复】原来 pierce 写死 99 = 无限穿透，于是"穿透 +1"对它是废属性，
             贯穿衰减也整段跳过（代码里 pierce===99 直接免疫）。
             现在：底子能穿 3 个，穿透属性再往上加，飞满射程再掉头。 */
          r: 6, dmg: s.dmg, life: 2.6, pierce: 3 + Math.min(6, ST.pierce), hitCount: 0, trav: 0,
          hitSet: new Set(), rot: a, spin: 18, col: '#ffc46b', src: 'chakram',
          range: wRange(320, lv), back: 0.9, backMul: evo ? 2.0 : 1.55, boom: 0
        });
      }
      sfx('whoosh');
    }
  },

  /* ---- 厨师 · 高压锅：焖一下再炸，顺手引爆身上的元素 ---- */
  cooker: {
    name:'高压锅', school:'blast', blurb:'扔出去焖半秒再炸，把敌人身上的元素一起点着。',
    color:'#ff8a3d', icon:'pot', max:5,
    tags:['blast', 'elem', 'fire'],
    mods:['blast', 'size', 'burn', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', count:'锅数' },
    stats: lv => ({
      dmg: 44 + 24*lv + 7.0*lv*lv,
      cd: Math.max(0.90, 2.10 - 0.22*lv),
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'爆炒：爆炸同时挂上火与冰，强制搓出融化',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = wRange(340, lv);
      const dmg = s.dmg * wDmgMul('cooker');
      for(let i = 0; i < s.count; i++){
        const tgt = i === 0
          ? (nearestBig(P.x, P.y, R) || nearestEnemy(P.x, P.y, R))
          : nearestEnemy(P.x, P.y, R);
        const tx = tgt ? tgt.x + rand(-24, 24) : P.x + rand(-130, 130);
        const ty = tgt ? tgt.y + rand(-24, 24) : P.y + rand(-130, 130);
        strikes.push({ kind:'bomb', x: tx, y: ty, delay: 0.34, max: 0.34,
                       r: 78, dmg: dmg, src:'cooker', seed: 3,
                       col:'#ffb066', elem: evo ? 'hotcold' : null });
      }
      sfx('pop');
    }
  },

  /* ---- 赌徒 · 老虎机：三个图案，三同就是一次大奖 ---- */


  /* ---- 赌徒 · 千术飞牌：暴击时会分裂出一张复制牌 ---- */


  /* ============ 1. 飞拖鞋 ============ */
  slipper: {
    name:'飞拖鞋', school:'barrage', blurb:'丢出拖鞋砸向最近的敌人，可穿透多个目标。',
    color:'#ffc46b', icon:'slipper', max:5,
    tags:['proj', 'pierce', 'crit'],
    mods:['scatter', 'pierce', 'bounce', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', count:'拖鞋数', pierce:'穿透' },
    stats: lv => ({
      dmg: 20 + 8*lv + 2.6*lv*lv,
      cd: Math.max(0.26, 0.72 - 0.06*lv),
      count: 1 + Math.floor((lv - 1) / 2),
      pierce: 1 + Math.floor(lv / 2)
    }),
    awaken:'巨型拖鞋：穿透 4 个，每次命中都炸开',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = Math.max(1, s.count + ST.multi);
      /* 【3.6】试过"多发分散瞄准不同目标"，实测是错的：
         游侠 3 种子均值从 3871 掉到 2573，而且 3 局死 2 局。
         原因很直白——弹道雨露均沾就清不掉**贴脸那只**，
         围上来的怪越积越多。远程要的是"先打死最近的"，
         不是"同时蹭所有怪"。保持扇形集火。 */
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      for(let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.15;
        addBullet({
          type:'slipper', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * (evo ? 330 : 275), vy: Math.sin(a) * (evo ? 330 : 275),
          r: evo ? 9 : 5, dmg: s.dmg * (evo ? 1.35 : 1),
          life: 1.35, pierce: evo ? 4 : s.pierce + ST.pierce,
          range: wRange(evo ? 360 : 290, lv),
          hitCount:0, hitSet:new Set(), rot:a, spin:14,
          boom: evo ? 13 : 0, boomMul: 0.22, col:'#ffc46b', src:'slipper'
        });
      }
      sfx('shoot');
    }
  },

  /* ============ 2. 回旋香蕉 ============ */
  banana: {
    name:'回旋香蕉', school:'orbit', blurb:'贴着身子绕圈，把撞上来的敌人子弹打掉。',
    color:'#ffd83d', icon:'banana', max:5,
    tags:['orbit', 'melee', 'guard'],
    mods:['size', 'burn', 'crit', 'heavy'],
    labels:{ dmg:'伤害', count:'香蕉数', size:'判定', rot:'转速' },
    stats: lv => ({
      dmg: 22 + 12*lv + 4.2*lv*lv,
      count: 1 + Math.floor(lv / 2.5),
      size: 5.6 + lv * 1.1,
      radius: 38,
      rot: 3.0 + lv * 0.42
    }),
    awaken:'双环香蕉：内外两圈反向旋转',
    continuous: true
  },

  /* ============ 3. 弹跳糖果 ============ */
  candy: {
    name:'弹跳糖果', school:'barrage', blurb:'会弹来弹去的糖果，一次打一串敌人。',
    color:'#ff9dc0', icon:'candy', max:5,
    tags:['proj', 'chain', 'bounce'],
    mods:['bounce', 'scatter', 'volt', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', bounces:'弹跳次数' },
    stats: lv => ({
      dmg: 21 + 11*lv + 3.4*lv*lv,
      cd: Math.max(0.36, 1.20 - 0.12*lv),
      bounces: 2 + lv,
      spd: 235
    }),
    awaken:'跳跳糖：每次弹跳都会炸开',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = 1 + ST.multi;
      for(let k = 0; k < n; k++){
        const tgt = nearestEnemy(P.x, P.y);
        const a = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : 0;
        addBullet({
          type:'candy', x:P.x, y:P.y - 2,
          vx: Math.cos(a + k * 0.5) * s.spd, vy: Math.sin(a + k * 0.5) * s.spd,
          r:5, dmg:s.dmg, life:3.8, bounces:s.bounces + ST.pierce,
          range: wRange(320, lv),
          hitSet:new Set(), rot:0, spin:9, boom: evo ? 20 : 0, src:'candy'
        });
      }
      sfx('pop');
    }
  },

  /* ============ 4. 魔法泡泡 ============ */
  bubble: {
    name:'魔法泡泡', school:'blast', blurb:'周期性炸开一圈泡泡，把身边的敌人推开。',
    color:'#7ce3ff', icon:'bubble', max:5,
    tags:['blast', 'knock', 'aoe'],
    mods:['size', 'chill', 'knock', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', radius:'范围', count:'泡泡数' },
    stats: lv => ({
      dmg: 26 + 13*lv + 4.6*lv*lv,
      cd: Math.max(0.80, 1.95 - 0.16*lv),
      radius: 36 + 9*lv,
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'泡泡风暴：连续爆开三波',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const waves = evo ? 3 : 1;
      for(let w = 0; w < waves; w++){
        const delay = w * 0.15;
        const R0 = s.radius * ST.area * (hasMod('bubble','size') ? 1.25 : 1) * (1 + w * 0.16);
        const cnt = s.count + ST.multi - 1;
        for(let k = 0; k < Math.max(1, cnt); k++){
          const ox = k === 0 ? 0 : rand(-24, 24);
          const oy = k === 0 ? 0 : rand(-24, 24);
          const px = P.x + ox, py = P.y + oy;
          if(delay > 0) strikes.push({ kind:'bubble', x:px, y:py, delay, max:delay, r:R0, dmg:s.dmg * wDmgMul('bubble'), seed:rand(0,100), src:'bubble' });
          else bubbleBoom(px, py, R0, s.dmg * wDmgMul('bubble'), 'bubble');
        }
      }
      sfx('bubble');
    }
  },

  /* ============ 5. 番茄酱喷射 ============ */
  tomato: {
    detonates:['fire'],
    name:'番茄酱喷射', school:'fire', blurb:'朝敌人喷出一排番茄酱，近距离很暴力，天生带火。',
    color:'#ff6b6b', icon:'tomato', max:5,
    tags:['proj', 'fire', 'spread'],
    mods:['burn', 'scatter', 'venom', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', count:'酱柱数' },
    stats: lv => ({
      dmg: 16 + 9.5*lv + 3.1*lv*lv,
      cd: Math.max(0.22, 1.00 - 0.11*lv),
      count: 2 + Math.floor(lv * 1.0)
    }),
    awaken:'番茄暴雨：环形 360° 喷射',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi;
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      const full = evo ? TAU : Math.min(1.2, 0.22 + n * 0.06);
      for(let i = 0; i < n; i++){
        const a = evo ? (i / n) * TAU : base + (i / (n - 1 || 1) - 0.5) * full + rand(-0.03, 0.03);
        const sp = rand(255, 330);
        addBullet({
          type:'tomato', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r:4.2, dmg:s.dmg, life: evo ? 0.9 : 1.1,
          range: wRange(230, lv),
          pierce: 1 + ST.pierce, hitCount:0, elem:['fire'],
          hitSet:new Set(), rot:a, spin:0, boom:0, col:'#ff6b6b', src:'tomato'
        });
      }
      sfx('splat');
    }
  },

  /* ============ 6. 闪电泡芙 ============ */
  bolt: {
    detonates:['ice'],
    name:'闪电泡芙', school:'volt', blurb:'天降雷击，随机劈向敌人，落点全带感电。',
    color:'#ffe066', icon:'bolt', max:5,
    tags:['volt', 'aoe', 'strike'],
    mods:['volt', 'size', 'haste', 'bounce'],
    labels:{ dmg:'伤害', cd:'冷却', count:'落雷数' },
    stats: lv => ({
      dmg: 40 + 20*lv + 5.6*lv*lv,
      cd: Math.max(0.90, 2.45 - 0.2*lv),
      count: 1 + Math.floor(lv / 1.8)
    }),
    awaken:'雷神泡芙：落雷连锁，一次劈满全屏',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = wRange(400, lv);
      const cands = enemies.filter(e => !e.dead && dist(P.x, P.y, e.x, e.y) <= R);
      if(!cands.length) return;
      const n = s.count + ST.multi + (evo ? 4 : 0);
      for(let i = 0; i < n; i++){
        const e = pickOne(cands);
        strikes.push({
          kind:'zap', x:e.x, y:e.y, delay:0.16, max:0.16,
          r:(evo ? 30 : 22) * ST.area * (hasMod('bolt','size') ? 1.25 : 1),
          dmg:s.dmg * wDmgMul('bolt') * (evo ? 1.3 : 1), seed:rand(0,100), src:'bolt'
        });
      }
      sfx('zap');
    }
  },

  /* ============ 7. 爆米花炮 ============ */
  popcorn: {
    name:'爆米花炮', school:'blast', blurb:'把爆米花抛出去，落地炸开一大片。',
    color:'#ffe9b8', icon:'popcorn', max:5,
    tags:['blast', 'lob', 'aoe'],
    mods:['size', 'burn', 'count', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', radius:'爆炸范围', count:'爆米花数' },
    stats: lv => ({
      dmg: 36 + 15*lv + 5.4*lv*lv,
      cd: Math.max(1.00, 2.65 - 0.22*lv),
      count: 1 + Math.floor(lv / 2.2),
      radius: 32 + 7*lv
    }),
    awaken:'爆米花雨：一次抛出一大把',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi + (evo ? 5 : 0) + (hasMod('popcorn','count') ? 2 : 0);
      for(let i = 0; i < n; i++){
        const R = wRange(300, lv);
        const tgt = nearestEnemy(P.x, P.y, R);
        const a = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) + rand(-0.5, 0.5) : rand(0, TAU);
        const d = tgt ? Math.min(R, dist(P.x, P.y, tgt.x, tgt.y)) : rand(90, Math.min(210, R));
        strikes.push({
          kind:'bomb', x: clamp(P.x + Math.cos(a) * d, 14, ARENA.w - 14),
          y: clamp(P.y + Math.sin(a) * d, 14, ARENA.h - 14),
          delay:0.42, max:0.42,
          r: s.radius * ST.area * (hasMod('popcorn','size') ? 1.25 : 1),
          dmg: s.dmg * wDmgMul('popcorn'), seed:rand(0,100), src:'popcorn'
        });
      }
      sfx('pop');
    }
  },

  /* ============ 8. 辣椒光环 ============ */
  aura: {
    name:'辣椒光环', school:'fire', blurb:'身边常驻一圈辣味热浪，靠近的敌人持续被烤。',
    color:'#ff8a3d', icon:'aura', max:5,
    tags:['fire', 'melee', 'aura'],
    mods:['size', 'burn', 'venom', 'heavy'],
    labels:{ dmg:'每跳伤害', radius:'光环半径', tick:'跳动间隔' },
    stats: lv => ({
      dmg: 7 + 3.5*lv + 1.0*lv*lv,
      radius: 46 + 8*lv,
      tick: Math.max(0.34, 0.62 - 0.045*lv)
    }),
    awaken:'岩浆领域：范围翻倍，每次跳动把敌人推开',
    continuous: 'aura'
  },

  /* ============ 9. 风车糖 ============ */
  fan: {
    name:'风车糖', school:'barrage', blurb:'以自己为圆心，向四面八方均匀撒糖。',
    color:'#b6f0ff', icon:'fan', max:5,
    tags:['proj', 'multi', 'spread'],
    mods:['count', 'scatter', 'chill', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', count:'糖粒数' },
    stats: lv => ({
      dmg: 9 + 5.2*lv + 1.85*lv*lv,
      cd: Math.max(0.58, 1.15 - 0.10*lv),
      count: 3 + Math.floor(lv * 1.15)
    }),
    awaken:'糖风车：双环交错，前后各来一圈',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = Math.round((s.count + ST.multi + (hasMod('fan','count') ? 3 : 0)));
      const rings = evo ? 2 : 1;
      for(let r = 0; r < rings; r++){
        const off = r * (TAU / n / 2);
        const cnt = Math.round(n * (r === 0 ? 1 : 0.8));
        for(let i = 0; i < cnt; i++){
          const a = off + (i / cnt) * TAU + state.t * (r ? -1.2 : 1.2) * 0.35;
          addBullet({
            type:'candy', x:P.x, y:P.y - 2,
            vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
            r:4.4, dmg:s.dmg, life:1.5, bounces:0, range: wRange(250, lv),
            hitSet:new Set(), rot:0, spin:11, boom:0, col:'#b6f0ff', src:'fan'
          });
        }
      }
      sfx('pop');
    }
  },

  /* ============ 10. 彩虹激光 ============ */
  beam: {
    name:'彩虹激光', school:'pierce', blurb:'锁定最近的敌人，射出一道贯穿一切的激光。',
    color:'#ff7ae0', icon:'beam', max:5,
    tags:['proj', 'pierce', 'beam'],
    mods:['size', 'pierce', 'crit', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', width:'激光宽度', count:'光束数' },
    stats: lv => ({
      dmg: 34 + 19*lv + 5.6*lv*lv,
      cd: Math.max(0.70, 1.32 - 0.12*lv),
      width: 5 + lv * 1.1,
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'彩虹风暴：三束激光扇形同时贯穿',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      const n = evo ? 3 : s.count;
      const R = wRange(380, lv);
      for(let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * (evo ? 0.34 : 0.16);
        fireBeam(P.x, P.y - 2, a, R,
          s.width * ST.area * (hasMod('beam','size') ? 1.25 : 1),
          s.dmg * wDmgMul('beam') * (evo ? 1.1 : 1), 'beam');
      }
      sfx('zap');
    }
  },

  /* ============ 11. 夹心地雷 ============ */
  mine: {
    name:'夹心地雷', school:'blast', blurb:'在脚边埋下软糖地雷，敌人踩上就炸。',
    color:'#ff5f8f', icon:'mine', max:5,
    tags:['blast', 'trap', 'turf'],
    mods:['size', 'burn', 'count', 'venom'],
    labels:{ dmg:'伤害', cd:'冷却', radius:'爆炸范围', count:'每次埋设' },
    stats: lv => ({
      dmg: 26 + 13*lv + 3.8*lv*lv,
      cd: Math.max(0.90, 2.0 - 0.16*lv),
      radius: 38 + 6*lv,
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'连锁地雷：一次埋两颗，爆炸后留下火圈',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = (s.count + ST.multi) * (evo ? 2 : 1) + (hasMod('mine','count') ? 1 : 0);
      for(let i = 0; i < n; i++){
        if(mines.length > 60) break;
        mines.push({
          x: clamp(P.x + rand(-16, 16), 16, ARENA.w - 16),
          y: clamp(P.y + rand(-16, 16), 16, ARENA.h - 16),
          r: 15, dmg: s.dmg * wDmgMul('mine'),
          boom: s.radius * ST.area * (hasMod('mine','size') ? 1.25 : 1),
          arm: 0.45, life: 14, seed: rand(0, 10), evo, src:'mine'
        });
      }
      sfx('pop');
    }
  },

  /* ============ 12. 泡泡糖黑洞 ============ */
  hole: {
    name:'泡泡糖黑洞', school:'ice', blurb:'在怪最密的地方拉出黑洞，把周围的敌人往里吸并持续碾压。',
    color:'#b98cff', icon:'hole', max:5,
    tags:['cc', 'gravity', 'aoe'],
    mods:['size', 'chill', 'haste', 'volt'],
    labels:{ dmg:'每跳伤害', cd:'冷却', radius:'引力范围', tick:'跳动间隔' },
    stats: lv => ({
      dmg: 7 + 3.4*lv + 1.0*lv*lv,
      cd: Math.max(3.4, 8.0 - 0.85*lv),
      radius: 48 + 8*lv,
      tick: Math.max(0.22, 0.40 - 0.032*lv)
    }),
    awaken:'双重奇点：一次拉两个，消失时大爆炸',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const cnt = evo ? 2 : 1;
      for(let k = 0; k < cnt; k++){
        if(holes.length > 8) break;
        const tgt = nearestEnemy(P.x, P.y, wRange(340, lv));
        const a = rand(0, TAU);
        const dd = evo ? 80 : 0;
        holes.push({
          x: clamp((tgt ? tgt.x : P.x) + Math.cos(a) * dd, 26, ARENA.w - 26),
          y: clamp((tgt ? tgt.y : P.y) + Math.sin(a) * dd, 26, ARENA.h - 26),
          r: s.radius * ST.area * ST.blast * (hasMod('hole','size') ? 1.25 : 1),
          dmg: s.dmg * wDmgMul('hole'), tick: s.tick, t: 0, life: 2.6, max: 2.6,
          evo, seed: rand(0, 10), src:'hole'
        });
      }
      sfx('bubble');
    }
  },

  /* ============ 13. 电链糖 ============ */
  chain: {
    detonates:['venom'],
    name:'电链糖', school:'volt', blurb:'一道电链在敌人之间来回跳，每跳一次伤害衰减。',
    color:'#8fd8ff', icon:'chain', max:5,
    tags:['volt', 'chain', 'aoe'],
    mods:['bounce', 'volt', 'crit', 'echo'],
    labels:{ dmg:'伤害', cd:'冷却', jumps:'跳跃次数' },
    stats: lv => ({
      dmg: 26 + 13*lv + 3.4*lv*lv,
      cd: Math.max(0.85, 1.95 - 0.19*lv),
      jumps: 3 + Math.floor(lv * 1.3)
    }),
    awaken:'雷网：跳跃次数翻倍，衰减大幅降低',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = wRange(400, lv);
      let cur = nearestEnemy(P.x, P.y, R);
      if(!cur) return;
      const jumped = new Set();
      const jumps = s.jumps + (evo ? s.jumps : 0) + ST.multi + (hasMod('chain','bounce') ? 2 : 0);
      let dmg = s.dmg * wDmgMul('chain');
      let fx = P.x, fy = P.y - 2;
      for(let i = 0; i < jumps; i++){
        if(!cur) break;
        dealDamage(cur, dmg, { src:'chain', elem:'volt' });
        jumped.add(cur.id);
        const ang = Math.atan2(cur.y - fy, cur.x - fx);
        const len = dist(fx, fy, cur.x, cur.y);
        beams.push({ x:fx, y:fy, ang, len, width: evo ? 3 : 2, life:0.14, max:0.14, col:'#9fe8ff', src:'chain' });
        burst(cur.x, cur.y, '#9fe8ff', 4, 80, 0);
        fx = cur.x; fy = cur.y;
        dmg *= evo ? 0.9 : 0.78;
        cur = null;
        let bd = 1e9;
        for(let j = 0; j < enemies.length; j++){
          const e = enemies[j];
          if(e.dead || jumped.has(e.id)) continue;
          if(dist(P.x, P.y, e.x, e.y) > R) continue;
          const dd = dist(fx, fy, e.x, e.y);
          if(dd < (evo ? 260 : 200) && dd < bd){ bd = dd; cur = e; }
        }
      }
      sfx('zap');
    }
  },

  /* ============ 14. 追踪导弹 ============ */
  missile: {
    name:'追踪导弹', school:'blast', blurb:'慢悠悠地自己拐弯找目标，撞上就炸。',
    color:'#ff8f6b', icon:'missile', max:5,
    tags:['proj', 'blast', 'homing'],
    mods:['size', 'burn', 'count', 'split'],
    labels:{ dmg:'伤害', cd:'冷却', count:'导弹数', radius:'爆炸范围' },
    stats: lv => ({
      dmg: 34 + 16*lv + 4.2*lv*lv,
      cd: Math.max(1.05, 2.35 - 0.20*lv),
      count: 1 + Math.floor(lv / 2),
      radius: 30 + 7*lv
    }),
    awaken:'导弹雨：一次三发起跳，爆炸范围大幅提升',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi + (evo ? 2 : 0) + (hasMod('missile','count') ? 2 : 0);
      for(let i = 0; i < n; i++){
        const a = rand(0, TAU);
        addBullet({
          type:'missile', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 85, vy: Math.sin(a) * 85,
          r: 5, dmg: s.dmg, life: 4.4, pierce: 0, homing: 170,
          range: wRange(480, lv),
          boom: s.radius * ST.area * (evo ? 1.35 : 1) * (hasMod('missile','size') ? 1.25 : 1),
          hitSet: new Set(), hitCount: 0, rot: a, spin: 0,
          col:'#ff8f6b', src:'missile'
        });
      }
      sfx('shoot');
    }
  },

  /* ============ 15. 冰霜雪糕 ============ */
  frost: {
    detonates:['fire'],
    name:'冰霜雪糕', school:'ice', blurb:'喷一把冰渣把敌人冻住 —— 伤害很低，但能把一群怪按在原地。',
    color:'#8fe8ff', icon:'frost', max:5,
    tags:['ice', 'cc', 'spread'],
    mods:['chill', 'scatter', 'size', 'venom'],
    labels:{ dmg:'伤害', cd:'冷却', count:'冰渣数', slow:'冻结时长' },
    stats: lv => ({
      dmg: 10 + 4.5*lv + 1.3*lv*lv,
      cd: Math.max(0.50, 1.40 - 0.16*lv),
      count: 3 + Math.floor(lv * 1.4),
      slow: 1.9 + lv * 0.32
    }),
    awaken:'极寒风暴：360° 炸开冰环，全场冻住更久',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi + (evo ? 8 : 0);
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      for(let i = 0; i < n; i++){
        const a = evo ? (i / n) * TAU : base + (i / Math.max(1, n - 1) - 0.5) * 0.95 + rand(-0.05, 0.05);
        addBullet({
          type:'frost', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 215, vy: Math.sin(a) * 215,
          r: 4.5, dmg: s.dmg, life: 0.78, pierce: 2 + ST.pierce,
          range: wRange(205, lv),
          slow: s.slow, hitCount: 0, hitSet: new Set(), elem:['ice'],
          rot: a, spin: 0, col:'#8fe8ff', src:'frost'
        });
      }
      sfx('bubble');
    }
  },

  /* ============ 16. 焦糖机枪 ============ */
  gun: {
    name:'焦糖机枪', school:'barrage', blurb:'死死咬住最近的那只怪，一秒打出好几发。',
    color:'#ffe066', icon:'gun', max:5,
    tags:['proj', 'rapid', 'crit'],
    mods:['crit', 'pierce', 'blast', 'haste'],
    labels:{ dmg:'每发伤害', cd:'冷却', count:'连发数' },
    stats: lv => ({
      dmg: 10 + 6.5*lv + 1.9*lv*lv,
      cd: Math.max(0.28, 0.46 - 0.035*lv),
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'过热机枪：一次三连发，并附带穿透',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi + (evo ? 2 : 0);
      const R = wRange(380, lv);
      const tgt = nearestBig(P.x, P.y, R) || nearestEnemy(P.x, P.y, R);
      if(!tgt) return;
      const base = Math.atan2(tgt.y - P.y, tgt.x - P.x);
      for(let i = 0; i < n; i++){
        const a = base + rand(-0.04, 0.04);
        addBullet({
          type:'shot', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: 3, dmg: s.dmg, life: 0.95, pierce: (evo ? 1 : 0) + ST.pierce,
          range: wRange(380, lv),
          hitSet: new Set(), hitCount: 0, rot: a, spin: 0,
          col:'#ffe066', src:'gun'
        });
      }
      sfx('shoot');
    }
  },

  /* ============ 17. 棒棒糖狙击 ============ */
  snipe: {
    name:'棒棒糖狙击', school:'pierce', blurb:'每两秒给最近的那只怪来一发超痛的穿甲弹。',
    color:'#c7a2ff', icon:'snipe', max:5,
    tags:['proj', 'crit', 'pierce'],
    mods:['crit', 'pierce', 'heavy', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', count:'弹数' },
    stats: lv => ({
      dmg: 120 + 75*lv + 24*lv*lv,
      cd: Math.max(1.05, 2.40 - 0.24*lv),
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'贯穿狙击：一次两发，整条线全穿',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + (evo ? 1 : 0);
      for(let i = 0; i < n; i++){
        const R = wRange(470, lv);
        const tgt = nearestBig(P.x, P.y, R) || nearestEnemy(P.x, P.y, R);
        const ang = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
        const a2 = ang + (n > 1 ? (i - (n - 1) / 2) * 0.12 : 0);
        fireBeam(P.x, P.y - 2, a2, R, (6 + lv) * (hasMod('snipe','size') ? 1.25 : 1),
          s.dmg * wDmgMul('snipe'), 'snipe');
        const bm = beams[beams.length - 1];
        if(bm) bm.col = '#c7a2ff';
      }
      sfx('zap');
    }
  },

  /* ============ 19. 泡泡糖炮台（工程师） ============ */
  turret: {
    name:'泡泡糖炮台', school:'fort', blurb:'在脚边架一座炮台，自动索敌射击。炮台越多，彼此超频越快。',
    color:'#ffe066', icon:'turret', max:5,
    tags:['turret', 'summon', 'proj'],
    mods:['crit', 'burn', 'haste', 'size'],
    labels:{ dmg:'炮台伤害', cd:'部署间隔', dur:'存在时长', count:'每次部署' },
    stats: lv => ({
      dmg: 17 + 9*lv + 2.9*lv*lv,
      cd: Math.max(2.2, 5.6 - 0.55*lv),
      dur: 8 + lv * 1.4,      /* 9+1.6lv → 6+1.1lv：工程师的伤害来自"部署速度"，
                                  炮台覆盖时间太长就等于永久的堡垒 */
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'要塞模式：炮台改为双管并附带爆裂',
    fire(lv){
      const s = this.stats(lv);
      const n = s.count + (hasMod('turret','size') ? 1 : 0);
      for(let k = 0; k < n; k++){
        if(turretCountOf('mg') >= turretLimitOf('mg')) retireOldestTurret('mg');
        deployTurret('mg', P.x + rand(-30, 30), P.y + rand(-30, 30), lv, s.dmg * wDmgMul('turret'), s.dur);
      }
      sfx('pop');
    }
  },

  /* ============ 20. 小狗（饲养员） ============ */
  pet: {
    name:'小狗', school:'beast', blurb:'叫一只小狗跟着你打架。升级后会带来更多不同的小家伙。',
    color:'#8ee6b3', icon:'pet', max:5,
    tags:['summon', 'pet', 'melee'],
    mods:['crit', 'burn', 'haste', 'size'],
    labels:{ dmg:'宠物伤害', cd:'召唤间隔', count:'数量' },
    stats: lv => ({
      dmg: 16 + 9*lv + 3.0*lv*lv,
      cd: Math.max(2.6, 6.0 - 0.6*lv),
      count: 1 + Math.floor(lv / 2)
    }),
    awaken:'兽王：所有宠物变强，死亡时必定爆炸',
    fire(lv){
      const s = this.stats(lv);
      const max = petLimit();
      let alive = 0;
      for(let i = 0; i < allies.length; i++) if(allies[i].kind === 'pet' && !allies[i].dead) alive++;
      const n = Math.min(s.count, max - alive);
      for(let k = 0; k < n; k++) spawnPet(P.x + rand(-24, 24), P.y + rand(-24, 24), lv, s.dmg * wDmgMul('pet'));
      if(n > 0) sfx('pop');
    }
  },

  /* ============ 21. 喷火枪（厨师） ============ */
  flamer: {
    name:'喷火枪', school:'fire', blurb:'朝前方喷出火舌，穿透一串敌人并点燃。',
    color:'#ff8a3d', icon:'jar', max:5,
    tags:['fire', 'proj', 'cone'],
    detonates:['venom'],   /* 火焰引爆中毒：毒爆 */
    mods:['burn', 'venom', 'size', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', count:'火舌数' },
    stats: lv => ({
      dmg: 11 + 6.4*lv + 2.1*lv*lv,
      cd: Math.max(0.26, 0.78 - 0.07*lv),
      count: 3 + Math.floor(lv * 1.05)
    }),
    awaken:'龙息：火舌变成一片持续燃烧的火墙',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi;
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      for(let i = 0; i < n; i++){
        const a = base + rand(-0.26, 0.26);
        addBullet({
          type:'flame', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * rand(180, 260), vy: Math.sin(a) * rand(180, 260),
          r: 7 * (hasMod('flamer','size') ? 1.25 : 1), dmg: s.dmg, life: 0.62,
          pierce: 3 + Math.min(3, ST.pierce), hitCount: 0, hitSet: new Set(), elem:['fire'],
          rot: a, spin: 0, col:'#ff8a3d', src:'flamer', range: wRange(240, lv)
        });
      }
      if(evo && Math.random() < 0.5){
        addHazard(clamp(P.x + Math.cos(base) * 70, 20, ARENA.w - 20),
                  clamp(P.y + Math.sin(base) * 70, 20, ARENA.h - 20), 34, 2.4, 6, true);
      }
      sfx('splat');
    }
  },

  /* ============ 22. 骰子（赌徒） ============ */
  dice: {
    name:'幸运骰子', school:'crit', blurb:'丢出会弹跳的骰子，伤害在 1~6 倍之间乱跳。',
    color:'#ff9dc0', icon:'dice', max:5,
    tags:['crit', 'lucky', 'proj'],
    mods:['crit', 'bounce', 'split', 'haste'],
    labels:{ dmg:'基准伤害', cd:'冷却', count:'骰子数' },
    stats: lv => ({
      dmg: 26 + 14*lv + 4.4*lv*lv,
      cd: Math.max(0.50, 1.30 - 0.13*lv),
      count: 1 + Math.floor(lv / 2)
    }),
    awaken:'豹子：掷出 6 时必定暴击并炸开',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + ST.multi;
      /* 【3.0 修复】原来是"完全随机方向"。玩家一旦拉开距离，骰子全都
         往空地飞，整场打不出伤害（实测 198 秒只有 91 杀）。
         现在第一颗必定朝最近的敌人丢，其余的再随机散开——
         仍然是"乱跳的骰子"，但至少有一发是认真的。 */
      const near = nearestEnemy(P.x, P.y, wRange(360, lv));
      const aim = near ? Math.atan2(near.y - P.y, near.x - P.x) : rand(0, TAU);
      for(let i = 0; i < n; i++){
        const roll = 1 + ((Math.random() * 6) | 0);
        const a = i === 0 ? aim + rand(-0.18, 0.18) : rand(0, TAU);
        addBullet({
          type:'dice', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 280, vy: Math.sin(a) * 280,
          r: 5, dmg: s.dmg * (0.82 + roll * 0.20), life: 2.2,
          bounces: 2 + ST.pierce, hitSet: new Set(), hitCount: 0,
          rot: a, spin: 8, col:'#ff9dc0', src:'dice', range: wRange(360, lv),
          boom: (evo && roll === 6) ? 30 : 0, lucky6: roll === 6, roll
        });
      }
      sfx('pop');
    }
  },

  /* ============ 23. 回旋镖 ============ */
  boomerang: {
    name:'回旋镖', school:'pierce', blurb:'飞出去、绕回来，来回两趟都能刮伤人。',
    color:'#a6ffcb', icon:'boomerang', max:5,
    tags:['proj', 'melee', 'return'],
    mods:['pierce', 'bounce', 'burn', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', count:'数量' },
    stats: lv => ({
      dmg: 24 + 13*lv + 4.0*lv*lv,
      cd: Math.max(0.55, 1.25 - 0.12*lv),
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'千刃回旋：一次三枚，回程时伤害翻倍',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + (evo ? 2 : 0);
      const tgt = nearestEnemy(P.x, P.y);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : rand(0, TAU);
      for(let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.4;
        addBullet({
          type:'boomerang', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          r: 6, dmg: s.dmg,
          /* 【6.0 修复】原来 life 只有 1.5 秒、掉头阈值是射程的 55%（≈165px），
             于是它飞出去不到两百像素就往回拐，两趟速度一样，玩家看到的
             是"丢出去就消失了"。现在：飞满射程再掉头，回程稍快，
             寿命留够一个完整来回。 */
          life: 2.6, pierce: 3 + Math.min(6, ST.pierce), hitCount: 0, trav: 0,
          hitSet: new Set(), rot: a, spin: 16, col:'#a6ffcb', src:'boomerang',
          range: wRange(300, lv), back: 0.9, backMul: evo ? 2.0 : 1.4, boom:0
        });
      }
      sfx('shoot');
    }
  },

  /* ============ 24. 闪电塔 ============ */
  tesla: {
    name:'闪电塔', blurb:'部署一座会连锁放电的塔，多座塔之间会形成电网。',
    color:'#9fe8ff', icon:'coil', max:5, school:'volt',
    tags:['volt', 'turret', 'aoe'],
    mods:['size', 'volt', 'haste', 'crit'],
    labels:{ dmg:'放电伤害', cd:'部署间隔', dur:'存在时长' },
    stats: lv => ({
      dmg: 12 + 6.5*lv + 2.2*lv*lv,
      cd: Math.max(2.8, 6.6 - 0.66*lv),
      dur: 8 + lv * 1.5,
      count: 1
    }),
    awaken:'雷神柱：多建一座，放电跳数翻倍',
    fire(lv){
      const s = this.stats(lv);
      if(turretCountOf('tesla') >= turretLimitOf('tesla')) retireOldestTurret('tesla');
      deployTurret('tesla', P.x + rand(-24, 24), P.y + rand(-24, 24), lv, s.dmg * wDmgMul('tesla'), s.dur);
      sfx('zap');
    }
  },

  /* ============ 25. 火箭炮台 ============ */
  rocket: {
    name:'火箭炮台', blurb:'发射会追踪的火箭，命中炸开一大片。慢，但一炮顶别人三炮。',
    color:'#ff8f6b', icon:'missile', max:5, school:'blast',
    tags:['turret', 'blast', 'aoe'],
    mods:['size', 'burn', 'count', 'haste'],
    labels:{ dmg:'火箭伤害', cd:'部署间隔', dur:'存在时长' },
    stats: lv => ({
      dmg: 26 + 13*lv + 4.4*lv*lv,
      cd: Math.max(3.4, 7.6 - 0.75*lv),
      dur: 9 + lv * 1.5,
      count: 1
    }),
    awaken:'饱和打击：一次部署两座',
    fire(lv){
      const s = this.stats(lv);
      const n = lv >= 5 ? 2 : 1;
      for(let k = 0; k < n; k++){
        if(turretCountOf('rocket') >= turretLimitOf('rocket')) retireOldestTurret('rocket');
        deployTurret('rocket', P.x + rand(-26, 26), P.y + rand(-26, 26), lv, s.dmg * wDmgMul('rocket'), s.dur);
      }
      sfx('shoot');
    }
  },

  /* ============ 26. 激光炮台 ============ */
  lasertower: {
    name:'激光炮台', blurb:'架一座持续照射的激光塔，一条线全穿。',
    color:'#ff7ae0', icon:'spire', max:5, school:'fort',
    tags:['turret', 'pierce', 'beam'],
    mods:['size', 'pierce', 'crit', 'haste'],
    labels:{ dmg:'照射伤害', cd:'部署间隔', dur:'存在时长' },
    stats: lv => ({
      dmg: 9 + 5.2*lv + 1.9*lv*lv,
      cd: Math.max(3.6, 8.2 - 0.8*lv),
      dur: 8 + lv * 1.5,
      count: 1
    }),
    awaken:'棱镜：同时架两座，激光更粗',
    fire(lv){
      const s = this.stats(lv);
      const n = lv >= 5 ? 2 : 1;
      for(let k = 0; k < n; k++){
        if(turretCountOf('laser') >= turretLimitOf('laser')) retireOldestTurret('laser');
        deployTurret('laser', P.x + rand(-28, 28), P.y + rand(-28, 28), lv, s.dmg * wDmgMul('lasertower'), s.dur);
      }
      sfx('zap');
    }
  },

  /* ============ 27. 冰冻炮台 ============ */
  frosttower: {
    name:'冰冻炮台', blurb:'发射冰弹，把一整片敌人按住。配合火箭能打出元素爆破。',
    color:'#8fe8ff', icon:'icetower', max:5, school:'ice',
    tags:['turret', 'ice', 'cc'],
    mods:['size', 'chill', 'count', 'haste'],
    labels:{ dmg:'冰弹伤害', cd:'部署间隔', dur:'存在时长' },
    stats: lv => ({
      dmg: 10 + 5.6*lv + 2.0*lv*lv,
      cd: Math.max(3.2, 7.2 - 0.7*lv),
      dur: 9 + lv * 1.5,
      count: 1
    }),
    awaken:'极寒阵地：一次两座，冰弹范围更大',
    fire(lv){
      const s = this.stats(lv);
      const n = lv >= 5 ? 2 : 1;
      for(let k = 0; k < n; k++){
        if(turretCountOf('frost') >= turretLimitOf('frost')) retireOldestTurret('frost');
        deployTurret('frost', P.x + rand(-26, 26), P.y + rand(-26, 26), lv, s.dmg * wDmgMul('frosttower'), s.dur);
      }
      sfx('bubble');
    }
  },

  /* ============ 28. 地雷工厂 ============ */
  minefactory: {
    name:'地雷工厂', blurb:'自己不断生产地雷撒在周围，人走了雷还在。',
    color:'#ff5f8f', icon:'factory', max:5, school:'fort',
    tags:['turret', 'trap', 'turf'],
    mods:['size', 'count', 'venom', 'haste'],
    labels:{ dmg:'地雷伤害', cd:'部署间隔', dur:'存在时长' },
    stats: lv => ({
      dmg: 16 + 8*lv + 2.6*lv*lv,
      /* 【6.0 修复】原来 Lv3 是 5.85 秒一颗、Lv5 才 4.15 秒，一颗只活 16 秒，
         稳定状态场上只有 2~3 颗雷——比 1 级的夹心地雷还稀疏，
         叫"工厂"名不副实。现在 Lv3 ≈ 2.85 秒、Lv5 ≈ 1.95 秒，
         16 秒寿命下稳定 6~8 颗，才是"人走了雷还在"。 */
      cd: Math.max(1.9, 4.2 - 0.45*lv),
      dur: 10 + lv * 2,
      count: 1 + Math.floor(lv / 3)
    }),
    awaken:'雷场：工厂部署更快，地雷同时存在数翻倍',
    fire(lv){
      const s = this.stats(lv);
      /* 【6.0 修复】原来它 deployTurret('factory', ...)，而 TURRETS 里**没有 factory 这一型**，
         于是掉进 `TURRETS[type] || TURRETS.mg` 的兜底；兜底出来的机枪塔既没有工厂的
         产出逻辑，又因为索敌/冷却字段对不上，整局一场伤害都打不出来
         （funcgate 里它是唯一一把"伤害 0"的武器，而门禁因为"召了一个单位"判它通过）。

         它本来该做的事就写在卡面上：**自己不断生产地雷撒在周围**。
         所以直接走已有的 mines 系统，不再借炮台。 */
      const n = s.count + (hasMod('minefactory', 'count') ? 1 : 0);
      for(let i = 0; i < n; i++){
        if(mines.length > 70) break;
        const ang = rand(0, TAU), rr = rand(10, 52);
        mines.push({
          x: clamp(P.x + Math.cos(ang) * rr, 16, ARENA.w - 16),
          y: clamp(P.y + Math.sin(ang) * rr, 16, ARENA.h - 16),
          r: 15, dmg: s.dmg * wDmgMul('minefactory'),
          boom: (34 + lv * 5) * ST.area * (hasMod('minefactory', 'size') ? 1.25 : 1),
          arm: 0.45, life: s.dur, seed: rand(0, 10), evo:0, src:'minefactory'
        });
      }
      sfx('pop');
    }
  },

  /* =========================================================
     4.0 新武器（每把都挂一条"新机制"或"新交换"）
     ========================================================= */

  /* ---- 蜂巢：给饲养员一条"蚊子"线——伤害低但咬住不放 ---- */
  hive: {
    name:'蜂巢', school:'beast', blurb:'放出机械蜂，自动追着最近的敌人蜇。',
    color:'#ffd166', icon:'comb', max:5,
    tags:['proj', 'summon', 'venom'],
    mods:['count', 'haste', 'venom', 'crit'],
    labels:{ dmg:'蜇伤', cd:'放出间隔', count:'蜂数' },
    stats: lv => ({
      dmg: 15 + 7*lv + 1.8*lv*lv,
      /* 【4.0 复测修正】蜂群原本是"3 只蜂 / 1 秒 / 每只只叮一下"，
         实测总伤害只有同档武器的 1/6 —— 不是"伤害低但黏人"，
         而是根本咬不上。蜂本来就该是"数量压过来"的形状：
         放出更快、蜂更多，并且每只蜂能连刺两个目标（pierce 1）。 */
      cd: Math.max(0.40, 1.15 - 0.13*lv),
      count: 2 + Math.floor(lv * 0.8)
    }),
    awaken:'蜂群：蜂数 +2，被蜇的目标持续中毒',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = s.count + (evo ? 2 : 0) + Math.floor(ST.multi * 0.5);
      for(let i = 0; i < n; i++){
        const a = rand(0, TAU);
        addBullet({
          type:'shot', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
          r: 4, dmg: s.dmg, life: 2.6, pierce: 1,
          homing: 430, hitSet:new Set(), hitCount:0, rot:a, spin:12,
          col:'#ffd166', src:'hive', range: 560,
          bee: true
        });
      }
      sfx('shoot');
    }
  },

  /* ---- 棱镜：先冻住，再自己打碎（利用现成的「引爆」机制） ---- */
  prism: {
    name:'棱镜', school:'pierce', blurb:'一条穿透的棱光，先挂冰缓；下一发会把冰引爆。',
    color:'#9fe8ff', icon:'pierce', max:5,
    tags:['proj', 'pierce', 'ice'],
    mods:['pierce', 'haste', 'chill', 'crit'],
    labels:{ dmg:'光束伤害', cd:'冷却', pierce:'穿透' },
    detonates:['ice'],
    stats: lv => ({
      dmg: 26 + 12*lv + 3.2*lv*lv,
      cd: Math.max(0.42, 1.05 - 0.10*lv),
      pierce: 2 + Math.floor(lv * 0.6)
    }),
    awaken:'冷光：穿透 +3，光束宽度与伤害提高',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = 1 + (ST.multi > 0 ? 1 : 0);
      const R = wRange(520, lv);
      const tgt = nearestEnemy(P.x, P.y, R);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      for(let i = 0; i < n; i++){
        const a = base + (n > 1 ? (i - 0.5) * 0.10 : 0);
        addBullet({
          type:'shot', x:P.x, y:P.y - 2,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          r: evo ? 7 : 5, dmg: s.dmg * (evo ? 1.3 : 1),
          life: 1.0, pierce: s.pierce + (evo ? 3 : 0) + ST.pierce,
          hitSet:new Set(), hitCount:0, rot:a, spin:0,
          col:'#bff0ff', src:'prism', range: R, elem:['ice']
        });
      }
      sfx('shoot');
    }
  },

  /* ---- 雷鼓：以自己为圆心的一圈雷 + 感电 ---- */
  drum: {
    name:'雷鼓', school:'volt', blurb:'以自己为圆心敲一圈雷，命中的敌人都会被感电。',
    color:'#ffe066', icon:'drum', max:5,
    tags:['volt', 'blast', 'aoe'],
    mods:['size', 'volt', 'crit', 'haste'],
    labels:{ dmg:'雷鸣', cd:'敲击间隔', radius:'范围' },
    stats: lv => ({
      dmg: 30 + 14*lv + 3.6*lv*lv,
      cd: Math.max(0.85, 1.9 - 0.17*lv),
      radius: 74 + 7*lv
    }),
    awaken:'雷池：敲击范围 +35%，并留下一圈感电',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = s.radius * ST.area * (evo ? 1.35 : 1);
      /* 【4.2】雷鼓不再消耗灵光（灵光已删除）。它的定位回到"范围感电锤"：
         每次敲击对范围内所有敌人造成雷鸣 + 感电。 */
      const dmg = s.dmg;
      if(rings.length < 34) rings.push({ x:P.x, y:P.y, r0:8, r1:R, life:0.26, max:0.26, col:'#ffe066', w:3 });
      burst(P.x, P.y, '#fff3a8', 10, 150, -0.1);
      eachNear(P.x, P.y, R, function(e){
        if(e.dead) return;
        dealDamage(e, dmg, { src:'drum' });
        applyElem(e, 'volt', 2.2, dmg * 0.22, 'drum');
      });
      addShake(1.2);
      sfx('zap');
    }
  },

  /* ---- 余烬瓶：抛一架燃烧瓶，落点炸开并点燃一片 ---- */
  ember: {
    name:'余烬瓶', school:'fire', blurb:'扔一只燃烧瓶，在落点炸开并点燃。',
    color:'#ff8a3d', icon:'flamer', max:5,
    tags:['blast', 'fire', 'aoe'],
    mods:['size', 'burn', 'blast', 'count'],
    labels:{ dmg:'爆炸', cd:'投掷间隔', radius:'范围' },
    stats: lv => ({
      dmg: 34 + 15*lv + 4.0*lv*lv,
      cd: Math.max(1.0, 2.2 - 0.20*lv),
      radius: 40 + 3.5*lv
    }),
    awaken:'纵火：一次扔两瓶，落点留下一片火',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const n = 1 + (evo ? 1 : 0);
      const R = s.radius * ST.area * ST.blast;
      for(let i = 0; i < n; i++){
        const tgt = nearestEnemy(P.x, P.y, 430);
        const tx = clamp((tgt ? tgt.x : P.x + P.facing * 170) + rand(-26, 26), 20, ARENA.w - 20);
        const ty = clamp((tgt ? tgt.y : P.y) + rand(-26, 26), 20, ARENA.h - 20);
        strikes.push({
          kind:'bomb', x:tx, y:ty, delay:0.30 + i * 0.12, max:0.30 + i * 0.12,
          r: R, dmg: s.dmg * wDmgMul('ember'), src:'ember', seed: rand(0, 100)
        });
        strikes.push({ kind:'ember', x:tx, y:ty, delay:0.31 + i * 0.12, max:0.31 + i * 0.12,
          r: R * 1.1, dmg: s.dmg * 0.42 * wDmgMul('ember'), src:'ember', seed: rand(0, 100) });
      }
      sfx('shoot');
    }
  },

  /* ---- 巨剑：慢、窄、极重。它的价值不在 DPS，在把怪打趴下 ---- */
  claymore: {
    name:'巨剑', school:'melee', blurb:'慢而重的一记竖劈，削韧极高，破韧窗口足够长。',
    color:'#dfe8f5', icon:'star', max:5,
    tags:['melee', 'heavy', 'knock'],
    mods:['heavy', 'reach', 'crit', 'size'],
    labels:{ dmg:'伤害', cd:'冷却', range:'劈砍长度' },
    stats: lv => ({
      /* 【4.0 复测修正】巨剑原本 DPS 只有同档近战的 1/3，
         "用 DPS 换削韧"换得太贵——削韧再强也不该让一件武器打不动怪。
         现在按"每次挥击更贵、但每一记更重"重排：伤害 +25%，冷却 −10%，
         扇形从 54° 放到 60°（重剑本来就该扫一片，而不是戳一只）。 */
      dmg: 150 + 58*lv + 15*lv*lv,
      cd: Math.max(1.05, 1.95 - 0.18*lv),
      range: 84 + 7*lv
    }),
    awaken:'断层：劈出一条冲击波，一路击退',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = s.range * ST.area;
      const tgt = nearestEnemy(P.x, P.y, R * 1.9);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base,
        arc: 1.05, range: R,
        windup: 0.20, active: 0.16, recover: 0.16,
        dmg: s.dmg * wDmgMul('claymore'), src:'claymore', col:'#dfe8f5', lv,
        knock: 22, stun: 0.55, life: 0.04,
        motion:'chop', vis:{ shape:'blade', len:52 }, heavy: true, noFinisher: true
      });
      if(evo){
        strikes.push({ kind:'slam', x:P.x, y:P.y, delay:0.22, max:0.22,
          r: R * 1.5, dmg: s.dmg * 0.5 * wDmgMul('claymore'), waves: 2, src:'claymore' });
        addShake(2.0);
      }
      sfx('whoosh');
    }
  }
};

/* ---------------- 武器槽 ----------------
   开局 1 把，武器位随等级逐步开放。

   【4.1】6 槽 → 4 槽。
   6 槽的问题不是"位子太多"，而是**根本升不满**：
   一局 10 分钟大约 28 次升级，分给 6 把武器，
   每把只能拿到 4~5 张卡，连"Lv4 改造 + Lv5 觉醒"都摸不到，
   于是玩家真正玩到的是"6 把 Lv3 的残废武器"，
   而不是"4 把练满的本命武器 + 一堆改造"。
   4 槽之后：每把武器平均能吃到 7 张卡，改造与觉醒都能落地，
   而且"带哪 4 把"重新变成一个要做的决定。 */
const MAX_SLOTS = 4;
/* 【6.0】槽位等级保持 1 / 5 / 11 / 18
   ---------------------------------------------------------
   试过把第 2 槽从 Lv5 提前到 Lv3，想解决"Lv1~4 只有一把武器"。
   三种子对照：骑士 458s→158s、152s→153s；游侠 158~419s 不变。
   **没有证据表明更早的第二把武器更好**——它挤掉了同一时期的
   武器升级与遗物，等于用"数量"换掉了"质量"。
   在拿到多种子证据之前不改。原样保留。 */
const SLOT_UNLOCK = [1, 5, 11, 18];      /* 第 n 把武器需要的等级 */

function weaponSlots(){
  return Object.keys(P.weapons);
}
function weaponCount(){ return Object.keys(P.weapons).length; }
function hasWeapon(id){ return !!(P && P.weapons[id]); }
function hasMeleeWeapon(){
  if(!P) return false;
  for(const id in P.weapons) if(MELEE[id]) return true;
  return false;
}

/* 改造卡候选：还没选过的卡里随机两张。
   池子 = 武器自己的修饰卡 + 该流派固定提供的两张机制卡，
   保证每次升级都至少有一张是"改变打法"而不是"加数字"。 */
/* 元素类改造卡：只有「元素专精」角色（厨师）能拿到。
   其它角色如果也能随手挂火 / 毒 / 电，那不管起点是什么角色，
   最后都会收敛到「堆反应」这一条路——这正是"所有角色胡法都一样"的根源。
   门禁在这里做，武器自己的元素（喷火枪自带燃烧之类）不受影响。 */
const ELEM_MODS = { burn:1, chill:1, venom:1, volt:1 };
/* 非元素角色的补位池：全是机制 / 数值类，被门禁抽空时用它兜底，
   保证每把武器仍然有 4 张不一样的候选，而不是"没卡可选" */
const NEUTRAL_MODS = ['crit','haste','size','count','heavy','reach','knock',
                      'combo','momentum','overload','split','echo','chainkill','bounce',
                      'ragefuel','chargeup','bloodpact'];

/* 元素卡的出货概率：厨师几乎必出，其它角色低概率但不是 0。
   用"抽卡倾斜"区分角色，而不是"禁止"——别的角色偶尔也能摸到元素，
   只是凑不成整套；这比直接把他们的反应砍半要合理得多。 */
function elemModChance(){
  if(CHAR && CHAR.reactionMaster) return 1.0;
  return 0.30;
}

function modChoices(id){
  const w = WEAPONS[id];
  if(!w) return [];
  const picked = P.wmod[id] || [];
  const allowElem = Math.random() < elemModChance();
  const pool = [];
  const own = w.mods || [];
  for(let i = 0; i < own.length; i++){
    const m = own[i];
    if(picked.indexOf(m) >= 0) continue;
    if(!allowElem && ELEM_MODS[m]) continue;
    pool.push(m);
  }
  const extra = SCHOOL_MODS[w.school] || [];
  for(let i = 0; i < extra.length; i++){
    if(picked.indexOf(extra[i]) < 0 && pool.indexOf(extra[i]) < 0) pool.push(extra[i]);
  }
  /* 投射类流派（弹幕 / 穿甲）额外候选：双翼。
     弹道形态的变化是这类武器最直接的爽点。 */
  if(w.school === 'barrage' || w.school === 'pierce'){
    const extra2 = ['flank'];
    for(let i = 0; i < extra2.length; i++){
      const m = extra2[i];
      if(picked.indexOf(m) < 0 && pool.indexOf(m) < 0) pool.push(m);
    }
  }
  /* 3.0：已经走上某条资源流派时，对应的改造卡才会出现——
     "武器 = 资源泵" 这条路必须抽得到，否则构筑接不起来。 */
  const archMods = [];
  if(archTier('rage') >= 1) archMods.push('ragefuel');
  if(archTier('charge') >= 1) archMods.push('chargeup');
  if(archTier('flesh') >= 1) archMods.push('bloodpact');
  for(let i = 0; i < archMods.length; i++){
    const m = archMods[i];
    if(picked.indexOf(m) < 0 && pool.indexOf(m) < 0) pool.push(m);
  }
  /* 门禁之后池子可能只剩 1 张，补中性卡，保证永远凑得齐 2 个方向 */
  if(!allowElem && pool.length < 2){
    for(let i = 0; i < NEUTRAL_MODS.length && pool.length < 4; i++){
      const m = NEUTRAL_MODS[i];
      if(picked.indexOf(m) < 0 && pool.indexOf(m) < 0) pool.push(m);
    }
  }
  const out = [];
  while(out.length < 2 && pool.length){
    out.push(pool.splice(ri(0, pool.length - 1), 1)[0]);
  }
  /* 厨师保底：只要池子里有元素卡，就一定给一张。
     "更容易抽到相关的东西"要抽得出来才算，不能靠运气。 */
  if(CHAR && CHAR.reactionMaster){
    let has = false;
    for(let i = 0; i < out.length; i++) if(ELEM_MODS[out[i]]) has = true;
    if(!has){
      for(let i = 0; i < pool.length; i++){
        if(ELEM_MODS[pool[i]]){ out[out.length - 1] = pool[i]; break; }
      }
    }
  }
  return out;
}
