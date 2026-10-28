/* =========================================================
   4.55 流派机制
   ---------------------------------------------------------
   元素反应（融化 / 毒爆 / 超导 / 导电）是**厨师**的专长：
   只有拿到「调和」的厨师才有反应加成与反应回血，别的角色只是沾到状态伤害。

   其它流派必须有自己的机制联动，否则所有 build 最后都在打元素反应。
   这里给每个流派一条"真正干活"的机制，全部走统一伤害管线与事件总线，
   不需要在武器代码里写任何 if：

     近战  · 连击    连续命中叠层，越打越疼，断手就掉
     穿甲  · 破甲    穿透命中给目标叠破甲，全队伤害都吃加成
     阵地  · 火力网  炮台命中打标记，其它炮台打标记目标加成
     兽群  · 兽群    宠物集火叠标记；宠物击杀让全体宠物变强
     爆破  · 连锁爆  爆炸有概率引发二次小爆炸
     暴击  · 锐气    暴击叠锐气（暴击率 + 爆伤），停手就衰减
     环绕  · 环绕格挡 环绕体持续清掉靠近的敌弹
     元素  · 反应    厨师专属
   ========================================================= */

const SCHOOL_MECH = {
  melee:   { name:'连击',      icon:'⚔', desc:'近战连续命中叠连击，每层 +5% 近战伤害；1.8 秒不命中就断' },
  pierce:  { name:'破甲',      icon:'➤', desc:'穿透类命中叠破甲（最多 5 层），目标受到的所有伤害 +7%/层' },
  fort:    { name:'火力网',    icon:'▣', desc:'炮台命中打上标记 2.4 秒，炮台打标记目标 +25%/级' },
  beast:   { name:'兽群',      icon:'🐾', desc:'宠物集火同一目标叠标记（最多 5 层），宠物伤害 +8%/层；宠物击杀后全体宠物 +8%' },
  blast:   { name:'连锁爆',    icon:'✹', desc:'爆炸有概率在附近再引发一次小爆炸' },
  crit:    { name:'锐气',      icon:'✦', desc:'暴击叠锐气：+1.5% 暴击率 / +3% 爆伤每层，3 秒不出暴击开始衰减' },
  orbit:   { name:'环绕格挡',  icon:'◍', desc:'环绕体持续清除靠近你的敌弹，并把贴身的敌人推远' },
  fire:    { name:'灼烧反应',  icon:'🔥', desc:'厨师专长：燃烧 / 融化，反应伤害与回血只有厨师吃满' },
  ice:     { name:'霜寒反应',  icon:'❄', desc:'厨师专长：冰缓 / 冻结 / 超导，非厨师只吃到基础效果' },
  volt:    { name:'感电反应',  icon:'⚡', desc:'厨师专长：感电链与超导，非厨师只吃到基础效果' },
  venom:   { name:'剧毒反应',  icon:'☠', desc:'厨师专长：中毒 / 毒爆，非厨师只吃到基础毒伤' }
};

/* 每种流派当前有几把武器 → 机制等级 0~3 */
function recomputeSchoolTiers(){
  if(!P) return;
  const t = {};
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(w && w.school) t[w.school] = (t[w.school] || 0) + 1;
  }
  for(const k in t) t[k] = Math.min(3, t[k]);
  P.scT = t;
  if(!P.sc) P.sc = {};
}

/* 流派专属结晶的等级（没拿就是 0） */
function gemLv(id){
  return (P && P.passives && P.passives[id]) ? P.passives[id] : 0;
}

function schoolTier(sid){
  return (P && P.scT && P.scT[sid]) ? P.scT[sid] : 0;
}

/* 某个来源属于哪个流派 */
function srcSchool(src){
  if(!src) return null;
  if(src === 'turret') return 'fort';
  if(src === 'pet') return 'beast';
  const w = WEAPONS[src];
  if(w && w.school) return w.school;
  if(MELEE[src]) return 'melee';
  return null;
}

/* ---------------------------------------------------------
   伤害侧的联动（在 dealDamage 里调用，所有来源统一吃）
   --------------------------------------------------------- */
function schoolDamageMul(e, src){
  if(!P || !P.scT) return 1;
  const T = P.scT, S = P.sc || {};
  const now = state.time;
  let m = 1;

  /* 近战连击（连击刻印会加码） */
  if(T.melee && MELEE[src] && S.combo > 0){
    m *= 1 + S.combo * (0.05 + gemLv('combogem') * 0.02);
  }
  /* 破甲：任何来源都吃 */
  if(T.pierce && e.pierceUntil > now && e.pierceS > 0){
    m *= 1 + e.pierceS * (0.07 + gemLv('breakpin') * 0.03);
  }
  /* 火力网：炮台打被标记的目标 */
  if(src === 'turret' && T.fort && e.turretUntil > now){
    m *= 1 + 0.25 * Math.min(2, T.fort) + gemLv('gridchip') * 0.10;
  }
  /* 兽群：宠物集火标记 + 击杀后全体变强 */
  if(src === 'pet' && T.beast){
    if(e.packUntil > now && e.packMark > 0) m *= 1 + e.packMark * 0.08;
    m *= 1 + gemLv('packhorn') * 0.15;
    if(S.packUntil > now && S.pack > 0) m *= 1 + S.pack * 0.08;
  }
  return m;
}

/* ---------------------------------------------------------
   每帧：计时器衰减 + 环绕格挡
   --------------------------------------------------------- */
function schoolTick(dt){
  if(!P || !P.sc) return;
  const S = P.sc, T = P.scT || {};

  if(S.combo > 0){
    S.comboT -= dt;
    if(S.comboT <= 0) S.combo = 0;
  }
  if(S.sharp > 0 && state.time - (S.sharpT || 0) > 3){
    S.sharpDecay = (S.sharpDecay || 0) + dt;
    if(S.sharpDecay > 1){
      S.sharpDecay = 0;
      S.sharp = Math.max(0, S.sharp - 1);
    }
  }

  /* 包围圈：清子弹 + 推开贴脸的怪 */
  if(T.orbit){
    S.orbitT = (S.orbitT || 0) - dt;
    if(S.orbitT <= 0){
      S.orbitT = Math.max(0.18, 0.55 - T.orbit * 0.08 - gemLv('guardring') * 0.10);
      const R = (P.orbR || 46) * 1.15;
      for(let i = ebullets.length - 1; i >= 0; i--){
        const b = ebullets[i];
        if(dist(b.x, b.y, P.x, P.y) < R){
          burst(b.x, b.y, '#9fe8ff', 3, 70, 0);
          ebullets.splice(i, 1);
        }
      }
      eachNear(P.x, P.y, R, function(e){
        if(e.big || e.dead) return;
        const a = Math.atan2(e.y - P.y, e.x - P.x);
        e.x += Math.cos(a) * 2.5;
        e.y += Math.sin(a) * 2.5;
      });
    }
  }
}

/* ---------------------------------------------------------
   事件监听（每局注册一次）
   --------------------------------------------------------- */
function initSchoolMech(){
  P.sc = { combo:0, comboT:0, sharp:0, sharpen:0, pack:0, packUntil:0, orbitT:0 };

  /* ---- 命中 ---- */
  on('hit', function(h){
    const e = h.e, src = h.src;
    if(!e || e.dead || !P.scT) return;
    const T = P.scT, S = P.sc;
    const now = state.time;

    /* 近战连击 */
    if(T.melee && MELEE[src]){
      const cap = 4 + T.melee * 3 + gemLv('combogem') * 3;
      if(S.combo < cap) S.combo++;
      S.comboT = 1.8;
    }

    /* 穿甲：破甲叠层（只由穿甲类武器叠） */
    if(T.pierce && srcSchool(src) === 'pierce'){
      e.pierceS = Math.min(5 + gemLv('breakpin') * 2, (e.pierceS || 0) + 1);
      e.pierceUntil = now + 4;
    }

    /* 火力网：炮台打标记 */
    if(src === 'turret' && T.fort){
      e.turretUntil = now + 2.4 + gemLv('gridchip');
    }

    /* 兽群：宠物集火 */
    if(src === 'pet' && T.beast){
      e.packMark = Math.min(5, (e.packMark || 0) + 1);
      e.packUntil = now + 2.6;
    }

  });

  /* ---- 暴击：锐气 ---- */
  on('crit', function(){
    if(!P.scT || !P.scT.crit) return;
    const cap = 6 + P.scT.crit * 3;
    P.sc.sharp = Math.min(cap, (P.sc.sharp || 0) + 1);
    P.sc.sharpT = state.time;
  });

  /* ---- 击杀：兽群强化 ---- */
  on('kill', function(h){
    if(!P.scT || !P.scT.beast) return;
    if(h.src !== 'pet') return;
    P.sc.pack = Math.min(3, (P.sc.pack || 0) + 1);
    P.sc.packUntil = state.time + 5;
  });

  /* ---- 爆炸：连锁爆 ---- */
  on('boom', function(b){
    if(!P.scT || !P.scT.blast) return;
    if(!b || b.chain) return;                       /* 二次爆炸不再连锁，防递归 */
    const chance = 0.18 + P.scT.blast * 0.10 + gemLv('corebomb') * 0.10;
    if(Math.random() > chance) return;
    if(!spend('boom')) return;
    const list = [];
    eachNear(b.x, b.y, b.r * 1.6, function(e){ if(!e.dead) list.push(e); });
    if(!list.length) return;
    const tgt = pickOne(list);
    const r2 = b.r * 0.62 * (1 + gemLv('corebomb') * 0.15);
    rings.push({ x:tgt.x, y:tgt.y, r0:r2 * 0.3, r1:r2, life:0.2, max:0.2, col:'#ff9d4d', w:3 });
    eachNear(tgt.x, tgt.y, r2, function(e){
      dealDamage(e, (b.dmg || 10) * 0.45, { src: b.src || 'blast', mul: 1 });
    });
    sfx('boom');
  });
}
