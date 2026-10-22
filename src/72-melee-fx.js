/* =========================================================
   12.5 近战表现层
   ---------------------------------------------------------
   之前所有近战共用一个"扇形填充"，看起来像范围技能而不是挥砍。
   这里改成：武器本体真的握在手里，按各自的轨迹运动，
   留下残影与刀光带，命中时给顿帧 + 火花 + 震屏。
   每种武器有自己的动作曲线：
     sweep  横扫（平底锅）
     chop   劈砍（菜刀）
     thrust 突刺（拖把）
     slam   蓄力砸地（汤勺）
     flurry 连打（双截棍）
     spin   旋转切割（披萨刀）
     grind  持续切割（电锯）
   ========================================================= */

/* 缓动：出手快、收尾慢，是"挥"而不是"匀速转" */
function easeSwing(k){
  if(k <= 0) return 0;
  if(k >= 1) return 1;
  return 1 - Math.pow(1 - k, 3.4);
}

/* 纯函数：给定时刻 t，算出这一击此刻的姿态
   渲染层用它画当前帧与几帧前的残影，逻辑层不参与 */
function meleePose(s, t){
  const windup = s.windup, active = s.active, recover = s.recover;
  const total = windup + active + recover;
  const tt = clamp(t, 0, total);
  const m = s.motion || 'sweep';
  const a0 = s.ang - s.arc * 0.5;
  const a1 = s.ang + s.arc * 0.5;
  let ang = s.ang, reach = 1, lift = 0, alpha = 1, phase = 0, spin = 0;

  if(tt < windup){
    phase = 0;
    const k = windup > 0 ? tt / windup : 1;
    if(m === 'sweep'){
      ang = a0 - 0.30 * k;              /* 往后拉一点，蓄势 */
      reach = 0.86 + 0.14 * k;
    } else if(m === 'chop'){
      ang = s.ang - 0.85 - 0.20 * k;    /* 举起来 */
      reach = 0.92;
      lift = -k * 3;
    } else if(m === 'thrust'){
      ang = s.ang;
      reach = 0.52 - 0.20 * k;          /* 收回来再捅 */
    } else if(m === 'slam'){
      ang = s.ang - 1.25 - 0.22 * k;    /* 高高举起 */
      reach = 0.78;
      lift = -k * 9;
    } else if(m === 'flurry'){
      ang = s.ang + (s.side > 0 ? -0.55 : 0.55) * k;
      reach = 0.9;
    } else if(m === 'spin'){
      ang = a0 + s.arc * easeSwing(k * 0.5);
      reach = 0.9;
    }
    alpha = 1;
  } else if(tt < windup + active){
    phase = 1;
    const k = active > 0 ? (tt - windup) / active : 1;
    if(m === 'sweep'){
      ang = a0 + s.arc * easeSwing(k) * 1.04;
      reach = 1;
    } else if(m === 'chop'){
      ang = s.ang - 1.05 + (s.arc + 1.05) * easeSwing(k);
      reach = 1;
      lift = (1 - k) * -3;
    } else if(m === 'thrust'){
      ang = s.ang;
      reach = 0.32 + Math.sin(k * Math.PI * 0.92) * 1.02;
    } else if(m === 'slam'){
      const kk = easeSwing(k);
      ang = s.ang - 1.47 + 1.62 * kk;   /* 从头顶砸到前方 */
      reach = 0.8 + 0.35 * kk;
      lift = (1 - kk) * -9;
    } else if(m === 'flurry'){
      const dir = s.side > 0 ? 1 : -1;
      ang = s.ang - dir * s.arc * 0.5 + dir * s.arc * easeSwing(k);
      reach = 1;
    } else if(m === 'spin'){
      ang = a0 + s.arc * easeSwing(0.5 + k * 0.5);
      reach = 1;
      spin = k * TAU * 2;
    }
  } else {
    phase = 2;
    const k = recover > 0 ? clamp((tt - windup - active) / recover, 0, 1) : 1;
    if(m === 'thrust'){
      ang = s.ang;
      reach = 1.34 - 0.5 * k;           /* 慢慢收回 */
    } else if(m === 'slam'){
      ang = s.ang + 0.15;
      reach = 1.15 - 0.2 * k;
    } else if(m === 'chop'){
      ang = s.ang + s.arc * 0.55 - 0.25 * k;
      reach = 1;
    } else if(m === 'flurry'){
      ang = s.ang + (s.side > 0 ? 1 : -1) * s.arc * 0.5;
      reach = 1;
    } else {
      ang = a1 + 0.12 * k;              /* 收招继续滑一点 */
      reach = 1;
    }
    alpha = 1 - k * 0.85;
  }
  return { ang, reach, lift, alpha, phase, spin };
}

/* ---------------------------------------------------------
   武器本体：本地坐标原点在握点，+X 指向刀锋
   --------------------------------------------------------- */
function drawMeleeShape(g, shape, col, len, t, extra){
  const L = len;
  g.save();
  switch(shape){
    case 'pan': {
      /* 手柄 */
      g.fillStyle = '#8a6a4a';
      g.fillRect(Math.round(L * 0.08), -2, Math.round(L * 0.46), 4);
      g.fillStyle = '#b98a5e';
      g.fillRect(Math.round(L * 0.08), -2, Math.round(L * 0.42), 1);
      /* 锅体：外圈暗、内圈亮，中间一道高光，一眼看出是锅 */
      const cx = L * 0.72, r = L * 0.30;
      g.fillStyle = '#4a5160';
      g.beginPath(); g.arc(cx, 0, r, 0, TAU); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.arc(cx, 0, r * 0.86, 0, TAU); g.fill();
      g.fillStyle = '#8f98a8';
      g.beginPath(); g.arc(cx, 0, r * 0.62, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath(); g.arc(cx - r * 0.22, -r * 0.28, r * 0.28, 0, TAU); g.fill();
      break;
    }
    case 'cleaver': {
      g.fillStyle = '#6b5138';
      g.fillRect(0, -2, Math.round(L * 0.34), 4);
      g.fillStyle = '#3f4552';
      g.fillRect(Math.round(L * 0.30), -9, Math.round(L * 0.62), 18);
      g.fillStyle = col;
      g.fillRect(Math.round(L * 0.32), -8, Math.round(L * 0.58), 15);
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillRect(Math.round(L * 0.32), -8, Math.round(L * 0.58), 2);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(L * 0.88), -8, 3, 16);
      break;
    }
    case 'bat': {
      g.fillStyle = '#a8792a';
      g.fillRect(Math.round(L * 0.06), -2, Math.round(L * 0.26), 4);
      g.fillStyle = '#8a5f1f';
      g.fillRect(Math.round(L * 0.30), -2, 3, 4);
      g.fillStyle = col;
      g.fillRect(Math.round(L * 0.33), -4, Math.round(L * 0.34), 8);
      g.fillRect(Math.round(L * 0.62), -5, Math.round(L * 0.24), 10);
      g.fillRect(Math.round(L * 0.83), -6, Math.round(L * 0.15), 12);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(Math.round(L * 0.34), -4, Math.round(L * 0.60), 1);
      break;
    }
    case 'chainsaw': {
      g.fillStyle = '#6b4a2a';
      g.fillRect(0, -3, Math.round(L * 0.28), 6);
      g.fillStyle = '#ff9d4d';
      g.fillRect(Math.round(L * 0.26), -6, Math.round(L * 0.30), 12);
      g.fillStyle = '#ffd18a';
      g.fillRect(Math.round(L * 0.28), -4, Math.round(L * 0.22), 3);
      /* 链条：随时间滚动的小齿 */
      const phase = ((t || 0) * 26) % 6;
      for(let i = 0; i < 7; i++){
        const x = Math.round(L * 0.54 + i * (L * 0.065) + phase * 0.4);
        g.fillStyle = (i % 2) ? '#e8eef8' : '#b8c2d2';
        g.fillRect(x, -7, 3, 3);
        g.fillRect(x + 1, 4, 3, 3);
      }
      g.fillStyle = '#9aa4b4';
      g.fillRect(Math.round(L * 0.54), -5, Math.round(L * 0.46), 10);
      break;
    }
    case 'mop': {
      g.fillStyle = '#8a6a4a';
      g.fillRect(0, -1, Math.round(L * 0.72), 2);
      g.fillStyle = '#c9d4e2';
      g.fillRect(Math.round(L * 0.18), -1, Math.round(L * 0.3), 2);
      const hx = Math.round(L * 0.70);
      g.fillStyle = col;
      for(let i = 0; i < 5; i++){
        g.fillRect(hx, -6 + i * 3, Math.round(L * 0.28) - i, 2);
      }
      g.fillStyle = '#ffffff';
      g.fillRect(hx + 2, -5, 4, 2);
      break;
    }
    case 'ladle': {
      g.fillStyle = '#8a93a3';
      g.fillRect(0, -2, Math.round(L * 0.66), 4);
      g.fillStyle = '#c9d4e2';
      g.fillRect(Math.round(L * 0.02), -2, Math.round(L * 0.62), 1);
      const cx = Math.round(L * 0.78), r = Math.round(L * 0.24);
      g.fillStyle = '#5d6472';
      g.beginPath(); g.arc(cx, 0, r, 0, TAU); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.arc(cx, 0, r - 2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.arc(cx - 2, -2, r * 0.45, 0, TAU); g.fill();
      break;
    }
    case 'nunchaku': {
      const sw = Math.sin((t || 0) * 30) * 0.5;
      g.fillStyle = col;
      g.fillRect(0, -2, Math.round(L * 0.40), 4);
      g.fillStyle = '#c9a03c';
      g.fillRect(Math.round(L * 0.36), -3, 4, 6);
      g.save();
      g.translate(L * 0.40, 0);
      g.rotate(0.55 + sw);
      g.fillStyle = '#c9a03c';
      g.fillRect(0, -1, 5, 2);
      g.fillStyle = col;
      g.fillRect(5, -2, Math.round(L * 0.42), 4);
      g.fillStyle = '#fff6c8';
      g.fillRect(Math.round(L * 0.42), -2, 3, 4);
      g.restore();
      break;
    }
    case 'pizza': {
      g.fillStyle = '#8a6a4a';
      g.fillRect(0, -2, Math.round(L * 0.42), 4);
      const cx = Math.round(L * 0.66), r = Math.round(L * 0.30);
      g.fillStyle = '#c9d4e2';
      g.beginPath(); g.arc(cx, 0, r, 0, TAU); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.arc(cx, 0, r - 1.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.62)';
      g.beginPath(); g.arc(cx, 0, r * 0.5, 0, TAU); g.fill();
      /* 锯齿 */
      g.fillStyle = '#e8eef8';
      for(let i = 0; i < 8; i++){
        const a = (t || 0) * 9 + i * TAU / 8;
        g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(Math.sin(a) * r), 3, 2);
      }
      break;
    }
    default: {
      g.fillStyle = col;
      g.fillRect(0, -2, Math.round(L), 4);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(L * 0.82), -2, Math.round(L * 0.18), 2);
    }
  }
  g.restore();
}

/* 残影：把武器往前的几帧再画一遍，形成"挥过去"的拖影 */
function drawMeleeGhost(s, x, y, vis, col, t, age, alphaMul){
  if(alphaMul <= 0.02) return;
  const p = meleePose(s, t - age);
  if(p.alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.ang);
  ctx.globalAlpha = p.alpha * alphaMul;
  drawMeleeShape(ctx, vis.shape, col, vis.len * p.reach, s.wt || 0, s);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSwings(t){
  for(let i = 0; i < swings.length; i++){
    const s = swings[i];
    if(s.x < cam.x - 260 || s.x > cam.x + W + 260 || s.y < cam.y - 260 || s.y > cam.y + H + 260) continue;

    const raw = s.vis || { len: 26, shape: 'blade' };
    /* 武器的视觉长度跟着实际攻击距离走：拖把看起来就该是长的 */
    const vis = { shape: raw.shape, len: Math.max(raw.len, s.range * 0.62) };
    const col = s.col || '#e6eefc';
    const p = meleePose(s, s.t);
    const pivotX = s.x + Math.cos(p.ang) * 5 + (s.pivot || 0);
    const pivotY = s.y + Math.sin(p.ang) * 5;
    const yOff = (p.lift || 0);

    /* --- 1. 刀光带：沿刃口扫过的一段弧形，头亮尾淡 --- */
    if(p.phase >= 1 && s.arc > 0.10 && s.motion !== 'thrust'){
      const trailAge = Math.min(s.active * 0.9, s.heavy ? 0.075 : 0.05);
      const pp = meleePose(s, Math.max(s.windup, s.t - trailAge));
      const aA = pp.ang, aB = p.ang;
      const span = aB - aA;
      if(Math.abs(span) > 0.03){
        const fade = p.phase === 2 ? p.alpha : 1;
        const rOut = vis.len * Math.max(pp.reach, p.reach) * 1.02;
        const maxThick = vis.len * (s.heavy ? 0.34 : 0.24);
        const SEG = 10;

        /* 外层柔光，让刀光在草地上也看得清 */
        ctx.globalAlpha = 0.16 * fade;
        ctx.strokeStyle = col;
        ctx.lineWidth = maxThick * 1.9;
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, rOut - maxThick * 0.45, aA, aB, span < 0);
        ctx.stroke();

        /* 月牙主体：中段最厚，两端收细——这是"挥过去"，不是"一块区域" */
        ctx.fillStyle = '#ffffff';
        for(let k = 0; k < SEG; k++){
          const f0 = k / SEG, f1 = (k + 1) / SEG;
          const fm = (f0 + f1) * 0.5;
          const thick = maxThick * (0.18 + 0.82 * Math.sin(Math.PI * fm));
          const al = fade * (0.20 + 0.72 * Math.pow(fm, 1.3));
          ctx.globalAlpha = al * 0.92;
          ctx.beginPath();
          ctx.arc(pivotX, pivotY, rOut, aA + span * f0, aA + span * f1, span < 0);
          ctx.arc(pivotX, pivotY, rOut - thick, aA + span * f1, aA + span * f0, span >= 0);
          ctx.closePath();
          ctx.fill();
        }

        /* 外缘描边：一道武器色的锋线 */
        ctx.globalAlpha = 0.62 * fade;
        ctx.strokeStyle = col;
        ctx.lineWidth = s.heavy ? 2.6 : 2.0;
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, rOut, aA + span * 0.06, aB, span < 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    /* --- 2. 突刺：直线速度线，而不是弧 --- */
    if(s.motion === 'thrust' && p.phase >= 1){
      const len = vis.len * p.reach;
      const fade = p.alpha;
      ctx.globalAlpha = 0.30 * fade;
      ctx.strokeStyle = col;
      for(let k = 0; k < 3; k++){
        const off = (k - 1) * 3;
        ctx.lineWidth = k === 1 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(pivotX + Math.cos(p.ang) * (len * 0.28), pivotY + Math.sin(p.ang) * (len * 0.28) + off);
        ctx.lineTo(pivotX + Math.cos(p.ang) * len * 1.05, pivotY + Math.sin(p.ang) * len * 1.05 + off);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* --- 3. 残影 + 武器本体 --- */
    if(p.phase === 0){
      /* 前摇：半透明地"举起来"，让玩家预判这一下 */
      ctx.save();
      ctx.globalAlpha = 0.42 + 0.3 * (s.t / Math.max(0.001, s.windup));
      ctx.translate(pivotX, pivotY + yOff);
      ctx.rotate(p.ang);
      drawMeleeShape(ctx, vis.shape, col, vis.len * p.reach, s.wt || 0, s);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      /* 残影：越早越淡 */
      drawMeleeGhost(s, pivotX, pivotY + (meleePose(s, s.t - 0.022).lift || 0), vis, col, s.t, 0.022, 0.30);

      ctx.save();
      ctx.translate(pivotX, pivotY + yOff);
      ctx.rotate(p.ang);
      ctx.globalAlpha = p.alpha;
      drawMeleeShape(ctx, vis.shape, col, vis.len * p.reach, s.wt || 0, s);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* --- 4. 砸地类：落点预警环 --- */
    if(s.motion === 'slam' && p.phase < 1 && s.slamX !== undefined){
      const k = s.t / Math.max(0.001, s.windup);
      const rr = (s.slamR || 40) * (1.10 - k * 0.16);
      ctx.globalAlpha = 0.30 + k * 0.55;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      /* 虚线环：读作"要砸这里"，不是"这里是范围" */
      for(let d = 0; d < 14; d++){
        const a0 = d * TAU / 14, a1 = a0 + TAU / 42;
        ctx.beginPath();
        ctx.arc(s.slamX, s.slamY, rr, a0, a1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

/* ---------------------------------------------------------
   待机时把手上的近战武器画出来（最多两把，避免糊成一团）
   --------------------------------------------------------- */
function drawHeldMelee(t){
  const list = [];
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(w && w.meleeVisual && !w.continuous) list.push({ id, w, lv: P.weapons[id] });
  }
  if(!list.length) return;
  list.sort(function(a, b){ return b.lv - a.lv; });
  const n = Math.min(2, list.length);
  for(let i = 0; i < n; i++){
    const it = list[i];
    /* 正在挥击的武器就交给 drawSwings，避免重复画 */
    let busy = false;
    for(let k = 0; k < swings.length; k++){
      if(swings[k].src === it.id && swings[k].t < swingTotal(swings[k])){ busy = true; break; }
    }
    if(busy) continue;
    const bob = Math.sin(t * 3 + i * 1.7) * 1.2;
    const base = P.facing > 0 ? 0.30 : Math.PI - 0.30;
    const ang = base + (i === 0 ? 0 : -0.55) + bob * 0.02;
    ctx.save();
    ctx.translate(P.x + Math.cos(ang) * 5, P.y + Math.sin(ang) * 5 + 1);
    ctx.rotate(ang);
    ctx.globalAlpha = i === 0 ? 0.85 : 0.6;
    drawMeleeShape(ctx, it.w.meleeVisual.shape, it.w.color, it.w.meleeVisual.len, t, {});
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/* ---------------------------------------------------------
   持续型近战（电锯 / 披萨刀）：没有挥击，但必须一直看得见
   --------------------------------------------------------- */
function drawMeleeContinuous(t){
  /* --- 电锯：握在身前，链条滚动，切割时抖 --- */
  const clv = P.weapons.chainsaw;
  if(clv){
    const vis = MELEE.chainsaw.meleeVisual;
    const ang = P.sawAng !== undefined ? P.sawAng : (P.facing > 0 ? 0 : Math.PI);
    const sh = Math.sin(t * 42) * 0.05;
    ctx.save();
    ctx.translate(P.x + Math.cos(ang) * 4, P.y + Math.sin(ang) * 4);
    ctx.rotate(ang + sh);
    ctx.globalAlpha = 0.95;
    drawMeleeShape(ctx, vis.shape, MELEE.chainsaw.color, vis.len, t, null);
    ctx.restore();
    ctx.globalAlpha = 1;

    /* 刃口持续喷涂 */
    if(Math.random() < 0.35){
      const a = ang + rand(-0.25, 0.25);
      parts.push({
        x: P.x + Math.cos(ang) * vis.len * 0.85, y: P.y + Math.sin(ang) * vis.len * 0.85,
        vx: Math.cos(a) * rand(40, 120), vy: Math.sin(a) * rand(40, 120) - 20,
        life: rand(0.10, 0.22), max: 0.22, col: Math.random() < 0.5 ? '#ffd166' : '#fff3c4',
        size: 2, g: 1, spark: true
      });
    }
  }

  /* --- 披萨刀：绕身旋转的圆刃 + 运动模糊环 --- */
  const plv = P.weapons.pizzacutter;
  if(plv){
    const vis = MELEE.pizzacutter.meleeVisual;
    const evo = plv >= 5;
    const s = MELEE.pizzacutter.stats(plv);
    const R = s.radius * ST.area * (hasMod('pizzacutter','size') ? 1.25 : 1) * (evo ? 1.5 : 1);
    const a = P.pizzaA || 0;

    /* 模糊环：让"一直在切"这件事看得见 */
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = MELEE.pizzacutter.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(P.x, P.y, R * 0.92, a, a + 2.4);
    ctx.stroke();
    ctx.globalAlpha = 0.10;
    ctx.beginPath();
    ctx.arc(P.x, P.y, R * 0.92, a + Math.PI, a + Math.PI + 2.4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* 两片刀刃对角旋转 */
    for(let k = 0; k < 2; k++){
      const aa = a + k * Math.PI;
      ctx.save();
      ctx.translate(P.x + Math.cos(aa) * R * 0.72, P.y + Math.sin(aa) * R * 0.72);
      ctx.rotate(aa + Math.PI * 0.5);
      drawMeleeShape(ctx, vis.shape, MELEE.pizzacutter.color, vis.len * 0.85, t * 3 + k, null);
      ctx.restore();
    }
  }
}
