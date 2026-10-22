/* =========================================================
   2.5 角色
   ---------------------------------------------------------
   每个角色不只是数值不同：他们的"爽点"决定了这局的构筑方向。
   工程师的爽点是摆一片炮台阵地，饲养员是一群各有特色的宠物，
   游侠是弹幕与连击，骑士是越打越狂，厨师是元素连锁。
   ========================================================= */
/* 【3.3 坦度分工】血条本身要说明"这个角色靠什么活"。
   之前游侠 300 > 骑士 285，一个远程弹幕角色比近战肉盾血还厚，
   玩家第一眼就看不懂这个角色的定位。

   现在的顺序（基础生命 / 初始护甲 / 活下来的方式）：
     骑士   340 / 7%   血条 + 护甲 + 格挡，站着换血
     饲养员 305 / 5%   宠物挡刀（有宠物时受伤 ×0.72）
     工程师 290 / 5%   炮台吸引仇恨 + 护盾
     厨师   275 / 4%   打得出反应就回得上血
     游侠   265 / 3%   血最少、伤害倍率最高，用移速 114 + 7% 闪避换命
   总量与之前持平，只是把"谁该肉"摆正。 */
const CHARS = {
  /* ---------------- 1. 拖鞋游侠 ---------------- */
  ranger: {
    id:'ranger', name:'拖鞋游侠', title:'SHOE RANGER',
    color:'#ffc46b', icon:'slipper',
    blurb:'远程弹幕。所有投射武器自带一条额外弹道，弹幕越密，充能越快。',
    /* 【4.1】「暴雨」这个名字配一个"每 11 次命中下一发必暴"的隐藏计数器，
       结果是玩家完全不知道自己在攒什么 —— 攒满了没有提示，用掉了也没有。
       4.1 把它拆成两句人话：
         · 连珠：每 10 次命中，下一发必定暴击（HUD 直接写「必暴 7/10」）
         · 转速表：充能越高冷却越低，打满 100 触发超载齐射
       两个计数器互相独立，各自有明确的"差几次"读法。 */
    perkName:'转速表',
    perkDesc:'所有投射类武器额外 +1 弹道。转速表：充能越高冷却越低（最多 −32%），每次开火消耗；打满 100 触发超载齐射（冷却减半 + 全武器齐射一轮）。',
    projBonus: 1,
    /* 【3.3】伤害倍率 1.06 → 1.22：充能从"常驻超载"改成"节奏点"之后，
       游侠少掉了约 1.5 倍的持续输出（超载齐射 + 2.6 秒 50% 冷却缩减）。
       他本来就该是"最能打但最不能挨"的那一个，输出必须补回来。 */
    hasCharge: true,
    /* 【4.1】265 → 300。围攻改成"被几只围就吃几口"之后，
       血最少的那一个要吃最大的亏——他没有回血、没有护盾，只有 9% 闪避。
       300 仍然是最低血量，定位没变，"靠躲不靠血"也还在（移速 114 + 闪避）。 */
    /* 【4.1】「必暴」删掉之后，它原本提供的约 +10% 等效暴击直接写进面板：
       7% → 14%，"游侠最能暴击"这件事还在，只是不再需要一个计数器中转。
       闪避 9% → 12%：围攻改成线性叠加之后，闪避（"没被打到"）是最对症的一层。 */
    hp:300, speed:113, dmg:1.19, crit:0.14, critMul:1.65, armor:0.03, dodge:0.11, luck:1.0,
    /* 【3.6】起手武器 slipper → crossbow（连发弩）。
       实测游侠在 3~4 分钟是全角色输出垫底（281 / 656，骑士 346 / 862），
       根因不在伤害倍率，而在**起手武器**：其他四个角色开局拿的都是
       自己流派的代表武器（骑士平底锅 / 工程师炮台 / 饲养员小狗 / 厨师喷火枪），
       只有游侠拿的是人人都有份的通用飞拖鞋，本命连发弩还得靠抽。
       连发弩基础伤害更高、穿透 2、射程 400，是"远程弹幕"该有的起手。
       （飞拖鞋仍在通用池里，随时能拿到，主题没丢。） */
    weapon:'crossbow',
    schools:['barrage', 'crit'],
    affinity:['proj', 'crit', 'pierce', 'multi']
    /* 【4.1】「连珠 / 必暴」计数器已删除。
       ---------------------------------------------------------
       它的问题是**没有决策、也没有反馈**：
       游侠一秒打十几发，每 10 发换一发必暴，等价于暴击率 +10%，
       数值上不痛不痒，屏幕上也看不出来——玩家永远不知道自己是不是"攒满了"，
       知道了也不会因此改变任何操作。一个既不影响选择、又不改变观感的
       计数器，就是纯噪音（上一版把它改名成「连珠」也没救回来）。
       现在游侠的身份只剩两条，都能被直接感觉到：
         · 所有投射武器 +1 弹道（开局就能看到多一条弹道）
         · 转速表：充能越高冷却越低，打满 100 触发超载齐射
       暴击相关的成长交给结晶与遗物。 */
  },

  /* ---------------- 2. 平底锅骑士 ---------------- */
  knight: {
    id:'knight', name:'平底锅骑士', title:'PAN KNIGHT',
    color:'#c9d4e2', icon:'pan',
    blurb:'近身挥锅，挨打攒怒气。怒气是全角色通用的，但他攒得最快、狂得最狠。',
    perkName:'怒气',
    perkDesc:'怒气获取 +35%。狂战 5.5 秒：伤害 ×1.65、冷却 −45%、命中吸血 2.5%（每秒最多回 6% 最大生命）。带近战武器时额外 +7 护甲，被咬一口后 2.5 秒内伤害 ×1.6。',
    hp:340, speed:96, dmg:1.10, crit:0.06, critMul:1.6, armor:0.07, luck:1.0,
    /* 骑士的专属轴：护甲一件两吃——既减伤，又按比例折成反伤。 */
    thornsArmor: true,
    hasRage: true,
    rageGain: 1.35,
    berserkBonus: 1.0,
    berserkDmg: 0.20,
    berserkRate: 0.55,
    weapon:'pan',
    schools:['melee', 'blast'],
    affinity:['melee', 'blast', 'tank', 'knock'],
    init(){ P.riposte = 0; },
    /* 【3.0】怒气本体搬进 41-resources.js：
       2.x 只有骑士自己 tick 怒气，于是"怒气"永远只是一个角色的私产。
       现在全角色共用同一套攒/放逻辑，骑士只保留"更强"的角色系数。 */
    tick(dt){
      if(P.riposte > 0) P.riposte -= dt;
    },
    onHit(){ /* 怒气由统一管线累积，这里不再重复加 */ },
    onHurt(){
      /* 【4.1】原来这里是"18% 概率格挡 45% 伤害"——一条和护甲并行的随机免伤，
         面板上完全看不见，只能感觉"有时候没那么疼"。
         现在格挡的价值折算成护甲点数（见 50-state 的 armorPts），
         这里只保留**挨打之后的奖励**：带近战武器的骑士被咬一口，
         2.5 秒内下一锅更狠。挨打这件事依然是他专属的正反馈，
         但它不再是"减伤"，而是一个能被看见的输出窗口。 */
      if(hasMeleeWeapon()) P.riposte = 2.5;
    },
    damageMul(){ return (P.riposte > 0 ? 1.6 : 1); },
    hud(){
      if(P.berserk > 0) return '狂战 ' + P.berserk.toFixed(1) + 's';
      return P.rage > 0 ? ('怒气 ' + Math.round(P.rage)) : '';
    }
  },

  /* ---------------- 3. 炮台工程师 ---------------- */
  engineer: {
    id:'engineer', name:'炮台工程师', title:'TURRET ENGINEER',
    color:'#ffe066', icon:'turret',
    blurb:'本体最脆，靠护盾活。炮台没有上限，走到哪摆到哪，但它们很快会消失。',
    perkName:'超频',
    perkDesc:'炮台上限 +2。每座炮台让其它炮台冷却 -9%；炮台击杀有 20% 概率补一颗地雷。',
    /* 【4.2】工程师的定位：**本体最脆，靠护盾活**。
       hp 320 → 240（全角色最低，比游侠还少 60）
       armor 5 → 2 点（他自己几乎没有皮）
       shieldBase 55 + 护甲点数 × 1.4（护盾才是他的血条）
     ---------------------------------------------------------
     这样"护甲"对他来说是**双倍价值**：既减伤，又直接撑护盾上限，
     于是他的构筑会自然偏向防御件，而不是跟别人一样堆攻击。
     护盾破了就是真危险——这正是"靠护盾保命"该有的紧张感。 */
    hp:262, speed:98, dmg:1.02, crit:0.05, critMul:1.6, armor:0.03, luck:1.0,
    shieldBase: 58, shieldScale: 1.4,
    weapon:'turret',
    schools:['fort', 'blast'],
    affinity:['turret', 'summon', 'blast', 'trap'],
    hasShield: true,
    turretLimit(){ return 4; },
    /* 本体输出低是设计，但炮台必须真的顶得住：专职工程师的炮台额外 +15% 伤害 */
    turretDmg(){ return 0.64; },
    xpMul: 1.08,
    turretRate(){
      let n = 0;
      for(let i = 0; i < allies.length; i++) if(allies[i].kind === 'turret' && !allies[i].dead) n++;
      return 1 + Math.max(0, n - 1) * 0.10;
    },
    onAllyKill(a, e){
      if(a.kind === 'turret' && Math.random() < 0.2){
        mines.push({ x:e.x, y:e.y, r:15, dmg: 24 + 10 * P.level, boom: 40, arm:0.15,
          life: 9, seed: rand(0, 10), evo:false });
      }
    },
    hud(){
      let n = 0;
      for(let i = 0; i < allies.length; i++) if(allies[i].kind === 'turret' && !allies[i].dead) n++;
      return n ? ('炮台 ×' + n) : '';
    }
  },

  /* ---------------- 4. 宠物饲养员 ---------------- */
  keeper: {
    id:'keeper', name:'宠物饲养员', title:'BEAST KEEPER',
    color:'#8ee6b3', icon:'pet',
    blurb:'召唤一队各有本领的小家伙。宠物继承你的暴击，死了还会炸。',
    perkName:'兽群',
    perkDesc:'每把宠物武器自带一只（每种最多 3 只），继承你 60% 暴击。默认走「兽群」：宠物活着提供输出与减伤；拿到献祭类遗物后切成「献祭」：宠物死亡会爆炸并永久叠伤。',
    hp:340, speed:102, dmg:1.04, crit:0.07, critMul:1.6, armor:0.06, luck:1.0,
    weapon:'pet',
    schools:['beast', 'venom'],
    affinity:['summon', 'crit', 'elem', 'relic'],
    hasDevour: true,
    petLimit(){ return 6 + (relic('broodnest') ? 2 : 0); },
    guardByPets: true,
    xpMul: 1.15,   /* 召唤流本体输出低，靠宠物清场，经验给一点补偿（5.0：1.10 → 1.15） */
    petCrit(){ return ST.crit * 0.6; },

    /* 宠物死了不是"白掉一只"：同类会因此变凶（永久 +8% 伤害，最多 5 层）。
       不需要按键、不需要捡东西，死得越多同类越狠——玩家能直接看到的那句飘字。 */
    /* 【3.1 一致性修复】宠物死亡到底意味着什么，必须一条路走到底：
         兽群（默认）—— 同伴只是倒下，不炸、不叠伤，靠"活着"提供输出
         献祭（流派）—— 死亡即燃料：爆炸 + 永久叠伤 + 快速补员
       之前"死了炸一下 + 同类永久变凶 + 自动补员"三件事同时成立，
       既像护卫又像耗材，玩家读不出自己到底在玩哪种。 */
    onPetDeath(a){
      const sac = archTier('sacrifice');
      if(sac <= 0){
        addText(a.x, a.y - 18, '同伴倒下', '#a99ac2', 9);
        P.petRespawn = 4;
        return;
      }
      explode(a.x, a.y, 46, (22 + P.level * 5) * 1.5, '#ff6b8b', true, 'pet');
      P.petRespawn = sac >= 3 ? 0 : 4;
      if(sac >= 2){
        P.sacStack = Math.min(10, (P.sacStack || 0) + 1);
        addText(a.x, a.y - 20, '献祭 +2%', '#ff6b8b', 11);
        if(rings.length < 26) rings.push({ x:a.x, y:a.y, r0: 4, r1: 30, life: 0.22, max: 0.22, col:'#ff6b8b', w: 2 });
      }
    },
    hud(){
      let n = 0;
      for(let i = 0; i < allies.length; i++) if(allies[i].kind === 'pet' && !allies[i].dead) n++;
      return n ? ('宠物 ×' + n) : '';
    }
  },

  /* ---------------- 5. 冰火厨师 ---------------- */
  chef: {
    id:'chef', name:'冰火厨师', title:'FROST & FLAME',
    color:'#ff8a3d', icon:'flamer',
    blurb:'一手火一手冰。冻住再烤、烤完再冻，靠元素反应连锁清场。',
    perkName:'调和',
    perkDesc:'对身上有 2 种以上元素的敌人伤害 +35%；元素反应吃满，每次反应回复 0.9% 最大生命；冰火交替会自动补上缺少的那一层。',
    /* 【4.0】320 → 360，护甲 5 → 6 点。
       理由不是"他太脆所以加血"，而是：他是唯一一个**贴身打**的角色
       （喷火枪 150 射程），而"贴身"在 4.0 里终于真的会掉血了。
       同等级实测有效生命只有骑士的一半，而他的伤害又没有补偿这个差距。 */
    /* 【4.1】360 → 430，护甲 6 → 11 点，反应回血 0.68% → 0.90%。
       理由很直接：4.1 删掉了"燃烧中的敌人咬得更轻 ×0.72"，
       而那正是厨师唯一的一层隐形防御。他是全角色射程最短的一个（喷火枪 150），
       被围时吃到的接触伤害本来就是别人的两倍——
       以前靠一个乘数掩盖着，现在只能写进血条和护甲里。 */
    hp:490, speed:98, dmg:1.10, crit:0.05, critMul:1.6, armor:0.16, luck:1.0,
    weapon:'flamer',
    reactionMaster:true,
    schools:['fire', 'ice'],
    affinity:['elem', 'fire', 'ice', 'blast'],
    init(){
      REACT_MUL.melt = 1.15; REACT_MUL.toxblast = 1.15;
      REACT_MUL.superconduct = 1.15; REACT_MUL.conduct = 1.15;
      P.reactN = 0;
      /* 反应回血：厨师的续航挂在"打反应"上，而不是挂在一张防御卡上 */
      on('reaction', function(){ P.reactN = (P.reactN || 0) + 1; if(P && P.hp < P.maxHp) healPlayer(P.maxHp * 0.0090); });
    },
    /* 「冰火交替」：命中带火的敌人时补一层冰，命中带冰的敌人时补一层火。
       没有这条，厨师起手只有喷火枪（纯火），抽不到冰武器就一整个局面都打不出反应——
       他的专属机制等于不存在。现在从第一分钟开始就能自己搓反应。 */
    onHit(h){
      if(!h || !h.e || h.e.dead) return;
      const st = h.e.st;
      if(!st || st.reactCd > 0) return;
      if(st.fire > 0 && !(st.ice > 0)) applyElem(h.e, 'ice', 1.8, h.dmg || 20, 'react');
      else if((st.ice > 0 || h.e.slowT > 0) && !(st.fire > 0)) applyElem(h.e, 'fire', 1.8, h.dmg || 20, 'react');
    },
    damageMul(e){ return elemKinds(e) >= 2 ? 1.45 : 1; },
    hud(){ return P.reactN ? ('反应 ×' + P.reactN) : ''; }
  }
};

let CHAR = CHARS.ranger;

/* 角色钩子的统一入口（角色没实现的钩子直接跳过） */
function charHook(name, a, b){
  const p = CHAR;
  if(p && p[name]) return p[name](a, b);
  return undefined;
}
function charDamageMul(e, opt){
  return CHAR && CHAR.damageMul ? CHAR.damageMul(e, opt) : 1;
}

/* 一个敌人身上有几种元素 */
function elemKinds(e){
  if(!e || !e.st) return 0;
  let n = 0;
  if(e.st.fire > 0) n++;
  if(e.st.ice > 0 || (e.slowT || 0) > 0) n++;
  if(e.st.venom > 0) n++;
  if(e.st.volt > 0) n++;
  return n;
}
