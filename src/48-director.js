/* =========================================================
   4.8 节奏导演
   ---------------------------------------------------------
   单局能活多久是结果，不是目标：
     · 卡组烂 → 第一次精英/首 BOSS 就顶不住，2–4 分钟结束
     · 一般   → 6–9 分钟
     · 成型   → 12–18 分钟
     · 胡牌   → 20 分钟以上，进入无尽强化
   导演只负责在正确的时刻施压，不负责限制时长。
   ========================================================= */
const ACTS = [
  { id:1, from:0,   name:'第一幕 · 立流派', sub:'先活下来，找到这局的方向' },
  { id:2, from:80,  name:'第二幕 · 成型',   sub:'把咬合的几件拼起来' },
  { id:3, from:220, name:'第三幕 · 爆发',   sub:'让连锁自己滚起来' },
  { id:4, from:600, name:'终局 · 拖鞋之王', sub:'10:00 击败拖鞋之王即可通关' }
];

function directorTick(dt){
  const t = state.time;
  let act = 1;
  for(let i = 0; i < ACTS.length; i++) if(t >= ACTS[i].from) act = ACTS[i].id;
  if(act !== state.act){
    state.act = act;
    onActStart(act);
  }

  /* 场地事件：2:30 起每 55 秒来一次，制造起伏 */
  if(t > 150){
    state.eventT = (state.eventT === undefined ? 55 : state.eventT) - dt;
    if(state.eventT <= 0){
      state.eventT = 55;
      arenaEvent();
    }
  }

  /* 无尽阶段：通关之后继续玩才启动（每分钟送强化，Boss 循环加速） */
  if(act >= 4 && state.endless){
    state.endlessT = (state.endlessT === undefined ? 60 : state.endlessT) - dt;
    if(state.endlessT <= 0){
      state.endlessT = 60;
      endlessTick();
    }
  }
}

function onActStart(act){
  const a = ACTS[act - 1];
  showToast(a.name);
  bgmSetAct(act);
  state.flash = Math.max(state.flash, 0.25);
  state.shake = Math.max(state.shake, 3);
  rings.push({ x:P.x, y:P.y, r0:10, r1:220, life:0.8, max:0.8, col:'#ffe066', w:3 });

  if(act === 2){
    /* 第二幕开场：一圈怪潮，逼玩家确认自己的清场手段 */
    spawnHorde();
  } else if(act === 3){
    /* 第三幕：精英小队 */
    for(let i = 0; i < 2; i++){
      const ang = rand(0, TAU);
      spawnEliteAt(clamp(P.x + Math.cos(ang) * 200, 40, ARENA.w - 40),
                   clamp(P.y + Math.sin(ang) * 200, 40, ARENA.h - 40));
    }
  } else if(act === 4){
    /* 终局：拖鞋之王登场。它不是"更厚的怪"，而是这一局的目标 */
    spawnFinalBoss();
    addText(P.x, P.y - 44, '终局', '#ff9dc0', 16);
  }
}

/* ---------------- 场地事件 ---------------- */
const ARENA_EVENTS = ['toxic', 'storm', 'supply', 'portal'];

function arenaEvent(){
  /* 【3.5】补给空投在后期是纯减压事件：玩家血量 1000+，一次 3 个 10% 血包，
     等于白送 30% 生命。前期它该是"喘口气"，后期它不该继续按 25% 概率出现。
     权重从 25/25/25/25 变成 30/30/8/32（越到后期补给越少）。 */
  const lateK = Math.min(1, Math.max(0, (state.time - 180) / 360));
  const w = {
    toxic: 30 + lateK * 6,
    storm: 30 + lateK * 6,
    supply: 25 - lateK * 17,
    portal: 25 + lateK * 9
  };
  const bag = [];
  for(const k in w){ for(let i = 0; i < Math.round(w[k]); i++) bag.push(k); }
  const kind = pickOne(bag);
  if(kind === 'toxic'){
    showToast('☣ 毒雾扩散');
    for(let i = 0; i < 4; i++){
      const a = rand(0, TAU), d = rand(60, 200);
      addHazard(clamp(P.x + Math.cos(a) * d, 40, ARENA.w - 40),
                clamp(P.y + Math.sin(a) * d, 40, ARENA.h - 40), rand(34, 52), rand(6, 9), 7);
    }
  } else if(kind === 'storm'){
    showToast('⚡ 闪电风暴');
    for(let i = 0; i < 8; i++){
      const a = rand(0, TAU), d = rand(40, 240);
      strikes.push({ kind:'zap', x: clamp(P.x + Math.cos(a) * d, 20, ARENA.w - 20),
        y: clamp(P.y + Math.sin(a) * d, 20, ARENA.h - 20),
        delay: 0.25 + i * 0.22, max: 0.5, r: 40 * ST.area,
        /* 【5.0】场地闪电一下 30 点起（约 8~10% 生命），走同一条攻击曲线 */
        dmg: 30 * atkCurve(state.time), seed: rand(0, 100), src:'bolt' });
    }
  } else if(kind === 'supply'){
    showToast('🎁 补给空投');
    for(let i = 0; i < 3; i++){
      const a = rand(0, TAU), d = rand(50, 150);
      dropHeal(clamp(P.x + Math.cos(a) * d, 40, ARENA.w - 40),
               clamp(P.y + Math.sin(a) * d, 40, ARENA.h - 40), 0.10);
    }
    for(let i = 0; i < 6; i++) dropGem(P.x + rand(-90, 90), P.y + rand(-70, 70), 4);
  } else {
    showToast('🌀 裂隙开启：精英来了');
    for(let i = 0; i < 3; i++){
      const a = (i / 3) * TAU + rand(-0.3, 0.3);
      const x = clamp(P.x + Math.cos(a) * 190, 40, ARENA.w - 40);
      const y = clamp(P.y + Math.sin(a) * 190, 40, ARENA.h - 40);
      spawnEliteAt(x, y, pickType());
      rings.push({ x, y, r0:6, r1:60, life:0.5, max:0.5, col:'#b98cff', w:3 });
    }
  }
}

/* 无尽阶段：每分钟强化一次，同时把 BOSS 间隔压短 */
function endlessTick(){
  if(state.act !== 4) return;
  P.endless = (P.endless || 0) + 1;
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.25);
  forceLevelUp();
  state.bossAt = Math.min(state.bossAt, state.time + 45);
  showToast('♾ 无尽强化 ×' + P.endless);
  rings.push({ x:P.x, y:P.y, r0:10, r1:160, life:0.6, max:0.6, col:'#ff9dc0', w:4 });
}
