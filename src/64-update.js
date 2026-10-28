/* =========================================================
   11. 更新
   ========================================================= */
function updateGame(dt){
  state.time += dt;
  resetBudget();
  resFrameReset(dt);

  /* 【6.0】动态属性重算（4 Hz）
     ---------------------------------------------------------
     石像鬼（贴身数）、复仇（损失生命）、血怒、熔炉（护甲）、复利（时间）、
     绝境（残血）这几件的数值**每帧都在变**，而 getStats 原本只在
     选卡 / 升级时调用 —— 于是它们的卡面写着"动态"，实际是一个固定值。

     这里按 4Hz 重算：足够跟上贴身数量的变化，又不会每帧遍历 200 件遗物。
     （不是新增乘区，只是把已经写好的公式接上它的输入。） */
  state.stT = (state.stT || 0) + dt;
  if(state.stT >= 0.25){ state.stT = 0; ST = getStats(); }

  /* --- 玩家移动 --- */
  let mx = 0, my = 0;
  if(keys['a'] || keys['arrowleft'])  mx--;
  if(keys['d'] || keys['arrowright']) mx++;
  if(keys['w'] || keys['arrowup'])    my--;
  if(keys['s'] || keys['arrowdown'])  my++;
  if(mx || my){
    const l = Math.hypot(mx, my);
    mx /= l; my /= l;
    /* 【3.5】记录平滑后的移动方向，供刷怪点做"拦截式"布点。
       直接读 keys 会在松手的瞬间丢方向，平滑之后刷怪点不会抖。 */
    P.mx = (P.mx || 0) * 0.86 + mx * 0.14;
    P.my = (P.my || 0) * 0.86 + my * 0.14;
    P.moving = true;
    P.stillT = 0;                        /* 「惯性」：一动就断 */
    P.anim += dt * (1 + Math.hypot(mx, my));
    if(mx > 0.1) P.facing = 1;
    else if(mx < -0.1) P.facing = -1;
  } else {
    P.mx = (P.mx || 0) * 0.90;
    P.my = (P.my || 0) * 0.90;
    P.moving = false;
    P.stillT = (P.stillT || 0) + dt;     /* 站定计时，供「惯性」判定 */
    P.anim += dt * 0.4;
  }
  /* 盾电池：护盾还在时跑得更快 */
  const shieldSpd = (P.shield > 0 && relic('shdbattery')) ? 1.06 : 1;
  const spd = ST.speed * shieldSpd;
  P.x = clamp(P.x + mx * spd * dt, 14, ARENA.w - 14);
  P.y = clamp(P.y + my * spd * dt, 14, ARENA.h - 14);
  /* 【4.0】冲刺：被围时唯一的解，也是"顺势"输出的来源 */
  dashTick(dt);

  /* 接触伤害的冷却按真实时间流逝。
     放在这里（而不是 applyContact 里）是为了让"离开接触"不冻结冷却：
     撞上去的第一口永远立刻结算，之后才是每 contactTick 一次。 */
  if(P.contactT > 0) P.contactT = Math.max(0, P.contactT - dt);

  if(P.invuln > 0) P.invuln -= dt;
  /* 【4.1 难度】脱战恢复：3.5 秒 / 1.8%/秒 → **4.5 秒 / 0.18%/秒**。
     ---------------------------------------------------------
     1.8%/秒意味着"风筝 6 秒回满 11% 血"，而清场本来就需要不停走位——
     于是每个角色都能自愈，掉血在结算面板上很难看，手感上却不存在。
     现在：脱战只能把你从"快死"拉回"还能再打一波"，不能当饭吃。 */
  if(P.lastHurt === undefined) P.lastHurt = -99;
  if(state.time - P.lastHurt > 4.5 && P.hp < P.maxHp){
    /* 脱战恢复改走治疗池。
       它原来是 healRaw（不受预算限制），而它是**按最大生命百分比**给的：
       1300 血的骑士脱战 5 秒就有 2.4 HP/秒的免费回复，叠在治疗桶之上，
       等于一个隐形血包。被动治疗只有一条路：healPlayer。 */
    healPlayer(P.maxHp * 0.0018 * dt);
  }
  if(state.hurtFlash > 0) state.hurtFlash -= dt;
  if(state.flash > 0) state.flash -= dt * 3.2;
  if(state.slow > 0) state.slow -= dt;
  if(state.shake > 0) state.shake = Math.max(0, state.shake - dt * 20);
  if(state.shakeCd > 0) state.shakeCd -= dt;
  if(state.hitstopCd > 0) state.hitstopCd -= dt;
  /* 愈合结晶：每 5 秒固定回 1.2%/级。独立节奏，不和击杀回血共用一个池，
     否则「愈合 2 级 = 0.9%/秒」会把击杀回血完全压死（旧版就是这样）。 */
  if(ST.regenLv > 0){
    P.regenT = (P.regenT === undefined ? 5 : P.regenT) - dt;
    if(P.regenT <= 0){
      P.regenT = 5;
      if(P.hp < P.maxHp) healPlayer(P.maxHp * 0.012 * ST.regenLv * (ST.regenMul || 1));
    }
  }
  /* 治疗预算的"记忆"：回血速度按 0.5 秒的时间常数衰减。
     它只让"同一瞬间刷几十次回血"变得不划算，不会永久惩罚玩家。 */
  state._dt = dt;
  healPoolTick(dt);

  /* --- 角色机制 --- */
  if(CHAR.tick) CHAR.tick(dt);

  /* --- 流派机制计时（连击 / 锐气 / 环绕格挡） --- */
  schoolTick(dt);

  /* --- 3.0 通用资源：怒气 / 超载 / 护盾 / 吞噬 --- */
  resTick(dt);

  /* --- 相机 --- */
  const tx = clamp(P.x - W / 2, 0, ARENA.w - W);
  const ty = clamp(P.y - H / 2, 0, ARENA.h - H);
  const k = 1 - Math.pow(0.00001, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);

  /* --- DPS 估计（只用于统计与调试，不再影响 BOSS 血量） --- */
  if(state.time - (state.dpsT || 0) >= 1){
    state.dpsT = state.time;
    state.dps = lerp(state.dps || 80, state.dmgAcc || 0, 0.5);
    state.dmgAcc = 0;
    if(!state.dpsLog) state.dpsLog = [];
    if(state.dpsLog.length < 1400) state.dpsLog.push([Math.round(state.time), Math.round(state.dps)]);
    /* 审计用：每秒真实击杀 / 受伤 / 回血 */
    if(!state.rate) state.rate = [];
    if(state.rate.length < 1400){
      state.rate.push([Math.round(state.time),
        +(state.killAcc || 0).toFixed(2),
        Math.round(state.hurtAcc || 0),
        Math.round(state.healAcc || 0),
        Math.round(P.hp), Math.round(P.maxHp)]);
    }
    /* 武器 DPS 采样：遗物伤害上限的基准 */
    state.wpnDps = lerp(state.wpnDps || 120, state.wpnAcc || 0, 0.5);
    state.wpnAcc = 0;
    state.relicAcc = 0;
    state.thornsAcc = 0;
    state.killAcc = 0; state.hurtAcc = 0; state.healAcc = 0;
  }

  /* --- 幕与节奏 --- */
  directorTick(dt);

  /* --- 刷怪 --- */
  state.bossAlive = false;
  for(let i = 0; i < enemies.length; i++){ if(enemies[i].big && !enemies[i].dead){ state.bossAlive = true; break; } }
  state.spawn -= dt;
  if(state.spawn <= 0) spawnWave();
  if(state.time >= state.bossAt) spawnBoss();
  /* 【3.5】中后期加压：精英与怪潮都从"固定节拍"改成"随幕收紧"。
     原来精英永远是 55 秒 1 只、怪潮永远 40~52 秒一次——
     玩家在 3 分钟时就摸清了这两条节奏，之后它们只算"背景音"。
     现在精英间隔 58→40 秒、7 分钟后成对出现；怪潮 48→32 秒。 */
  if(state.time >= state.eliteAt){
    const t = state.time;
    state.eliteAt = t + Math.max(40, 58 - t * 0.032);
    spawnElite();
    if(t > 420) spawnElite();          /* 一幕之下成对压上来 */
  }
  if(state.time >= state.hordeAt){
    const t = state.time;
    state.hordeAt = t + Math.max(32, 48 - t * 0.030) + rand(0, 6);
    spawnHorde();
  }

  /* --- 血包补给 --- */
  state.dropTimer -= dt;
  if(state.dropTimer <= 0){
    state.dropTimer = rand(13, 18);
    if(drops.length < 3){
      const a = rand(0, TAU), d = rand(60, 165);
      dropHeal(clamp(P.x + Math.cos(a) * d, 30, ARENA.w - 30),
               clamp(P.y + Math.sin(a) * d, 30, ARENA.h - 30), 0.12);
    }
  }

  /* 持续型武器（喷火枪 / 光环 / 电锯…）不走进开火循环，
     但充能是"开火就要付出"的转速表，所以这里按时间扣同样的比例。 */
  for(const cid in P.weapons){
    const cw = WEAPONS[cid];
    if(cw && cw.continuous) chargeSpend(dt * 1.1);
  }

  /* --- 武器开火 --- */
  for(const id in P.weapons){
    const w = WEAPONS[id];
    const lv = P.weapons[id];
    if(!w) continue;
    if(w.continuous) continue;
    P.cds[id] = (P.cds[id] === undefined ? 0.3 : P.cds[id]) - dt;
    if(P.cds[id] <= 0){
      w.fire(lv);
      /* 充能是转速表：开火就是消耗。打得准（命中多）才补得回来。 */
      chargeSpend(1.6);
      if(hasMod(id, 'echo') && Math.random() < 0.50) w.fire(lv);
      /* 回响之心：每次开火 10% 概率让所有武器立刻再齐射一轮 */
      if(relic('echoheart') && !P.echoLock && Math.random() < 0.10){
        P.echoLock = true;
        volleyAll();
        P.echoLock = false;
      }
      /* 传导齿轮：开火给"别的武器"减 CD —— 整套构筑越转越快 */
      if(relic('chggear') && !P.gearLock && state.time - (P.gearT || -9) > 0.8){
        P.gearT = state.time;
        P.gearLock = true;
        for(const oid in P.weapons){
          if(oid === id) continue;
          if(P.cds[oid] > 0) P.cds[oid] = Math.max(0.05, P.cds[oid] - 0.35);
        }
        if(rings.length < 24) rings.push({ x:P.x, y:P.y, r0:6, r1:34, life:0.16, max:0.16, col:'#7ce3ff', w:2 });
        P.gearLock = false;
      }
      /* 超载：冷却减半（电容再叠 25%） */
      const overloadCd = P.overload > 0 ? (relic('chgcap') ? 0.40 : 0.50) : 1;
      /* 狂战：全角色通用的冷却缩减（骑士更狠） */
      const berserkCd = P.berserk > 0 ? (ST.berserkRate || 0.72) : 1;
      /* 怒爆脉冲：引爆后 2 秒冷却 -38% */
      const detCd = (P.rageHaste > 0) ? 0.625 : 1;
      P.cds[id] = w.stats(lv).cd * ST.cdMul * wCdMul(id)
        * (CHAR.fireMul ? CHAR.fireMul() : 1) * (P.bloodrageOn ? 0.6 : 1)
        * overloadCd * berserkCd * detCd * chargeRateMul();
      if(!P.cds[id] || P.cds[id] < 0.08) P.cds[id] = 0.08;
    }
  }

  /* --- 持续型武器 --- */
  updateContinuous(dt);
  updateMeleeContinuous(dt);
  updateSwings(dt);

  /* --- 友方单位 --- */
  updateAllies(dt);
  alliesTakeContact(dt);

  /* --- 遗物每帧逻辑 --- */
  tickRelics(dt);

  /* --- 玩家子弹 --- */
  updateBullets(dt);

  /* --- 敌人 AI + 状态 --- */
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead) continue;
    if(e.flash > 0) e.flash -= dt;
    if(e.hitT > 0) e.hitT -= dt;
    if(e.atkCd > 0) e.atkCd -= dt;
    if(e.banCd > 0) e.banCd -= dt;
    if(e.big) e.fightT = (e.fightT || 0) + dt;
    if(e.stun > 0){
      e.stun -= dt;
      tickStatus(e, dt);
      continue;
    }
    if(e.baseSpeed === undefined) e.baseSpeed = e.speed;
    if(e.slowT > 0){
      e.slowT -= dt;
      /* 【2.6】减速从"只剩 34% 速度"放宽到 62%。 */
      /* 冷冻Ⅰ：冰缓减速再强一档 */
      e.speed = e.baseSpeed * (ST.freezeTier >= 1 ? 0.48 : 0.62);
    } else if(e.speed !== e.baseSpeed){
      e.speed = e.baseSpeed;
    }
    /* 【3.0 根因修复】追击加速度：
       玩家移速 96~110，杂兵基础速度只有 17~40（乘上时间系数也就 40~90）。
       只要一直跑，杂兵永远追不上——这正是"场上 245 只怪、贴身数始终是 0"
       以及短射程武器（骰子 / 喷火）"整场打不到人"的同一个根因。
       规则：离玩家超过 200 像素开始加速，到 420 像素封顶 ×3。
       近身之后加速消失，所以贴脸战斗的手感不变。 */
    /* 【4.0】追击从"全局速度地板"改成每只怪自己的**饿意**。
       旧写法是"所有慢怪的速度不低于玩家速度的 75%"——那是拿一个
       全局常数去补一个个体行为问题，副作用是所有怪突然一起变快。
       现在：每只怪离你够远且一直没咬到你，就会慢慢加速（约 9 秒到顶，
       最高 2 倍速），一旦贴身就消退。于是"绕圈跑"不再是免费的，
       但也不会出现"所有怪一起瞬移上来"的观感。 */
    if(!e.big){
      const dd = dist(e.x, e.y, P.x, P.y);
      if(dd > 170) e.hunt = Math.min(1, (e.hunt || 0) + dt / 9);
      else e.hunt = Math.max(0, (e.hunt || 0) - dt / 2.2);
      if(e.hunt > 0) e.speed *= 1 + 1.0 * e.hunt;
    }
    /* 【6.0】三条"敌人变慢 / 变快"的来源，全部写在卡面上：
         贪婪契约：全体 +20%（这是一直存在但从来没被读取的死字段，现在真的生效）
         霜环：贴身 120 内 -15%
         雷池：感电的 -20% */
    (function(){
      let em = (ST && ST.enemySpeed) ? ST.enemySpeed : 1;
      if(relic('frostring')){
        const dd2 = dist(e.x, e.y, P.x, P.y);
        if(dd2 < 120) em *= 1 - (evoFlag('frostring', 'fs25') ? 0.25 : 0.15);
      }
      if(relic('voltpool') && e.st && e.st.volt > 0) em *= 0.80;
      if(em !== 1) e.speed *= em;
    })();
    tickStatus(e, dt);
    if(e.dead) continue;
    updateEnemyAI(e, dt);
  }

  gridBuild();
  separate();
  /* 【3.4】必须紧跟在 separate() 之后：分离力会把贴身单位互相挤开，
     方向与玩家无关，会把已经贴边的怪重新怼进身体里。见 holdBodyOut 注释。 */
  holdBodyOut();
  applyContact(dt);

  let anyDead = false;
  for(let i = 0; i < enemies.length; i++) if(enemies[i].dead){ anyDead = true; break; }
  if(anyDead) enemies = enemies.filter(e => !e.dead);

  /* --- 敌弹 --- */
  if(state.orbCd > 0) state.orbCd -= dt;
  for(let i = ebullets.length - 1; i >= 0; i--){
    const b = ebullets[i];
    if(state.orbCd <= 0 && P.orbPos && P.orbPos.length){
      let blocked = false;
      for(let k2 = 0; k2 < P.orbPos.length; k2++){
        const o = P.orbPos[k2];
        if(dist(o.x, o.y, b.x, b.y) < o.r + b.r){ blocked = true; break; }
      }
      if(blocked){
        burst(b.x, b.y, '#ffe066', 5, 80, 0);
        state.orbCd = 0.42;
        ebullets.splice(i, 1);
        continue;
      }
    }
    b.life -= dt;
    if(b.homing){
      const a = Math.atan2(P.y - b.y, P.x - b.x);
      let cur = Math.atan2(b.vy, b.vx);
      let diff = a - cur;
      while(diff > Math.PI) diff -= TAU;
      while(diff < -Math.PI) diff += TAU;
      const na = cur + clamp(diff, -b.homing * dt, b.homing * dt);
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(na) * sp;
      b.vy = Math.sin(na) * sp;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if(b.life <= 0 || b.x < -20 || b.y < -20 || b.x > ARENA.w + 20 || b.y > ARENA.h + 20){
      ebullets.splice(i, 1);
      continue;
    }
    const pdx = b.x - P.x, pdy = b.y - P.y;
    const pd = Math.hypot(pdx, pdy);
    if(pd < b.r + P.r){
      /* 【4.0】敌弹回到绝对伤害：b.dmg 来自 enemy.dmg × 倍率，
         而 enemy.dmg 走 atkCurve 曲线。不再有 maxHp 百分比地板。 */
      hurtPlayer(b.dmg);
      burst(b.x, b.y, b.col, 5, 70, 0);
      /* 投掷手的爆弹：命中时炸开一小片（伤害已在 hurtPlayer 里结算） */
      if(b.boom){
        rings.push({ x:b.x, y:b.y, r0:6, r1:b.boom, life:0.28, max:0.28, col:b.col, w:3 });
        burst(b.x, b.y, b.col, 12, 150, 0);
      }
      ebullets.splice(i, 1);
      continue;
    }
  }

  /* --- 经验宝石 --- */
  const pr = ST.pickup;
  for(let i = gems.length - 1; i >= 0; i--){
    const g = gems[i];
    g.life += dt;
    const d = dist(g.x, g.y, P.x, P.y);
    if(d < pr){
      const pull = 250 + (pr - d) * 10;
      const a = Math.atan2(P.y - g.y, P.x - g.x);
      g.vx = lerp(g.vx, Math.cos(a) * pull, 0.3);
      g.vy = lerp(g.vy, Math.sin(a) * pull, 0.3);
    } else {
      g.vx *= 0.9;
      g.vy *= 0.9;
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if(d < 13){
      gainXp(g.val);
      burst(g.x, g.y, g.col, 4, 55, 0);
      sfx('gem');
      emit('gem', g);
      gems.splice(i, 1);
    }
  }

  /* --- 血包 --- */
  for(let i = drops.length - 1; i >= 0; i--){
    const h = drops[i];
    h.life += dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.vx *= 0.9;
    h.vy *= 0.9;
    if(dist(h.x, h.y, P.x, P.y) < 15){
      const heal = P.maxHp * h.val;
      const got = healRaw(heal);
      addText(P.x, P.y - 22, '+' + Math.round(got || heal), '#8ee06b', 11);
      burst(h.x, h.y, '#8ee06b', 10, 100, 0);
      rings.push({ x:h.x, y:h.y, r0:4, r1:26, life:0.32, max:0.32, col:'#8ee06b', w:2 });
      sfx('gem');
      drops.splice(i, 1);
    }
  }

  /* --- 黑洞 --- */
  for(let i = holes.length - 1; i >= 0; i--){
    const h = holes[i];
    h.life -= dt;
    h.acc = (h.acc || 0) - dt;
    if(h.life <= 0){
      if(h.evo) explode(h.x, h.y, h.r * 0.95, h.dmg * 5, '#b98cff', false, 'hole');
      holes.splice(i, 1);
      continue;
    }
    const tickNow = h.acc <= 0;
    if(tickNow) h.acc = h.tick;
    eachNear(h.x, h.y, h.r, function(e){
      const d = dist(h.x, h.y, e.x, e.y);
      const a = Math.atan2(h.y - e.y, h.x - e.x);
      const pull = e.big ? 0 : (1 - d / h.r) * 88 * dt;
      e.x += Math.cos(a) * pull;
      e.y += Math.sin(a) * pull;
      if(tickNow) dealDamage(e, h.dmg, { src:'hole' });
    });
    if(hasMod('hole', 'chill')){
      eachNear(h.x, h.y, h.r, function(e){ if(e.slowT < 0.4) e.slowT = 0.5; });
    }
  }

  /* --- 地雷 --- */
  for(let i = mines.length - 1; i >= 0; i--){
    const m = mines[i];
    m.arm -= dt;
    m.life -= dt;
    if(m.life <= 0){ mines.splice(i, 1); continue; }
    if(m.arm > 0) continue;
    let trig = false;
    eachNear(m.x, m.y, m.r + 4, function(){ trig = true; });
    if(trig){
      explode(m.x, m.y, m.boom, m.dmg, '#ff5f8f', true, m.src || 'mine');
      if(m.evo) addHazard(m.x, m.y, m.boom * 0.65, 2.0, 4, true);
      if(hasMod('mine', 'venom')) addHazard(m.x, m.y, m.boom * 0.6, 2.4, 5, false);
      mines.splice(i, 1);
    }
  }

  /* --- 毒雾 / 火墙 --- */
  for(let i = hazards.length - 1; i >= 0; i--){
    const h = hazards[i];
    h.life -= dt;
    h.tickT -= dt;
    if(h.tickT <= 0){
      h.tickT = 0.6;
      if(dist(h.x, h.y, P.x, P.y) < h.r + P.r) hurtPlayer(h.dmg);
      if(h.fire){
        eachNear(h.x, h.y, h.r, function(e){ applyElem(e, 'fire', 1.2, h.dmg * 3, 'hazard'); });
      }
    }
    if(h.life <= 0) hazards.splice(i, 1);
  }

  /* --- 光柱 --- */
  for(let i = beams.length - 1; i >= 0; i--){
    beams[i].life -= dt;
    if(beams[i].life <= 0) beams.splice(i, 1);
  }

  /* --- 延迟技能 --- */
  for(let i = strikes.length - 1; i >= 0; i--){
    const s = strikes[i];
    s.delay -= dt;
    if(s.delay <= 0){
      const src = s.src || (s.kind === 'bomb' ? 'popcorn' : (s.kind === 'bubble' ? 'bubble' : 'bolt'));
      if(s.kind === 'bomb'){
        explode(s.x, s.y, s.r, s.dmg, s.col || '#ffe9b8', false, src);
        /* 高压锅觉醒：一炸同时挂火与冰，不用第二把元素武器也能搓反应 */
        if(s.elem === 'hotcold'){
          eachNear(s.x, s.y, s.r, function(e){
            if(e.dead) return;
            applyElem(e, 'fire', 2.6, s.dmg * 0.12, src);
            applyElem(e, 'ice', 2.6, s.dmg * 0.12, src);
          });
        }
      } else if(s.kind === 'bubble'){
        bubbleBoom(s.x, s.y, s.r, s.dmg, src);
      } else if(s.kind === 'slam'){
        for(let w = 0; w < (s.waves || 1); w++){
          const rr = s.r * (1 + w * 0.35);
          rings.push({ x:s.x, y:s.y, r0:rr * 0.3, r1:rr, life:0.3 + w * 0.08, max:0.3 + w * 0.08,
            col:'#e0c8ff', w:4 });
          eachNear(s.x, s.y, rr, function(e){
            dealDamage(e, s.dmg * (w === 0 ? 1 : 0.5), { src:'ladle' });
            if(!e.big && !e.dead){
              const a = Math.atan2(e.y - s.y, e.x - s.x);
              e.x += Math.cos(a) * 18; e.y += Math.sin(a) * 18;
              e.stun = Math.max(e.stun || 0, 0.4);
            }
          });
        }
        burst(s.x, s.y, '#e0c8ff', 20, 200);
        addShake(3);
      } else {
        eachNear(s.x, s.y, s.r, function(e){
          dealDamage(e, s.dmg, { src, elem: src === 'bolt' || src === 'totem' ? 'volt' : null });
          e.flash = 0.12;
        });
        rings.push({ x:s.x, y:s.y, r0:s.r*0.25, r1:s.r*1.7, life:0.28, max:0.28, col:'#ffe066', w:3 });
        burst(s.x, s.y, '#fff3a8', 12, 150);
        addShake(1.2);
        if(src === 'bolt' || src === 'totem'){
          eachNear(s.x, s.y, s.r, function(e){ applyElem(e, 'volt', 2.2, s.dmg * 0.25, src); });
        }
      }
      strikes.splice(i, 1);
    }
  }

  /* --- 特效 --- */
  for(let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    p.life -= dt;
    if(p.life <= 0){ parts.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 240 * dt * (p.g === undefined ? 1 : p.g);
    p.vx *= 0.96;
  }
  for(let i = texts.length - 1; i >= 0; i--){
    const t = texts[i];
    t.life -= dt;
    t.y -= 28 * dt;
    if(t.life <= 0) texts.splice(i, 1);
  }
  for(let i = rings.length - 1; i >= 0; i--){
    const r = rings[i];
    r.life -= dt;
    if(r.life <= 0) rings.splice(i, 1);
  }

  updateHUD();
}

/* =========================================================
   武器：持续型（光环 / 环绕）
   ========================================================= */
function updateContinuous(dt){
  /* --- 回旋香蕉 --- */
  const blv = P.weapons.banana;
  P.orbPos = P.orbPos || [];
  P.orbPos.length = 0;
  if(blv){
    const s = WEAPONS.banana.stats(blv);
    const mul = ST.orbitMul || 1;
    P.orbAngle = (P.orbAngle || 0) + dt * s.rot;
    const dual = blv >= 5;
    const R = s.radius * ST.area * mul;
    P.orbR = R;
    const loops = dual ? 2 : 1;
    const dmg = s.dmg * wDmgMul('banana');
    for(let r = 0; r < loops; r++){
      const dir = r === 0 ? 1 : -1;
      const rr = r === 0 ? R : R * 0.64;
      const cnt = s.count;
      for(let i = 0; i < cnt; i++){
        const a = P.orbAngle * dir + i * TAU / cnt + r * 0.55;
        const bx = P.x + Math.cos(a) * rr;
        const by = P.y + Math.sin(a) * rr;
        if(P.orbPos.length < 24) P.orbPos.push({ x: bx, y: by, r: s.size + 2 });
        eachNear(bx, by, s.size + 8, function(e){
          if(e.banCd > 0) return;
          e.banCd = 0.3;
          dealDamage(e, dmg * (dual ? 1.3 : 1), { src:'banana' });
          hitMods(e, 'banana', dmg);
          burst(bx, by, '#ffe066', 2, 70, 0);
        });
      }
    }
  }

  /* --- 辣椒光环 --- */
  const alv = P.weapons.aura;
  if(alv){
    const as = WEAPONS.aura.stats(alv);
    const evo = alv >= 5;
    const R = as.radius * ST.area * ST.blast * (evo ? 1.3 : 1) * (hasMod('aura','size') ? 1.25 : 1);
    P.auraR = R;
    P.auraT = (P.auraT === undefined ? 0.2 : P.auraT) - dt;
    if(P.auraT <= 0){
      P.auraT = as.tick;
      P.auraPulse = 1;
      const dmg = as.dmg * wDmgMul('aura') * (evo ? 1.5 : 1);
      eachNear(P.x, P.y, R, function(e){
        dealDamage(e, dmg, { src:'aura', elem:'fire' });
        hitMods(e, 'aura', dmg);
        if(evo && !e.dead && !e.big){
          const a2 = Math.atan2(e.y - P.y, e.x - P.x);
          e.x += Math.cos(a2) * 8;
          e.y += Math.sin(a2) * 8;
        }
      });
      if(evo && rings.length < 22){
        rings.push({ x:P.x, y:P.y, r0:R * 0.35, r1:R, life:0.28, max:0.28, col:'#ff8a3d', w:2 });
      }
    }
    if(P.auraPulse > 0) P.auraPulse -= dt * 3.6;
  }
}

/* =========================================================
   子弹更新（含元素、弹跳、回旋镖回程）
   ========================================================= */
function updateBullets(dt){
  for(let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    b.life -= dt;

    /* 回旋镖：飞到一半掉头追玩家 */
    if(b.type === 'boomerang' && !b.returning && b.range && (b.trav || 0) > b.range * (b.back || 0.9)){
      b.returning = true;
      b.hitSet.clear();
      /* 回程换一个亮色，让"第二趟"在屏幕上看得出区别 */
      b.col = '#eafff3';
      b.vx *= 1.18;
      b.vy *= 1.18;
    }
    if(b.returning){
      const a = Math.atan2(P.y - b.y, P.x - b.x);
      const sp = Math.hypot(b.vx, b.vy);
      /* 转向从 0.12 提到 0.30：原来拐得太慢，玩家一走动它就绕大圈追不上，
         最后超时消失——这也是"不会飞回来"的一部分。 */
      b.vx = lerp(b.vx, Math.cos(a) * sp, 0.30);
      b.vy = lerp(b.vy, Math.sin(a) * sp, 0.30);
      if(!b.backDone){ b.backDone = true; b.dmg *= (b.backMul || 1.3); }
      if(dist(b.x, b.y, P.x, P.y) < 22){ bullets.splice(i, 1); continue; }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += (b.spin || 0) * dt;
    if(b.homing && !b.returning){
      const tgt = nearestEnemy(b.x, b.y, 300);
      if(tgt){
        const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let df = want - cur;
        while(df > Math.PI) df -= TAU;
        while(df < -Math.PI) df += TAU;
        const na = cur + clamp(df, -3.4 * dt, 3.4 * dt);
        const sp = Math.min(300, Math.hypot(b.vx, b.vy) + b.homing * dt);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
      }
    }
    b.trav = (b.trav || 0) + Math.hypot(b.vx, b.vy) * dt;
    if(b.range && b.trav > b.range && b.type !== 'boomerang'){
      burst(b.x, b.y, b.col || '#ffe9c9', 2, 34, 0);
      bullets.splice(i, 1);
      continue;
    }
    if(b.life <= 0 || b.x < -30 || b.y < -30 || b.x > ARENA.w + 30 || b.y > ARENA.h + 30){
      bullets.splice(i, 1);
      continue;
    }

    let gone = false;
    let hitOne = false;
    eachNear(b.x, b.y, b.r + 6, function(e){
      if(gone || hitOne) return;
      if(b.hitSet.has(e.id)) return;
      if(e.dead) return;
      b.hitSet.add(e.id);
      hitOne = true;
      b.hitCount = (b.hitCount || 0) + 1;

      /* 【2.6】把子弹自身的 bounce 标记带进伤害管线：
         跳弹遗物生成的子弹命中时若不带上这个标记，会再触发一次跳弹，
         于是 1 → 2 → 4 → 8 指数繁殖到 700 发上限——这就是"选了弹射就卡死"。
         现在跳弹只生一代。 */
      /* 【6.0】贯穿衰减：穿透不再只是"能打到第几个"，它同时决定"打到之后还剩多少"。
         ---------------------------------------------------------
         旧规则：`hitCount > pierce` 就消失，穿透后的伤害一分不减。
         于是"穿透 +1"对 44 把武器完全无效、对 3 把自带上限的武器也无效，
         这个属性在三选一里长期是空卡。

         现在：
           基础保留率 = 0.85 + 穿透点 × 0.03（最多 0.99）
           穿甲Ⅱ「穿透不衰减」= 固定 1.00
           穿甲Ⅲ「越穿越狠」= 改成 1.10（每多穿一个目标反而更痛）
         保留率按命中次数取幂，所以第 1 个目标永远 100%。 */
      let bdmg = b.dmg;
      if((b.hitCount || 0) > 1){
        const pt = (typeof ST !== 'undefined' && ST && ST.pierce) || 0;
        const pTier = (typeof archTier === 'function') ? archTier('pierce') : 0;
        let keep = Math.min(0.99, 0.85 + pt * 0.03);
        if(pTier >= 2) keep = 1.00;
        if(pTier >= 3) keep = 1.10;
        bdmg *= Math.pow(keep, b.hitCount - 1);
      }
      dealDamage(e, bdmg, { src: b.src || 'misc', elem: null, bounce: !!b.bounce });
      /* 【2.6】弹射跳不再挂元素：弹射是"伤害扩散"，不该顺手把元素触发率
         乘上弹射次数——那正是"选了弹射之后连锁到卡死"的一半原因。 */
      if(b.elem && b.elem.length && !b.bounced) elemOnHit(e, b.elem, b.dmg, b.src);
      if(b.slow) e.slowT = Math.max(e.slowT || 0, b.slow);
      if(b.knock && !e.big){
        const ka = Math.atan2(e.y - b.y, e.x - b.x) || 0;
        e.x = clamp(e.x + Math.cos(ka) * b.knock, 8, ARENA.w - 8);
        e.y = clamp(e.y + Math.sin(ka) * b.knock, 8, ARENA.h - 8);
      }
      if(b.lucky6 && !e.dead) applyElem(e, 'volt', 1.4, b.dmg * 0.3, b.src);

      /* 命中爆裂 */
      if(b.boom && b.boom > 0) explode(b.x, b.y, b.boom, b.dmg * (b.boomMul === undefined ? 0.5 : b.boomMul), b.col || '#ffd166', false, b.src || 'misc');

      /* 分裂 */
      if(b.split && !b.splitDone){
        b.splitDone = true;
        for(let k2 = 0; k2 < b.split; k2++){
          const a2 = (k2 / b.split) * TAU + rand(-0.2, 0.2);
          bullets.push({
            type:'shot', x:b.x, y:b.y,
            vx: Math.cos(a2) * 200, vy: Math.sin(a2) * 200,
            r:4, dmg: b.dmg * 0.45, life:1.0, pierce:0,
            hitSet:new Set(), hitCount:0, rot:a2, spin:0,
            col:b.col || '#ffe066', src:b.src, range: 180
          });
        }
      }

      /* 跳弹 / 弹跳 */
      const bounceN = b.bounces || 0;
      /* 【2.6】弹射跳受全局预算约束（18 次/帧），并且标记 b.bounced：
         后续这一发子弹的命中不再挂元素。弹射回到"伤害扩散"的本职。 */
      if(bounceN > 0 && spend('chain')){
        b.bounces = bounceN - 1;
        b.bounced = true;
        const nx = nearestEnemy(b.x, b.y, 240, e.id);
        if(nx){
          const a = Math.atan2(nx.y - b.y, nx.x - b.x);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
          b.hitSet.clear();
          b.hitSet.add(e.id);
          burst(b.x, b.y, b.col || '#ffc2d6', 3, 60, 0);
        } else if(b.hitCount > (b.pierce === undefined ? 0 : b.pierce)) gone = true;
      } else if(b.type === 'candy' && b.bounces === 0){
        b.bounces = -1;
        gone = true;
      } else if(b.hitCount > (b.pierce === undefined ? 0 : b.pierce)){
        gone = true;
      }
    });
    if(gone){
      burst(b.x, b.y, b.col || '#ffe9c9', 3, 60, 0);
      bullets.splice(i, 1);
    }
  }
}
