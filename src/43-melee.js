/* =========================================================
   3.5 近战：有动作的挥击系统
   ---------------------------------------------------------
   不是"在脚下炸一圈"，而是：
     【3.3 手感】前摇 / 后摇整体缩短约 30%：
       原来重武器一抡要 0.34 + 0.09 + 0.32 = 0.75 秒动画，
       在怪物已经贴脸的游戏里，这是"按下去半秒才打出去"的迟滞感。
       前摇保留（抬手要看得见，否则没有反馈），后摇砍得更多
       ——后摇不影响命中，只是把角色锁在动画里。

     前摇（蓄力，能看见抬手） → 命中帧（只有这几帧判定）
     → 后摇（收招，此时不能再次挥击）
   每把近战武器的三段时长、扇形角度、距离、击退、眩晕都不一样，
   所以手感是"快斩 / 重击 / 突刺 / 连打"的区别，而不是换皮。
   视觉部分在 72-melee-fx.js：武器本体沿轨迹运动 + 残影 + 刀光带。
   ========================================================= */
let swings = [];

/* 流血的挂载（物理状态，和元素分开算） */
function applyBleed(e, dur, dps, src){
  if(!e || e.dead) return;
  const st = stInit(e);
  st.bleed = Math.max(st.bleed || 0, dur);
  st.bleedDmg = Math.max(st.bleedDmg || 0, dps);
}

function startSwing(cfg){
  if(swings.length > 40) return null;
  const s = {
    x: cfg.x, y: cfg.y, ang: cfg.ang,
    arc: cfg.arc, range: cfg.range,
    windup: cfg.windup, active: cfg.active, recover: cfg.recover,
    /* 近战的身份是"扛着打"：护甲按 60% 折算成近战伤害。
       堆生命 / 减伤对近战不是纯防御属性，而是双重收益。 */
    dmg: cfg.dmg * (1 + (ST.armor || 0) * 0.9), src: cfg.src, col: cfg.col || '#e6eefc',
    knock: cfg.knock || 0, stun: cfg.stun || 0, bleed: cfg.bleed || 0, life: cfg.life || 0,
    hits: new Set(), t: 0, hitCount: 0, done: false,
    lv: cfg.lv || 1, heavy: !!cfg.heavy, wide: !!cfg.wide,
    motion: cfg.motion || 'sweep',
    vis: cfg.vis || { len: 30, shape: 'blade' },
    side: cfg.side || 1, pivot: cfg.pivot || 0, wt: cfg.wt || 0,
    slamX: cfg.slamX, slamY: cfg.slamY, slamR: cfg.slamR,
    hpDmg: cfg.hpDmg || 0,
    elemAlt: cfg.elemAlt || 0,
    execute: cfg.execute || 0
  };
  swings.push(s);
  /* 自动连段：每第三下挥击自动变成「横扫」——范围更大、击退更狠、额外震屏与音效。
     不需要任何按键，节奏自己跑；玩家看到的只是"第三下明显更大一下"。
     这是近战唯一的"爽点节拍器"，也是它和远程扫射的区别。 */
  P.meleeChain = ((P.meleeChain || 0) + 1) % 3;
  if(P.meleeChain === 0 && !cfg.noFinisher){
    s.finisher = true;
    s.arc = Math.min(TAU, s.arc * 1.45);
    s.range *= 1.22;
    s.knock = (s.knock || 0) * 1.7;
    s.dmg *= 1.25;
    /* 让第三下"看得见"：一圈冲击光环 + 轻微震屏 */
    rings.push({ x:s.x, y:s.y, r0:8, r1:s.range * 1.1, life:0.22, max:0.22, col:'#fff1c4', w:3 });
    state.shake = Math.max(state.shake, 3.2);
  }
  return s;
}

function swingTotal(s){ return s.windup + s.active + s.recover; }
function swingPhase(s){
  if(s.t < s.windup) return 0;                 /* 前摇 */
  if(s.t < s.windup + s.active) return 1;      /* 命中窗口 */
  return 2;                                     /* 后摇 */
}

/* 命中反馈：火花 + 顿帧 + 震屏。重击更狠，快斩走节流 */
function meleeImpact(e, s, a){
  const n = s.heavy ? 8 : 4;
  for(let i = 0; i < n && parts.length < 400; i++){
    const ang = a + rand(-0.8, 0.8);
    const sp = rand(70, s.heavy ? 280 : 170);
    parts.push({
      x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
      life: rand(0.10, 0.24), max: 0.24, col: s.heavy ? '#fff3c4' : '#fffbe8',
      size: 2, g: 1.4, spark: true
    });
  }
  /* 命中点的冲击星：只给重击，且限流——普通命中靠火花，堆圈会糊成一片 */
  if(s.heavy && rings.length < 40){
    rings.push({ x: e.x, y: e.y, r0: 2, r1: 30, life: 0.16, max: 0.16, col: '#ffe9b0', w: 3 });
  }

  /* 只有重击才震屏：快斩类一秒砍 5 下，每下都震就是"一直在抖" */
  if(s.heavy) addShake(2.2);

  /* 顿帧：命中瞬间几乎停住，是"打到了"的关键；重击给得更长 */
  if(s.heavy){
    state.hitstop = Math.max(state.hitstop || 0, 0.055);
  } else if((state.hitstopCd || 0) <= 0){
    state.hitstop = Math.max(state.hitstop || 0, 0.030);
    state.hitstopCd = 0.20;
  }
}

/* 命中判定：只在前摇结束后的 active 窗口里生效，且每个敌人只吃一次 */
function updateSwings(dt){
  for(let i = swings.length - 1; i >= 0; i--){
    const s = swings[i];
    s.t += dt;
    if(swingPhase(s) === 1){
      const k = (s.t - s.windup) / s.active;    /* 0→1，用来做挥击轨迹 */
      const a0 = s.ang - s.arc * 0.5;
      const sweep = a0 + s.arc * k;
      eachNear(s.x, s.y, s.range, function(e){
        if(s.hits.has(e.id) || e.dead) return;
        const d = dist(s.x, s.y, e.x, e.y);
        if(d > s.range + e.r) return;
        /* 只打扇形范围内（用当前挥击角度判定，有"扫过去"的感觉） */
        let df = Math.atan2(e.y - s.y, e.x - s.x) - s.ang;
        while(df > Math.PI) df -= TAU;
        while(df < -Math.PI) df += TAU;
        if(s.wide ? Math.abs(df) > s.arc * 0.55 : Math.abs(df - (sweep - s.ang)) > s.arc * 0.28 + 0.16) return;

        s.hits.add(e.id);
        s.hitCount++;
        const ea = Math.atan2(e.y - s.y, e.x - s.x);
        dealDamage(e, s.dmg, { src: s.src });
        hitMods(e, s.src, s.dmg);
        if(s.hpDmg > 0){
          dealDamage(e, P.maxHp * s.hpDmg * (1 + state.time / 240), { src:'flesh', trueDmg:true, noFlesh:true, canCrit:false });
        }
        /* 双持锅铲：一刀火一刀冰，自己就能搓出融化，不依赖第二把元素武器 */
        if(s.elemAlt > 0 && !e.dead){
          P.cookFlip = !P.cookFlip;
          applyElem(e, P.cookFlip ? 'fire' : 'ice', 2.6, s.dmg * s.elemAlt, s.src);
        }
        /* 断头台：残血直接处决，并把怒气还给你 */
        if(s.execute > 0 && !e.dead && e.hp < e.maxHp * s.execute && !e.big){
          dealDamage(e, e.hp + 1, { src:'guillotine', trueDmg:true, noFlesh:true, canCrit:false });
          if(hasRage()) rageGainRaw(6);
          addText(e.x, e.y - 20, '处决', '#ff5a3d', 11);
        }
        if(s.bleed > 0) applyBleed(e, 3.2, s.dmg * s.bleed, s.src);

        /* 击退：位移 + 记录动量，撞到别人会额外掉血（见 separate） */
        /* 击退：原来是"每命中一次就把怪推 s.knock 像素"（锅 22 / 球棒 88），
           连段下来怪被推出攻击范围，近战一直在追空气。
           现在位移 ×0.55，且同一只怪 0.3 秒内只会被推一次。 */
        if(!e.big && s.knock > 0 && !((e.knockCd || 0) > 0)){
          const kr = 1 - (e.knockRes || 0);
          const push = s.knock * kr * 0.55;
          e.x += Math.cos(ea) * push;
          e.y += Math.sin(ea) * push;
          e.knockPow = Math.max(e.knockPow || 0, push * 0.55);
          e.knockCd = 0.30;
        }
        /* 【2.6】眩晕抗性：3 秒内反复被晕，时长依次递减到 25%。
           原来每次都是满时长，一片近战横扫过去等于全体罚站，
           控制越堆越强——这也是"控制太强、怪近不了身"的一部分。 */
        if(s.stun > 0 && !e.big){
          if((e.stunResetT || -99) < state.time - 3) e.stunN = 0;
          e.stunResetT = state.time;
          e.stunN = Math.min(4, (e.stunN || 0) + 1);
          e.stun = Math.max(e.stun || 0, s.stun * Math.max(0.25, 1 - (e.stunN - 1) * 0.25));
        }
        /* 近战的身份不是"把怪推走"，而是"贴着打、边打边扛"：
           命中吸血 + 装备近战武器时的固定减伤（见 getStats）。
           持续输出的回报是续航，而不是把敌人推成一条空走廊。 */
        /* 【2.6】近战吸血改成"单次封顶 0.8% 最大生命"。
           原来按伤害比例回血，而伤害后期涨了 10 倍——回血就跟着涨 10 倍，
           调系数永远追不上。封顶之后，吸血是"贴脸续航"，不是"无限血量"。 */
        if(s.life > 0 && P.hp < P.maxHp) healPlayer(Math.min(s.dmg * s.life * 0.5, P.maxHp * 0.008));
        meleeImpact(e, s, ea);
        sfx(s.heavy ? 'clang' : 'slash');
      });
    }
    if(s.t >= swingTotal(s)) swings.splice(i, 1);
  }
}

/* =========================================================
   近战武器表
   ========================================================= */
const MELEE = {
  /* ---- 平底锅：扇形横扫，击退 + 眩晕（骑士起始） ---- */
  pan: {
    name:'平底锅', school:'melee', blurb:'朝面朝方向横扫一锅，把一群怪拍飞并短暂眩晕。',
    color:'#c9d4e2', icon:'pan', max:5, type:'melee',
    meleeVisual:{ shape:'pan', len:40 },
    tags:['melee', 'blast', 'knock'],
    mods:['reach', 'knock', 'burn', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', arc:'挥击角度', range:'挥击范围' },
    stats: lv => ({
      dmg: 46 + 22*lv + 6.6*lv*lv,
      cd: Math.max(0.46, 1.10 - 0.105*lv),
      arc: 2.0 + lv * 0.10,
      range: 62 + 6*lv
    }),
    awaken:'锅气冲天：360° 全向横扫，命中必定眩晕',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const R = s.range * ST.area * (hasMod('pan','reach') ? 1.25 : 1);
      const tgt = nearestEnemy(P.x, P.y, R * 1.8);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base,
        arc: evo ? TAU : Math.min(TAU, s.arc * (hasMod('pan','reach') ? 1.15 : 1)),
        range: R, windup: 0.11, active: 0.15, recover: 0.12,
        dmg: s.dmg * wDmgMul('pan'), src:'pan', col:'#e6eefc', lv,
        knock: hasMod('pan','knock') ? 14 : 8,
        life: 0.035,
        stun: evo ? 0.7 : 0.28,
        wide: evo, motion:'sweep', vis:this.meleeVisual, heavy: evo
      });
      sfx('whoosh');
      addShake(1.0);
    }
  },

  /* ---- 菜刀：极快连斩，暴击 + 流血 ---- */
  cleaver: {
    name:'菜刀', school:'melee', blurb:'极快的连续斩击，命中会挂上流血；对流血目标的暴击更痛。',
    color:'#e6eefc', icon:'cleaver', max:5, type:'melee',
    meleeVisual:{ shape:'cleaver', len:26 },
    tags:['melee', 'bleed', 'crit'],
    mods:['combo', 'bleed', 'crit', 'reach'],
    labels:{ dmg:'伤害', cd:'斩击间隔', arc:'劈砍角度' },
    stats: lv => ({
      dmg: 15 + 8*lv + 2.6*lv*lv,
      cd: Math.max(0.17, 0.40 - 0.045*lv),
      arc: 1.15,
      range: 52 + 4*lv
    }),
    awaken:'剁骨刀：每次挥砍都是一次双击，流血强度翻倍',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      const cfg = {
        x:P.x, y:P.y, ang: base + rand(-0.12, 0.12), arc: s.arc,
        range: s.range * ST.area, windup: 0.05, active: 0.08, recover: 0.06,
        dmg: s.dmg * wDmgMul('cleaver'), src:'cleaver', col:'#fff1f4', lv,
        knock: 3, life: 0.04, bleed: (hasMod('cleaver','bleed') ? 0.55 : 0.32) * (evo ? 2 : 1),
        motion:'chop', vis:this.meleeVisual
      };
      startSwing(cfg);
      if(evo) startSwing(Object.assign({}, cfg, { ang: base + 0.2, dmg: cfg.dmg * 0.8 }));
      sfx('whoosh');
    }
  },

  /* ---- 棒球棍：慢速重击，强击退，撞人额外伤害 ---- */
  bat: {
    name:'棒球棍', school:'melee', blurb:'抬起来、砸下去。慢，但一下能把整排怪打飞并互相撞伤。',
    color:'#f2b45c', icon:'bat', max:5, type:'melee',
    meleeVisual:{ shape:'bat', len:44 },
    tags:['melee', 'knock', 'blast'],
    mods:['knock', 'reach', 'heavy', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', knock:'击退' },
    stats: lv => ({
      dmg: 78 + 38*lv + 12*lv*lv,
      cd: Math.max(0.90, 1.85 - 0.17*lv),
      arc: 1.35,
      range: 74 + 6*lv,
      knock: 48 + 8*lv
    }),
    awaken:'再见全垒打：击退翻倍，被撞到的敌人额外吃一次震荡伤害',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 2.2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base, arc: s.arc,
        range: s.range * ST.area, windup: 0.15, active: 0.12, recover: 0.18,
        dmg: s.dmg * wDmgMul('bat'), src:'bat', col:'#ffd9a0', lv,
        knock: s.knock * (evo ? 2 : 1) * (hasMod('bat','knock') ? 1.4 : 1),
        stun: 0.35, heavy: true,
        motion:'sweep', vis:this.meleeVisual
      });
      addShake(2.2);
      sfx('whoosh');
    }
  },

  /* ---- 电锯：贴身持续切割，高频命中 ---- */
  chainsaw: {
    name:'电锯', school:'melee', blurb:'贴近就一直在切。单下很轻，但一秒能切好几下，最适合挂流血和吸血。',
    color:'#ff9d4d', icon:'chainsaw', max:5, type:'melee',
    meleeVisual:{ shape:'chainsaw', len:32 },
    tags:['melee', 'bleed', 'rapid'],
    mods:['combo', 'bleed', 'crit', 'heavy'],
    labels:{ dmg:'每下伤害', tick:'切割间隔', range:'切割范围' },
    stats: lv => ({
      dmg: 7 + 4.2*lv + 1.5*lv*lv,
      tick: Math.max(0.10, 0.20 - 0.02*lv),
      arc: 1.0,
      range: 44 + 3.2*lv
    }),
    awaken:'绞肉机：切割范围扩大，每次切割都会叠一层流血',
    continuous: true
  },

  /* ---- 长柄拖把：长距离突刺，穿透一条线 ---- */
  mop: {
    name:'长柄拖把', school:'melee', blurb:'往前一捅，捅穿一整条线上的敌人。距离长，但只打正面。',
    color:'#a6ffcb', icon:'mop', max:5, type:'melee',
    meleeVisual:{ shape:'mop', len:58 },
    tags:['melee', 'pierce', 'reach'],
    mods:['reach', 'pierce', 'knock', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', range:'突刺距离' },
    stats: lv => ({
      dmg: 42 + 21*lv + 7.2*lv*lv,
      cd: Math.max(0.42, 0.95 - 0.09*lv),
      arc: 0.30,
      range: 118 + 10*lv
    }),
    awaken:'拖把风暴：突刺变宽，命中会被拉向自己',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 1.2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base, arc: evo ? 0.85 : s.arc,
        range: s.range * ST.area * (hasMod('mop','reach') ? 1.2 : 1),
        windup: 0.12, active: 0.10, recover: 0.12,
        dmg: s.dmg * wDmgMul('mop'), src:'mop', col:'#d8ffe9', lv,
        knock: 10, motion:'thrust', vis:this.meleeVisual
      });
      sfx('whoosh');
    }
  },

  /* ---- 巨型汤勺：蓄力重击 + 震荡波 ---- */
  ladle: {
    name:'巨型汤勺', school:'melee', blurb:'举起来砸下去，落地震出一圈冲击波。慢得离谱，但一下能清一片。',
    color:'#c7a2ff', icon:'ladle', max:5, type:'melee',
    meleeVisual:{ shape:'ladle', len:46 },
    tags:['melee', 'blast', 'aoe'],
    mods:['reach', 'size', 'heavy', 'burn'],
    labels:{ dmg:'伤害', cd:'冷却', radius:'震荡范围' },
    stats: lv => ({
      dmg: 110 + 48*lv + 15*lv*lv,
      cd: Math.max(1.9, 3.6 - 0.34*lv),
      arc: 2.4,
      range: 92 + 7*lv,
      radius: 64 + 10*lv
    }),
    awaken:'汤勺风暴：砸地后连震三圈',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 1.8);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      const R = s.radius * ST.area * (hasMod('ladle','size') ? 1.25 : 1);
      const sx = clamp(P.x + Math.cos(base) * s.range * 0.5, 20, ARENA.w - 20);
      const sy = clamp(P.y + Math.sin(base) * s.range * 0.5, 20, ARENA.h - 20);
      strikes.push({
        kind:'slam', x: sx, y: sy,
        delay: 0.34, max: 0.34, r: R,
        dmg: s.dmg * wDmgMul('ladle'), seed: rand(0, 100), src:'ladle',
        waves: evo ? 3 : 1
      });
      startSwing({
        x:P.x, y:P.y, ang: base, arc: s.arc, range: s.range,
        windup: 0.22, active: 0.09, recover: 0.20,
        dmg: s.dmg * 0.45 * wDmgMul('ladle'),
        src:'ladle', col:'#e0c8ff', lv, knock: 12, stun: 0.5, life: 0.02,
        wide: true, heavy: true, motion:'slam', vis:this.meleeVisual,
        slamX: sx, slamY: sy, slamR: R
      });
      sfx('whoosh');
    }
  },


  /* ---- 骑士 · 断头台：专吃残血，处决返怒 ---- */
  guillotine: {
    name:'断头台', school:'melee', blurb:'横着一刀，把残血的直接送走。处决会返还怒气。',
    color:'#ff5a3d', icon:'mine', max:5, type:'melee',
    meleeVisual:{ shape:'bat', len:50 },
    tags:['melee', 'crit', 'rage'],
    mods:['crit', 'reach', 'heavy', 'haste'],
    labels:{ dmg:'伤害', cd:'冷却', range:'挥击范围' },
    stats: lv => ({
      dmg: 30 + 14*lv + 4.0*lv*lv,
      cd: Math.max(0.72, 1.35 - 0.12*lv),
      arc: 1.62,
      range: 74 + 5*lv,
      knock: 18 + 3*lv
    }),
    awaken:'斩首：处决线从 30% 提高到 40%，处决时炸一圈',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base, arc: s.arc,
        range: s.range * ST.area, windup: 0.13, active: 0.10, recover: 0.15,
        dmg: s.dmg * wDmgMul('guillotine'), src:'guillotine', col:'#ff8a6b', lv,
        knock: s.knock, stun: 0.25,
        execute: evo ? 0.40 : 0.30,
        motion:'sweep', vis:this.meleeVisual
      });
      sfx('slash');
    }
  },

  /* ---- 厨师 · 双持锅铲：一刀火一刀冰，自带反应 ---- */
  spatula: {
    name:'双持锅铲', school:'melee', blurb:'左手的铲是火，右手的是冰。砍两下就自己搓出融化。',
    color:'#ff8a3d', icon:'pan', max:5, type:'melee',
    meleeVisual:{ shape:'pan', len:32 },
    tags:['melee', 'elem', 'fire', 'ice'],
    mods:['haste', 'reach', 'burn', 'size'],
    labels:{ dmg:'伤害', cd:'冷却', range:'挥击范围' },
    stats: lv => ({
      dmg: 17 + 8*lv + 2.0*lv*lv,
      cd: Math.max(0.42, 0.86 - 0.09*lv),
      arc: 1.30,
      range: 60 + 4*lv,
      knock: 12 + 2*lv
    }),
    awaken:'爆炒连击：冷却再低一档，附加元素伤害翻倍',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base, arc: s.arc,
        range: s.range * ST.area, windup: 0.10, active: 0.08, recover: 0.12,
        dmg: s.dmg * wDmgMul('spatula'), src:'spatula', col:'#ffb066', lv,
        knock: s.knock, stun: 0.15,
        elemAlt: evo ? 0.70 : 0.35,
        motion:'sweep', vis:this.meleeVisual
      });
      sfx('slash');
    }
  },

  /* ---- 血肉重锤：肉猪流派的核心武器，伤害直接吃最大生命 ---- */
  meatmaul: {
    name:'血肉重锤', school:'melee', blurb:'砸下去的重量等于你的血量。血越厚，砸得越重。',
    color:'#ff5f7e', icon:'bat', max:5, type:'melee',
    meleeVisual:{ shape:'bat', len:44 },
    tags:['melee', 'knock', 'flesh'],
    mods:['heavy', 'knock', 'reach', 'crit'],
    labels:{ dmg:'伤害', cd:'冷却', range:'挥击范围' },
    stats: lv => ({
      /* 固定部分很少，主要吃最大生命：300 血时约 +18，800 血时约 +48 */
      dmg: 24 + 10*lv + 2.6*lv*lv + (P ? P.maxHp : 300) * (0.06 + 0.012*lv),
      cd: Math.max(0.80, 1.55 - 0.13*lv),
      arc: 1.45,
      range: 68 + 5*lv,
      knock: 26 + 4*lv
    }),
    awaken:'血怒重锤：每次命中额外造成 3% 最大生命的真实伤害',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      const tgt = nearestEnemy(P.x, P.y, s.range * 2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      startSwing({
        x:P.x, y:P.y, ang: base, arc: s.arc,
        range: s.range * ST.area, windup: 0.17, active: 0.12, recover: 0.18,
        dmg: s.dmg * wDmgMul('meatmaul'), src:'meatmaul', col:'#ffb0c4', lv,
        knock: s.knock * (hasMod('meatmaul','knock') ? 1.4 : 1),
        stun: 0.35, heavy: true,
        hpDmg: evo ? 0.03 : 0,
        motion:'sweep', vis:this.meleeVisual
      });
      addShake(2.4);
      sfx('whoosh');
    }
  },

  /* ---- 双截棍：连打越快，命中越多冷却越低 ---- */
  nunchaku: {
    name:'双截棍', school:'melee', blurb:'连着打，越打越快。停手就会掉节奏。',
    color:'#ffe066', icon:'nunchaku', max:5, type:'melee',
    meleeVisual:{ shape:'nunchaku', len:28 },
    tags:['melee', 'rapid', 'combo'],
    mods:['combo', 'crit', 'bleed', 'reach'],
    labels:{ dmg:'伤害', cd:'基础间隔' },
    stats: lv => ({
      dmg: 18 + 9.5*lv + 3.0*lv*lv,
      cd: Math.max(0.16, 0.34 - 0.036*lv),
      arc: 1.5,
      range: 58 + 4*lv
    }),
    awaken:'乱打：连击上限翻倍，每层额外 +3% 伤害',
    fire(lv){
      const s = this.stats(lv);
      const evo = evoOn(this, lv);
      P.nunCombo = Math.min(evo ? 20 : 10, (P.nunCombo || 0) + 1);
      P.nunT = 1.2;
      const speed = 1 / (1 + P.nunCombo * 0.06);
      const tgt = nearestEnemy(P.x, P.y, s.range * 2);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      P.nunSide = -(P.nunSide || 1);
      startSwing({
        x:P.x, y:P.y, ang: base + rand(-0.2, 0.2), arc: s.arc,
        range: s.range * ST.area, windup: 0.04, active: 0.07, recover: 0.05,
        dmg: s.dmg * wDmgMul('nunchaku') * (1 + P.nunCombo * (evo ? 0.03 : 0.02)),
        src:'nunchaku', col:'#fff3a8', lv, knock: 4, life: 0.03,
        motion:'flurry', vis:this.meleeVisual, side: P.nunSide
      });
      P.cds['nunchaku'] = Math.max(0.10, s.cd * speed);
      sfx('whoosh');
    }
  },

  /* ---- 回旋披萨刀：移动时持续旋转切割 ---- */
  pizzacutter: {
    name:'回旋披萨刀', school:'melee', blurb:'一边跑一边转，贴着你的怪都在被切。移动越快切得越狠。',
    color:'#ff8fb0', icon:'pizza', max:5, type:'melee',
    meleeVisual:{ shape:'pizza', len:30 },
    tags:['melee', 'orbit', 'bleed'],
    mods:['size', 'bleed', 'combo', 'crit'],
    labels:{ dmg:'每跳伤害', radius:'切割半径', tick:'跳动间隔' },
    stats: lv => ({
      dmg: 12 + 6.5*lv + 2.2*lv*lv,
      radius: 52 + 6*lv,
      tick: Math.max(0.20, 0.34 - 0.028*lv)
    }),
    awaken:'披萨风暴：半径翻倍，切割附带流血',
    continuous:'pizza'
  }
};

/* 合并进武器总表（覆盖 42 里同名的老实现） */
Object.assign(WEAPONS, MELEE);

/* 电锯 / 披萨刀的持续型逻辑，挂在 updateContinuous 里调用 */
function updateMeleeContinuous(dt){
  /* 电锯 */
  const clv = P.weapons.chainsaw;
  if(clv){
    const s = MELEE.chainsaw.stats(clv);
    const evo = clv >= 5;
    P.sawT = (P.sawT === undefined ? 0 : P.sawT) - dt;
    if(P.sawT <= 0){
      P.sawT = s.tick;
      const tgt = nearestEnemy(P.x, P.y, s.range * 1.6);
      const base = tgt ? Math.atan2(tgt.y - P.y, tgt.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
      P.sawAng = base;
      const R = s.range * ST.area * (evo ? 1.3 : 1);
      const dmg = s.dmg * wDmgMul('chainsaw') * (hasMod('chainsaw','combo') ? 1.15 : 1);
      let hitAny = false;
      eachNear(P.x, P.y, R, function(e){
        let df = Math.atan2(e.y - P.y, e.x - P.x) - base;
        while(df > Math.PI) df -= TAU;
        while(df < -Math.PI) df += TAU;
        if(Math.abs(df) > s.arc * 0.7) return;
        hitAny = true;
        dealDamage(e, dmg, { src:'chainsaw' });
        hitMods(e, 'chainsaw', dmg);
        if(hasMod('chainsaw','bleed') || evo) applyBleed(e, 2.4, dmg * 0.7, 'chainsaw');
        if(!e.big){
          const a = Math.atan2(e.y - P.y, e.x - P.x);
          e.x += Math.cos(a) * 3; e.y += Math.sin(a) * 3;
        }
      });
      if(hitAny){
        /* 切割火花：从刀口往前飞 */
        for(let i = 0; i < 5 && parts.length < 400; i++){
          const a = base + rand(-0.5, 0.5);
          parts.push({
            x: P.x + Math.cos(a) * R * 0.75, y: P.y + Math.sin(a) * R * 0.75,
            vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(80, 200) - 40,
            life: rand(0.08, 0.20), max: 0.2, col: i % 2 ? '#ffd166' : '#fff3c4',
            size: 2, g: 1.2, spark: true
          });
        }
        addShake(0.5);
        sfx('slash');
      } else {
        sfx('chainLoop');
      }
    }
  }

  /* 回旋披萨刀 */
  const plv = P.weapons.pizzacutter;
  if(plv){
    const s = MELEE.pizzacutter.stats(plv);
    const evo = plv >= 5;
    const R = s.radius * ST.area * (hasMod('pizzacutter','size') ? 1.25 : 1) * (evo ? 1.5 : 1);
    P.pizzaA = (P.pizzaA || 0) + dt * 9;
    P.pizzaT = (P.pizzaT === undefined ? 0 : P.pizzaT) - dt;
    if(P.pizzaT <= 0){
      P.pizzaT = s.tick;
      const moving = P.moving ? 1.35 : 1;
      const dmg = s.dmg * wDmgMul('pizzacutter') * moving;
      eachNear(P.x, P.y, R, function(e){
        if((e.pizzaCd || 0) > 0) return;
        e.pizzaCd = 0.24;
        dealDamage(e, dmg, { src:'pizzacutter' });
        hitMods(e, 'pizzacutter', dmg);
        if(hasMod('pizzacutter','bleed') || evo) applyBleed(e, 2.0, dmg * 0.5, 'pizzacutter');
      });
      if(!enemies.length) return;
      sfx('spin');
    }
  }
}
