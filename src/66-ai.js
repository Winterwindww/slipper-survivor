
/* --- 敌人行为 --- */

/* 远程怪默认弹道（豌豆射手不单独配 shot 时用它） */
const RANGED_DEFAULT = { keep:[150,215], range:330, cd:2.6, n:1, spd:112, mul:0.8, col:'#ff4fd8', r:4 };

/* 按配置开火：n 连发 + 扇形扩散 + 可选落点爆炸 */
function fireShot(e, cfg, aimAng){
  const n = cfg.n || 1;
  const base = (aimAng === undefined) ? Math.atan2(P.y - e.y, P.x - e.x) : aimAng;
  for(let k = 0; k < n; k++){
    const off = (n > 1) ? (k - (n - 1) / 2) * (cfg.spread || 0.18) : 0;
    const a = base + off;
    shootAt(e.x, e.y - 2, e.x + Math.cos(a) * 120, e.y + Math.sin(a) * 120,
            cfg.spd, e.dmg * (cfg.mul || 1), cfg.col, 0, cfg);
  }
  burst(e.x, e.y - 4, cfg.col, 5, 70, 0);
  sfx('shoot');
}

/* ---------------- 3.0 精英词缀 ----------------
   精英的核心问题一直不是"不够厚"，而是"没有行为"：
   以前它们只是一堵会走路的墙，玩家绕着走就行。
   这里给三条可读、可应对的行为，让精英真的需要"处理"。 */
function eliteAffixTick(e, dt, d, ang){
  if(!e.affix) return;
  if(e.affix === 'charge'){
    if(e.affixState === 'idle'){
      e.affixT -= dt;
      if(e.affixT <= 0 && d < 340){
        e.affixState = 'wind';
        e.affixT = 0.5;
        e.affixDir = ang;
        addText(e.x, e.y - e.r - 12, '蓄力！', '#ff9d4d', 11);
        sfx('whoosh');
      }
    } else if(e.affixState === 'wind'){
      e.affixT -= dt;
      /* 前摇期间缓慢转向：给玩家"往侧面走"的时间 */
      let df = ang - e.affixDir;
      while(df > Math.PI) df -= TAU;
      while(df < -Math.PI) df += TAU;
      e.affixDir += clamp(df, -2.2 * dt, 2.2 * dt);
      if(Math.random() < 0.55) burst(e.x, e.y + e.r, '#ffb066', 1, 40, 0);
      if(e.affixT <= 0){ e.affixState = 'go'; e.affixT = 0.40; }
    } else {
      e.affixT -= dt;
      const sp = e.speed * 4.4;
      e.x += Math.cos(e.affixDir) * sp * dt;
      e.y += Math.sin(e.affixDir) * sp * dt;
      if(Math.random() < 0.75) burst(e.x, e.y, '#ffb066', 1, 30, 0);
      if(e.affixT <= 0){ e.affixState = 'idle'; e.affixT = rand(3.4, 5.0); }
    }
  } else if(e.affix === 'summon'){
    e.affixT -= dt;
    if(e.affixT <= 0){
      e.affixT = 6.5;
      if(enemies.length < 228){
        for(let k = 0; k < 2; k++) addEnemy('ant', e.x + rand(-22, 22), e.y + rand(-22, 22));
        burst(e.x, e.y, e.col || '#ffb0c4', 10, 90, 0);
        rings.push({ x:e.x, y:e.y, r0:6, r1:44, life:0.3, max:0.3, col:e.col || '#ffb0c4', w:2 });
        sfx('deploy');
      }
    }
  }
}

function updateEnemyAI(e, dt){
  const dx = P.x - e.x, dy = P.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);

  if(e.big){ bossAI(e, dt, d, ang); return; }
  if(e.elite) eliteAffixTick(e, dt, d, ang);

  switch(e.ai){
    case 'weave': {
      e.anim += dt * 5;
      const w = Math.sin(state.t * 7 + e.seed) * 0.55;
      e.x += Math.cos(ang + w) * e.speed * dt;
      e.y += Math.sin(ang + w) * e.speed * dt;
      break;
    }
    case 'dash': {
      e.anim += dt * 3;
      if(e.dashState === 'walk'){
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt;
        e.dashT -= dt;
        if(e.dashT <= 0 && d < 240){ e.dashState = 'wind'; e.dashT = 0.42; e.dashDir = ang; }
      } else if(e.dashState === 'wind'){
        e.dashT -= dt;
        e.dashDir = ang;
        e.x += Math.cos(e.dashDir) * e.speed * 0.12 * dt;
        e.y += Math.sin(e.dashDir) * e.speed * 0.12 * dt;
        if(Math.random() < 0.4) burst(e.x, e.y + e.r, '#ffb066', 1, 40, 0);
        if(e.dashT <= 0){ e.dashState = 'dash'; e.dashT = 0.42; }
      } else {
        e.dashT -= dt;
        e.x += Math.cos(e.dashDir) * e.speed * 3.6 * dt;
        e.y += Math.sin(e.dashDir) * e.speed * 3.6 * dt;
        if(Math.random() < 0.6) burst(e.x, e.y, '#ffb066', 1, 30, 0);
        if(e.dashT <= 0){ e.dashState = 'walk'; e.dashT = rand(1.9, 3.0); }
      }
      break;
    }
    case 'ranged': {
      e.anim += dt * 2;
      /* 按 e.shot 的 keep 区间走位：近身后撤、太远前压、区间内绕圈 */
      const cfg = e.shot || RANGED_DEFAULT;
      const near = cfg.keep[0], far = cfg.keep[1];
      const mv = e.speed;
      if(d < near){
        e.x -= Math.cos(ang) * mv * 0.9 * dt;
        e.y -= Math.sin(ang) * mv * 0.9 * dt;
      } else if(d > far){
        e.x += Math.cos(ang) * mv * dt;
        e.y += Math.sin(ang) * mv * dt;
      } else {
        e.x += Math.cos(ang + Math.PI / 2) * mv * 0.75 * dt;
        e.y += Math.sin(ang + Math.PI / 2) * mv * 0.75 * dt;
      }
      if(e.atkCd <= 0 && d < cfg.range){
        e.atkCd = cfg.cd + rand(0, 0.7);
        fireShot(e, cfg, ang);
      }
      break;
    }
    case 'spawner': {
      /* 巢母：保持中距离，定期下崽。放着不管会越积越多 */
      e.anim += dt * 2;
      if(d > 300){
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt;
      } else if(d < 190){
        e.x -= Math.cos(ang) * e.speed * dt;
        e.y -= Math.sin(ang) * e.speed * dt;
      } else {
        e.x += Math.cos(ang + Math.PI / 2) * e.speed * 0.6 * dt;
        e.y += Math.sin(ang + Math.PI / 2) * e.speed * 0.6 * dt;
      }
      e.spawnT = (e.spawnT === undefined ? 2.5 : e.spawnT) - dt;
      if(e.spawnT <= 0){
        e.spawnT = 3.4;
        if(enemies.length < 235){
          for(let k = 0; k < 2; k++) addEnemy('ant', e.x + rand(-16, 16), e.y + rand(-16, 16));
          burst(e.x, e.y, e.col, 8, 80, 0);
          sfx('deploy');
        }
      }
      break;
    }
    case 'kamikaze': {
      e.anim += dt * 7;
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;
      if(d < e.r + P.r + 9){ enemySelfDestruct(e); return; }
      break;
    }
    case 'ghost': {
      /* 幽灵：中距离冲刺，贴身收速。
         原来是"越近越快"（2.5 倍，190+ px/s），配上 0.78 的透明度，
         观感就是"屏幕上冒出来一坨东西、一眨眼已经糊在脸上"——
         冲刺本该是**看得见的一段过程**，不是瞬移。
         现在 170px 外慢慢飘（1.0×）、170→70px 加速冲（最高 2.1×）、
         70px 以内主动收速（0.85×），给玩家一个"它冲过来了、该躲了"的窗口。 */
      e.anim += dt * 4;
      const near = Math.max(0, Math.min(1, (170 - d) / 100));
      const boost = d < 70 ? 0.85 : 1 + Math.min(1, near) * 1.1;
      e.x += Math.cos(ang) * e.speed * boost * dt;
      e.y += Math.sin(ang) * e.speed * boost * dt;
      if(Math.random() < 0.22) burst(e.x + rand(-4, 4), e.y + rand(-4, 4), '#cfd6ff', 1, 18, -0.3);
      break;
    }
    case 'hop': {
      /* 青蛙：走两步蹦一次大跳 */
      e.anim += dt * 3;
      if(e.dashState === 'walk'){
        e.dashT -= dt;
        e.x += Math.cos(ang) * e.speed * 0.55 * dt;
        e.y += Math.sin(ang) * e.speed * 0.55 * dt;
        if(e.dashT <= 0){
          e.dashState = 'dash'; e.dashT = 0.32; e.dashDir = ang;
          burst(e.x, e.y + e.r, '#6fe0c8', 6, 70, 0);
        }
      } else {
        e.dashT -= dt;
        e.x += Math.cos(e.dashDir) * e.speed * 5.4 * dt;
        e.y += Math.sin(e.dashDir) * e.speed * 5.4 * dt;
        if(e.dashT <= 0){ e.dashState = 'walk'; e.dashT = rand(0.7, 1.3); }
      }
      break;
    }
    case 'circle': {
      /* 蜜蜂：绕着玩家转圈，周期性俯冲 */
      e.anim += dt * 9;
      e.circleT = (e.circleT || 0) + dt;
      if(e.dashState === 'walk'){
        const tangent = ang + Math.PI / 2;
        const pull = d > 100 ? 1 : (d < 62 ? -0.7 : 0);
        e.x += (Math.cos(tangent) * 0.95 + Math.cos(ang) * pull) * e.speed * dt;
        e.y += (Math.sin(tangent) * 0.95 + Math.sin(ang) * pull) * e.speed * dt;
        if(e.circleT > 2.4){ e.circleT = 0; e.dashState = 'dash'; e.dashT = 0.45; }
      } else {
        e.dashT -= dt;
        e.x += Math.cos(ang) * e.speed * 2.4 * dt;
        e.y += Math.sin(ang) * e.speed * 2.4 * dt;
        if(e.dashT <= 0){ e.dashState = 'walk'; e.circleT = 0; }
      }
      break;
    }
    default: {
      e.anim += dt * 3;
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;
      break;
    }
  }

  if(d < e.r + P.r - 1 && e.atkCd <= 0){
    e.atkCd = 0.9;
  }
  e.x = clamp(e.x, 10, ARENA.w - 10);
  e.y = clamp(e.y, 10, ARENA.h - 10);
}

/* 【3.4】怪不许钻进玩家身体（BOSS 也算）。
   之前所有 AI（chase / weave / ghost / hop / 各种 bossAI）都直接朝玩家中心点走，
   没有任何"停在边缘"的约束。慢的怪一帧挪 0.3px 看不太出来；但幽灵贴身时
   有 190~225 px/s ≈ 每帧 3.7px，一帧就穿进身体内部，之后每帧锁在玩家坐标上——
   玩家看到的就是"一坨半透明的东西凭空糊在身上，看不见也躲不掉"。
   BOSS 更糟：r=15~25，整个人能盖住玩家。

   ★ 必须放在 separate() **之后**：分离力会把贴身单位互相推开，
     推的方向和玩家无关，会把已经贴边的怪重新挤进身体里。
     只有放在每帧最后一环，才不会被下一帧的分离算法打回来。
   这不是"推开"（推力会凭空变成击退），而是**贴边**：
   接触伤害判定用的是 e.r + P.r + 1，钉在 92% 处照样触发，
   "被围住"的压迫感一分不少。 */
function holdBodyOut(){
  if(!P) return;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead) continue;
    let dx = e.x - P.x, dy = e.y - P.y;
    let d = Math.hypot(dx, dy);
    const bodyR = (e.r + P.r) * 0.92;
    if(d >= bodyR) continue;
    if(d < 0.0001){ dx = 1; dy = 0; d = 1; }
    e.x = P.x + (dx / d) * bodyR;
    e.y = P.y + (dy / d) * bodyR;
  }
}

/* --- BOSS 行为：每种都有独立技能组 --- */
function bossAI(e, dt, d, ang){
  e.anim += dt * 2;
  e.skillCd -= dt;
  if(e.skill2Cd !== undefined) e.skill2Cd -= dt;

  if(e.dashState === 'dash'){
    e.dashT -= dt;
    e.x += Math.cos(e.dashDir) * e.speed * 4.2 * dt;
    e.y += Math.sin(e.dashDir) * e.speed * 4.2 * dt;
    if(Math.random() < 0.7) burst(e.x, e.y, e.col, 1, 45, 0);
    if(e.dashT <= 0){
      /* 冲撞落地：布丁暴君会砸出冲击波 */
      if(e.bossType === 'puddingTyrant'){
        rings.push({ x:e.x, y:e.y, r0:e.r, r1:e.r * 4.2, life:0.42, max:0.42, col:'#ffd166', w:4 });
        burst(e.x, e.y, '#ffd166', 14, 165);
        state.shake = Math.max(state.shake, 3.5);
        if(dist(e.x, e.y, P.x, P.y) < e.r * 3.6) hurtPlayer(bossDmg(e, 0.7, 0.17));
      }
      if(e.dashQueue > 0){
        e.dashQueue--;
        e.dashDir = Math.atan2(P.y - e.y, P.x - e.x);
        e.dashT = 0.34;
      } else {
        e.dashState = 'walk'; e.dashT = 1.2;
      }
    }
  } else {
    const keep = (e.bossType === 'veggieQueen' || e.bossType === 'colaKing') ? 125 : 0;
    if(d > keep + 10){
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;
    } else if(keep){
      e.x -= Math.cos(ang) * e.speed * 0.55 * dt;
      e.y -= Math.sin(ang) * e.speed * 0.55 * dt;
    }
  }

  const seg = e.hp / e.maxHp;
  const rage = seg < 0.35 ? 1.8 : (seg < 0.65 ? 1.35 : 1);

  if(e.skillCd <= 0){
    if(e.bossType === 'candyKing'){
      /* 糖果大王：环形弹幕 + 扇形追击，半血后叫糖果球 */
      shootRing(e.x, e.y, 14, 118 * rage, bossDmg(e, 0.5, 0.10), '#ff8fc7', rand(0, TAU));
      for(let i2 = 0; i2 < 5; i2++){
        const a2 = ang + (i2 - 2) * 0.22;
        ebullets.push({ x:e.x, y:e.y, vx:Math.cos(a2)*178, vy:Math.sin(a2)*178, r:5, dmg:bossDmg(e, 0.55, 0.12), col:'#ff5fc0', life:4, homing:0 });
      }
      rings.push({ x:e.x, y:e.y, r0:e.r, r1:e.r*2.6, life:0.34, max:0.34, col:'#ff8fc7', w:3 });
      if(seg < 0.5){
        for(let i2 = 0; i2 < 3; i2++){
          const a2 = rand(0, TAU);
          addEnemy('pudding', clamp(e.x + Math.cos(a2)*80, 30, ARENA.w - 30), clamp(e.y + Math.sin(a2)*80, 30, ARENA.h - 30));
        }
      }
      e.skillCd = 2.7 / rage;
      sfx('zap');

    } else if(e.bossType === 'colaKing'){
      /* 可乐喷泉：螺旋弹幕（持续 2.2 秒旋转扫射），隔一次追加追踪罐 */
      e.spiral = 2.2;
      e.spiralA = rand(0, TAU);
      e.spiralT = 0;
      e.spiralDir = Math.random() < 0.5 ? 1 : -1;
      if(e.phase % 2 === 1){
        for(let i2 = 0; i2 < 3; i2++){
          const a2 = ang + (i2 - 1) * 0.5;
          ebullets.push({ x:e.x, y:e.y, vx:Math.cos(a2)*140, vy:Math.sin(a2)*140, r:5, dmg:e.dmg*0.6, col:'#ff6b6b', life:5, homing:1.8 });
        }
      }
      e.phase++;
      e.skillCd = (seg < 0.4 ? 2.8 : 3.6);
      sfx('zap');

    } else if(e.bossType === 'burgerKing'){
      /* 汉堡巨兽：叫小弟 / 冲撞 / 天降肉饼 三选一 */
      const mode = e.phase % 3;
      if(mode === 0){
        for(let i2 = 0; i2 < 3; i2++){
          const a2 = rand(0, TAU);
          addEnemy('burger', clamp(e.x + Math.cos(a2)*74, 30, ARENA.w - 30), clamp(e.y + Math.sin(a2)*74, 30, ARENA.h - 30));
        }
        showToast('汉堡巨兽叫来了小弟！');
      } else if(mode === 1){
        e.dashState = 'dash'; e.dashT = 0.62; e.dashDir = ang;
        sfx('boss');
      } else {
        for(let i2 = 0; i2 < 3; i2++){
          strikes.push({ kind:'bomb',
            x: clamp(P.x + rand(-70, 70), 20, ARENA.w - 20),
            y: clamp(P.y + rand(-60, 60), 20, ARENA.h - 20),
            delay:0.7, max:0.7, r:44, dmg:e.dmg*0.8, seed:rand(0,100) });
        }
        showToast('小心天降肉饼！');
      }
      e.phase++;
      e.skillCd = 3.0 / rage;

    } else if(e.bossType === 'jellyPope'){
      /* 果冻教皇：召唤精英怪（核心特色），半血后一次两只 */
      const n = seg < 0.5 ? 2 : 1;
      for(let i2 = 0; i2 < n; i2++){
        spawnEliteAt(clamp(e.x + rand(-110, 110), 30, ARENA.w - 30),
                     clamp(e.y + rand(-110, 110), 30, ARENA.h - 30), 'pudding');
      }
      showToast(seg < 0.5 ? '果冻教皇狂化了，一次叫两只精英！' : '果冻教皇召来了精英！');
      rings.push({ x:e.x, y:e.y, r0:e.r, r1:e.r*3.4, life:0.5, max:0.5, col:'#a0ffd0', w:4 });
      shootRing(e.x, e.y, 12, 104, bossDmg(e, 0.45, 0.10), '#a0ffd0', rand(0, TAU));
      e.skillCd = 5.0 / rage;
      sfx('boss');

    } else if(e.bossType === 'puddingTyrant'){
      /* 布丁暴君：三连冲刺，每段落地砸冲击波 */
      e.dashState = 'dash';
      e.dashDir = ang;
      e.dashT = 0.42;
      e.dashQueue = 2;
      showToast('布丁暴君开始冲撞！');
      sfx('boss');
      e.skillCd = 4.4 / rage;

    } else if(e.bossType === 'slipperKing'){
      /* 拖鞋之王：三个阶段，每个阶段换一套"必须换走位"的招式
         一阶段 环形弹幕 + 扇形点射 → 逼你绕着它转
         二阶段 叫两只精英 + 三连冲撞 → 逼你处理召唤而不是站桩
         三阶段 螺旋 + 天降踩踏 → 逼你持续移动、不能贴脸 */
      if(seg > 0.66){
        shootRing(e.x, e.y, 16, 116 * rage, bossDmg(e, 0.42, 0.10), '#ffd166', rand(0, TAU));
        for(let i2 = 0; i2 < 5; i2++){
          const a2 = ang + (i2 - 2) * 0.2;
          ebullets.push({ x:e.x, y:e.y, vx:Math.cos(a2)*196, vy:Math.sin(a2)*196, r:5,
            dmg:bossDmg(e, 0.5, 0.12), col:'#fff3b0', life:4.2, homing:0 });
        }
        e.skillCd = 2.6 / rage;
        sfx('boss');
      } else if(seg > 0.33){
        if(e.phase % 2 === 0){
          for(let i2 = 0; i2 < 2; i2++){
            spawnEliteAt(clamp(e.x + rand(-130, 130), 30, ARENA.w - 30),
                         clamp(e.y + rand(-130, 130), 30, ARENA.h - 30));
          }
          showToast('拖鞋之王召来了守卫！');
          e.skillCd = 5.4 / rage;
        } else {
          e.dashState = 'dash'; e.dashDir = ang; e.dashT = 0.40; e.dashQueue = 2;
          showToast('小心连续冲撞！');
          e.skillCd = 4.2 / rage;
        }
        e.phase++;
        sfx('boss');
      } else {
        if(e.phase % 3 === 0){
          e.spiral = 1.8; e.spiralA = rand(0, TAU); e.spiralT = 0;
          e.spiralDir = Math.random() < 0.5 ? 1 : -1;
        } else if(e.phase % 3 === 1){
          for(let i2 = 0; i2 < 4; i2++){
            strikes.push({ kind:'bomb',
              x: clamp(P.x + rand(-84, 84), 20, ARENA.w - 20),
              y: clamp(P.y + rand(-72, 72), 20, ARENA.h - 20),
              delay:0.62, max:0.62, r:46, dmg:bossDmg(e, 0.75, 0.20), seed:rand(0,100) });
          }
          showToast('拖鞋踩下来了！');
        } else {
          shootRing(e.x, e.y, 22, 124, bossDmg(e, 0.45, 0.10), '#fff3b0', rand(0, TAU));
        }
        e.phase++;
        e.skillCd = 2.4 / rage;
        sfx('zap');
      }

    } else {
      /* 蔬菜女王：追踪弹 + 给小弟回血 + 毒雾 */
      for(let i2 = 0; i2 < 5; i2++){
        const a2 = ang + (i2 - 2) * 0.3;
        ebullets.push({ x:e.x, y:e.y, vx:Math.cos(a2)*150, vy:Math.sin(a2)*150, r:5, dmg:e.dmg*0.7, col:'#ff5fc0', life:4.6, homing:1.5 });
      }
      for(let i2 = 0; i2 < enemies.length; i2++){
        const o = enemies[i2];
        if(!o.dead && !o.big && dist(o.x, o.y, e.x, e.y) < 170){
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.35);
        }
      }
      if(e.phase % 2 === 1){
        addHazard(clamp(P.x + rand(-40, 40), 30, ARENA.w - 30),
                  clamp(P.y + rand(-30, 30), 30, ARENA.h - 30), 40, 4.5, e.dmg * 0.45);
      }
      e.phase++;
      e.skillCd = 3.0 / rage;
      sfx('zap');
    }
  }

  /* 可乐喷泉的螺旋弹幕：每 0.085 秒甩两发，角度持续旋转 */
  if(e.spiral > 0){
    e.spiral -= dt;
    e.spiralA += e.spiralDir * dt * 5.0;
    e.spiralT -= dt;
    if(e.spiralT <= 0){
      e.spiralT = 0.085;
      for(let k = 0; k < 2; k++){
        const a2 = e.spiralA + k * Math.PI;
        ebullets.push({ x:e.x, y:e.y, vx:Math.cos(a2)*152, vy:Math.sin(a2)*152, r:4, dmg:e.dmg*0.4, col:'#ffb0b0', life:5.5, homing:0 });
      }
    }
  }

  if(seg < 0.7 && e.skill2Cd <= 0){
    shootRing(e.x, e.y, 18, 105, bossDmg(e, 0.4, 0.09), e.col, rand(0, TAU));
    e.skill2Cd = 6.0 / rage;
  }

  if(d < e.r + P.r && e.atkCd <= 0){
    e.atkCd = 0.85;
    hurtPlayer(bossDmg(e, 1, 0.14));
  }
  e.x = clamp(e.x, 12, ARENA.w - 12);
  e.y = clamp(e.y, 12, ARENA.h - 12);
}

/* 【4.0】BOSS 伤害回到"绝对量"。
   ---------------------------------------------------------
   3.3 给 BOSS 加了一个 `maxHp × pct` 的百分比地板，理由是"玩家越肉 BOSS 越没威胁"。
   但那条地板同时带来两个副作用：
     · 堆生命对 BOSS 伤害完全无效（伤害按 maxHp 等比涨）——堆血等于白堆；
     · 前期 BOSS 也按同一比例咬，110 秒的第一个 BOSS 直接按终局强度打人。
   现在 BOSS 的 dmg 在 spawnBoss 里就走 atkCurve()（绝对曲线），
   这里只负责乘技能倍率。玩家堆出来的生命与护甲，是真的能扛住它的。 */
function bossDmg(e, mul, pct){
  if(state) state.bossHit = true;
  return (e.dmg || 0) * (mul === undefined ? 1 : mul);
}

/* =========================================================
   接触伤害（4.2）
   ---------------------------------------------------------
   规则：**碰到就掉血**，节奏来自玩家侧的 0.45 秒受伤间隔。
     每次结算 = Σ(贴身怪的 dmg) × 0.52，再过护甲。
   怪没有自己的攻击冷却（不会"贴着你在发呆"），也不是逐帧流血。
   被几只围就吃几份，"冲刺"是唯一的解法（无敌帧内不计伤害）。
   ========================================================= */
function applyContact(dt){
  if(!P) return;
  const near = [];
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead) continue;
    const d = dist(e.x, e.y, P.x, P.y);
    if(d < (e.r + P.r) * 1.55) near.push(e);
  }
  state.contactN = near.length;
  /* 【6.0】坦克引擎：被 BOSS / 精英贴身时损失 20% 已获得的引擎生命（2 秒最多一次）。
     原版是"阵亡掉层"，本游戏一次死亡就结束，所以换成"别硬吃 BOSS 的贴身"。 */
  if(near.length && typeof relic === 'function' && relic('tankengine') && state.time - (P.engCutT || -99) > 2){
    for(let i = 0; i < near.length; i++){
      if(!(near[i].big || near[i].elite)) continue;
      P.engCutT = state.time;
      const lose = Math.round((P.engineHp || 0) * 0.2);
      if(lose > 0){
        P.engineHp -= lose;
        P.maxHp = Math.max(40, P.maxHp - lose);
        P.hp = Math.min(P.hp, P.maxHp);
        addText(P.x, P.y - 28, '引擎 -20%', '#ffb056', 11);
      }
      break;
    }
  }
  state.biteN = 0;
  if(!near.length) return;

  /* 荆棘：贴身就持续反伤（独立于被咬的节奏） */
  if(ST.thorns > 0){
    state.thornsT = (state.thornsT || 0) - dt;
    if(state.thornsT <= 0){
      state.thornsT = 0.25;
      let sumDmg = 0;
      for(let i = 0; i < near.length; i++) sumDmg += near[i].dmg;
      const refl = thornsHit(ST.thorns + sumDmg * 0.10);
      for(let i = 0; i < near.length; i++){
        dealDamage(near[i], refl, { src: 'thorns' });
        burst(near[i].x, near[i].y, '#ffb0c4', 2, 70, 0);
      }
      addText(P.x, P.y - 34, '反伤 ' + Math.round(refl), '#ffb0c4', 9);
      rings.push({ x:P.x, y:P.y, r0:6, r1:26, life:0.16, max:0.16, col:'#ffb0c4', w:1.5 });
    }
  }

  /* 接触伤害：每 0.40 秒结算一次，Σ(贴身怪的 dmg)，再过一次护甲。
     ---------------------------------------------------------
     规则没有变，还是"被几只围就吃几份"——贴 10 只就是 10 份，
     该跑就得跑。变的是**数值**：
       · 单只杂兵一口 18~42 点（旧表 7~20），打在 300 血身上看得见
       · 节奏 0.45 → 1.1 秒，同样的每秒压力，但每一口都数得清
     接触伤害没有上限、下限或隐藏系数，
     单纯是把"单口多大"和"多久一口"这两个数重排了一遍。 */
  /* 冲刺的无敌窗口内不吃接触伤害：这是冲刺存在的意义。
     【6.0】只认冲刺自己的无敌（dashIvyT）。弹幕 / 陷阱给的 0.30 秒无敌
     不该顺手把接触伤害也挡掉——那会变成"挨一发子弹 → 顶着怪群走 0.3 秒"。 */
  if((P.dashIvyT || 0) > 0) return;

  let sum = 0;
  for(let i = 0; i < near.length; i++){
    const e = near[i];
    /* 眩晕 / 冰冻中的怪贴着你也不掉血 —— 一条规则，不是一串倍率 */
    if(e.stun > 0) continue;
    sum += e.dmg;
    e.flash = Math.max(e.flash || 0, 0.08);
  }
  state.biteN = near.length;
  if(sum <= 0) return;

  /* 玩家侧的受伤间隔：第一次贴上**立刻**结算，之后每 contactTick 一次。
     ---------------------------------------------------------
     修复：冷却必须在主循环里按真实时间走（见 64-update 的 contactTick），
     不能只在"贴身时"递减。
     旧的写法有两个后果：
       · 你挨过一口之后离开，冷却停在 0.9 秒不动；
         再撞上去的第一次接触**不结算**，要干等这 0.9 秒才掉血 ——
         玩家看到的就是"撞到怪都不掉血"。
       · 贴着不动时冷却正常递减，所以只有"反复进出"的碰撞会哑火，
         而那恰好是最常见的走位方式。
     现在：冷却永远是真实流逝的 1.1 秒，撞上去的第一口一定立刻生效。 */
  if(P.contactT > 0) return;
  P.contactT = ECO.contactTick;

  const real = hurtPlayer(sum * ECO.contactTickMul, { kind:'contact' });
  if(real > 0){
    burst(P.x, P.y, '#ff6b8f', 4, 80, 0);
    state.contactFx = (state.contactFx || 0) - ECO.contactTick;
    if(state.contactFx <= 0){
      state.contactFx = 0.45;
      state.hurtFlash = Math.max(state.hurtFlash, 0.26);
      state.shake = Math.max(state.shake, 2.6);
      sfx('hurt');
      addText(P.x, P.y - 20, '-' + Math.round(real), '#ff8fa8', 9);
    }
  }
}


/* 分离：直接用预分配的 GRID（不再每帧 new Map），512 只怪也能跑满帧。
   顺便处理"被击退的敌人撞到别人"的额外碰撞伤害——这是控制流派的核心收益。 */
function separate(){
  const cells = GRID.cells, cols = GRID.cols, rows = GRID.rows;
  if(!cells.length) return;
  for(let cy = 0; cy < rows; cy++){
    for(let cx = 0; cx < cols; cx++){
      const arr = cells[cy * cols + cx];
      if(!arr.length) continue;
      for(let k = 0; k < arr.length; k++){
        const e = arr[k];
        if(e.dead) continue;
        for(let ox = 0; ox <= 1; ox++){
          for(let oy = (ox === 0 ? 0 : -1); oy <= 1; oy++){
            const nx = cx + ox, ny = cy + oy;
            if(nx >= cols || ny < 0 || ny >= rows) continue;
            const arr2 = cells[ny * cols + nx];
            if(!arr2 || !arr2.length) continue;
            const start = (ox === 0 && oy === 0) ? k + 1 : 0;
            for(let m = start; m < arr2.length; m++){
              const o = arr2[m];
              if(o === e || o.dead) continue;
              const dx = e.x - o.x, dy = e.y - o.y;
              const d2 = dx*dx + dy*dy;
              const mr = (e.r + o.r) * 0.85;
              if(d2 < mr * mr && d2 > 0.0001){
                const d = Math.sqrt(d2);
                const push = (mr - d) * 0.42;
                e.x += (dx / d) * push;
                e.y += (dy / d) * push;
                /* 撞人伤害：被击退的单位撞到别人，双方都吃伤害 */
                if(e.knockPow > 3 && spend('boom')){
                  const dmg = e.knockPow * 2.4;
                  e.knockPow = 0;
                  dealDamage(o, dmg, { src:'knock' });
                  burst(o.x, o.y, '#ffe9c4', 3, 90, 0);
                  sfx('knock');
                }
              }
            }
          }
        }
      }
    }
  }
}

