/* =========================================================
   9. 战斗逻辑
   ========================================================= */
function nearestEnemy(x, y, maxD, skipId){
  let best = null, bd = (maxD || 1e9) ** 2;
  let bigBest = null, bigD = bd;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead || (skipId !== undefined && e.id === skipId)) continue;
    const dx = e.x - x, dy = e.y - y, d = dx*dx + dy*dy;
    if(e.big){
      if(d < bigD){ bigD = d; bigBest = e; }
    } else if(d < bd){
      bd = d; best = e;
    }
  }
  return bigBest || best;
}

function nearestBig(x, y, maxD){
  let best = null, bd = (maxD || 1e9) ** 2;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead || !e.big) continue;
    const dx = e.x - x, dy = e.y - y, d = dx*dx + dy*dy;
    if(d < bd){ bd = d; best = e; }
  }
  return best;
}

/* 通用爆炸：统一走 dealDamage，会触发事件与连锁 */
function explode(x, y, r, dmg, col, light, src){
  const col2 = col || '#ffd166';
  r *= ST.blast;
  if(rings.length < 22){
    rings.push({ x, y, r0: r * 0.22, r1: r * 1.1, life: 0.22, max: 0.22, col: col2, w: light ? 2 : 4 });
    if(!light) rings.push({ x, y, r0: r * 0.5, r1: r * 1.3, life: 0.24, max: 0.24, col: '#ffcf7a', w: 1.5 });
  }
  burst(x, y, col2, light ? 6 : 14, light ? 110 : 180);
  if(!light){ addShake(1.5); sfx('boom'); }
  const s = src || 'boom';
  eachNear(x, y, r, function(e){ dealDamage(e, dmg, { src: s }); });
  if(spend('boom')) emit('boom', { x, y, r, dmg, src: s });
}

function bubbleBoom(px, py, R0, dmg, src){
  R0 *= ST.blast;
  if(rings.length < 26) rings.push({ x:px, y:py, r0:R0*0.3, r1:R0, life:0.26, max:0.26, col:'#9de9ff', w:3 });
  const s = src || 'bubble';
  eachNear(px, py, R0, function(e){
    dealDamage(e, dmg, { src: s });
    if(!e.dead && !e.big && !(e.stun > 0)){
      const a = Math.atan2(e.y - py, e.x - px) || 0;
      e.x += Math.cos(a) * 13;
      e.y += Math.sin(a) * 13;
    }
  });
  burst(px, py, '#9de9ff', 12, 130);
  if(spend('boom')) emit('boom', { x: px, y: py, r: R0, dmg: dmg, src: s });
}

/* ---------------- 击杀 ---------------- */
function killEnemy(e, hit){
  if(e.dead) return;
  e.dead = true;
  /* 溢出斩：把这一击的 40% 溅到周围，"一炸一片"的爽感 */
  if(relic('overkill') && hit && hit.dmg > 0){
    eachNear(e.x, e.y, 62, function(o){
      if(o === e || o.dead) return;
      dealDamage(o, hit.dmg * 0.40, { src: 'relic' });
    });
    rings.push({ x:e.x, y:e.y, r0:6, r1:40, life:0.22, max:0.22, col:'#ff9d4d', w:2 });
  }
  state.kills++;
  /* 【4.2】护盾不再自然回充：每 25 次击杀回 4% 上限（打出来的防御）。
     第一版写的是"每 10 次击杀回 6%"，实测一局 6000 次击杀 = 回满 36 条盾，
     工程师直接变成 0.14 受伤/秒的无敌角色。量级必须按**击杀率**倒推：
     后期每秒 10 杀，1/25 × 4% ≈ 每秒 0.16% 上限，才是"补给"而不是"无敌"。 */
  if(typeof hasShield === 'function' && hasShield()) P.killShield = (P.killShield || 0) + 1 / 100;
  state.killAcc = (state.killAcc || 0) + 1;
  /* 3.0：顶部只放总击杀数。里程碑改在角色身上飘字，
     每 50 杀一次，用递进文案让"这局打得有多狠"有体感。 */
  if(state.kills % 50 === 0){
    const N = state.kills;
    const word = N >= 1000 ? '千杀！' : (N >= 500 ? '五百杀！' : (N >= 200 ? '两百杀！' : '五十杀！'));
    addText(P.x, P.y - 44, word, N >= 500 ? '#ff9dc0' : '#ffe066', 15);
    if(rings.length < 22) rings.push({ x:P.x, y:P.y, r0: 6, r1: 54, life: 0.3, max: 0.3, col:'#ffe066', w: 2 });
    sfx('streak');
  }

  /* 辣酱：烧死的敌人会炸开，把「点燃 → 连锁」这条线接上 */
  if((relic('hotsauce') || ST.heatTier >= 2) && e.st && e.st.burn > 0){
    explode(e.x, e.y, 54, e.maxHp * 0.10 + P.level * 3, '#ff8a3d', true, 'fire');
  }

  /* 3.0：击杀同时驱动三条资源线 —— 怒气、充能、吞噬 */
  if(P){
    rageGainRaw(RES.rageGainKill);
    /* 尸潮之怒：附近有人死就涨怒，清场速度直接换成怒气速度 */
    if(relic('ragefeast') && dist(e.x, e.y, P.x, P.y) < 220) rageGainRaw(3);
    chargeGain(RES.chargeKill);
    devourOnKill();
    if(archTier('growth') >= 2 && Math.random() < 0.04){
      dropHeal(e.x, e.y, 0.08);
    }
  }

  /* 吸血：和击杀回血共用每秒预算 */
  const healAmt = killHealAmount();
  if(healAmt > 0) drawKillHeal(healAmt);

  if(e.big){
    burst(e.x, e.y, e.col, 52, 250);
    rings.push({ x:e.x, y:e.y, r0:e.r, r1:110, life:0.6, max:0.6, col:e.col, w:5 });
    rings.push({ x:e.x, y:e.y, r0:e.r, r1:150, life:0.85, max:0.85, col:'#ffffff', w:2 });
    state.shake = 9;
    state.slow = 0.25;
    state.flash = 0.3;
    sfx('boss');
    bgmSetBoss(false);
    for(let i = 0; i < 10; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-26, 26), 6);
    for(let i = 0; i < 2; i++) dropHeal(e.x + rand(-34, 34), e.y + rand(-28, 28), 0.18);
    addText(e.x, e.y - 34, 'BOSS 击破！', '#ffe066', 14);
    forceLevelUp();
    state.bossKills = (state.bossKills || 0) + 1;
    if(!state.bossTtk) state.bossTtk = [];
    state.bossTtk.push(+(state.time - (e.spawnT || state.time)).toFixed(1));
    /* 卷轴只从 BOSS 掉：精英不该白送改造 */
    grantFreeMod('BOSS 卷轴');
    emit('bossDeath', e);
    if(e.final && !state.won){
      state.won = true;
      addText(e.x, e.y - 60, '通 关 ！', '#fff3b0', 22);
      showToast('👑 拖鞋之王倒下了 —— 通关！');
      /* 用帧计时而不是 setTimeout：结算延迟要能被模拟器复现 */
      state.winT = 1.4;
    }
  } else {
    burst(e.x, e.y, e.col, 10, 135);
    rings.push({ x:e.x, y:e.y, r0:e.r*0.7, r1:e.r*3.2, life:0.26, max:0.26, col:e.col, w:2 });
    dropGem(e.x, e.y, e.xp);
    sfx('kill');
    /* 精英词缀「爆裂」：死了也要拉你一起。近战贴脸杀它会吃一发。 */
    if(e.elite && e.affix === 'volatile'){
      explode(e.x, e.y, 74, Math.max(20, (e.dmg || 20) * 1.4), '#ff7a3d', false, 'elite');
      addHazard(e.x, e.y, 40, 2.6, Math.max(6, (e.dmg || 20) * 0.35), true);
      addText(e.x, e.y - 26, '爆裂！', '#ff9d4d', 12);
    }
    if(e.type === 'pudding'){
      for(let i = 0; i < 3; i++) spawnMini(e.x + rand(-16, 16), e.y + rand(-16, 16));
    }
    if(e.poison) addHazard(e.x, e.y, 30, 5.5, Math.max(6, e.dmg * 0.5));
    if(Math.random() < 0.030 * (ST.luck || 1)) dropHeal(e.x, e.y, 0.10);
  }

  if(spend('kill')){
    HIT.e = e; HIT.dmg = hit ? hit.dmg : 0; HIT.crit = hit ? hit.crit : false;
    HIT.src = hit ? hit.src : SRC; HIT.elem = hit ? hit.elem : null;
    emit('kill', HIT);
  }
}

function forceLevelUp(){
  P.level++;
  onLevel();
  P.xp = 0;
  P.xpNext = nextXp();
  state.pending++;
  if(state.mode === 'playing') showLevelUp();
}

/* ---------------- 掉落 ---------------- */
function dropGem(x, y, val){
  for(let i = 0; i < gems.length; i++){
    const g = gems[i];
    if(Math.abs(g.x - x) < 26 && Math.abs(g.y - y) < 26){
      g.val += val;
      g.col = g.val >= 4 ? '#ffd166' : (g.val >= 2 ? '#a0ffb0' : '#7df9ff');
      return;
    }
  }
  if(gems.length > 900){
    const old = gems.shift();
    let best = -1, bd = 1e18;
    for(let i = 0; i < gems.length; i += 3){
      const d = (gems[i].x - old.x) ** 2 + (gems[i].y - old.y) ** 2;
      if(d < bd){ bd = d; best = i; }
    }
    if(best >= 0) gems[best].val += old.val;
    else val += old.val;
  }
  const col = val >= 4 ? '#ffd166' : (val >= 2 ? '#a0ffb0' : '#7df9ff');
  gems.push({ x, y, val, col, vx: rand(-30, 30), vy: rand(-30, 30), seed: rand(0, 10), life: 0 });
}

function dropHeal(x, y, ratio){
  if(drops.length >= 6) return;
  drops.push({ x, y, kind:'hp', val: ratio, seed: rand(0, 10), life: 0, vx: rand(-14, 14), vy: rand(-14, 14) });
}

function gainXp(n){
  /* 只在很后期轻踩一脚：构建已经成型，不需要每 10 秒弹一次窗 */
  const damp = P.level > 24 ? Math.max(0.70, 1 - (P.level - 24) * 0.04) : 1;
  P.xp += n * ST.xpMul * damp * (CHAR.xpMul || 1);
  while(P.xp >= P.xpNext){
    P.xp -= P.xpNext;
    P.level++;
    onLevel();
    P.xpNext = nextXp();
    state.pending++;
  }
  if(state.pending > 0 && state.mode === 'playing') showLevelUp();
}

/* ---------------- 玩家受伤 ---------------- */
/* 反伤伤害：荆棘之心让反伤可以暴击，这是"挨打流"的质变点 */
function thornsHit(base){
  if(ST && ST.thornCrit && Math.random() < (ST.crit || 0)) return base * (ST.critMul || 1.6);
  return base;
}

/* 【4.0】唯一的受伤入口。
   opt.kind：'hit'（弹幕 / 陷阱 / 技能）/ 'contact'（贴脸被咬）/ 'boss'
   ---------------------------------------------------------
   以前 applyContact 自己算护甲、自己做闪避判定，于是：
     · 护盾、格挡、反射装甲、护盾流Ⅱ —— 对接触伤害全部失效
     · 闪避被算了两次（applyContact 一次、hurtPlayer 一次）
     · 反伤、血泵、怒气这些"挨打触发"的齿轮，贴脸时全部哑火
   现在两条路合并成一条：所有减伤 / 触发都在这里发生一次，
   接触伤害只是"不吃全局无敌帧"的一种输入，而不是另一套规则。 */
function hurtPlayer(d, opt){
  const kind = (opt && opt.kind) || 'hit';
  const isContact = kind === 'contact';
  if(state.mode !== 'playing') return 0;
  /* 全局无敌帧只保护"一下一下打过来"的东西；
     接触伤害由每只怪自己的攻击间隔负责节奏，所以不吃这层。 */
  if(!isContact && P.invuln > 0) return 0;
  if(ST.dodge > 0 && Math.random() < ST.dodge){
    if(!isContact) P.invuln = 0.22;
    addText(P.x, P.y - 26, '闪避', '#a6ffcb', 11);
    P.dodgeProc = true;
    if(relic('phasecloak')) P.phaseT = 1.2;   /* 闪避后 1.2 秒冷却窗口 */
    emit('dodge', d);
    return 0;
  }
  /* 铁壁：曾经是"每 12 秒完全挡下一次伤害"。4.1 取消——
     一次性完全免伤和护甲是两套语言，玩家没法把它算进"我能挨几下"。
     它的价值已经折算成护甲点数（见 44-relics 的 ironwall）。 */
  /* 【4.1】减伤只有一个数字：护甲。
     ---------------------------------------------------------
     4.0 在护甲之外还并行着四条"免伤"：
       · 遗物 hurtTaken（整体受伤 ×0.85 ~ ×1.15）
       · 骑士格挡（18% 概率挡掉 45%）
       · 护盾期减伤 8% / 反射装甲 20%
       · 饲养员的宠物挡刀 ×0.72
     每一条单看都很小，但乘在一起之后，面板写着"护甲 40%"
     实际却只挨了三成伤害——数字永远对不上体感，玩家也学不会
     "到底该堆什么"。现在它们全部折算成护甲点数（见 50-state 的 armorPts），
     受伤只走一条乘法。

     闪避刻意**不**并进来：它是"没被打到"（判定根本没发生），
     不是"少挨一点"，两者在玩法上是两件事。 */
  let real = d * (1 - (ST.armor || 0));
  P.shieldHitT = 0;

  /* 3.0 护盾：先于生命值吸收。完全挡住时不掉血、不进重伤反馈。 */
  if(P.shield > 0){
    const left = shieldAbsorb(real);
    if(left <= 0.01){
      if(!isContact) P.invuln = 0.28;
      rageGainRaw(RES.rageGainHurt * 0.6);
      emit('hurt', 0);
      return 0;
    }
    real = left;
  }

  P.hp -= real;
  P.lastHurt = state.time;
  /* 【3.6】伤害归因统计（不参与玩法） */
  if(state.dmgSrc){
    state.dmgSrc[isContact ? 'contact' : (state.bossHit ? 'boss' : 'hit')] += real;
    if(!isContact) state.bossHit = false;
  }
  state.hurtAcc = (state.hurtAcc || 0) + real;
  /* 【4.0】全局无敌帧 0.50 → 0.30，而且它现在**只管弹幕 / 陷阱 / BOSS 技能**。
     接触伤害已经改成"每只怪自己的攻击间隔"（applyContact），不吃这层保护——
     所以"被 20 只怪围住"和"被 1 只怪咬"终于有密度差了，
     而弹幕仍然有一次呼吸的余地。这两件事本来就不该共用一个数值。 */
  if(!isContact) P.invuln = 0.30;
  /* 被咬的观感反馈走 applyContact 的 0.28 秒聚合，避免 5 只怪同帧咬出 5 次震屏 */
  if(!isContact){
    state.shake = Math.max(state.shake, 4.5);
    state.hurtFlash = 0.36;
    burst(P.x, P.y, '#ff6b8f', 10, 120);
    sfx('hurt');
  }
  /* 怒气：挨打也涨，而且是"被围"时最快的一条线 */
  rageGainRaw(RES.rageGainHurt);
  emit('hurt', real);
  /* 血泵：挨的打有一部分直接折算成怒气（骑士"越挨打越凶"的专属齿轮） */
  if(relic('bloodpump') && hasRage()) rageGainRaw(real * 0.30 * 0.22);
  /* 反伤：挨打当场扎回去。
     原来只有 applyContact 里 0.35 秒一跳的持续反伤，打你一下完全没有反馈，
     玩家自然断定"反伤根本没触发"。这里补一个即时反馈 + 飘字。
     【4.0】贴脸（contact）不再走这一段：applyContact 自己有一条 0.25 秒的
     持续反伤，如果这里再扎一次，被围的时候反伤会翻倍——那是重复计算，不是加强。 */
  if(ST.thorns > 0 && !isContact){
    const refl = thornsHit(ST.thorns);
    eachNear(P.x, P.y, 54, function(o){
      dealDamage(o, refl, { src:'thorns' });
      burst(o.x, o.y, '#ffb0c4', 2, 80, 0);
    });
    addText(P.x, P.y - 40, '反伤 ' + Math.round(refl), '#ffb0c4', 10);
    rings.push({ x:P.x, y:P.y, r0:8, r1:40, life:0.18, max:0.18, col:'#ffb0c4', w:2 });
  }
  if(P.hp <= 0){
    P.hp = 0;
    gameOver();
  }
  return real;
}

/* =========================================================
   10. 生成敌人
   ========================================================= */
/* 每种怪的出场窗口：早期杂兵到点就退场，不会 10 分钟还在刷果冻 */
const SPAWN_TABLE = [
  { id:'slime',    from:0,   to:150, w:30 },
  { id:'carrot',   from:15,  to:210, w:22 },
  { id:'bat',      from:32,  to:240, w:20 },
  /* 远程线（3.3 加密）
     之前三种远程兵权重都只有 4，而且时间窗互不重叠——
     全表权重合计 150~200，远程只占 2%~6%，实测 10 分钟场上常年 0~2 只远程怪，
     玩家站着不动也不会被打到。
     现在：
       · 权重 4 → 6~8（约占刷怪的 10%~15%，原来只有 2%~6%）
       · 改成**两档并存**：中距离的喷吐/豌豆常驻，远距离的狙击与抛掷在后期接力
       · thrower 重新启用（后期超远抛掷，落点有预警圈，能躲）
     颜色仍然分段：早期粉(豌豆) → 中后期橙(喷吐/抛掷) + 深红(狙击)。 */
  { id:'shooter',  from:40,  to:300, w:8 },
  { id:'spitter',  from:200, to:99999, w:7 },
  /* 【3.5】狙击 / 抛掷提前登场（420→330、540→440）。
     实测中段（5~8 分钟）远程怪只有 2~4 只，占同屏 7%：
     近战怪被 AOE 清光，远程又还没上线，于是"炮台/召唤"这类大范围角色
     在中段几乎不掉血。远程是最难被 AOE 顺手清掉的威胁——
     让它在 5:30 就位，中段才有"必须走位"的理由。 */
  { id:'sniper',   from:330, to:99999, w:7 },
  { id:'thrower',  from:440, to:99999, w:6 },
  { id:'bomb',     from:62,  to:330, w:14 },
  { id:'pudding',  from:75,  to:360, w:13 },
  /* 汉堡 / 毒蘑菇不再到点退场：它们是后半场（和无尽）的主力杂兵，
     否则 10 分钟之后场上只剩重甲兵与疾行者，观感非常单调 */
  { id:'burger',   from:90,  to:99999, w:12 },
  { id:'ghost',    from:105, to:420, w:12 },
  { id:'frog',     from:120, to:450, w:13 },
  { id:'bee',      from:135, to:420, w:13 },
  { id:'mushroom', from:150, to:99999, w:10 },
  { id:'iron',     from:175, to:99999, w:9 },
  { id:'ant',      from:195, to:420, w:13 },
  { id:'brute',    from:240, to:99999, w:11 },
  { id:'runner',   from:300, to:99999, w:11 },
  { id:'nest',     from:360, to:99999, w:7 }
];

/* 小怪血量倍率：只跟时间有关 */
function enemyHpMul(t){
  /* 【2.6】同屏上限压到 235 之后，血量倍率补上来：
     怪少了 25%，但每只更硬——压力靠"耐打"，不靠"堆数量"（堆数量就是卡顿）。 */
  return 1 + t * 0.018 + Math.pow(t / 60, 2.3) * 0.34;
}

/* 【4.0】远程配额：从"场上最多 8/12/18 只"改成**威胁占比**。
   ---------------------------------------------------------
   写死只数的问题：远程怪之间差异巨大（狙击 34 血 vs 抛掷 72 血），
   "最多 18 只"在全是狙击时是灾难，在全是抛掷时又不够。
   现在比的是"远程占全场威胁的比例"，超过 38% 就暂时改刷近战。
   这样远程的存在感是恒定的，而不会随刷到哪种远程而抖。 */
const RANGED_SHARE = 0.38;

function pickType(budget){
  const t = state.time;
  const share = rangedThreatShare();
  const bag = [];
  for(let i = 0; i < SPAWN_TABLE.length; i++){
    const row = SPAWN_TABLE[i];
    if(t < row.from || t >= row.to) continue;
    const def = ENEMIES[row.id];
    if(!def) continue;
    if(def.shot && share > RANGED_SHARE) continue;
    const c = unitThreat(def, row.id);
    if(budget !== undefined && c > budget) continue;
    /* 便宜的多、贵的少：1/cost^0.55 让"堆杂兵"仍然是基本盘，
       但重甲 / 巢母这种高威胁单位会以能感知的频率出现。 */
    bag.push([row.id, 1 / Math.pow(c, 0.55)]);
  }
  if(!bag.length){
    if(budget !== undefined) return null;
    bag.push(['slime', 1]);
  }
  let total = 0;
  for(const b of bag) total += b[1];
  let r = Math.random() * total;
  for(const b of bag){
    r -= b[1];
    if(r <= 0) return b[0];
  }
  return bag[0][0];
}

/* 【3.5】刷怪点：从"均匀环形"改成"拦截式"
   ---------------------------------------------------------
   实测（tools/probe.mjs）：中后期同屏 230 只怪，但贴身（<70px）只有 1~2 只，
   最近 240px 内的平均距离还从 158px 一路涨到 186px。
   也就是说**怪根本追不上玩家**：玩家速度 130~150，慢怪后期也才 55~70，
   怪刷在 352px 外，玩家一直朝一个方向跑，它们永远隔着 200px 追。
   "同屏 230 只"是个假数字——威胁密度才是真的，而它一直在降。

   所以布点改为按移动方向拦截：
     · 62% 刷在玩家前进方向 ±62° 的扇形里（跑到哪里都撞上）
     · 38% 保持均匀环形（保留"从背后包上来"的压迫感）
   前期没有移动方向（P.mx/P.my 近似 0）时自动退回均匀环形。 */
function spawnPoint(){
  const maxR = Math.max(W, H);
  const mvx = P ? (P.mx || 0) : 0;
  const mvy = P ? (P.my || 0) : 0;
  /* 拦截强度也走曲线：前 2 分钟几乎不拦（等于原版环形刷），
     之后线性升到 52%。这样"前期是原样、后期才收紧"，
     而不是一上来就把所有人都按住。 */
  const t = state.time;
  const k = Math.min(1, Math.max(0, (t - 120) / 300));
  const biasPct = 0.10 + k * 0.42;
  const bias = Math.hypot(mvx, mvy) > 0.25 && Math.random() < biasPct;
  const baseA = bias ? Math.atan2(mvy, mvx) : rand(0, TAU);
  /* 半径从 0.55 收到 0.44：拦在前面的怪如果还在 352px 外，等于没拦。 */
  const biasRad = 0.55 - k * 0.08;
  for(let i = 0; i < 30; i++){
    const a = bias ? baseA + rand(-1.5 + k * 0.40, 1.5 - k * 0.40) : rand(0, TAU);
    const rad = maxR * (bias ? biasRad : 0.55) * rand(0.94, 1.06);
    const x = P.x + Math.cos(a) * rad;
    const y = P.y + Math.sin(a) * rad;
    if(x < 26 || y < 26 || x > ARENA.w - 26 || y > ARENA.h - 26) continue;
    if(x > cam.x - 6 && x < cam.x + W + 6 && y > cam.y - 6 && y < cam.y + H + 6) continue;
    return { x, y };
  }
  return {
    x: clamp(P.x + rand(-1, 1) * 340, 26, ARENA.w - 26),
    y: clamp(P.y + rand(-1, 1) * 220, 26, ARENA.h - 26)
  };
}

/* 同屏上限（幕段台阶）
   第一段沿用原公式（120 + t×0.32，到 168），所以**前 2.5 分钟和改前完全一样**；
   之后才逐幕抬高：190 → 250 → 300 → 340。
   台阶而不是一条直斜线，是因为"压力"要能被玩家感知成"这一幕更挤了"，
   而不是一根感觉不到的缓坡。 */
function actSpawnCap(t){
  if(t < 150) return 120 + t * 0.32;
  if(t < 330) return 190;
  if(t < 480) return 250;
  if(t < 600) return 300;
  return 340;
}

function addEnemy(type, px, py){
  const def = ENEMIES[type];
  if(!def) return;
  /* 最后一道闸：同屏上限随时间放开。
     【3.5】原来 235 在 t≈360 秒就封顶，之后"玩家 DPS"变成唯一的压力来源——
     你越强，怪越是被秒，缺口永远补不上，中后期自然就"随便打"。
     现在继续放开到 320（600 秒到顶），并且**按幕段给台阶**，
     让每一幕的上限都明显高于上一幕，而不是一条斜率递减的平滑线。
     320 是基于原 235 只的渲染实测：单帧更新仍在一档内，没有为难度牺牲帧率。 */
  const capNow = actSpawnCap(state.time);
  if(enemies.length >= capNow) return;
  const t = state.time;
  /* 小怪血量：前 2 分钟几乎不变，之后按 3 次方抬。
     目标不是"更难打死"，而是"后期杂兵不会一发就没"。 */
  const hpMul = enemyHpMul(t);
  /* 速度只跟时间线性长；"追不上玩家"这件事交给每只怪自己的饿意（见 64-update）。
     全局速度地板那种写法会让所有怪一起变快，观感像"集体瞬移"。 */
  const spdMul = 1.06 + Math.min(1.15, t * 0.0019);
  /* 【5.0】基础伤害重新定过（杂兵 26~58），曲线只到 2.45 倍 ——
     于是"一口占多少血"从第 1 分钟到第 10 分钟基本恒定。 */
  const dmgNow = def.dmg * atkCurve(t);
  const p = (px === undefined) ? spawnPoint() : { x:px, y:py };
  enemies.push({
    id: uid++,
    type, spr: def.spr, sc: def.sc || 1, big: false,
    x: p.x, y: p.y,
    hp: def.hp * hpMul * 0.72, maxHp: def.hp * hpMul * 0.72,
    speed: def.spd * spdMul * rand(0.92, 1.08) * (relic('greedpact') ? 1.20 : 1),
    r: def.r, dmg: dmgNow, slowT: 0, stun: 0,
    armor: def.armor || 0, knockRes: def.knockRes || 0,
    xp: Math.max(1, Math.round(def.xp * (1 + t * 0.0035 + Math.pow(t / 60, 2.1) * 0.05))),
    col: def.col, ai: def.ai || 'chase',
    alpha: def.alpha || 1, poison: !!def.poison, circleT: 0, shot: def.shot || null,
    flash:0, hitT:0, atkCd:0, banCd:0, seed: rand(0,10), anim:0,
    dashState:'walk', dashT: rand(1.2, 2.8), dashDir: 0, dashV: 0,
    /* 【4.1】威胁成本 / 饿意。韧性（破韧）已删除。 */
    threat: unitThreat(def, type),
    /* 【4.2】接触伤害改成"贴着就一直掉血"，怪不再需要攻击冷却 */
    hunt: 0,
    st: null, dead:false
  });
}

/* 【4.0】旧的"速度地板"已经删除。
   它把"怪追不上玩家"这个个体行为问题，用一个全局常数（玩家速度的 75%）去补，
   副作用是后期所有慢怪一起暴涨到同一个速度——玩家看到的是"集体瞬移"。
   现在由每只怪自己的饿意（64-update.js）负责：追得越久越快，咬到就消退。 */

function spawnMini(x, y){
  if(enemies.length >= actSpawnCap(state.time)) return;
  const t = state.time;
  const hpMul = 0.55 * (1 + t * 0.045 + Math.pow(t / 60, 3.0) * 0.55);
  /* 【4.0】分裂小怪也走统一攻击曲线（原来是自己写的一条 1+t*0.0035），
     并且补齐 threat 等字段 —— 少任何一个字段，
     它就绕过了刷怪经济、削韧和咬击节奏，变成"规则之外的东西"。 */
  const defMini = { hp:7, dmg:16, spd:48, r:3.8 };
  enemies.push({
    id: uid++, type:'slime', spr:'slime', sc:0.62, big:false,
    x, y, hp: 7*hpMul, maxHp: 7*hpMul,
    speed: 48 * (1 + Math.min(0.4, t * 0.001)),
    slowT: 0, stun: 0,
    r: 3.8, dmg: defMini.dmg * atkCurve(t), xp: 1, col:'#7fe08a', ai:'chase',
    threat: unitThreat(defMini, 'slime'),
    threat: unitThreat(defMini, 'slime'),
    hunt: 0,
    flash:0, hitT:0, atkCd:0, banCd:0, seed:rand(0,10), anim:0,
    dashState:'walk', dashT:1, dashDir:0, dashV:0, st:null, dead:false
  });
}

function spawnWave(){
  const t = state.time;
  const cap = actSpawnCap(t);
  /* 【4.0】刷怪改成"威胁预算"经济：
     每秒拿到 spawnBudget(t) 点额度，每只怪按自己的威胁成本计价，
     买完为止。加一种新怪只要给它定价，不用再去手调权重平衡。
     这样"混编"才有意义：同一笔预算，可以买一群蚂蚁，也可以买一只重甲。 */
  const interval = Math.max(0.26, 0.86 - t * 0.0011);
  let budget = spawnBudget(t) * interval * (state.bossAlive ? 2.0 : 1);
  let guard = 0;
  while(budget > 0.75 && enemies.length < cap && guard++ < 48){
    const ty = pickType(budget);
    if(!ty) break;
    const def = ENEMIES[ty];
    const pack = (ty === 'ant') ? 3 : 1;
    for(let k = 0; k < pack; k++){
      if(enemies.length >= cap) break;
      addEnemy(ty);
    }
    budget -= unitThreat(def, ty) * pack;
  }
  state.spawn = interval;
}

function spawnHorde(){
  const capH = actSpawnCap(state.time) + 70;
  if(enemies.length >= capH) return;
  const t = state.time;
  /* 【4.0】怪潮不再是"12 + 时间/45 只"，而是**一次性投入 5 秒的吞吐预算**。
     原来那个公式和刷怪经济完全脱钩：它不看怪多重、不看玩家清得多快，
     加一种新怪就要重新调一次 n。现在怪潮只是"把接下来 5 秒该刷的怪
     一次性堆到视野外"，和常规刷怪共用同一套威胁定价——
     强怪自动更少、弱怪自动更多，不需要第二套规则。 */
  let budget = spawnBudget(t) * 5.0;
  const plan = [];
  let guard = 0;
  while(budget > 0.75 && plan.length < 90 && guard++ < 60){
    const ty = pickType(budget);
    if(!ty) break;
    const def = ENEMIES[ty];
    plan.push(ty);
    budget -= unitThreat(def, ty);
  }
  const n = plan.length;
  if(!n) return;
  /* 【3.4】怪潮半径 250~330 → 400~500。
     原来这一圈是刷在**屏幕里面**的：玩家眼前突然凭空长出一圈怪，
     如果恰好抽到幽灵（半透明 + 冲刺），1.3 秒内就集体糊到身上，
     玩家连"它们从哪来"都看不清。
     现在刷在视野边缘以外，配合下面那个从 340 收到 250 的预警环，
     玩家有大约 1.5 秒反应时间——怪潮依然是压力，但不再是偷袭。 */
  for(let i = 0; i < n; i++){
    if(enemies.length >= capH) break;
    const a = (i / n) * TAU + rand(-0.08, 0.08);
    const d = rand(340, 430);
    addEnemy(plan[i], clamp(P.x + Math.cos(a) * d, 26, ARENA.w - 26),
                       clamp(P.y + Math.sin(a) * d, 26, ARENA.h - 26));
  }
  showToast('怪潮来袭！');
  sfx('swarm');
  rings.push({ x:P.x, y:P.y, r0:340, r1:250, life:0.7, max:0.7, col:'#ff8fb0', w:2 });
}

function spawnElite(){ spawnEliteAt(); }

function spawnEliteAt(x, y, type){
  if(enemies.length >= actSpawnCap(state.time) + 20) return;
  addEnemy(type || pickType(), x, y);
  const e = enemies[enemies.length - 1];
  if(!e || e.big) return;
  e.elite = true;
  e.sc *= 1.9;
  e.r *= 1.7;
  /* 精英血量按 BOSS 的比例定，而不是"怪种 ×固定倍数"。 */
  const bossBase = bossHpMul(state.time, state.bossIdx) * 1650;
  e.hp = e.maxHp = Math.min(Math.max(e.maxHp * 8, bossBase * 0.16), bossBase * 0.28);
  e.armor = 0.20;
  e.knockRes = 0.6;
  e.speed = Math.min(e.speed * 0.88, 92);
  e.dmg *= 2.2;
  e.xp = Math.round(e.xp * 12);

  /* 【3.0】精英不再只是"血厚的墙"：给它们一条行为词缀。
     以前精英 = 血×8、攻×2.2、速×0.88，本质上是一个会走的血包；
     现在至少有一件事需要玩家应对：
       charge  周期性蓄力冲撞（有 0.5 秒前摇，能躲）
       summon  定期召唤两只小怪（放着不管会越来越多）
       volatile 死亡时大范围爆炸（近战要算好距离） */
  const pool = ['charge', 'summon', 'volatile'];
  e.affix = pickOne(pool);
  if(e.affix === 'charge'){ e.hp = e.maxHp = Math.round(e.maxHp * 0.88); }
  else if(e.affix === 'summon'){ e.hp = e.maxHp = Math.round(e.maxHp * 1.05); }
  else { e.hp = e.maxHp = Math.round(e.maxHp * 0.92); }
  e.affixT = rand(1.6, 3.2);
  e.affixState = 'idle';

  const label = e.affix === 'charge' ? '冲锋' : (e.affix === 'summon' ? '召唤' : '爆裂');
  addText(e.x, e.y - 22, '✦ 精英 · ' + label, '#ffd166', 12);
}

/* BOSS：血量走**固定曲线**（只跟时间与第几只有关，绝不参考玩家数值）。
   曲线由 tools/balance.mjs 采集的人群 DPS 中位数反推，保证：
   成型 build 打 10–18 秒，弱 build 打不动 → 该被淘汰就被淘汰。 */
function bossHpMul(t, idx){
  /* 【5.0】8.2 × (t/60)^0.97 → 3.6 × (t/60)^1.00。
     ---------------------------------------------------------
     旧系数在 110 秒（第一个 BOSS）给出 21,500 血：
     当时玩家的实际输出大约 550 DPS，也就是说**第一个 BOSS 要打 40 秒**，
     而场上的杂兵还在源源不断刷。这不是"BOSS 很强"，
     这是"BOSS 变成了一场 40 秒的消耗战"——玩家感觉不到 BOSS 的威胁，
     只感觉到打得烦；打得久反而把难度转移给了杂兵。

     5.0 的方向是**短而危险的战斗**：
       · 第一个 BOSS 约 9,500 血 → 成型一半的构筑 15~20 秒打完
       · 10 分钟终局 BOSS 约 13 万血 → 成型的构筑 20 秒左右
       · 单次贴身伤害从 11~19 提到 46~70（见 46-enemies）
     于是"打 BOSS"变成一段需要专心走位的高压时间，而不是磨血。
     曲线仍然跟时间走，不跟玩家数值走——你变强就是打得更快。 */
  const m = 3.6 * Math.pow(Math.max(30, t) / 60, 1.00);
  return m * (1 + Math.min(9, idx) * 0.03);
}

function spawnBoss(keyOverride){
  const keys = ['candyKing', 'colaKing', 'burgerKing', 'jellyPope', 'veggieQueen', 'puddingTyrant'];
  const key = keyOverride || keys[state.bossIdx % keys.length];
  const def = BOSSES[key];
  const t = state.time;
  const idx = state.bossIdx;
  const hp = def.hp * bossHpMul(t, idx);

  const a = rand(0, TAU);
  const x = clamp(P.x + Math.cos(a) * 210, 40, ARENA.w - 40);
  const y = clamp(P.y + Math.sin(a) * 210, 40, ARENA.h - 40);
  enemies.push({
    id: uid++, type:'boss', bossType:key, name:def.name,
    spr:def.spr, sc:def.sc, big:true,
    x, y, hp: hp, maxHp: hp,
    /* 【2.6】BOSS 移速 ×2.2：原来 spd 20~30，玩家 94~108，
       BOSS 永远是"乌龟爬"，打不到人也就没有压力。 */
    speed: def.spd * 2.2 * (1 + Math.min(0.9, t * 0.0022)), slowT: 0, r: def.r,
    /* BOSS 血量涨了约 3 倍，玩家站桩时间也变 3 倍。
       技能伤害同步下调，否则"打得久"就变成"必被磨死"。 */
    /* 【4.0】BOSS 伤害走和杂兵同一条攻击曲线：它是一个绝对量，
       玩家的护甲 / 生命堆多少就吃多少，不再按 maxHp 百分比兜底。
       数值下调是因为"百分比地板"被拿掉了（见 bossDmg）。 */
    /* 【5.0】BOSS 贴身伤害 46~70（4.x 只有 11~19），
       配合 0.9 秒的咬击节奏，站桩吃三下就该死。 */
    dmg: def.dmg * atkCurve(t), xp: def.xp,
    col: def.col, crown: def.crown, ai: def.ai,
    flash:0, hitT:0, atkCd:1.6, banCd:0, seed:rand(0,10), anim:0,
    dashState:'walk', dashT:3, dashDir:0, dashV:0, dashQueue: 0,
    spiral: 0, spiralA: 0, spiralT: 0, spiralDir: 1,
    skillCd: 2.0, skill2Cd: 4.6, phase: 0, st:null, dead:false,
    spawnT: state.time,
    final: false
  });
  /* 【2.6】登场不再"清场"，只把 BOSS 附近的杂兵震退 300 像素。
     原来 boss 一出场就把全场小怪判死，结果 BOSS 反而成了最安全的时间段——
     压力源被 BOSS 自己清掉了。现在小怪留着，只是让出一个圈。 */
  let cleared = 0;
  for(let i = 0; i < enemies.length; i++){
    const o = enemies[i];
    if(o.big || o.dead) continue;
    const dd = dist(o.x, o.y, x, y);
    if(dd > 300) continue;
    const a2 = Math.atan2(o.y - y, o.x - x) || rand(0, TAU);
    const push = 300 - dd + 30;
    o.x = clamp(o.x + Math.cos(a2) * push, 10, ARENA.w - 10);
    o.y = clamp(o.y + Math.sin(a2) * push, 10, ARENA.h - 10);
    cleared++;
  }
  for(let r = 0; r < 3; r++){
    rings.push({ x, y, r0: 20 + r * 40, r1: 210 + r * 90, life: 0.55 + r * 0.12, max: 0.55 + r * 0.12,
      col: r === 0 ? '#ffffff' : def.col, w: 3 });
  }
  burst(x, y, '#fff6c8', 26, 220);
  if(cleared > 0) addText(x, y - 40, '杂兵被震退！', '#ffe066', 12);

  state.bossIdx++;
  state.bossAt = state.time + 90;
  showToast(def.hint || ('⚠ ' + def.name + ' 出现了！'));
  bgmSetBoss(true);
  sfx('boss');
  state.shake = 7;
  state.flash = 0.18;
}

/* 终局 BOSS：10 分钟一到，「拖鞋之王」登场，击败它就是通关 */
function spawnFinalBoss(){
  if(state.finalSpawned) return;
  state.finalSpawned = true;
  spawnBoss('slipperKing');
  const e = enemies[enemies.length - 1];
  if(e){ e.final = true; state.finalEnemy = e.id; }
  state.bossAt = 1e9;          /* 终局之后不再刷常规 BOSS */
  state.flash = 0.42;
  state.shake = 10;
  addText(P.x, P.y - 46, '最 终 BOSS', '#fff3b0', 18);
  rings.push({ x:P.x, y:P.y, r0:20, r1:260, life:0.9, max:0.9, col:'#ffd166', w:5 });
}

/* 通关计时：**不能只放在 updateGame 里**。
   击杀终局 BOSS 会顺带 forceLevelUp()，此时 mode 变成 'levelup'，
   updateGame 不再推进，胜利结算就永远等不到。
   所以用真实时间倒数，每帧无条件检查（除了已经在结算的状态）。 */
function checkWin(dt){
  if(state.mode === 'victory' || state.mode === 'gameover') return false;
  if(!(state.winT > 0)) return false;
  state.winT -= dt;
  if(state.winT > 0) return false;
  state.winT = 0;
  victory();
  return true;
}

/* --- 地面毒雾 --- */
function addHazard(x, y, r, life, dmg, fire){
  if(hazards.length >= 26) return;
  hazards.push({ x, y, r, life, max: life, dmg, tickT: 0.45, seed: rand(0, 10), fire: !!fire });
}

/* --- 激光 --- */
function fireBeam(x, y, ang, len, width, dmg, src){
  beams.push({ x, y, ang, len, width, life: 0.2, max: 0.2, src: src || 'beam', col:'#ff7ae0' });
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const mx = x + dx * len * 0.5, my = y + dy * len * 0.5;
  const s = src || 'beam';
  eachNear(mx, my, len * 0.5 + width, function(e){
    const rx = e.x - x, ry = e.y - y;
    const t = rx * dx + ry * dy;
    if(t < -e.r || t > len + e.r) return;
    const px = x + dx * clamp(t, 0, len);
    const py = y + dy * clamp(t, 0, len);
    if(dist(px, py, e.x, e.y) < width * 0.5 + e.r) dealDamage(e, dmg, { src: s });
  });
}

/* --- 敌弹 --- */
function shootAt(x, y, tx, ty, spd, dmg, col, homing, opt){
  if(ebullets.length > 70) return;
  const o = opt || {};
  const a = Math.atan2(ty - y, tx - x);
  ebullets.push({
    x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
    r: o.r || 4, dmg, col, life: o.life || 4.5,
    homing: homing || 0, boom: o.boom || 0
  });
}
function shootRing(x, y, n, spd, dmg, col, off){
  if(ebullets.length > 70) return;
  for(let i = 0; i < n; i++){
    const a = (off || 0) + i * TAU / n;
    ebullets.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, r:4.5, dmg, col, life:5.5, homing:0 });
  }
}

/* --- 自爆番茄 --- */
function enemySelfDestruct(e){
  e.dead = true;
  state.shake = Math.max(state.shake, 4.5);
  explode(e.x, e.y, 50, 58 * atkCurve(state.time), '#ff8a5c');
  /* 自爆 = "比咬一口重得多的那一下"，所以走同一个 e.dmg 的倍率，
     而不是 e.dmg + 12（那 12 点在 1 分钟时占七成，10 分钟后可以忽略——
     又是一个"只在前 3 分钟有存在感"的常数）。 */
  if(dist(e.x, e.y, P.x, P.y) < 50 + P.r) hurtPlayer(e.dmg * 1.85);
}
