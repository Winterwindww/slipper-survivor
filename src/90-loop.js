/* =========================================================
   14. 开局
   ========================================================= */
function resetGame(){
  const C = CHAR;
  const S = relicStat();
  let maxHp = Math.round((C.hp + (S.maxHp || 0)) * (S.maxHpMul || 1));

  P = {
    x: ARENA.w / 2, y: ARENA.h / 2, r: 6,
    hp: maxHp, maxHp: maxHp,
    level: 1, xp: 0, xpNext: nextXp(1),
    facing: 1, invuln: 0, anim: 0, moving: false,
    cds: {}, weapons: {}, wmod: {}, wevo: {}, refine: {}, freeMods: 0, passives: {}, relics: {}, relicOrder: [],
    resoSeen: {}, orbAngle: 0, orbPos: [],
    auraT: 0.2, auraR: 0, auraPulse: 0, focus: 0, rage: 0, berserk: 0,
    gamble: null, gambleDmg: 1, gambleSpd: 1, gambleT: 10, dodgeProc: false,
    killCounter: 0, gemCounter: 0, petRespawn: 0
  };
  resInit();

  /* 事件总线：先清空再注册，避免上一局的监听残留 */
  clearBus();
  initRelics();
  initSchoolMech();
  REACT_MUL.melt = 1; REACT_MUL.toxblast = 1; REACT_MUL.superconduct = 1; REACT_MUL.conduct = 1;
  if(C.init) C.init();

  enemies = []; bullets = []; ebullets = []; gems = [];
  parts = []; texts = []; rings = []; strikes = []; drops = [];
  beams = []; mines = []; hazards = []; holes = []; allies = [];
  DMG = {}; SRC = 'misc';
  uid = 1;

  state.time = 0; state.kills = 0;
  state.shake = 0; state.shakeCd = 0; state.calmT = 99;
  state.contactFx = 0; state.contactN = 0; state.orbCd = 0;
  state.hurtFlash = 0; state.flash = 0; state.slow = 0;
  state.spawn = 0.3; state.bossAt = 150; state.bossIdx = 0;
  state.eliteAt = 75; state.hordeAt = 150; state.act = 1;
  state.pending = 0; state.dropTimer = 10; state.healBudget = 0; state.healPool = undefined;
  state.healEWMA = 0; state.flankFx = -9;
  state.dps = 80; state.dmgAcc = 0; state.dpsT = 0; state.eventT = 55; state.bossKills = 0; state.bossTtk = [];
  state.lastStand = false;
  /* 终局相关：每局都要重置，否则第二局一开局就是"已通关" */
  state.finalSpawned = false; state.finalEnemy = 0; state.won = false; state.endless = false; state.winOnce = false;
  try{ state.clears = Number(localStorage.getItem('slipper_survivor_clears') || 0) || 0; }catch(e){ state.clears = 0; }
  state.hitstop = 0; state.hitstopCd = 0;
  state.hitCount = 0; state.dmgDealt = 0;
  /* 【6.0】BOSS 领域每局清空 */
  state.ban = null;

  /* 初始武器 */
  P.weapons[C.weapon] = 1;
  P.wmod[C.weapon] = [];
  P.cds[C.weapon] = 0.25;

  gridInit();
  ST = getStats();
  refreshArch(true);          /* 开局静默：角色禀赋带来的 I 级不弹窗 */
  invKey = ''; relKey = '';
  state.mode = 'playing';
  $('hud').classList.remove('hidden');
  $('title').classList.add('hidden');
  $('charselect').classList.add('hidden');
  $('levelup').classList.add('hidden');
  $('pausebox').classList.add('hidden');
  $('gameover').classList.add('hidden');
  buildInv();
  buildRelBar();
  updateHUD();
}

function startGame(charId){
  if(charId && CHARS[charId]) CHAR = CHARS[charId];
  bgmStart();
  resetGame();
}

function openCharSelect(){
  state.mode = 'title';
  $('title').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('charselect').classList.remove('hidden');
  buildCharSelect();
}

/* =========================================================
   15. 输入 & 主循环
   ========================================================= */
const keys = Object.create(null);
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();

  if(k === 'm'){ toggleMute(); return; }
  /* 【4.0】冲刺：空格 / Shift。放在暂停、选卡之前，避免和"确认"抢键。 */
  if(state.mode === 'playing' && (k === ' ' || k === 'shift')){
    e.preventDefault();
    let dx = 0, dy = 0;
    if(keys['a'] || keys['arrowleft'])  dx--;
    if(keys['d'] || keys['arrowright']) dx++;
    if(keys['w'] || keys['arrowup'])    dy--;
    if(keys['s'] || keys['arrowdown'])  dy++;
    /* 没按方向键就朝面朝方向冲，避免"站着不动按空格没反应" */
    startDash(dx, dy);
    return;
  }
  if(k === 'escape' || k === 'p'){
    if(state.mode === 'playing' || state.mode === 'paused') togglePause();
    return;
  }
  if(state.mode === 'levelup' && ['1','2','3'].includes(k)){
    chooseCard(Number(k) - 1);
    return;
  }
  if(state.mode === 'title' && (k === 'enter' || k === ' ')){
    e.preventDefault();
    if($('charselect').classList.contains('hidden')) openCharSelect();
    return;
  }
  if(state.mode === 'gameover' && (k === 'enter' || k === ' ')){
    e.preventDefault();
    openCharSelect();
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => {
  for(const k in keys) keys[k] = false;
  if(state.mode === 'playing') togglePause();
});

$('startBtn').addEventListener('click', openCharSelect);
$('restartBtn').addEventListener('click', openCharSelect);
$('continueBtn').addEventListener('click', continueEndless);
$('resumeBtn').addEventListener('click', togglePause);
$('dieBtn').addEventListener('click', function(){
  $('pausebox').classList.add('hidden');
  state.mode = 'playing';
  P.hp = 0;
  gameOver();
});
$('pausebtn').addEventListener('click', togglePause);
$('mutebtn').addEventListener('click', toggleMute);

function toggleMute(){
  muted = !muted;
  $('mutebtn').textContent = muted ? '🔇' : '🔊';
  $('mutebtn').classList.toggle('off', muted);
  if(audioInit() && masterGain){
    const t = AC.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), t);
    masterGain.gain.linearRampToValueAtTime(muted ? 0.0001 : 1, t + 0.12);
  }
}

$('bestT').textContent = fmtTime(state.best);
try{ $('clearT').textContent = String(Number(localStorage.getItem('slipper_survivor_clears') || 0) || 0); }catch(e){}

function resize(){
  let s = Math.min(window.innerWidth / W, window.innerHeight / H);
  if(s > 1) s = Math.max(1, Math.floor(s * 2) / 2);
  s = clamp(s, 0.55, 5);
  const dw = Math.round(W * s), dh = Math.round(H * s);
  stage.style.width = dw + 'px';
  stage.style.height = dh + 'px';
  stage.style.setProperty('--u', (dw / W * 2) + 'px');
}
window.addEventListener('resize', resize);

let lastT = performance.now();
function loop(now){
  let dt = (now - lastT) / 1000;
  lastT = now;
  if(dt > 0.05) dt = 0.05;
  if(dt < 0) dt = 0;
  state.t += dt;

  /* 通关倒数：与 mode 无关，避免升级弹窗把结算卡住 */
  checkWin(dt);

  if(state.mode === 'playing'){
    let gdt = state.slow > 0 ? dt * 0.35 : dt;
    /* 顿帧：命中瞬间几乎冻结，是打击感的关键。用真实时间消耗，避免堆积 */
    if(state.hitstop > 0){ state.hitstop -= dt; gdt = dt * 0.05; }
    updateGame(gdt);
  }

  if(state.mode === 'title' && $('charselect').classList.contains('hidden')){
    renderTitle();
  } else {
    render();
  }
  requestAnimationFrame(loop);
}

/* 初始化 */
resize();
makeGround();
makeProps();
makeBlobs();
makeVignette();
gridInit();
normalizeWeaponCurves();
resetGame();          // 先建立对象，避免空引用
state.mode = 'title';
$('hud').classList.add('hidden');
$('title').classList.remove('hidden');
requestAnimationFrame(loop);

/* =========================================================
   16. 调试 / 无头模拟接口
   ========================================================= */
const KIND_SCORE = { wevo:18, revo:22, revoTo:22, wup:14, wmod:13, relic:12, wnew:10, wmerge:15, crystal:6, heal:0 };

function autoPickCard(){
  if(state.mode !== 'levelup' || !curChoices || !curChoices.length) return false;
  /* 进化 A/B 二选一：AI 直接选 A。玩家自己会看到两张卡，
     这里只是让"进化在真实对局里真的会走到"可被测试验证。 */
  for(let i = 0; i < curChoices.length; i++){
    if(curChoices[i].kind === 'revoTo'){ chooseCard(i); return true; }
  }
  const lowHp = P.hp < P.maxHp * 0.55;
  const wCount = weaponCount();
  const limit = slotLimit();
  const map = { burn:'fire', chill:'ice', venom:'venom', volt:'volt', blast:'blast',
                pierce:'pierce', crit:'crit', bounce:'chain', size:'aoe' };
  let best = 0, bestScore = -1e9;
  for(let i = 0; i < curChoices.length; i++){
    const o = curChoices[i];
    let s = KIND_SCORE[o.kind] === undefined ? 0 : KIND_SCORE[o.kind];
    if(o.kind === 'wnew'){
      if(wCount >= limit) s = 2;
      /* 只要有空槽，新武器就是最高优先：一个空槽 = 一份完全闲置的输出位。
         实测厨师会卡在 2/3 槽——+4 分抢不过同流派的武器升级（20 分），
         于是一整局只有两把武器。空槽不是以后再说，是现在就亏。 */
      else s += 12;
    }
    if(o.kind === 'wnew' || o.kind === 'wup' || o.kind === 'wmod'){
      const w = WEAPONS[o.id];
      if(w && CHAR.schools && CHAR.schools.indexOf(w.school) >= 0) s += 6;
    }
    if(o.kind === 'swapNew') s = -6;
    if(o.kind === 'swapBack') s = 200;
    if(o.kind === 'swapTo') s = -6;
    if(o.kind === 'wmod'){
      const t = map[o.mod];
      if(t && CHAR.affinity.indexOf(t) >= 0) s += 5;
      if(o.mod === 'crit' || o.mod === 'heavy') s += 3;
      if(hasMod(o.id, o.mod)) s -= 20;
    }
    if(o.kind === 'wup' && o.tag === '⚡ 觉醒') s += 3;
    if(o.kind === 'relic'){
      const r = RELICS[o.id];
      if(r && r.rar === 'epic') s += 4;
      if(r && r.rar === 'curse') s -= 3;
      /* 已经投入的构筑流派：优先拿同路的遗物 */
      if(r && r.tags && P.arch){
        for(const aid in P.arch){
          const a = P.arch[aid];
          if(!a || !a.pts) continue;
          const def = ARCH[aid];
          for(let ti = 0; ti < def.tags.length; ti++){
            if(r.tags.indexOf(def.tags[ti]) >= 0){ s += 6; break; }
          }
        }
      }
    }
    if(o.kind === 'crystal'){
      const p = PASSIVES[o.id];
      if(p && p.arch && P.arch && P.arch[p.arch] && P.arch[p.arch].pts > 0) s += 5;
    }
    if(o.kind === 'heal') s += lowHp ? 20 : -12;
    if(o.kind === 'crystal' && lowHp && (o.id === 'heart' || o.id === 'regen' || o.id === 'plate')) s += 9;
    if(s > bestScore){ bestScore = s; best = i; }
  }
  chooseCard(best);
  return true;
}

window.__SS = {
  version: '6.0.0',
  start(charId){
    startGame(charId || CHAR.id);
    return true;
  },
  step(dt){
    state.t += dt;
    checkWin(dt);
    if(state.mode === 'playing'){
      let gdt = dt;
      if(state.hitstop > 0){ state.hitstop -= dt; gdt = dt * 0.05; }
      updateGame(gdt);
    }
    return state.mode;
  },
  autoPick: autoPickCard,
  continueEndless(){ continueEndless(); return state.mode; },
  draft(n){
    return rollUpgrades(n || 3).map(function(o){ return { kind:o.kind, id:o.id, mod:o.mod, name:o.name, tag:o.tag }; });
  },
  render(){ render(); return true; },
  weaponIds(){ return Object.keys(WEAPONS); },
  /* 数值审计：全部遗物 id（tools/budget.mjs 用它做全卡压力测试） */
  allRelicIds(){ return Object.keys(RELICS); },
  /* 当前角色还能抽到的武器（验证"卡池收口"是否真的生效） */
  poolFor(){
    const out = [];
    for(const id in WEAPONS) if(!P.weapons[id] && weaponForChar(id)) out.push(id);
    return out;
  },
  dmgBySrc(){ const o = {}; for(const k in DMG) o[k] = Math.round(DMG[k]); return o; },
  hpTable(){
    /* 给数值审计用：任意时刻各类怪与 BOSS 的实际血量 */
    const out = { mobs:{}, bosses:{} };
    const hpMul = enemyHpMul;
    const times = [0, 60, 120, 180, 240, 300, 420, 480, 600, 900];
    for(const id in ENEMIES){
      out.mobs[id] = {};
      for(const t of times) out.mobs[id][t] = Math.round(ENEMIES[id].hp * hpMul(t) * 0.72);
    }
    out.times = times;
    out.boss = {};
    out.bossAt = {};
    out.bossName = {};
    const keys = ['candyKing','colaKing','burgerKing','jellyPope','veggieQueen','puddingTyrant'];
    for(const t of [110, 188, 266, 344, 422, 500, 578, 600]){
      const idx = Math.max(0, Math.round((t - 110) / 78));
      const key = keys[idx % keys.length];
      out.bossAt[t] = Math.round(BOSSES[key].hp * bossHpMul(t, idx));
      out.bossName[t] = BOSSES[key].name;
    }
    return out;
  },
  setBalance(t){ for(const k in t) BALANCE[k] = t[k]; return true; },
  balance(){ const o = {}; for(const k in BALANCE) o[k] = { s:BALANCE[k].s, k:BALANCE[k].k }; return o; },
  refresh(){ refreshSchools(); ST = getStats(); return true; },
  /* 【6.0】进化与共鸣的测试接口：让门禁能验证"条件达成 → 进化卡出现 → 分支真的生效" */
  evoIds(){ return Object.keys(EVO); },
  evoState(){ const o = {}; for(const rid in EVO) o[rid] = evoState(rid); return o; },
  evoReady(){ return evoReadyList(); },
  giveEvoN(k, n){ if(!P.evoN) P.evoN = {}; P.evoN[k] = n; return true; },
  pickEvo(rid, which){ applyRelicEvo(rid, which); refreshSchools(); ST = getStats(); return true; },
  resonances(){ return resonanceList(); },
  audit(){
    return {
      rate: state.rate || [],
      st: ST,
      level: P.level, hp: P.hp, maxHp: P.maxHp,
      relicIds: Object.keys(P.relics), passiveIds: P.passives,
      weaponIds: Object.keys(P.weapons),
      bullets: bullets.length, allies: allies.length, enemies: enemies.length
    };
  },
  title(){ renderTitle(); return true; },
  get P(){ return P; },
  get ST(){ return ST; },
  get state(){ return state; },
  get keys(){ return keys; },
  get arena(){ return ARENA; },
  get enemies(){ return enemies; },
  get gems(){ return gems; },
  get bullets(){ return bullets; },
  /* 【3.3】模拟器要能看见敌弹才能评估"远程怪加密"的影响 */
  get ebullets(){ return ebullets; },
  get allies(){ return allies; },
  get swings(){ return swings; },
  get choices(){ return curChoices; },
  get char(){ return CHAR; },
  chars(){ return Object.keys(CHARS); },
  spawn(type, n){
    for(let i = 0; i < (n || 1); i++) addEnemy(type || 'slime');
    return enemies.length;
  },
  /* 给回归测试用：直接对一个敌人结算伤害（走统一伤害管线，不绕过死亡处理） */
  hurt(e, dmg){
    if(!e) return false;
    dealDamage(e, dmg, { src:'dbg' });
    return !!e.dead;
  },
  /* 3.0 审计：直接结算一次伤害并返回实际数值（不含击杀处理之外的副作用） */
  probe(e, amount, opt){
    if(!e) return 0;
    const before = e.hp;
    dealDamage(e, amount, Object.assign({ src:'dbg' }, opt || {}));
    return before - e.hp;
  },
  hurtPlayer(n){ hurtPlayer(n); return P.hp; },
  spawnElite(type){
    spawnEliteAt(clamp(P.x + 120, 40, ARENA.w - 40), P.y, type);
    const e = enemies[enemies.length - 1];
    return e ? { affix: e.affix, elite: !!e.elite } : null;
  },
  ownerTables(){
    const relics = {}, crystals = {}, weapons = {};
    for(const id in RELICS) relics[id] = RELICS[id].own || null;
    for(const id in PASSIVES) crystals[id] = PASSIVES[id].own || null;
    for(const id in WEAPONS) weapons[id] = WEAPON_OWNER[id] || null;
    return { relics, crystals, weapons };
  },
  /* 该角色当前可抽的武器池（用于回归：专属武器必须真的在他的池里） */
  weaponPool(){
    const out = [];
    for(const id in WEAPONS) if(weaponForChar(id)) out.push(id);
    return out;
  },
  /* 全武器目录：给审计脚本 / 内容规模统计用 */
  drawIcon: drawIcon,   /* 给 tools/_iconshot.mjs 用（不参与玩法） */
  /* 图标审计：把每件遗物 / 每张改造卡的图标参数导出来，
     给 tools/_iconshot.mjs 画对照表（不参与玩法） */
  relicIcons(){
    const out = [];
    for(const id in RELICS){
      const r = RELICS[id];
      out.push({ id, name:r.name, icon:r.icon, color:r.color, seed:'relic:' + id });
    }
    return out;
  },
  /* 卡表全量（审计用）：把每件遗物的归属 / 标签 / 稀有度 / 描述原样导出。
     之前 tools/cardcheck.mjs 查 relicDef 这个方法根本不存在，
     于是"重名 / 空卡 / 越权"三项全是空跑假绿。 */
  relicTable(){
    const out = [];
    for(const id in RELICS){
      const r = RELICS[id];
      out.push({ id, name:r.name, own:r.own || null, rar:r.rar || null,
                 tags:(r.tags || []).slice(), desc:r.desc || '' });
    }
    return out;
  },
  passiveTable(){
    const out = [];
    for(const id in PASSIVES){
      const p = PASSIVES[id];
      out.push({ id, name:p.name, max:p.max || 0, desc: typeof p.desc === 'function' ? p.desc(1) : (p.desc || '') });
    }
    return out;
  },
  archTable(){
    const out = [];
    for(const id in ARCH){
      const a = ARCH[id];
      out.push({ id, name:a.name, own:a.own || null, tags:(a.tags || []).slice(), tiers:(a.tiers || []).slice() });
    }
    return out;
  },
  archPoints(){
    const out = {};
    for(const id in ARCH) out[id] = (typeof archPtsRaw === "function") ? archPtsRaw(id) : 0;
    return out;
  },
  modIcons(){
    const out = [];
    for(const m in MODS) out.push({ id:m, name:MODS[m].name, icon:'#' + m });
    return out;
  },
  weaponCatalog(){
    const out = [];
    for(const id in WEAPONS){
      const w = WEAPONS[id];
      let a = null, b = null;
      try { a = w.stats(1); b = w.stats(w.max || 5); } catch(e){}
      out.push({ id, name:w.name, school:w.school, owner:WEAPON_OWNER[id] || null,
                 max:w.max || 5, blurb:w.blurb || '', awaken:w.awaken || '',
                 tags:w.tags || [], mods:w.mods || [],
                 dmg1:a ? a.dmg : null, dmgMax:b ? b.dmg : null });
    }
    return out;
  },
  chargeMul(){ return chargeRateMul(); },
  spendCharge(n){ chargeSpend(n); return P.charge; },
  crystalPool(){
    const out = [];
    for(const id in PASSIVES) if(crystalForChar(id)) out.push(id);
    return out;
  },
  arch(){ const o = {}; for(const k in (P.arch||{})) o[k] = { pts: P.arch[k].pts, tier: P.arch[k].tier }; return o; },
  res(){ return { rage: P.rage, berserk: P.berserk, charge: P.charge, overload: P.overload,
                  shield: P.shield, shieldMax: ST.shieldMax, devour: P.devour,
                  fleshPct: ST.fleshPct, rageGain: ST.rageGain, chargeRate: ST.chargeRate,
                  overheat: P.overheat, drained: P.drained, rageCount: P.rageCount,
                  overloadCount: P.overloadCount }; },
  /* 【4.0】新机制的审计接口 */
  eco(){
    return {
      atk: atkCurve(state.time),
      refHp: refHpAt(state.time),
      armor: armorDR(45),
      contactTick: ECO.contactTick,
      spawnBudget: spawnBudget(state.time),
      rangedShare: rangedThreatShare(),
      dashCharge: P.dashCharge, dashT: P.dashT,
      dashMax: dashMaxNow(),
      healEff: healEff()
    };
  },
  ecoTable(){
    const rows = [];
    for(const t of [0, 90, 180, 300, 450, 600, 900]){
      rows.push({ t, atk: +atkCurve(t).toFixed(3), refHp: Math.round(refHpAt(t)),
                  budget: +spawnBudget(t).toFixed(2),
                  contactTick: ECO.contactTick });
    }
    return rows;
  },
  armorTable(){
    const out = [];
    for(const a of [0, 20, 40, 80, 160, 320]) out.push({ pts: a, dr: +armorDR(a).toFixed(3) });
    return out;
  },
  dash(){ return startDash(1, 0); },
  dodgeOf(list){ return avoidStack(list); },
  /* 【4.1】接触伤害已经没有形状函数可测了——这就是它现在的全部逻辑：
     n 只怪贴身 = n 份伤害。门禁直接断言"掉血量 ≈ 只数 × 单口伤害 × (1−护甲)"。 */
  contactRule(){ return { tick: ECO.contactTick, mul: ECO.contactTickMul }; },
  baseCrit(){ return ST.crit || 0; },
  unitThreatOf(type){ return unitThreat(ENEMIES[type], type); },
  dashInfo(){
    return { dist: ECO.dashDist, time: ECO.dashTime, max: dashMaxNow(),
             recharge: dashRechargeNow(), ivy: ECO.dashIvy,
             flow: dashFlowNow(), impact: ST.dashImpact || 0 };
  },
  giveCrystal(id, lv){
    P.passives[id] = lv || 1;
    refreshArch(); ST = getStats();
    return true;
  },
  /* 回归测试：走治疗统一入口，验证预算效率（软预算，不再有硬闸门） */
  healTest(a){ return healPlayer(a); },
  healPoolLeft(){ return Math.max(0, healPoolCap() - (state.healRate || 0) * ECO.healTau); },
  xpNextNow(){ return P.xpNext; },
  giveWeapon(id, lv){
    P.weapons[id] = lv || 1;
    P.wmod[id] = P.wmod[id] || [];
    refreshSchools();
    return true;
  },
  giveRelic(id){
    addRelic(id);
    return true;
  },
  /* 审计用：直接给某把武器选一条觉醒分支 */
  evoTest(id, bid){ return applyEvo(id, bid); },
  /* 审计用：某把武器当前能抽到的改造方向（验证"不同武器不同进化"） */
  modsFor(id){ return modChoices(id); },
  forceLevel(){ forceLevelUp(); return P.level; },
  snapshot(){
    const dmg = [];
    for(const k in DMG) if(DMG[k] > 0) dmg.push([srcName(k), Math.round(DMG[k])]);
    dmg.sort((a, b) => b[1] - a[1]);
    return {
      mode: state.mode,
      time: +state.time.toFixed(2),
      char: CHAR.id,
      act: state.act,
      bossKills: state.bossKills || 0,
      bossTtk: state.bossTtk || [],
      kills: state.kills,
      level: P.level,
      hp: Math.round(P.hp), maxHp: Math.round(P.maxHp),
      weapons: Object.assign({}, P.weapons),
      mods: JSON.parse(JSON.stringify(P.wmod)),
      relics: Object.keys(P.relics),
      relicEvo: Object.assign({}, P.relicEvo || {}),
      resonances: resonanceList(),
      passives: Object.assign({}, P.passives),
      schools: topSchools(3).map(r => r.id + Math.round(r.share * 100)),
      links: activeLinks().map(l => l.id),
      enemies: enemies.length,
      contact: state.contactN,
      bullets: bullets.length,
      allies: allies.length,
      particles: parts.length,
      gems: gems.length,
      dps: Math.round(state.dps || 0),
      hitCount: state.hitCount || 0,
      avgHit: state.hitCount ? Math.round((state.dmgDealt||0) / state.hitCount) : 0,
      avgKillHp: state.kills ? Math.round((state.dmgDealt||0) / state.kills) : 0,
      rage: Math.round(P.rage || 0),
      berserk: +(P.berserk || 0).toFixed(2),
      charge: Math.round(P.charge || 0),
      overload: +(P.overload || 0).toFixed(2),
      shield: Math.round(P.shield || 0),
      shieldMax: Math.round((ST && ST.shieldMax) || 0),
      devour: P.devour || 0,
      arch: (function(){ const o = {}; for(const id in (P.arch||{})) o[id] = P.arch[id].tier; return o; })(),
      dpsLog: state.dpsLog || [],
      dmg: dmg.slice(0, 12)
    };
  }
};

})();
