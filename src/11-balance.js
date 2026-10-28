/* =========================================================
   4.1 统一战斗经济（Economy）
   ---------------------------------------------------------
   4.1 的目标不是"再调一遍数值"，而是**减少规则的数量**。
   玩家能心算的只有三句话，整个平衡必须能塞进这三句话里：

     1) 怪咬你 = 它的伤害 × (1 − 你的护甲)。被几只围就吃几口。
     2) 你的护甲 = A / (A + 58)。A 越高越贵，但永远还有效果。
     3) 冷却 = 基础间隔 × 冷却倍率。没有"攻速"这个第二套说法。

   为此 4.1 删掉了 4.0 里那些"看起来很聪明、玩起来读不懂"的东西：

     · 夹击（被 3 只以上贴身 ×1.35）
     · 被围递减 crowdW（第 2 只 64%、第 3 只 41%……）
     · 控制减伤（眩晕 ×0.35 / 冰缓 ×0.6 / 燃烧 ×0.72 / 减速 ×0.8）
     · 韧性 / 破韧（打空韧性条 → 破防 +45% 易伤）
     · 独立免伤 hurtTaken（和护甲并行的第二个减伤数字）
     · 格挡 / 护盾期减伤 / 宠物挡刀（都是换名字的免伤）

   它们全被两件事替换：
     · **怪更疼**（接触伤害按怪自己的伤害直接结算，不再有任何修正系数）
     · **护甲更硬**（所有防御来源都折算成护甲点数，走同一条曲线）

   规则少了，能塞进数值里的"手感"反而更多：
   被 3 只围住现在是 3 份伤害，被 8 只围住就是 8 份——
   压力直接、可读，而且冲刺/走位的价值一眼就能看出来。
   ========================================================= */

const ECO = {
  T: 600,                  /* 一局的基准时长（10 分钟终局 BOSS） */

  /* --- 参考玩家：一条固定曲线，与玩家实际数值无关 --- */
  refHp0: 300,
  refHp1: 660,

  /* =========================================================
     攻击曲线：1 → 2.45（600 秒），线性
     ---------------------------------------------------------
     4.x 的曲线是 1 → 8.65（二次项 5.2）。它把"后期变凶"全压在后半程，
     配上一串很小的基础伤害（史莱姆 7），结果就是：
       · 开局 300 血挨一下掉 6 点，要挨 50 下才会死
       · 10 分钟时同样一口变成 60 点——曲线在替数值背锅

     伤害就该是绝对值，成长交给**两件事**：
       1) 基础伤害定在"打在身上看得见"的量级（杂兵 25~30，重甲 55~65）
       2) 曲线只跟到 2.45 倍，正好对应玩家生命 300 → 700 的自然成长，
          于是"一口占多少血"从第 1 分钟到第 10 分钟基本恒定在 8%~10%

     这就是数值设计该有的样子：绝对伤害 + 平缓曲线，
     而不是一个陡到必须靠小基础伤害来兜底的指数。
     ========================================================= */
  atkC0: 1.00,
  atkC1: 2.05,
  atkC2: 0.00,

  /* --- 护甲：全游戏唯一的减伤。A=40 → 41%，A=80 → 58%，A=160 → 73%。
     永远涨、永远不封顶，也就不需要"护甲上限 42%"这种东西。 --- */
  armorK: 58,

  /* --- 接触伤害：碰到就掉血，然后有一段很短的"受伤间隔"。
     ---------------------------------------------------------
     这里参考的是同类肉鸽的标准做法（土豆兄弟 / 吸血鬼幸存者 / 哈迪斯）：
       · 怪**没有自己的攻击冷却** —— 贴上来就结算；
       · 节奏来自**玩家侧的受伤间隔**（0.45 秒），不是每只怪各自计时；
       · 一次结算 = Σ(贴身怪的 dmg) × contactTickMul，再过护甲。

     为什么不是"逐帧流血"：那是 DPS，血条平滑地掉，玩家感知不到"我挨了"，
     也没法用冲刺去卡节奏。为什么不是"7 秒一口"：那就变成怪在发呆。
     0.45 秒既能让被围时数字"啪"地跳，又留得出一次冲刺的反应窗口。 --- */
  /* 【6.0】接触伤害节奏：1.10 秒 → 0.40 秒，单口 ×0.36。
     ---------------------------------------------------------
     1.10 秒的问题不是"总 DPS"，是**感知**：挨一口之后有 1.1 秒完全不会被咬，
     玩家看到的画面是"我顶着 8 只怪走路，血条不动"。
     现在改成每 0.40 秒结算一次、单口降到 36%，每秒总伤害基本不变
     （旧 1.0/1.10 = 0.909，新 0.36/0.40 = 0.900），但"挤着怪走"会连续掉血。
     同时接触伤害不再被弹幕 / 陷阱的无敌帧屏蔽（只吃冲刺无敌，见 66-ai）。 */
  contactTick: 0.40,
  contactTickMul: 0.36,

  /* --- 治疗：真正的令牌桶（见 50-state 的 drawHealPool）。 --- */
  /* 每秒回血上限 0.28% → 0.70% / 秒。
     4.x 那 0.28% 从来没有真正生效（效率公式不收敛，实测放行 1%/秒以上），
     所以它既是"没限制"，又是"限制了也没人知道"。
     现在桶是真的，这个数就是**持续治疗的上限**：
       0.70%/秒 = 一口杂兵（约 8%）需要 11 秒才能补回来
     于是"堆治疗"变成一种可以算的构筑：堆到 2 倍预算才有明显手感，
     而它永远追不上持续挨打 —— 这正是治疗该有的位置。
     额外的爆发空间由 healRefill（桶回补速度）与拾取血包承担。 */
  healBudget: 0.0050,
  healRefill: 1.20,
  healTau: 0.5,

  /* 【4.2】灵光（擦弹）已删除。
     它的本意是"贴着弹幕走有奖励"，但玩家根本读不出来自己在攒什么，
     也从来没有为了它改变过一次操作——用户原话："完全搞不懂，没用就删了"。
     暴击与资源的成长现在全部走看得见的东西：结晶、遗物、护甲。 */

  /* --- 冲刺 ---
     4.1：距离 138 → 96、无敌 0.34 → 0.22。
     4.0 的冲刺太长太安全，等于一个免费的位移技能，走位反而不重要了。
     缩短之后它变成"卡一下身位"的工具，而不是"穿墙"。
     两段充能保留：被围时至少要能连闪两次。 --- */
  dashCharges: 2,
  /* 【4.1】2.3s → 3.6s。两段充能 + 2.3 秒回复，等于"随时都有一次冲刺"，
     冲刺从"资源"退化成了"按键"。拉长之后，什么时候用掉第一段、
     要不要留着第二段解围，才成为一个需要想一下的决定。
     配套件（速充 -35%、踏风结晶 -8%/级）把上限拉回来。 */
  dashRecharge: 3.6,
  dashDist: 96,
  dashTime: 0.12,
  dashIvy: 0.22,
  dashFlow: 1.6,           /* 冲刺后「顺势」时长 */
  dashFlowDmg: 0.30,       /* 顺势期间伤害加成 */
  dashImpactR: 54,         /* 冲刺途中撞到敌人的判定半径 */
  dashImpactMul: 1.20      /* 撞击伤害 = 武器平均伤害 × 这个系数（见 66-ai.js） */
};

/* 归一化进度 p：0 → 1 是 10 分钟，允许超过 1（无尽模式） */
function stageP(t){
  const tt = Math.max(0, t || 0);
  return Math.min(2.4, tt / ECO.T);
}

/* 敌人攻击强度：一条纯曲线，没有任何 clamp 以外的截断。
   t=0 → 1.00，t=120 → 1.51，t=300 → 2.56，t=600 → 5.10，t=900 → 9.6 */
function atkCurve(t){
  const p = stageP(t);
  return ECO.atkC0 + ECO.atkC1 * p + ECO.atkC2 * p * p;
}

/* 参考生命曲线：只用来决定"一次攻击有多疼"，不参与玩家实际减伤 */
function refHpAt(t){
  const p = Math.min(1.9, stageP(t));
  return ECO.refHp0 + (ECO.refHp1 - ECO.refHp0) * Math.pow(p, 0.88);
}

/* 护甲点数 → 减伤比例（边际递减，无封顶）。全游戏唯一的减伤公式。 */
function armorDR(pts){
  const a = Math.max(0, pts || 0);
  return a / (a + ECO.armorK);
}
function armorPts(dr){
  /* 反解：给"按百分比写的防御来源"换算回点数 */
  const d = Math.min(0.95, Math.max(0, dr || 0));
  return d >= 0.999 ? 1e6 : ECO.armorK * d / (1 - d);
}

/* 治疗软预算：效率 = 1 / (1 + 近期回血速度 / 预算速度)。
   没有硬上限，只有越来越贵；停止触发之后 0.5 秒内恢复满效率。 */
function healEff(){
  if(typeof state === 'undefined' || !state || !P) return 1;
  const budget = Math.max(1, P.maxHp * ECO.healBudget);
  return 1 / (1 + (state.healRate || 0) / budget);
}
function healRateAdd(give, dt){
  const d = Math.max(0.002, dt || (1 / 60));
  const k = Math.exp(-d / ECO.healTau);
  state.healRate = (state.healRate || 0) * k + (give / d) * (1 - k);
}
function healRateDecay(dt){
  const d = Math.max(0.0001, dt || (1 / 60));
  state.healRate = (state.healRate || 0) * Math.exp(-d / ECO.healTau);
}

/* 多个闪避来源 → 一个总闪避率：按"每次都独立躲一次"的乘法合并。
   闪避不是"免伤"，它是"没被打到"——命中判定根本没发生，
   所以它不走护甲那条曲线，也不会和护甲叠成一个数字。
   两个 20% 是 36% 而不是 40%，十个也不会变成 200%，天然收敛。 */
function avoidStack(list){
  let miss = 1;
  for(let i = 0; i < list.length; i++){
    const d = Math.max(0, Math.min(0.92, list[i] || 0));
    miss *= (1 - d);
  }
  return 1 - miss;
}

/* ---------------- 威胁预算（刷怪经济） ----------------
   每只怪有一个**威胁成本**，刷怪器每秒拿到一笔预算，买什么由它决定。
   加一种新怪，只需要给它定价 —— 不用再动"每波几只"那张表。 */
function unitThreat(def, type){
  if(!def) return 1;
  let v = 0;
  v += (def.hp || 10) * 0.26;
  /* 伤害量级从 7 涨到 26 之后，威胁定价的权重必须同步缩小，
     否则每只怪在刷怪预算里会贵 2.6 倍 —— 场上怪少一半，
     玩家清得少、经验少、等级低，最后死于"等级跟不上"而不是死于难度。
     （这里踩过一次：只改伤害不改定价，五个角色的选卡次数从 30+ 掉到 6。） */
  v += (def.dmg || 5) * 0.42;
  v += (def.spd || 20) * 0.16;
  if(def.shot) v += 26 + (def.shot.mul || 0.8) * 10;
  if(def.armor) v += def.armor * 120;
  if(def.tank) v += 14;
  if(def.ai === 'spawner') v += 60;
  if(type === 'ant') v *= 0.55;
  return Math.max(0.6, v / 20);
}

/* 每秒刷怪预算：t=0 → 3.0，t=300 → 17，t=600 → 35 */
function spawnBudget(t){
  const p = Math.min(2.4, Math.max(0, t) / ECO.T);
  /* 【6.0】实测：上限写着 120~340，场上却长期只有 17~30 只。
     原因不是上限，是"每波买得起的怪太少"——开局每秒预算 3 点，
     按单只 1~2 点算等于每秒 1.5 只，而玩家清怪速度就有 1.5 只/秒，
     于是场上永远填不满。这里把预算整体抬一档（不是加隐藏倍率，
     就是"每秒能买多少怪"这一个数）。 */
  /* 【6.0】6+22p+34p² 在 150 秒 ≈ 13.6 点/秒、210 秒 ≈ 17.9 点/秒。
     死亡解剖：五个角色里只有工程师（炮台全场清）能持续压过这条线，
     其余四个的清怪上限 13~14 只/秒——于是全都在 2.5~4 分钟被自己的
     怪堆淹死（厨师两种子都死在 157s，场上 120+ 只）。
     放缓爬坡：90s≈7.9、150s≈10.4、210s≈13.3、300s≈18.5。
     终局 600s 仍到 43/秒，压力没有变低，只是"中期超出全员能力"的那段
     被削掉了。实测场上峰值 120~190 → 预计 60~110，依然是密的。 */
  return 5.0 + 16.0 * p + 22 * p * p;
}

/* 远程配额：不是"最多 8 只"，而是"远程威胁不得超过全场的 38%"。 */
function rangedThreatShare(){
  let r = 0, all = 0;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(!e || e.dead) continue;
    const c = e.threat || 1;
    all += c;
    if(e.shot) r += c;
  }
  return all > 0 ? r / all : 0;
}

/* ---------------- 冲刺 ----------------
   4.1 把冲刺做成了一个有配套的可养成机制：
     · 疾影靴 / 疾风符：多一段 / 更快回满
     · 破风：冲刺撞到敌人造成伤害
     · 余势：顺势更长更狠
   冲刺本身只是一个"位移 + 短无敌"，强度全部挂在这些配件上。 */
function dashMaxNow(){
  return ECO.dashCharges + ((typeof ST !== 'undefined' && ST && ST.dashExtra) || 0);
}
function dashRechargeNow(){
  const m = (typeof ST !== 'undefined' && ST && ST.dashCd) || 1;
  return ECO.dashRecharge * Math.max(0.35, m);
}
function dashFlowNow(){
  return ECO.dashFlow + ((typeof ST !== 'undefined' && ST && ST.dashFlowBonus) || 0);
}
function dashFlowDmgNow(){
  return ECO.dashFlowDmg + ((typeof ST !== 'undefined' && ST && ST.dashDmgBonus) || 0);
}
function dashReady(){
  return P && (P.dashCharge || 0) >= 1 && !(P.dashT > 0) && state.mode === 'playing';
}
function startDash(dx, dy){
  if(!dashReady()) return false;
  let l = Math.hypot(dx, dy);
  if(l < 0.01){ dx = P.facing >= 0 ? 1 : -1; dy = 0; l = 1; }
  dx /= l; dy /= l;
  P.dashCharge -= 1;
  P.dashT = ECO.dashTime;
  P.dashVx = dx; P.dashVy = dy;
  P.dashHitSet = null;
  P.invuln = Math.max(P.invuln, ECO.dashIvy);
  /* 【6.0】冲刺无敌单独记一份：接触伤害只认这一份，
     不再被弹幕 / 陷阱给的 0.30 秒无敌顺手挡掉。 */
  P.dashIvyT = Math.max(P.dashIvyT || 0, ECO.dashIvy);
  P.dashTrail = [];
  P.flow = dashFlowNow();
  sfx('whoosh');
  for(let i = 0; i < 8; i++){
    burst(P.x - dx * i * 4, P.y - dy * i * 4, '#9fe8ff', 1, 40, 0);
  }
  if(rings.length < 30){
    rings.push({ x:P.x, y:P.y, r0:4, r1:26, life:0.18, max:0.18, col:'#9fe8ff', w:2 });
  }
  return true;
}
function dashTick(dt){
  if(!P) return;
  if(P.dashIvyT > 0) P.dashIvyT = Math.max(0, P.dashIvyT - dt);
  const dmax = dashMaxNow();
  if(P.dashCharge === undefined) P.dashCharge = dmax;
  if(P.dashCharge < dmax){
    P.dashCharge = Math.min(dmax, P.dashCharge + dt / dashRechargeNow());
  }
  if(P.flow > 0) P.flow = Math.max(0, P.flow - dt);
  if(P.dashT > 0){
    P.dashT -= dt;
    const sp = ECO.dashDist / ECO.dashTime;
    const nx = clamp(P.x + P.dashVx * sp * dt, 14, ARENA.w - 14);
    const ny = clamp(P.y + P.dashVy * sp * dt, 14, ARENA.h - 14);
    P.x = nx; P.y = ny;
    dashImpact();
    if(!P.dashTrail) P.dashTrail = [];
    P.dashTrail.push({ x:P.x, y:P.y, t:0.26 });
    if(P.dashTrail.length > 10) P.dashTrail.shift();
    if(Math.random() < 0.8) burst(P.x, P.y, '#7ce3ff', 1, 30, 0);
  }
  if(P.dashTrail){
    for(let i = P.dashTrail.length - 1; i >= 0; i--){
      P.dashTrail[i].t -= dt;
      if(P.dashTrail[i].t <= 0) P.dashTrail.splice(i, 1);
    }
  }
}

/* 破风：冲刺撞到敌人造成伤害。
   伤害跟着"你当前最强那把武器"走，所以后期依然有用，
   不需要再给它单独写一条成长曲线。 */
function dashImpact(){
  const tier = (typeof ST !== 'undefined' && ST && ST.dashImpact) || 0;
  if(tier <= 0) return;
  if(!P.dashHitSet) P.dashHitSet = new Set();
  const r = ECO.dashImpactR;
  const base = dashImpactDmg();
  eachNear(P.x, P.y, r, function(e){
    if(!e || e.dead || P.dashHitSet.has(e.id)) return;
    P.dashHitSet.add(e.id);
    dealDamage(e, base * (1 + 0.55 * (tier - 1)), { src:'dash' });
    burst(e.x, e.y, '#9fe8ff', 5, 110, 0);
    if(rings.length < 30) rings.push({ x:e.x, y:e.y, r0:3, r1:18, life:0.16, max:0.16, col:'#9fe8ff', w:2 });
  });
  if(state.shake < 2) state.shake = 2;
}
function dashImpactDmg(){
  if(!P) return 20;
  let best = 0;
  for(const id in P.weapons){
    const w = (typeof WEAPONS !== 'undefined') ? WEAPONS[id] : null;
    if(!w || !w.stats) continue;
    try{
      const st = w.stats(P.weapons[id]);
      if(st && st.dmg > best) best = st.dmg;
    }catch(e){ /* 数据写错不该让整局崩掉 */ }
  }
  return Math.max(24, best * ECO.dashImpactMul);
}
