/* =========================================================
   6. 状态
   ========================================================= */
let P = null;
let enemies = [], bullets = [], ebullets = [], gems = [], parts = [], texts = [], rings = [], strikes = [], drops = [];
let beams = [], mines = [], hazards = [], holes = [];
let cam = { x: 0, y: 0 };
let ST = {};
let DMG = {};            /* 每个来源造成的累计伤害（结算页统计） */
let SRC = 'misc';        /* 当前伤害来源 */
let uid = 1;

const state = {
  mode: 'title',
  t: 0,
  time: 0,
  kills: 0,
  shake: 0,
  shakeCd: 0,
  hurtFlash: 0,
  flash: 0,
  slow: 0,
  calmT: 99,
  contactFx: 0,
  orbCd: 0,
  contactN: 0,
  spawn: 0.35,
  bossAt: 150,
  bossIdx: 0,
  eliteAt: 70,
  pending: 0,
  dropTimer: 10,
  healBudget: 0,
  act: 1,
  hordeAt: 150,
  /* 【3.6】伤害来源归因：只给审计脚本读，不参与玩法。
     没有这张表就只能看到"总共掉了多少血"，分不清是贴身咬的、弹幕打的还是 BOSS。 */
  dmgSrc: { contact: 0, hit: 0, boss: 0 },
  best: loadBest()
};

function loadBest(){
  try{ return Number(localStorage.getItem('slipper_survivor_best') || 0) || 0; }catch(e){ return 0; }
}
function saveBest(v){
  try{ localStorage.setItem('slipper_survivor_best', String(v)); }catch(e){}
}

/* ---------------------------------------------------------
   属性汇总：角色底子 × 结晶 × 遗物 × 共鸣
   --------------------------------------------------------- */
function getStats(){
  const p = P ? P.passives : {};
  const lv = id => p[id] || 0;
  const S = relicStat();
  const C = CHAR || CHARS.ranger;
  /* 【4.0】护甲：从"百分比相加 + 一个 42% 的硬顶"改成**点数 + 边际递减**。
     ---------------------------------------------------------
     旧写法的病：0.04/级 + 0.03/级 + 角色 3~7% + 遗物 10%×N 直接相加，
     三件装备就顶到 42% 的封顶值，之后所有人再拿护甲都是 0 收益——
     玩家不是"变强变慢了"，是一条路走到某个点直接断掉。
     现在所有来源换算成点数，减伤 = A/(A+58)：
       40 点 → 41%，80 点 → 58%，160 点 → 73%。
     永远在涨，但每一点的收益越来越小，不存在"堆到顶就没事干"。 */
  /* 【4.1】护甲是**全游戏唯一的减伤**，所有防御来源都换算成点数。
     ---------------------------------------------------------
     4.0 时护甲之外还并行着四条免伤（遗物 hurtTaken / 骑士格挡 /
     护盾期减伤 / 宠物挡刀）。玩家看到面板写"护甲 40%"，
     实际却只吃三成伤害——面板和体感永远对不上。
     4.1 把它们全部折算成点数，减伤仍然只有一条曲线 A/(A+58)：
       护甲结晶 / 甲壳结晶 / 铁皮罐头 …  装备
       骑士带近战武器 +7、宠物护卫 +2.1、炮台护卫 +4.6  角色与召唤物
       混沌骰子 −15（诅咒）
     点数没有上限，也没有"堆到某个点就完全没用"。 */
  const armorPts = 0.50 * Math.max(0, (P ? P.level : 1) - 1)
    + 4 * lv('plate') + 3 * lv('shell')
    + (C.armor || 0) * 100 + S.armor
    + (hasMeleeWeapon() ? (C.blockArmor || 3) : 0)
    + guardPtsAll()
    /* 【6.0】石像鬼：贴身越多甲越厚。这不是"隐形的乘数"，
       它读的是 applyContact 每帧已经算好的贴身数量，卡面写的就是这个数。 */
    + (P && relic('gargoyle') ? (state.contactN || 0) * 8 : 0)
    /* 复仇：每损失 10% 最大生命 +4 点（残血才有的坦度） */
    + (P && relic('revenge')
        ? Math.floor((1 - P.hp / Math.max(1, P.maxHp)) * 10) * 4 : 0);
  const armorVal = armorDR(armorPts);
  const maxHpVal = (P && P.maxHp) ? P.maxHp : 200;

  /* ---- 3.0 成长类加成：全部从计数器直接算，不需要每杀一只重算属性 ---- */
  const growBonus =
      (P && P.devour ? P.devour * 0.01 : 0)                    /* 吞噬之心 */
    + (P && P.gemDmg ? P.gemDmg : 0)                            /* 贪婪之卵 */
    + (P && P.growthHp ? P.growthHp * 0.006 : 0)                /* 生长之种 */
    + (P && P.feastHp ? P.feastHp * 0.0002 : 0);                /* 血肉盛宴：每 50 点 +1% */
  /* 血肉增生：每 100 最大生命 +4% 伤害 */
  const fleshMassBonus = relic('fleshmass') ? Math.min(0.28, Math.floor(maxHpVal / 100) * 0.04) : 0;

  const rageTier = archTier('rage');
  const chargeTier = archTier('charge');
  const fleshTier = archTier('flesh');
  const shieldTier = archTier('shield');
  const thornTier = archTier('thorns');
  const beastTier = archTier('beast');
  const sacTier = archTier('sacrifice');
  const barrageTier = archTier('barrage');
  const critTier = archTier('crit');
  const elemTier = archTier('elem');
  const pierceTier = archTier('pierce');
  const turretTier = archTier('turret');
  const gridTier = archTier('grid');
  const heatTier = archTier('heat');
  const freezeTier = archTier('freeze');

  const out = {
    speed: C.speed * (1 + 0.09 * lv('shoe')) * S.speed
           * (relic('syncer') ? Math.max(0.76, 1 - turretCountLive() * 0.04) : 1)
           /* 【3.3】游侠的转速表接上机动性：充能越高跑得越快（最多 +14%）。
              他是全场最脆的角色（265 血 / 3% 护甲），"靠躲不靠血"必须真的成立。
              之前唯一的防御是血条，而血条又被压到最低，等于只削弱没补偿。 */
           * ((C.hasCharge && P && P.charge > 0)
              ? (1 + Math.min(1, P.charge / 100) * 0.14) : 1),
    /* 相位斗篷：闪避成功后的 1.2 秒窗口内冷却 ×0.55 */
    cdMul: Math.pow(0.91, lv('sauce')) * S.cdMul * (P && P.phaseT > 0 ? 0.55 : 1) * (barrageTier >= 1 ? 0.92 : 1)
           * (turretTier >= 3 ? Math.max(0.70, 1 - turretCountLive() * 0.05) : 1)
           * (relic('syncer') ? Math.max(0.72, 1 - turretCountLive() * 0.04) : 1),
    /* 【2.6 平衡】范围整体 ×0.78：AOE 覆盖越大，"怪进不来"就越无解 */
    area: (1 + 0.13 * lv('lens')) * S.area * 0.78,
    range: (1 + 0.14 * lv('reach')) * S.range,
    blast: (1 + 0.13 * lv('blast')) * S.blast * 0.78,
    xpMul: (1 + 0.16 * lv('clover')) * S.xp,
    pickup: 130 + 40 * lv('magnet') + S.pickup,
    /* 【2.6 平衡】全局伤害倍率 1.20 → 0.82。 */
    dmgMul: 0.82 * C.dmg * (1 + 0.11 * lv('glove')) * S.dmg
            * (1 + growBonus + fleshMassBonus
               + (P && P.sacStack ? P.sacStack * 0.02 : 0)
               + (beastTier >= 3 ? petCountLive() * 0.06 : 0)
               + (relic('beastheart') ? petCountLive() * 0.05 : 0)
               /* 【6.0】成长与转化：全部是"看得见的计数 × 一个常数"，
                  没有隐藏系数，卡面写多少就是多少。 */
               + (relic('furnace') ? Math.floor(armorPts / 10) * 0.004 : 0)),
    /* 游侠：所有投射武器常驻 +1 弹道（角色自带的，不需要叠层） */
    multi: lv('multi') + S.multi + (C.projBonus || 0) + (barrageTier >= 2 ? 1 : 0),
    pierce: lv('pierce') + S.pierce + (pierceTier >= 1 ? 1 : 0),
    armor: armorVal,
    /* 护盾上限要用同一条护甲点数（见 41-resources 的 shieldMaxNow） */
    armorPts: armorPts,
    /* 【2.6】暴击率必须有上限：多个来源简单相加会溢出到 1.0 以上。 */
    crit: Math.min(0.95, Math.max(0, C.crit + 0.07 * lv('crit') + 0.03 * lv('luckgem') + S.crit + (P && P.critBonus ? P.critBonus : 0) + (critTier >= 1 ? 0.05 : 0))),
    critMul: C.critMul + 0.26 * lv('critdmg') + 0.20 * lv('razor') + 0.08 * lv('luckgem') + (S.critMul - 1) + (critTier >= 2 ? 0.25 : 0),
    /* 【3.3】角色自带闪避：游侠 5%。"靠躲不靠血"必须写进数值，
       否则调低血量只是单纯削弱，玩家读不到补偿。 */
    /* 【4.0】闪避改成**乘法合并**（见 avoidStack）：多来源不再叠加到 30% 封顶，
       而是各自独立"躲一次"。四个 7% 是 25%，七个是 40%，永远涨、永远不到 100%。 */
    dodge: avoidStack([C.dodge || 0, 0.07 * lv('dodge'), 0.05 * lv('swerve'), S.dodge]),
    /* 反伤：先有来源才有反伤，之后按"最大生命 1.4% + 护甲"跟着进度长。 */
    thorns: (function(){
      let base = 8 * lv('plate') + 14 * lv('thorn') + S.thorns;
      if(C.thornsArmor) base += 12;
      if(base <= 0) return 0;
      return (base + maxHpVal * 0.024 + armorVal * 120
        + (C.thornsArmor ? armorVal * 90 : 0)) * (thornTier >= 1 ? 1.25 : 1);
    })(),
    thornCrit: S.thornCrit || (thornTier >= 2 ? 1 : 0),
    knock: 10,
    luck: (C.luck || 1) + 0.25 * lv('lucky'),
    bossMul: 1 + 0.11 * lv('bossmul'),
    regenLv: lv('regen'),
    regenMul: S.regenMul,
    /* 系统加成 */
    petMul: S.petDmg * (beastTier >= 1 ? 1.15 : 1) * (1 + 0.12 * lv('beastgem')),
    turretRate: S.turretRate * (turretTier >= 2 ? 1.15 : 1),
    elemDur: S.elemDur * (elemTier >= 1 ? 1.25 : 1) * (1 + 0.12 * lv('elemgem')),
    enemySpeed: S.enemySpeed,
    /* 火候：燃烧伤害与持续时间；冷冻：冰伤、冻结目标易伤；电网：感电跳数 */
    burnMul: (heatTier >= 1 ? 1.30 : 1) * (S.burnMul0 || 1),
    /* 冰缓时长倍率：冷冻Ⅰ +30%、冷冻机 +20%。到这里之前它一直是"写了没人读"，
       所以这两条效果等于不存在。 */
    iceMul: (freezeTier >= 1 ? 1.30 : 1) * (S.iceMul0 || 1),
    frozenVuln: (freezeTier >= 3 ? 0.40 : 0),
    heatTier: heatTier,
    freezeTier: freezeTier,
    gridTier: gridTier,
    orbitMul: 1,

    /* ================= 3.0 通用资源 ================= */
    rageGain: (C.rageGain || 1) * (1 + 0.15 * lv('ragegem')) * S.rageGain
              * (rageTier >= 1 ? 1.20 : 1),
    rageDur: Math.max(1.2, RES.berserkBase + (C.berserkBonus || 0) + S.rageDur
              + (rageTier >= 2 ? 1.5 : 0)),
    rageDecay: S.rageDecay,
    berserkDmg: 1.45 + (C.berserkDmg || 0),
    berserkRate: (C.berserkRate || 0.62) * (relic('rageburst') ? 0.90 : 1),
    chargeRate: (1 + 0.15 * lv('chargegem')) * S.chargeRate
              * (chargeTier >= 1 ? 1.25 : 1),
    overloadDur: RES.overloadBase + S.overloadDur,
    shieldMax: (35 * lv('shieldgem') + S.shieldMax) * (shieldTier >= 1 ? 1.25 : 1),
    fleshPct: 0.004 * lv('fleshgem') + S.fleshPct + (fleshTier >= 2 ? 0.01 : 0),
    healMul: S.healMul * (fleshTier >= 3 ? 1.30 : 1),
    killHealMul: S.killHealMul,
    /* 【4.1】新机制相关（破韧已删除，换成冲刺四件套） */
    dashExtra: S.dashExtra || 0,
    dashImpact: S.dashImpact || 0,
    dashCd: (S.dashCd || 1) * Math.pow(0.92, lv('dashgem')),
    dashFlowBonus: S.dashFlowBonus || 0,
    dashDmgBonus: S.dashDmgBonus || 0,
    /* 【6.0】新减伤 / 新条件必须从这里带出来，否则 relicStat 里写了也没人读 */
    flatDR: S.flatDR || 0,
    hitCap: S.hitCap || 0,
    debuffVuln: S.debuffVuln || 0,
    healToDmg: S.healToDmg || 0,
    execMul: S.execMul || 0
  };
  /* 【6.0】三项"转换类"遗物必须等其他字段算完再接，不能写在字面量里互相引用。
     它们都只读 out 上已经存在的值，不引入新公式。 */
  if(P && typeof relic === 'function'){
    /* 疾影：闪避率的 50% 加到暴击率（防御属性接进攻） */
    if(relic('shadowstep')) out.crit = Math.min(0.95, out.crit + out.dodge * 0.5);
    /* 疾行：未受伤时移速 +25%（受伤后 3 秒内失效） */
    if(relic('windward') && state.time - (P.lastHurt || -99) > 3) out.speed *= 1.25;
    /* 惯性：移速超过 110 的部分，每点 +0.8% 伤害 */
    if(relic('inertia')){
      const over = Math.max(0, out.speed - 110);
      out.dmgMul *= 1 + over * 0.008;
    }

    /* 【6.0】铸铁心脏：每 100 最大生命换狂战时长与怒气效率。
       它让"堆血量"在骑士身上直接变成"更长的狂战"，
       而不是只变成一个更厚的血条。 */
    if(relic('ironheart')){
      const k = Math.floor(maxHpVal / 100);
      out.rageGain *= 1 + 0.03 * k;
      out.rageDur += 0.2 * k;
      out.berserkDmg += 0.04 * k;
    }
    /* 千刃：每多一条弹道，暴击率 +4%（弹道越多越准，滚雪球） */
    if(relic('thousandblade')){
      out.crit = Math.min(0.95, out.crit + Math.max(0, out.multi - 1) * 0.04);
    }
    /* 转速表：充能越高冷却越低，最多 -32%。游侠的资源第一次直接接上输出节奏 */
    if(relic('tachometer') && C.hasCharge){
      const c = Math.min(1, (P.charge || 0) / 100);
      out.cdMul *= 1 - 0.32 * c;
    }
    /* BOSS 领域：被压的武器流派伤害 ×0.65（写在卡面 / 提示上，不是隐藏） */
    if(state && state.ban && state.ban.k === 'school') out.banSchool = state.ban.key;

    /* 绝境：残血才给的攻速与移速。高风险，但不是赌博——血条自己看得见 */
    if(relic('laststand') && P.hp < P.maxHp * 0.30){
      out.cdMul *= 0.65;
      out.speed *= 1.12;
    }
  }
  return out;
}

/* 场上存活炮台 / 宠物数量（getStats 里要用，避免循环依赖） */
function turretCountLive(){
  if(typeof allies === 'undefined' || !allies) return 0;
  let n = 0;
  for(let i = 0; i < allies.length; i++) if(!allies[i].dead && allies[i].kind === 'turret') n++;
  return n;
}
function petCountLive(){
  if(typeof allies === 'undefined' || !allies) return 0;
  let n = 0;
  for(let i = 0; i < allies.length; i++) if(!allies[i].dead && allies[i].kind === 'pet') n++;
  return n;
}

/* 【4.1】召唤物的"护卫点数"。
   ---------------------------------------------------------
   旧写法是 min(18, 炮台×4.5) 和 min(8, 宠物×2)：
   多摆一座炮台、多带一只宠物，在某个点之后对生存**完全没有任何意义**。
   现在：
     · 第 k 个护卫给 v/(1+0.38k) 点 —— 越多人分，每个人分到的越少；
     · 炮台只有在**你身边 170px 内**才算（它是阵地，不是随身挂件），
       于是"站在自己阵地里打"变成一个真实的防御决策；
     · 饲养员的宠物是"肉盾"这件事从此有了准确的数值：
       每只给 5 点（其它角色 2.1 点），不再是一个 ×0.72 的隐形乘数。
   全部并入 armorPts，走同一条 armorDR 曲线。 */
function guardPtsAll(){
  if(typeof allies === 'undefined' || !allies || !P) return 0;
  const petEach = (CHAR && CHAR.guardByPets) ? 5.0 : 2.1;
  let kt = 0, kp = 0, sum = 0;
  for(let i = 0; i < allies.length; i++){
    const a = allies[i];
    if(a.dead) continue;
    if(a.kind === 'turret'){
      const dx = a.x - P.x, dy = a.y - P.y;
      if(dx * dx + dy * dy > 170 * 170) continue;
      sum += 4.6 / (1 + 0.38 * kt);
      kt++;
    } else if(a.kind === 'pet'){
      sum += petEach / (1 + 0.42 * kp);
      kp++;
    }
  }
  return sum;
}

/* 射程：基础值 → 随武器等级微涨 → 乘上射程结晶 */
function wRange(base, lv){
  const k = 1 + 0.045 * (Math.max(1, lv || 1) - 1);
  /* 【2.6 平衡】射程整体 ×0.86：场地 1720×1000、视野 640×360，
     原来的射程基本等于"覆盖整个视野"，怪没有接近过程可言。 */
  return base * k * ((ST && ST.range) ? ST.range : 1) * 0.86;
}

/* 升级所需经验 */
function nextXp(lv){
  /* 【2.6 修复】原来只读 P.level。而 resetGame 是在"上一局的 P 还活着"的时候
     就构造新 P 的（xpNext: nextXp() 写在对象字面量里），于是新一局开局
     的经验需求直接沿用上一局 70 级的数值——重开后第一级要几万经验。
     现在允许显式传等级，resetGame 传 1。 */
  const L = lv || (P ? P.level : 1);
  /* 前期便宜（前 10 级节奏快，爽点来得早），12 级之后逐级变贵，
     把一局 30+ 次弹窗压到 18 次左右——升级是决策，不是打扰。 */
  /* 【2.6】后期需求降到原来的约 40%：原来 Lv30→31 要 1.6 万经验，
     而怪物经验倍率 10 分钟只涨 5.5 倍，缺口 5 倍——
     直接后果就是"武器升不满、永远差一两张卡"。 */
  const base = 22 + 14 * L + 3.4 * Math.pow(L, 1.7);
  const late = 1 + Math.max(0, L - 12) * 0.12;
  return Math.round(base * late * 1.25);
}

/* 每次升级 */
function onLevel(){
  /* 每级生命 6 → 13。
     ---------------------------------------------------------
     3.3 把每级生命从 9 砍到 6，理由是"白送生命让敌人平伤失效"。
     那句话在当时的数值下成立，但它建立在**怪物伤害几乎没有成长**之上：
     史莱姆一口 7 点，升一级白送 6 点血当然显得很多。

     上一版把怪物基础伤害提高了 3~4 倍（史莱姆 26、重甲 58），
     并且攻击曲线从 8.65 倍压到 2.45 倍——伤害是真的会长在玩家身上。
     这时候 +6/级就不够了：Lv16 才 396 血，而一口围攻能咬掉 130。
     玩家会死在"血条根本没长起来"上，而不是死在"构筑没成型"上。

     +13/级 对应 Lv30 约 690 血、Lv50 约 950 血，
     配合 2.45 倍的攻击曲线，"一口占多少血"全程稳定在 8%~12%，
     护甲、闪避、治疗才有可以计算的基线。 */
  P.maxHp += 13;
  P.hp = Math.min(P.maxHp, P.hp + 13);
  ST = getStats();
  /* 【抄 DRG: Survivor 的 Overclock】每 5 级白送一个武器改造。
     等级奖励不该只有"多一张卡"，要有一个确定的、越来越强的节奏点。 */
  if(P.level % 8 === 0) grantFreeMod('超频');
  /* 【4.2】护盾不再自然回充。升级只补 20%（不是回满）——
     回满会让高等级工程师变成"每 10 秒一条满盾"，永远打不穿。
     补给要"够用但不无限"，护盾破了才该真的紧张。 */
  if(hasShield() && typeof shieldMaxNow === 'function'){
    P.shield = Math.min(shieldMaxNow(), (P.shield || 0) + shieldMaxNow() * 0.20);
  }
}

/* 随机给一把手上的武器塞一个它还没有的改造 */
function grantFreeMod(tag){
  /* 全局上限 4 个白送改造；单把武器最多 3 条（Lv2 / Lv4 两条 + 最多 1 条额外）。
     不设上限的话，光靠升级和精英就能把一把武器塞成"词条怪"。 */
  P.freeMods = P.freeMods || 0;
  if(P.freeMods >= 4) return;
  const cands = [];
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(!w) continue;
    const own = P.wmod[id] || [];
    const pool = (w.mods || []).concat(SCHOOL_MODS[w.school] || []);
    for(let i = 0; i < pool.length; i++){
      if(own.indexOf(pool[i]) < 0 && cands.indexOf(pool[i]) < 0) cands.push(pool[i]);
    }
    if(cands.length) break;
  }
  if(!cands.length) return;
  const modId = pickOne(cands);
  const owners = [];
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(!w) continue;
    const own = P.wmod[id] || [];
    const pool = (w.mods || []).concat(SCHOOL_MODS[w.school] || []);
    if(pool.indexOf(modId) >= 0 && own.indexOf(modId) < 0) owners.push(id);
  }
  if(!owners.length) return;
  const wid = pickOne(owners);
  if((P.wmod[wid] || []).length >= 3) return;
  P.wmod[wid] = (P.wmod[wid] || []).concat([modId]);
  P.freeMods++;
  showToast('⚡ ' + tag + '：' + WEAPONS[wid].name + ' 获得「' + (MODS[modId] ? MODS[modId].name : modId) + '」');
  sfx('awaken');
  buildInv();
}

function addShake(v){
  if(state.shakeCd > 0) return;
  state.shakeCd = 0.32;      /* 约 3 次/秒；0.16 秒时是 6 次/秒，等于常驻抖动 */
  state.shake = Math.min(5.5, Math.max(state.shake, v));
}

/* 击杀回血统一入口：所有来源（吸血结晶 / 血牙 / 血誓）共用每秒预算，
   避免"某个遗物没有上限、另一个被卡死"的问题 */
/* ---------------------------------------------------------
   击杀回血（重构）
   ---------------------------------------------------------
   旧版的两个上限互相打架：
     · 单次最多 0.30% —— 但实测 2 分钟后每秒击杀 11.6 只，
       11.6 × 0.30% = 3.5%/秒，永远先撞上限 → 单次限制形同虚设；
     · 每秒最多 0.90% —— 这才是真正生效的值，等于"恒定回血"，
       跟杀多少只怪完全无关，"击杀回血"这个名字是骗人的。
   现在改成按击杀数计价：
     每杀 1 只回 0.05% 最大生命，加成来源叠在"每杀"上，
     每秒上限 1.0%。
   实测 400 血、12 杀/秒 ≈ 2.4 血/秒 = 0.6%/秒，上限留出约 1.7 倍余量，
   只有满屏连锁才能撞顶——"多杀多回、少杀少回"才是真的。
   血牙从 +0.4%/杀 砍到 +0.15%/杀：旧值等于基础值的 5 倍，
   一件普通遗物直接让回血预算翻 6 倍，是"零投入不死流"的主因。
   --------------------------------------------------------- */
/* 0.07% → 0.035%。击杀回血是唯一"越打越回"的来源，
   后期每秒十几杀时它自己就能把治疗桶顶满（0.7%/秒），
   等于所有清场快的角色都自带常驻回血。砍半之后它仍是主要续航，
   但不再是一张免费血包。 */
const KILL_HEAL_PER_KILL = 0.00035;

/* ---------------------------------------------------------
   统一治疗预算（2.6 的结构性修复）
   ---------------------------------------------------------
   2.5 之前每个治疗来源各自为政：击杀回血有自己的每秒上限，
   厨师的反应回血、愈合结晶、近战吸血、升级回血全都绕过它。
   于是"治疗总量"只受**触发次数**约束，而后期元素反应每秒几十次，
   峰值能回 10% 最大生命/秒——比任何伤害来源都快，血条自然永远满。
   只调系数永远调不好："触发次数"这个乘数会跟着伤害一起涨。

   病根不在某个系数，而在"治疗没有时间维度"。
   现在所有被动治疗共用一个池：
     · 容量 = 1 秒的量（不许囤积）
     · 回补 = 每秒 2% 最大生命（约 50 秒回满）
   要判断续航够不够，只看这一个数，不用再追八条路径。
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   【4.0】治疗：从"硬闸门"改成"软预算"（边际递减）
   ---------------------------------------------------------
   2.6 的做法是给被动治疗一个容量 1.6%/秒的池子，回满就一滴都进不来。
   它确实拦住了"无限续航"，但同时把"堆治疗"这条构筑线也一起拦死了：
   超过 1.6%/秒的部分全部作废，玩家再拿治疗遗物等于拿空气。

   现在改成：效率 = 1 / (1 + 近期回血速度 / 预算)。
     回血速度 ≈ 预算的一半时，效率 67%；
     回血速度 ≈ 预算的 2 倍时，效率 33%；
     全靠触发堆出来的 10%/秒，落地只剩 2.4%/秒左右。
   没有墙，只有越来越贵——投入治疗的边际收益递减，但永远不是 0。
   --------------------------------------------------------- */
const HEAL_POOL_PER_SEC = ECO.healBudget;

function healPoolCap(){ return (P ? P.maxHp : 100) * ECO.healBudget; }

function drawHealPool(amount){
  if(!P || !(amount > 0) || P.hp >= P.maxHp) return 0;
  amount *= (ST && ST.healMul) ? ST.healMul : 1;
  /* 结构修复：这里原来是一段"边际递减"的效率公式：
       eff = 1 / (1 + 近期回血速度 / 预算)
     它的本意是"越刷越贵"，但数学上根本不收敛到预算：
     设每次请求 A、每帧结算，稳态吞吐解出来是 √(A·预算/Δt)，
     预算 1.7 HP/s 时会稳定在 8~10 HP/s —— 也就是**完全不生效**。
     这就是"骑士受伤 9.54/秒、回血 9.51/秒，永远打不死"的真正原因：
     治疗池写着 0.28%/秒，实际放行了 1%/秒以上。

     现在改成真正的令牌桶（文档里一直是这么写的，只是代码没照做）：
       · 桶容量 = 1 秒的预算量
       · 每秒回补 healRefill 倍（1.6 倍 → 攒得比用得稍快，允许短时爆发）
       · 单次请求能拿走的永远不会超过桶里剩下的
     于是"持续治疗上限"第一次真的是 healBudget，可以被测量、可以被平衡。 */
  const dt = state._dt || (1 / 60);
  const cap = healPoolCap();
  if(state.healPool === undefined) state.healPool = cap;
  const give = Math.min(amount, state.healPool, P.maxHp - P.hp);
  if(give <= 0) return 0;
  state.healPool -= give;
  state.healRate = give / dt;
  P.hp += give;
  state.healAcc = (state.healAcc || 0) + give;
  return give;
}

/* 治疗池每帧回补：**必须在主循环里跑**，而不是"下次有人要治疗时才补"。
   懒回补的后果是"打完一波停 3 秒，再治疗仍然只拿到一帧的量"，
   体感上就是"明明脱战了很久，回血还是没恢复"。 */
function healPoolTick(dt){
  if(!P) return;
  const cap = healPoolCap();
  if(state.healPool === undefined){ state.healPool = cap; return; }
  state.healPool = Math.min(cap, state.healPool + cap * (ECO.healRefill || 1.6) * dt);
}

/* 主动奖励（血包）不走预算池：是玩家自己捡回来的，不该被限速 */
function healRaw(amount){
  if(!P || !(amount > 0) || P.hp >= P.maxHp) return 0;
  const h = Math.min(amount, P.maxHp - P.hp);
  P.hp += h;
  state.healAcc = (state.healAcc || 0) + h;
  return h;
}

/* 每次击杀应该回多少（把所有加成算在"每杀"上） */
function killHealAmount(){
  if(!P) return 0;
  /* 【2.6】口径统一：只有"结晶 / 角色 buff"走加法，装备走倍率。
     原来血牙写 +0.15%、结晶写 +0.02%/级、赌徒 +0.18%，三个并列的百分比
     在描述里各说各话（血牙还写着 0.4%），玩家根本算不清自己每杀回多少。
     现在：基础 0.05% → 加结晶与 buff → 再乘血牙(×2) / 血誓(×2.4)。 */
  let per = KILL_HEAL_PER_KILL;
  per += 0.0002 * ((P.passives && P.passives.vamp) || 0);           /* 吸血结晶：+0.02%/级 */
  per += (P.killHealBonus || 0);                                   /* 赌徒押注等临时加成 */
  per *= (ST && ST.killHealMul) ? ST.killHealMul : 1;              /* 血之泉 */
  if(relic('fang')) per *= 2;                                      /* 血牙：击杀回血翻倍 */
  if(relic('bloodoath')) per *= 2.4;                               /* 血誓 */
  return P.maxHp * per;
}

function drawKillHeal(amount){
  /* 击杀回血不再单独维护预算，统一进治疗池 */
  return drawHealPool(amount);
}

/* 回血统一入口：所有被动治疗（击杀 / 反应 / 愈合结晶 / 近战吸血）都从这里走 */
function healPlayer(amount){
  const got = drawHealPool(amount);
  /* 【6.0】煮汤：治疗量的一部分转成对最近敌人的伤害。
     加一把锁：伤害→击杀回血→再触发治疗，否则会自己咬自己一圈。 */
  if(got > 0 && P && !P.brothLock && typeof relic === 'function' && relic('broth')){
    const rate = (typeof ST !== 'undefined' && ST && ST.healToDmg) || 0;
    if(rate > 0){
      let best = null, bd = 1e9;
      for(let i = 0; i < enemies.length; i++){
        const e = enemies[i];
        if(e.dead) continue;
        const dd = dist(e.x, e.y, P.x, P.y);
        if(dd < bd && dd < 260){ bd = dd; best = e; }
      }
      if(best){
        P.brothLock = 1;
        dealDamage(best, got * rate, { src:'broth', dot:true, canCrit:false });
        P.brothLock = 0;
      }
    }
  }
  /* 【6.0】治疗计数（进化条件）+ 溢出转伤害 */
  if(got > 0){
    evoAdd('heal', got);
    if(typeof relic === 'function' && relic('overflow') && P && !P.ovfLock){
      const room = Math.max(0, P.maxHp - P.hp);
      const over = Math.max(0, amount * ((ST && ST.healMul) || 1) - room) * 0.6;
      if(over > 1){
        let best = null, bd = 1e9;
        for(let i = 0; i < enemies.length; i++){
          const e = enemies[i];
          if(e.dead) continue;
          const dd = dist(e.x, e.y, P.x, P.y);
          if(dd < bd && dd < 200){ bd = dd; best = e; }
        }
        if(best){
          P.ovfLock = 1;
          dealDamage(best, over, { src:'overflow', dot:true, canCrit:false });
          P.ovfLock = 0;
        }
      }
    }
  }
  return got;
}

/* ---------------------------------------------------------
   状态 tick：灼烧 / 中毒 / 冰缓 / 感电
   --------------------------------------------------------- */
function tickStatus(e, dt){
  const st = e.st;
  /* 【P0 修复】回旋披萨刀给每只怪打的 e.pizzaCd 从来没有人递减，
     于是每只怪只会被切一次，之后永久免疫——45 秒里只打出 304 点伤害。
     冷却必须在这里衰减，否则"持续旋转切割"其实是一次性伤害。 */
  /* 「标记」易伤：6 秒后消失，层数一起清掉 */
  if(e.markT > 0){
    e.markT -= dt;
    if(e.markT <= 0){ e.markT = 0; e.markN = 0; }
  }
  if(e.pizzaCd > 0) e.pizzaCd -= dt;
  if(e.knockCd > 0) e.knockCd -= dt;
  /* 【4.0】咬击节奏：接触攻击的冷却**全局**走，不再只在贴身时递减。
     以前它只在 applyContact 里 tick，结果一只怪从远处走过来时冷却一直是满的，
     一群怪同时抵达就同时开咬——"怪潮"变成了瞬间爆发伤害。
     现在每只怪的节奏从出生起就一直在走，贴身才有机会咬，密度随登场顺序自然摊开。 */
  if(!st) return;
  if(st.reactCd > 0) st.reactCd -= dt;

  if(st.fire > 0){
    st.fire -= dt;
    if(st.fireDmg > 0){
      dealDamage(e, st.fireDmg * dt * (ST.burnMul || 1), { src:'burn', dot:true, canCrit:false });
      if(e.dead) return;
    }
    if(Math.random() < dt * 6) burst(e.x, e.y - 2, '#ff8a3d', 1, 40, -0.4);
  }
  if(st.venom > 0){
    st.venom -= dt;
    if(st.venomDmg > 0){
      dealDamage(e, st.venomDmg * dt, { src:'venom', dot:true, canCrit:false });
      if(e.dead) return;
    }
    if(Math.random() < dt * 4) burst(e.x, e.y - 2, '#a6e05a', 1, 34, -0.3);
  }
  if(st.bleed > 0){
    st.bleed -= dt;
    if(st.bleedDmg > 0){
      dealDamage(e, st.bleedDmg * dt, { src:'bleed', dot:true, canCrit:false });
      if(e.dead) return;
    }
    if(Math.random() < dt * 5) burst(e.x, e.y - 2, '#ff4d6d', 1, 34, -0.5);
  }
  if(st.ice > 0){
    st.ice -= dt;
    if(st.ice <= 0) e.slowT = 0;
  }
  if(st.volt > 0){
    st.volt -= dt;
    if(Math.random() < dt * 3) burst(e.x, e.y - 2, '#ffe066', 1, 46, -0.2);
  }
}
