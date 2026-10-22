/* =========================================================
   3.0 角色身份系统 · 资源
   ---------------------------------------------------------
   资源 = 角色身份，不做成全角色通用。每条资源只属于一个角色，
   别人连 HUD 上那条槽都不会出现（见 80-ui.js 的 updateResHUD）：

     骑士   怒气  ——  打人 / 挨打都会涨，满 100 进入「狂战」：
                      伤害 +30%、冷却 -29%，持续 6 秒。
                      默认"慢攒慢放"，但骑士的专属遗物能改成"快进快出"：
                        · 怒潮之核  攒得更快、放得更久（常规打法）
                        · 裂怒阀门  满怒不再进狂战，改为引爆一次（把攒怒变成输出循环）
                        · 怒爆脉冲  引爆额外再炸一次，并给 2 秒冷却缩减
                      三件凑齐就是一台"怒气打桩机"。

     游侠   充能  ——  命中 / 击杀 / 暴击攒充能，满 100 触发「超载」：
                      所有武器立刻齐射一轮，并在 3 秒内冷却减半。
     工程师 护盾  ——  先于生命值吸收伤害，脱战 3 秒后自动回充。
     饲养员 吞噬  ——  击杀累积层数，永久加伤害与生命上限（滚雪球）。

   厨师与赌徒不走这套资源：厨师是元素反应，赌徒是押注。
   公用池里仍然有"血肉 / 熔融 / 暴击 / 召唤"这类谁都能用的构筑件。
   ========================================================= */

const RES = {
  rageMax: 100,
  rageGainHit: 0.40,        /* 每次命中 */
  rageGainKill: 0.32,       /* 每次击杀 */
  /* 【4.1】7 → 2.5。上一次挨打就能给 7 点（骑士 ×1.35 约 9.5），
     挨十一下就是一次狂战——"站着挨打"反而成了最省事的开大方式，
     玩家根本不用去打怪。现在挨打只占怒气来源的约四分之一：
     主要来源还是命中与击杀，挨打是"被围时的补贴"，不是主菜。 */
  rageGainHurt: 2.5,        /* 每次受伤 */
  rageDecay: 5.0,           /* 每秒自然衰减 */
  rageIdle: 1.1,            /* 停止获取后多久开始衰减 */
  /* 同样的问题：3.2/帧 = 192/秒，形同虚设。改成每秒 16 点。 */
  ragePerSec: 16,
  berserkBase: 4.5,         /* 3.1：时长缩短，但从下面的倍率补回来 */

  chargeMax: 100,
  chargeRegen: 2.4,       /* 怠速回复：不打也在慢慢蓄，避免一断命中转速就归零 */
  chargeHit: 1.05,        /* 单发开火扣 1.6：命中 1 只打不平，得打中 2 只才涨 */
  chargeKill: 1.1,
  chargeCrit: 3.0,
  /* 【3.3 结构性修复】原来的 chargeFrameCap = 4.0 是"每帧最多 4 点"，
     60 帧就是每秒 240 点——等于没有上限。游侠后期一次齐射命中十几只，
     一帧直接顶满，这就是"0.1 秒充能 + 永远超载"的真正原因。
     换成**每秒令牌桶**：1 秒内最多只能攒 chargePerSec 点，不管命中多少次。 */
  /* 每秒令牌上限不是一个常数，而是一条**成长曲线**（见 chargePerSecNow）：
     开局约 11/s（充满要 9 秒，超载是惊喜），
     3 分钟约 20/s（约 5 秒一轮，转得起来），
     8 分钟约 30/s（约 3.3 秒一轮，后期超载频繁但不常驻）。
     固定成常数是错的做法：前期更难受、后期没有成长感。 */
  chargePerSecBase: 11,
  chargePerSecTime: 20,   /* 由时间贡献的上限增量 */
  chargeDrainHigh: 4.0,   /* 高充能维持成本（×sat²），满槽时每秒额外掉 4 点 */
  chargeSatDamp: 0.25,    /* 接近满槽时收益再打 25% 折 */
  overloadBase: 2.6,
  chargeSpeed: 0.45,      /* 满槽时的攻击间隔缩减 */
  overloadDmg: 0.25       /* 超载期间的伤害加成 */
};

/* 【4.0】令牌桶彻底拆掉，换成"过热"机制。
   ---------------------------------------------------------
   3.3 用每秒令牌桶压住了"一次齐射顶满充能"，但那是**外部闸门**：
   它不解释为什么不能攒，只是不让攒；而且是隐藏在代码里的天花板。
   结果就是"打得再猛也不会更快"，高投入没有回报。

   现在的规则是一条玩家能理解的因果：
     超载结束后枪管过热 → 4 秒内充能不涨（余温 4.2s）。
     于是两次超载之间必然有间隔，间隔长度只由角色决定，不由命中数决定；
     而在间隔之外，打得越猛充能越快，这个正反馈完整保留。
   怒气同理：狂战结束后有 3.5 秒"力竭"，怒气获取减半。 */
const TOKENS = { rage: 0, charge: 0 };   /* 兼容旧引用，实际不再作为闸门 */

/* 充能速率：随时间与等级一起长。
   前期 11/s、中期 20/s、后期 30/s——三个体感完全不同的阶段，
   而不是"从头到尾被一个数字卡住"。 */
function chargePerSecNow(){
  const t = (typeof state !== 'undefined' && state) ? state.time : 0;
  const lv = (P && P.level) ? P.level : 1;
  const base = RES.chargePerSecBase
             + Math.min(RES.chargePerSecTime, t / 38)
             + Math.min(4, (lv - 1) * 0.10);
  /* 【关键】获取加成要乘在**每秒预算**上，不能只乘在单次命中的数值上。
     后期命中密度大，预算是唯一的瓶颈——只乘单次数值的话，
     "充能速度 +15%" 这类结晶在真正需要它的后期等于不存在。 */
  return base * ((ST && ST.chargeRate) ? ST.chargeRate : 1);
}
/* 怒气同理：骑士的狂战节奏也要前期慢、后期快。 */
function ragePerSecNow(){
  const t = (typeof state !== 'undefined' && state) ? state.time : 0;
  const lv = (P && P.level) ? P.level : 1;
  const base = 11 + Math.min(11, t / 45) + Math.min(4, (lv - 1) * 0.09);
  return base * ((ST && ST.rageGain) ? ST.rageGain : 1);
}

function resInit(){
  TOKENS.rage = 11;
  TOKENS.charge = 11;
  P.rage = 0;
  P.berserk = 0;
  P.rageIdle = 99;
  P.ragePeak = 0;
  P.charge = 0;
  P.overload = 0;
  P.shield = 0;
  P.shieldHitT = 99;
  P.devour = 0;
  P.devourKills = 0;
  P.growthT = 0;
  P.growthHp = 0;
  P.growthDmg = 0;
  P.fleshT = -9;
  P.rageBurstT = -9;
  P.overloadCount = 0;
  P.rageCount = 0;
  /* 【4.0】新机制的状态位 */
  P.overheat = 0;
  P.drained = 0;
  P.dashCharge = ECO.dashCharges;
  P.flow = 0;
  P.dashT = 0;
  P.dashTrail = [];
  P.brokenCount = 0;
}

/* 每帧把令牌桶补到上限（漏桶：最多积压 1 秒的量）
   【3.3】原签名不带 dt，因为以前只是把计数器清零。
   现在要按真实时间补充，必须传 dt——硬编码 1/60 在变速帧上会算错。 */
function resFrameReset(dt){
  /* 预留：令牌桶已经拆掉，这里只保留接口，避免旧调用点报错 */
}

/* 伤害计价的统一尺度：一秒钟的武器输出。
   所有"按时间触发"的机制（怒气冲击波、心跳泵、盾反）都用它当基准，
   这样它们跟着构筑一起成长，不会像 2.x 的固定数值那样后期变成挠痒。 */
function powerBase(){
  return Math.max(35, (state && state.wpnDps) ? state.wpnDps : 120);
}

/* ---------------- 怒气 ---------------- */
/* 【3.0 定位修正】资源是**角色身份**，不是公共系统：
   怒气只属于骑士、充能只属于游侠、护盾只属于工程师、吞噬只属于饲养员。
   厨师与赌徒走元素反应 / 押注，不共享这套资源。 */
function hasRage(){ return !!(CHAR && CHAR.hasRage); }
function hasCharge(){ return !!(CHAR && CHAR.hasCharge); }
function hasShield(){ return !!(CHAR && CHAR.hasShield); }
/* 护甲点数（与 getStats 里那条唯一的减伤曲线同源） */
function armorPtsTotal(){ return Math.max(0, (ST && ST.armorPts) || 0); }
function hasDevour(){ return !!(CHAR && CHAR.hasDevour); }

function isBerserk(){ return !!(P && P.berserk > 0); }

/* 狂战吸血：伤害的一部分转成治疗。
   高频武器每击都调 healPlayer 会打爆预算闸门，所以先记账，每 0.25 秒结算一次。
   单次上限 1.6% 最大生命 → 每秒最多约 6.4%，是"打得凶才回得动"的续航，
   不是无脑站桩。 */
function berserkLeech(dmg){
  if(!P || !isBerserk() || !(dmg > 0)) return;
  P.leechAcc = (P.leechAcc || 0) + dmg * 0.025;
}
function leechTick(dt){
  if(!P) return;
  P.leechT = (P.leechT || 0) - dt;
  if(P.leechT > 0) return;
  P.leechT = 0.25;
  const acc = P.leechAcc || 0;
  P.leechAcc = 0;
  if(acc <= 0.5) return;
  const give = Math.min(acc, P.maxHp * 0.016);
  if(P.hp < P.maxHp && give > 0.5){
    healPlayer(give);
    if(state.time - (P.leechFx || -9) > 0.9){
      P.leechFx = state.time;
      addText(P.x, P.y - 26, '+' + Math.round(give), '#8ee06b', 9);
    }
  }
}

function rageGain(n){
  if(!P || !hasRage() || P.berserk > 0 || !(n > 0)) return;
  n *= (ST && ST.rageGain) ? ST.rageGain : 1;
  /* 力竭：狂战刚结束的 3.5 秒里，怒气只有一半效率。
     这是"别指望一直狂"的机制解释，而不是一个每秒点数闸门。 */
  if(P.drained > 0) n *= 0.5;
  P.rage = Math.min(RES.rageMax, P.rage + n);
  P.rageIdle = 0;
  if(P.rage >= RES.rageMax) rageEnter();
}

/* 脚本事件（受伤 / 遗物）给的怒气：不吃每帧上限，
   否则"受伤 +30 怒"会被 3.2/帧 的闸门砍成 3 点。 */
function rageGainRaw(n){
  if(!P || !hasRage() || P.berserk > 0 || !(n > 0)) return;
  n *= (ST && ST.rageGain) ? ST.rageGain : 1;
  P.rage = Math.min(RES.rageMax, P.rage + n);
  P.rageIdle = 0;
  if(P.rage >= RES.rageMax) rageEnter();
}

function rageEnter(){
  if(!P || !hasRage()) return;
  /* 【裂怒阀门】满怒时不再进入狂战，而是直接引爆并清零。
     这一件就把"攒怒 → 狂战"改写成"攒怒 → 爆炸"的循环，
     叠得越快，炸得越密——这是骑士的第二种玩法。 */
  if(relic('ragevent')){ rageDetonate(); return; }
  P.rage = 0;
  P.rageCount = (P.rageCount || 0) + 1;
  P.berserk = Math.max(0.8, (ST.rageDur || RES.berserkBase));
  P.ragePeak = P.berserk;

  addText(P.x, P.y - 36, '狂 战 ！', '#ff8a5c', 16);
  if(rings.length < 40){
    rings.push({ x:P.x, y:P.y, r0:10, r1:126, life:0.45, max:0.45, col:'#ff8a5c', w:5 });
    rings.push({ x:P.x, y:P.y, r0:4, r1:64, life:0.28, max:0.28, col:'#ffe9b0', w:3 });
  }
  burst(P.x, P.y, '#ff8a5c', 26, 210, -0.1);
  state.shake = Math.max(state.shake, 5);
  state.flash = Math.max(state.flash, 0.34);
  state.hitstop = Math.max(state.hitstop || 0, 0.045);
  sfx('rageEnter');
  emit('rageEnter', { rage: RES.rageMax });
  if(archTier('rage') >= 3) rageShockwave('enter');
}

function rageExit(reason){
  if(!P) return;
  P.berserk = 0;
  /* 力竭：狂战之后的恢复期。它是"节奏"本身，不需要每秒怒气闸门。 */
  P.drained = 3.5;
  addText(P.x, P.y - 30, '怒气消退', '#ffb08a', 10);
  burst(P.x, P.y, '#ff8a5c', 10, 120, 0);
  if(rings.length < 30) rings.push({ x:P.x, y:P.y, r0:6, r1:54, life:0.26, max:0.26, col:'#ff8a5c', w:2 });
  sfx('rageExit');
  emit('rageExit', { reason: reason || 'timeout' });
  if(archTier('rage') >= 3) rageShockwave('exit');
}

/* 裂怒阀门：满怒引爆。
   伤害 = 0.45 秒武器输出 + 2% 最大生命，跟着构筑一起成长，
   不会像固定数值那样后期变成挠痒。 */
function rageDetonate(){
  if(!P) return;
  /* 防自触发链：一次爆炸若炸死一片，击杀怒气会把怒气再推满，
     没有这个 0.25 秒闸门就会在同一帧里连爆几十次。 */
  if(state.time - (P.lastDet === undefined ? -9 : P.lastDet) < 0.6){
    P.rage = 0;
    return;
  }
  P.lastDet = state.time;
  P.rage = 0;
  P.rageCount = (P.rageCount || 0) + 1;

  const dbl = relic('rageburst');
  const r = 130 + (dbl ? 26 : 0);
  /* 引爆是「每秒一次的范围爆发」，不是「一发清屏」：
     系数按实测伤害占比调到 30% 左右（见 tools/sim.mjs 的伤害归因）。 */
  const dmg = powerBase() * 0.45 + P.maxHp * 0.02;

  addText(P.x, P.y - 38, '引 爆 ！', '#ff5a3d', 17);
  if(rings.length < 40){
    rings.push({ x:P.x, y:P.y, r0: 10, r1: r, life: 0.34, max: 0.34, col:'#ff5a3d', w: 6 });
    rings.push({ x:P.x, y:P.y, r0: 4, r1: r * 0.66, life: 0.24, max: 0.24, col:'#ffe9b0', w: 3 });
  }
  burst(P.x, P.y, '#ff7a4d', 30, 240, -0.1);
  state.shake = Math.max(state.shake, 7);
  state.flash = Math.max(state.flash, 0.4);
  state.hitstop = Math.max(state.hitstop || 0, 0.06);
  sfx('rageBurst');

  eachNear(P.x, P.y, r, function(e){
    if(e.dead) return;
    dealDamage(e, dmg, { src:'rage', noFlesh:true });
    if(!e.big && !e.dead){
      const a = Math.atan2(e.y - P.y, e.x - P.x);
      e.x += Math.cos(a) * 26;
      e.y += Math.sin(a) * 26;
      e.stun = Math.max(e.stun || 0, 0.3);
    }
  });

  if(dbl){
    /* 怒爆脉冲：延迟 0.26 秒补第二发（70%），并给 2 秒冷却缩减 */
    strikes.push({ kind:'bomb', x:P.x, y:P.y, delay:0.26, max:0.26,
                   r: r * 0.86, dmg: dmg * 0.7, src:'rage', seed: 0 });
    P.rageHaste = 2.0;
    addText(P.x, P.y - 52, '余 怒', '#ffb056', 12);
  }
  if(archTier('rage') >= 3){
    /* 流派Ⅲ：引爆时再震一圈（不额外结算伤害，只做击退与控场） */
    rings.push({ x:P.x, y:P.y, r0: r * 0.6, r1: r * 1.25, life: 0.3, max: 0.3, col:'#ff9d6b', w: 3 });
    eachNear(P.x, P.y, r * 1.25, function(e){
      if(e.dead || e.big) return;
      const a = Math.atan2(e.y - P.y, e.x - P.x);
      e.x += Math.cos(a) * 18;
      e.y += Math.sin(a) * 18;
    });
  }
  emit('rageEnter', { detonate: true });
}

/* 怒爆脉冲 / 怒气流派Ⅲ：进入与退出都是一发范围伤害。
   伤害 = 0.9 秒武器 DPS ×（1 + 当前怒气倍率），并附带击退。 */
function rageShockwave(kind){
  if(!P) return;
  const r = 108 + (P.berserk > 0 ? 18 : 0);
  const dmg = powerBase() * 0.5 * (kind === 'enter' ? 1 : 0.7);
  if(rings.length < 34) rings.push({ x:P.x, y:P.y, r0:12, r1:r, life:0.3, max:0.3, col:'#ff9d6b', w:4 });
  burst(P.x, P.y, '#ff9d6b', 16, 190, -0.1);
  eachNear(P.x, P.y, r, function(e){
    if(e.dead) return;
    dealDamage(e, dmg, { src:'rage', noFlesh:true });
    if(!e.big && !e.dead){
      const a = Math.atan2(e.y - P.y, e.x - P.x);
      e.x += Math.cos(a) * 16;
      e.y += Math.sin(a) * 16;
      e.knockPow = Math.max(e.knockPow || 0, 8);
    }
  });
  sfx('rageBurst');
}

function rageTick(dt){
  if(!P || !hasRage()) return;
  if(P.drained > 0) P.drained = Math.max(0, P.drained - dt);
  if(P.rageHaste > 0) P.rageHaste = Math.max(0, P.rageHaste - dt);
  if(P.berserk > 0){
    P.berserk -= dt;
    if(P.berserk <= 0) rageExit('timeout');
  } else if(P.rage > 0){
    P.rageIdle += dt;
    if(P.rageIdle > RES.rageIdle){
      P.rage = Math.max(0, P.rage - RES.rageDecay * ((ST && ST.rageDecay) || 1) * dt);
    }
  }
}

/* ---------------- 充能 / 超载 ---------------- */
/* 充能的第二层作用：**线性转速**。
   怒气的价值全在"进入狂战"那一刻（攒满 → 状态窗口 → 清零），
   充能的价值则在"当下有多少"——充能越高冷却越低，但每次开火都会掉。
   于是它是"保持转速"，不是"憋大招"：命中补得多、乱打就掉速。 */
/* 转速表的收益从 −32% 提高到 −45% 间隔。
   修好"永远满槽"之后，超载从常驻变成节奏点，游侠的总输出掉了一大截——
   但"高转速"这件事本身的价值并没有兑现：满槽时才 −32%，
   而以前满槽是常态，所以这 32% 等于白送。
   现在满槽是稀缺状态，就该给得更多，让"把转速踩住"成为游侠的核心动作。 */
function chargeRateMul(){
  if(!P || !hasCharge() || P.overload > 0) return 1;
  return 1 - Math.min(1, P.charge / RES.chargeMax) * RES.chargeSpeed;
}
function chargeSpend(n){
  if(!P || !hasCharge() || P.overload > 0) return;
  P.charge = Math.max(0, P.charge - n);
}

function chargeGain(n){
  if(!P || !hasCharge() || P.overload > 0 || !(n > 0)) return;
  /* 过热：超载结束后的 4 秒里，充能不涨。
     这是"两次超载之间必然有间隔"的机制来源，不是隐藏的每秒上限。 */
  if(P.overheat > 0) return;
  n *= (ST && ST.chargeRate) ? ST.chargeRate : 1;
  /* 越接近满槽越难涨：这是一条收益递减曲线，不是封顶 */
  const sat = P.charge / RES.chargeMax;
  n *= (1 - (RES.chargeSatDamp || 0) * sat * sat);
  if(n <= 0.0001) return;
  P.charge = Math.min(RES.chargeMax, P.charge + n);
  if(P.charge >= RES.chargeMax) overloadEnter();
}

function overloadEnter(){
  if(!P || !hasCharge()) return;
  P.charge = 0;
  P.overloadCount = (P.overloadCount || 0) + 1;
  P.overload = Math.max(1.0, ST.overloadDur || RES.overloadBase);
  addText(P.x, P.y - 34, '超 载 ！', '#7ce3ff', 15);
  if(rings.length < 40){
    rings.push({ x:P.x, y:P.y, r0:14, r1:150, life:0.4, max:0.4, col:'#7ce3ff', w:4 });
    rings.push({ x:P.x, y:P.y, r0:6, r1:80, life:0.24, max:0.24, col:'#ffffff', w:2 });
  }
  burst(P.x, P.y, '#9fe8ff', 22, 200, -0.1);
  state.shake = Math.max(state.shake, 4);
  state.flash = Math.max(state.flash, 0.3);
  sfx('overload');
  emit('overload', { });
  overloadVolley();
  if(archTier('charge') >= 3) P.overloadEcho = 1;      /* 结束前再齐射一次 */
}

/* 超载瞬间：所有武器立刻打一轮。这是"整套构筑一起开火"的爽点。 */
function overloadVolley(){
  if(!P) return;
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(!w || w.continuous) continue;
    const lv = P.weapons[id];
    try{ w.fire(lv); }catch(e){ /* 单把武器出错不能拖垮全局 */ }
    P.cds[id] = 0.12;
  }
}

/* 充能的"怠速"：即使一发没打中，转速也会慢慢爬回来。
   没有这一条，开局只有一把武器、命中少的时候充能永远是 0，
   整个转速机制等于不存在。 */
function chargeIdleTick(dt){
  if(!P || !hasCharge() || P.overload > 0) return;
  /* 过热期间怠速也不回充——"枪管还烫着"这件事要在体感上成立 */
  if(P.overheat > 0){ P.overheat = Math.max(0, P.overheat - dt); return; }
  const sat = P.charge / RES.chargeMax;
  /* 怠速回复只在低转速时明显：空槽给你一个起步转速，高转速则几乎不加。 */
  if(P.charge < RES.chargeMax){
    P.charge = Math.min(RES.chargeMax, P.charge + RES.chargeRegen * dt * (1 - sat));
  }
  /* 高充能维持成本：满槽每秒掉 chargeDrainHigh 点。
     "永远 100 充能 = 永远 −45% 冷却间隔"原本是白拿的，现在要付钱。 */
  P.charge = Math.max(0, P.charge - RES.chargeDrainHigh * sat * sat * dt);
}

function overloadTick(dt){
  if(!P || !hasCharge() || P.overload <= 0) return;
  P.overload -= dt;
  if(P.overload <= 0){
    P.overload = 0;
    /* 余温：超载之后的恢复期。下一次超载最快也要这么久之后。 */
    P.overheat = 4.2;
    if(P.overloadEcho){
      P.overloadEcho = 0;
      overloadVolley();
      addText(P.x, P.y - 28, '余响', '#9fe8ff', 11);
    }
    if(relic('chgcore')) P.charge = 40;
  }
}

/* ---------------- 护盾 ---------------- */
/* 护盾上限 = 装备给的护盾 + 护甲换算。
   护甲本身就是"防御性的东西"，让它同时给护盾，是工程师与坦克流派的交叉点。 */
function shieldMaxNow(){
  if(!hasShield()) return 0;
  const gear = (ST && ST.shieldMax) || 0;
  /* 【4.2】护盾是工程师的"血条"：基础值 + 护甲点数 × 角色系数。
     他的 hp 只有 240、护甲只有 2 点，所以防御件对他来说是双倍收益
     ——既减伤，又直接撑护盾上限。 */
  const base = (CHAR && CHAR.shieldBase) || 0;
  const scale = (CHAR && CHAR.shieldScale) || 0.9;
  return Math.max(0, gear + base + armorPtsTotal() * scale);
}

function shieldTick(dt){
  if(!P || !hasShield()) return;
  P.shieldHitT += dt;
  const max = shieldMaxNow();
  if(max <= 0){ P.shield = 0; return; }
  if(P.shield > max) P.shield = max;
  /* 【4.2】护盾不再"脱战自然回充"。
     ---------------------------------------------------------
     原来挨打 3 秒后每秒回 12% 上限 —— 等于一条自己长回来的血条，
     玩家根本不需要为它做任何事，防御类遗物也就失去意义了。
     现在护盾全部来自**装备与战斗**：
       · 上限  = 护甲点数 × 0.9 + 护盾类遗物/结晶（见 shieldMaxNow）
       · 补满  = 升级时回满（onLevel）
       · 回补  = 每击杀 10 个敌人回 6% 上限
     于是"要不要为护盾投一件防御装"变成一个真实的取舍。 */
  if(P.killShield > 0){
    P.shield = Math.min(max, P.shield + max * 0.018 * P.killShield);
    P.killShield = 0;
  }
}

/* 护盾先吃伤害；返回剩余需要生命值承受的伤害 */
function shieldAbsorb(dmg){
  if(!P || !hasShield() || P.shield <= 0 || !(dmg > 0)) return dmg;
  const take = Math.min(P.shield, dmg);
  P.shield -= take;
  burst(P.x + rand(-6, 6), P.y + rand(-8, 4), '#9fe8ff', 4, 90, 0);
  if(P.shield <= 0.01){
    P.shield = 0;
    if(rings.length < 30) rings.push({ x:P.x, y:P.y, r0:8, r1:56, life:0.26, max:0.26, col:'#9fe8ff', w:3 });
    addText(P.x, P.y - 30, '护盾破碎', '#9fe8ff', 11);
    sfx('shieldBreak');
    state.shake = Math.max(state.shake, 3);
    emit('shieldBreak', { });
    if(relic('shdbreak')){
      const r = 96, d = powerBase() * 0.85;
      rings.push({ x:P.x, y:P.y, r0:10, r1:r, life:0.3, max:0.3, col:'#9fe8ff', w:4 });
      eachNear(P.x, P.y, r, function(e){
        if(e.dead) return;
        dealDamage(e, d, { src:'shield', noFlesh:true });
        if(!e.big && !e.dead) e.stun = Math.max(e.stun || 0, 0.6);
      });
      sfx('boom');
    } else if(relic('overcharge')){
      /* 过载放电：破盾瞬间对周围放一圈电（独立于盾反，可以同时拿） */
      const r = 74, d = powerBase() * 0.45;
      rings.push({ x:P.x, y:P.y, r0:6, r1:r, life:0.2, max:0.2, col:'#bff0ff', w:2 });
      eachNear(P.x, P.y, r, function(e){
        if(e.dead || e.stunned) return;
        dealDamage(e, d, { src:'shield', elem:'volt', noFlesh:true });
        e.stun = Math.max(e.stun || 0, 0.3);
      });
      sfx('zap');
    } else if(archTier('shield') >= 3){
      const r = 84, d = powerBase() * 0.5;
      rings.push({ x:P.x, y:P.y, r0:8, r1:r, life:0.26, max:0.26, col:'#9fe8ff', w:3 });
      eachNear(P.x, P.y, r, function(e){ if(!e.dead) dealDamage(e, d, { src:'shield', noFlesh:true }); });
    }
  }
  return dmg - take;
}

/* ---------------- 血肉：按最大生命百分比结算的"真实伤害" ---------------- */
function fleshPctNow(){
  return Math.max(0, (ST && ST.fleshPct) || 0);
}

function fleshStrike(e, mult){
  if(!P || !e || e.dead) return;
  const pct = fleshPctNow();
  if(pct <= 0) return;
  if(state.time - (P.fleshT || -9) < 0.12) return;     /* 高频武器不刷屏 */
  P.fleshT = state.time;
  const ratio = pct * (mult === undefined ? 1 : mult);
  const base = P.maxHp * ratio * (1 + state.time / 240);
  if(base < 1) return;
  dealDamage(e, base, { src:'flesh', trueDmg:true, noFlesh:true, canCrit:false });
  if(!e.dead) burst(e.x, e.y - 3, '#ff5f7e', 3, 80, -0.2);
}

/* 「血契」改造卡：固定 0.5% 最大生命的附加真实伤害 */
function bloodPactStrike(e){
  if(!P || !e || e.dead) return;
  if(state.time - (P.bloodT || -9) < 0.12) return;
  P.bloodT = state.time;
  const base = P.maxHp * 0.005 * (1 + state.time / 240);
  if(base < 1) return;
  dealDamage(e, base, { src:'flesh', trueDmg:true, noFlesh:true, canCrit:false });
}

/* ---------------- 吞噬：滚雪球 ---------------- */
function devourOnKill(){
  if(!P || !hasDevour() || !relic('growdevour')) return;
  if(P.devour >= 60) return;
  P.devourKills = (P.devourKills || 0) + 1;
  if(P.devourKills < 15) return;
  P.devourKills -= 15;
  P.devour++;
  P.maxHp += 2;
  P.hp = Math.min(P.maxHp, P.hp + 2);
  ST = getStats();
  if(P.devour % 5 === 0){
    addText(P.x, P.y - 30, '吞噬 +' + P.devour, '#a6e05a', 11);
    if(rings.length < 26) rings.push({ x:P.x, y:P.y, r0:4, r1:36, life:0.2, max:0.2, col:'#a6e05a', w:2 });
    sfx('devour');
  }
}

/* 生长之种 / 血肉盛宴：按时间、按击杀永久成长。
   注意：这里**不重算 ST**——每杀一只就重算一次属性会白烧 CPU。
   成长得到的伤害加成由 getStats() 直接读 P.growthHp / P.feastHp 计算，
   下一次自然重算（升级 / 选卡 / 强化）就会生效；生命上限则当场生效。 */
function growthTick(dt){
  if(!P) return;
  if(relic('growseed')){
    P.growthT += dt;
    if(P.growthT >= 20){
      P.growthT = 0;
      if(P.growthHp < 30){
        P.growthHp += 1;
        P.maxHp += 1; P.hp += 1;
      }
    }
  }
  if(relic('fleshfeast')){
    const want = Math.min(150, Math.floor(state.kills / 2));
    const have = P.feastHp || 0;
    if(want > have){
      const add = want - have;
      P.feastHp = want;
      P.maxHp += add;
      P.hp = Math.min(P.maxHp, P.hp + add);
    }
  }
}

function resTick(dt){
  leechTick(dt);
  if(P && P.packFury > 0) P.packFury = Math.max(0, P.packFury - dt);
  chargeIdleTick(dt);
  rageTick(dt);
  overloadTick(dt);
  shieldTick(dt);
  growthTick(dt);
}
