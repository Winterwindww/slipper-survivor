/* =========================================================
   13. HUD / 界面
   ========================================================= */
let invKey = '';
let relKey = '';

function updateHUD(){
  if(!P) return;
  $('hpfill').style.width = Math.max(0, (P.hp / P.maxHp) * 100) + '%';
  const lh = $('lowhp');
  if(lh) lh.classList.toggle('on', P.hp / P.maxHp < 0.3 && state.mode === 'playing');
  $('hptext').textContent = Math.ceil(P.hp) + '/' + Math.round(P.maxHp);
  $('xpfill').style.width = Math.min(100, (P.xp / P.xpNext) * 100) + '%';
  $('timer').textContent = fmtTime(state.time);
  $('lvbox').textContent = 'Lv.' + P.level;
  if($('killnum').textContent !== String(state.kills)){
    $('killnum').textContent = state.kills;
    const nowT = performance.now();
    if(!state.lastPop || nowT - state.lastPop > 240){
      state.lastPop = nowT;
      const kb = $('killbox');
      if(kb){ kb.classList.remove('pop'); void kb.offsetWidth; kb.classList.add('pop'); }
    }
  }
  const pk = $('perkbox');
  if(pk){
    const t = CHAR.hud ? CHAR.hud() : '';
    if(pk.textContent !== t) pk.textContent = t;
  }

  updateResHUD();

  /* 局内目标：10:00 之前活下来，然后击败拖鞋之王 */
  const gl = $('goal');
  if(gl){
    const LEFT = 600 - state.time;
    let html, cls = '';
    if(state.won){ html = '👑 <b>已通关</b> · 继续挑战'; cls = 'done'; }
    else if(LEFT > 0){
      html = '🎯 <b>击败拖鞋之王</b> · ' + fmtTime(Math.max(0, LEFT));
      cls = LEFT < 45 ? 'urgent' : '';
    } else if(state.finalSpawned){
      html = '👑 <b>拖鞋之王</b> 降临中';
      cls = 'urgent';
    } else {
      html = '🎯 <b>终局</b> 即将开始';
      cls = 'urgent';
    }
    if(gl._k !== html){ gl.innerHTML = html; gl._k = html; }
    if(gl.className !== cls) gl.className = cls;
  }

  const key = JSON.stringify(P.weapons) + JSON.stringify(P.passives) + JSON.stringify(P.wmod);
  if(key !== invKey){ invKey = key; buildInv(); }

  const rk = Object.keys(P.relics).join(',');
  if(rk !== relKey){ relKey = rk; buildRelBar(); }
}

/* ---------------- 3.0 资源条 ---------------- */
const RES_EL = {};
function resEl(id){
  if(!RES_EL[id]) RES_EL[id] = $(id);
  return RES_EL[id];
}
function updateResHUD(){
  if(!P) return;

  /* 【4.1】怒气不再有 HTML 条：它画在人物脚下（70-render 的 drawPlayerRage）。
     这里只保留"还剩多少秒"的一行文字，挂在角色信息行里，
     因为"狂战还剩 2.1 秒"这种信息需要精确读数，画在脚下太挤。 */

  /* 充能：游侠专属。它不是"大招条"而是转速表——
     条越高冷却越低，所以条本身要读得出来"我现在转得多快"。 */
  const chBox = resEl('rbCharge');
  if(chBox){
    chBox.classList.toggle('off', !hasCharge());
  }
  if(chBox && hasCharge()){
    const bar = chBox.querySelector('i');
    if(P.overload > 0){
      const total = Math.max(0.2, ST.overloadDur || 3);
      bar.style.width = clamp(P.overload / total, 0, 1) * 100 + '%';
      chBox.classList.add('on');
    } else {
      bar.style.width = clamp(P.charge / RES.chargeMax, 0, 1) * 100 + '%';
      chBox.classList.toggle('on', P.charge >= 80);
    }
  }

  /* 护盾：工程师专属，没有护盾上限时整条隐藏 */
  const shBox = resEl('rbShield');
  if(shBox){
    const max = shieldMaxNow();
    shBox.classList.toggle('off', !hasShield() || max <= 0);
    if(max > 0){
      shBox.querySelector('i').style.width = clamp(P.shield / max, 0, 1) * 100 + '%';
    }
  }

  /* 【4.2】机制条：只剩冲刺充能（灵光已删除） */
  const mw = resEl('mechwrap');
  if(mw && mw.querySelectorAll){
    /* 【4.1】冲刺段数是可成长的（疾影靴 +1），所以格子必须按当前上限重建，
       否则拿了靴子之后 HUD 还是只画两格，"多出来那一段"就完全看不见。 */
    const wrap = mw.querySelector('#dashpips');
    const maxD = dashMaxNow();
    if(wrap && wrap.childElementCount !== maxD){
      wrap.innerHTML = '';
      for(let i = 0; i < maxD; i++) wrap.appendChild(document.createElement('i'));
    }
    const pips = mw.querySelectorAll('#dashpips i');
    const c = P.dashCharge || 0;
    /* 【4.1】只有两种状态：有冲刺 = 蓝色，没冲刺 = 黑色。
       之前还加了一个"顺势时变金色"，结果是玩家分不清
       "金色代表能冲还是不能冲"——状态指示器不能同时表达两件事。 */
    for(let i = 0; i < pips.length; i++){
      pips[i].classList.toggle('on', c >= i + 1);
      pips[i].classList.remove('flow');
    }
  }
}

function fmtTime(sec){  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function fmtNum(v){
  v = Math.round(v);
  if(v >= 1000000) return (v / 1000000).toFixed(1) + 'm';
  if(v >= 10000) return (v / 1000).toFixed(0) + 'k';
  if(v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(v);
}

const MOD_COL = { scatter:'#ffc46b', pierce:'#9fe0ff', bounce:'#b6f0ff', blast:'#ff9d4d',
  burn:'#ff8a3d', chill:'#8fe8ff', venom:'#a6e05a', volt:'#ffe066', haste:'#8ee06e',
  heavy:'#c9d4e2', split:'#c9b0ff', echo:'#9fe0ff', crit:'#ffd166', size:'#7cc7ff',
  greed:'#6fdc8c', focus:'#ff8fb0', count:'#c9b0ff', knock:'#a6ffcb' };

/* 悬停说明：原生 title 有延迟，这里自己做一个即时的 */
let tipEl = null;
function ensureTip(){
  if(tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.id = 'tip';
  tipEl.style.cssText = 'position:fixed;z-index:99999;display:none;max-width:240px;' +
    'padding:8px 10px;border-radius:8px;background:rgba(24,14,36,.96);' +
    'border:1px solid rgba(255,255,255,.18);color:#f0e8ff;font-size:12px;line-height:1.5;' +
    'pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.45)';
  document.body.appendChild(tipEl);
  return tipEl;
}
function showTip(el, html){
  const t = ensureTip();
  t.innerHTML = html;
  t.style.display = 'block';
  const r = el.getBoundingClientRect();
  const w = t.offsetWidth, h = t.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  let y = r.top - h - 8;
  if(y < 8) y = r.bottom + 8;
  x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  t.style.left = x + 'px';
  t.style.top = y + 'px';
}
function hideTip(){ if(tipEl) tipEl.style.display = 'none'; }

function slotEl(kind, id, lv, mods){
  const d = document.createElement('div');
  d.className = 'slot ' + kind;
  const def = kind === 'w' ? WEAPONS[id] : PASSIVES[id];
  d.title = '';
  const descText = kind === 'w'
    ? (def ? (def.blurb || '') : '')
    : (def ? (typeof def.desc === 'function' ? def.desc(0, 1) : def.desc) : '');
  const modText = (mods && mods.length)
    ? '<div style="margin-top:4px;color:#ffd166">改造：' + mods.map(function(m){ return MODS[m] ? MODS[m].name : m; }).join('、') + '</div>'
    : '';
  d.addEventListener('mouseenter', function(){
    showTip(d, '<b style="color:' + (def ? def.color || '#fff' : '#fff') + '">' +
      (def ? def.name : id) + ' Lv.' + lv + '</b>' +
      '<div style="margin-top:3px;color:#cfc4e6">' + descText + '</div>' + modText);
  });
  d.addEventListener('mouseleave', hideTip);
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  drawIcon(c.getContext('2d'), def ? def.icon : 'star',
           kind === 'r' ? ('relic:' + id) : null, def ? def.color : null);
  d.appendChild(c);
  const l = document.createElement('span');
  l.className = 'lvc';
  l.textContent = lv;
  d.appendChild(l);
  if(mods && mods.length){
    const mb = document.createElement('div');
    mb.className = 'mods';
    for(let i = 0; i < mods.length; i++){
      const dot = document.createElement('i');
      dot.style.setProperty('--mc', MOD_COL[mods[i]] || '#fff');
      mb.appendChild(dot);
    }
    d.appendChild(mb);
  }
  return d;
}

function buildInv(){
  if(!P) return;
  const bar = $('invbar');
  bar.innerHTML = '';
  /* 底栏只放武器槽：结晶/被动去暂停面板看，不然一屏图标不知道在干嘛 */
  for(const id in P.weapons) bar.appendChild(slotEl('w', id, P.weapons[id], P.wmod[id] || []));

  /* 还没解锁的武器位：直接写等级，让玩家知道"再升几级能带第二把" */
  const nxt = nextSlotLevel();
  if(nxt > 0){
    const d = document.createElement('div');
    d.className = 'slot wslot locked';
    d.style.opacity = '0.35';
    d.title = 'Lv.' + nxt + ' 解锁下一个武器位';
    d.innerHTML = '<div style="font-size:9px;line-height:1.1;text-align:center;padding-top:6px;color:#cfc4e6">Lv.' + nxt + '<br>解锁</div>';
    bar.appendChild(d);
  }
}

function buildRelBar(){
  const bar = $('relbar');
  if(!bar || !P) return;
  bar.innerHTML = '';
  let n = 0;
  for(const id in P.relics){
    if(n++ >= 8) break;
    const r = RELICS[id];
    if(!r) continue;
    const d = document.createElement('div');
    d.className = 'rel';
    d.style.setProperty('--rc', RARITY[r.rar].color);
    d.title = r.name + '：' + r.desc;
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    drawIcon(c.getContext('2d'), r.icon, 'relic:' + id, r.color);
    d.appendChild(c);
    const sp = document.createElement('span');
    sp.textContent = r.name;
    d.appendChild(sp);
    bar.appendChild(d);
  }
}

/* 遗物标签的中文名（悬停里不该出现 curse / proj 这种内部字段） */
const TAG_NAME = {
  curse:'诅咒', fire:'灼烧', ice:'霜寒', volt:'感电', venom:'剧毒', crit:'暴击',
  elem:'元素', blast:'爆破', proj:'弹幕', pierce:'穿甲', melee:'近战', turret:'阵地',
  pet:'兽群', summon:'召唤', heal:'回复', lucky:'幸运', tank:'防御', move:'移动',
  util:'通用', aoe:'广域', bounce:'弹跳', dodge:'闪避', rage:'怒气', cc:'控制',
  echo:'回响', multi:'多重', orbit:'环绕', trap:'陷阱', turf:'阵地', beam:'射线'
};
function tagName(t){ return TAG_NAME[t] || t; }

function miniEl(kind, id, lv, mods){
  const d = document.createElement('div');
  d.className = 'mini';
  /* kind: w = 武器, p = 结晶, r = 遗物 */
  const def = kind === 'w' ? WEAPONS[id] : (kind === 'r' ? RELICS[id] : PASSIVES[id]);
  if(def){
    const desc = kind === 'w'
      ? (def.blurb || '')
      : (typeof def.desc === 'function' ? def.desc(Math.max(0, lv - 1), lv) : (def.desc || ''));
    const rarTxt = kind === 'r'
      ? '<div style="margin-top:3px;color:' + (RARITY[def.rar] ? RARITY[def.rar].color : '#fff') + '">' +
        (RARITY[def.rar] ? RARITY[def.rar].name : '') + '遗物' +
        (def.tags && def.tags.length ? ' · ' + def.tags.map(tagName).join(' / ') : '') + '</div>'
      : '';
    const modTxt = (mods && mods.length)
      ? '<div style="margin-top:5px;color:#ffd166">改造：' + mods.map(function(m){ return MODS[m] ? (MODS[m].name + ' — ' + MODS[m].desc) : m; }).join('<br>改造：') + '</div>'
      : '';
    const stat = kind === 'w' && def.stats ? (function(){
      try{ const st = def.stats(lv); return '<div style="margin-top:5px;color:#9fe0ff">' +
        (def.labels && def.labels.dmg ? '伤害 ' + Math.round(st.dmg) + ' · ' : '') +
        (st.cd ? '间隔 ' + st.cd.toFixed(2) + 's' : '') +
        (st.count ? ' · 数量 ' + st.count : '') + '</div>'; }catch(e){ return ''; }
    })() : '';
    d.addEventListener('mouseenter', function(){
      showTip(d, '<b style="color:' + (def.color || '#fff') + '">' + def.name +
        (kind === 'r' ? '' : ' Lv.' + lv) + '</b>' +
        rarTxt + '<div style="margin-top:4px;color:#cfc4e6">' + desc + '</div>' + stat + modTxt);
    });
    d.addEventListener('mouseleave', hideTip);
  }
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  drawIcon(c.getContext('2d'), def ? def.icon : 'star',
           kind === 'r' ? ('relic:' + id) : null, def ? def.color : null);
  d.appendChild(c);
  const n = document.createElement('span');
  n.textContent = def ? def.name : '未知';
  d.appendChild(n);
  if(kind !== 'r'){
    const i = document.createElement('i');
    i.textContent = 'Lv.' + lv + (mods && mods.length ? ' · ' + mods.length + '改' : '');
    d.appendChild(i);
  }
  return d;
}

/* =========================================================
   角色选择
   ========================================================= */
const CHAR_SELECT_COPY = {
  ranger:{ blurb:'远程连射，越打越准。', perk:'投射武器额外 +1 弹道。' },
  knight:{ blurb:'平底锅近战，挨打攒怒。', perk:'怒气更快，狂战更强。' },
  engineer:{ blurb:'部署炮台，铺出火力网。', perk:'炮台上限 +2，彼此加速。' },
  keeper:{ blurb:'召唤伙伴，组建小兽群。', perk:'宠物上限 +3。' },
  chef:{ blurb:'冰火交替，打出元素反应。', perk:'多元素目标受到更多伤害。' }
};
function buildCharSelect(){
  const grid = $('charGrid');
  if(!grid) return;
  grid.innerHTML = '';
  for(const id in CHARS){
    const c = CHARS[id];
    const d = document.createElement('div');
    d.className = 'cs-card';
    d.style.setProperty('--cc', c.color);
    d.innerHTML =
      '<div class="cs-top"><canvas width="54" height="54"></canvas>' +
      '<div><div class="cs-name">' + c.name + '</div>' +
      '<div class="cs-title">' + c.title + '</div></div></div>' +
      '<div class="cs-blurb">' + (CHAR_SELECT_COPY[id]?.blurb || c.blurb) + '</div>' +
      '<div class="cs-school">武器 · ' + charSchoolNames(c) + '</div>' +
      '<div class="cs-route">路线 · ' + (CHAR_ROUTES[c.id] || []).map(function(r){
        return ARCH[r] ? ARCH[r].name : r;
      }).join(' / ') + '</div>' +
      '<div class="cs-perk"><b>' + c.perkName + '</b> · ' + (CHAR_SELECT_COPY[id]?.perk || c.perkDesc) + '</div>' +
      '<div class="cs-own">' + charOwnLine(c) + '</div>';
    drawCharPortrait(d.querySelector('canvas'), c);
    d.addEventListener('click', function(){ pickChar(id); });
    grid.appendChild(d);
  }
}


/* 角色专属内容一览：让"选角色 = 换一整套卡池"这件事在选人界面就看得见 */
function charOwnLine(c){
  let rel = 0, cry = 0, wp = 0;
  for(const id in RELICS) if(RELICS[id].own === c.id) rel++;
  for(const id in PASSIVES) if(PASSIVES[id].own === c.id) cry++;
  for(const id in WEAPONS) if(WEAPON_OWNER[id] === c.id) wp++;
  const bits = [];
  if(rel) bits.push('专属遗物 ' + rel);
  if(cry) bits.push('专属结晶 ' + cry);
  if(wp) bits.push('专属武器 ' + wp);
  return bits.length ? ('🔒 ' + bits.join(' · ')) : '🔓 主要靠公用池 + 角色机制';
}

/* 角色选择界面用真实像素形象做立绘（3 倍放大 + 角色色光圈） */
function drawCharPortrait(cv, c){
  if(!cv) return;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  const grd = g.createRadialGradient(27, 30, 2, 27, 30, 26);
  grd.addColorStop(0, c.color + '99');
  grd.addColorStop(1, c.color + '00');
  g.fillStyle = grd;
  g.beginPath(); g.arc(27, 30, 26, 0, Math.PI * 2); g.fill();
  const s = SPR['ch_' + c.id] || SPR.player;
  const sc = 3;
  g.drawImage(s.img,
    Math.round(27 - s.w * sc / 2),
    Math.round(33 - s.h * sc / 2),
    s.w * sc, s.h * sc);
}

function pickChar(id){
  CHAR = CHARS[id];
  $('charselect').classList.add('hidden');
  startGame(id);
}

/* =========================================================
   升级卡池
   ========================================================= */
let curChoices = [];
let swapBackup = null;      /* 换武器确认时暂存的上一屏卡，取消可以回去 */

/* 换武器：必须玩家自己点开 + 自己选放弃哪把，绝不自动替换 */
function openSwapConfirm(newId){
  const w = WEAPONS[newId];
  if(!w) return;
  swapBackup = curChoices.slice();
  const list = [];
  for(const id in P.weapons){
    const cur = WEAPONS[id];
    list.push({
      kind:'swapTo', id, add:newId, name:'换掉 ' + cur.name, color:cur.color, icon:cur.icon,
      tag:'放弃 Lv.' + P.weapons[id],
      lvText:'→ ' + w.name + ' Lv.1',
      desc:'用「' + w.name + '」替换「' + cur.name + '」。等级不继承，改造卡也会一起丢掉。',
      hint:''
    });
  }
  list.push({
    kind:'swapBack', id:'back', name:'算了', color:'#a99ac2', icon:'star',
    tag:'返回', lvText:'不换武器', desc:'回到刚才的三选一，什么都不会变', hint:''
  });
  curChoices = list;
  renderCards('cards', list);
}

function statDiff(a, b, labels){
  const out = [];
  for(const k in labels){
    if(a[k] === undefined || b[k] === undefined) continue;
    const d = b[k] - a[k];
    if(Math.abs(d) < 1e-9) continue;
    if(k === 'cd') out.push('冷却 −' + (a[k] - b[k]).toFixed(2) + 's');
    else if(k === 'radius' || k === 'size') out.push(labels[k] + ' +' + Math.round(d));
    else out.push(labels[k] + ' ' + (d > 0 ? '+' : '') + (Number.isInteger(d) ? d : d.toFixed(1)));
  }
  return out.length ? out.join('，') : '小幅强化';
}

/* 当前能带几把武器：等级解锁 + 遗物加成（献祭会减 1） */
function slotLimit(){
  let n = 1;
  for(let i = 1; i < SLOT_UNLOCK.length; i++){
    if(P.level >= SLOT_UNLOCK[i]) n++;
  }
  n += relicStat().slots;
  /* 【4.1】上限从 MAX_SLOTS+2 收到 +1：槽位本身就是稀缺资源，
     遗物只应该"多给你一个"，而不是把 4 槽变成 6 槽。 */
  return Math.max(1, Math.min(MAX_SLOTS + 1, n));
}

/* 下一个武器位的解锁等级，已全开返回 0 */
function nextSlotLevel(){
  for(let i = 0; i < SLOT_UNLOCK.length; i++){
    if(P.level < SLOT_UNLOCK[i]) return SLOT_UNLOCK[i];
  }
  return 0;
}

/* 角色亲和：命中角色的擅长标签时权重更高（但不是必出） */
function affinityMul(tags, school){
  if(school && CHAR.schools && CHAR.schools.indexOf(school) >= 0) return 2.0;
  if(!tags || !CHAR.affinity) return 1;
  for(let i = 0; i < tags.length; i++) if(CHAR.affinity.indexOf(tags[i]) >= 0) return 1.8;
  return 1;
}

function rarityAllowed(rar){
  const act = state.act || 1;
  if(rar === 'curse') return act >= 2;
  if(rar === 'epic') return act >= 2;
  if(rar === 'rare') return true;
  return true;
}

/* ---------------------------------------------------------
   升级池：按阶段给牌，而不是一锅乱炖
     前期（第 1 幕 / ≤7 级）  推新武器，先把方向立起来
     中期（第 2 幕）          推已有武器的升级/改造
     后期（第 3 幕 / ≥22 级） 推遗物与机制强化
   槽位满了就不再出普通新武器卡 —— 只有一张低概率的「换武器」，
   而且必须由玩家点开、确认替换目标。
   --------------------------------------------------------- */
function upgradePhase(){
  const act = state.act || 1;
  const lv = P.level;
  if(act >= 3 || lv >= 22) return 3;
  if(act >= 2 || lv >= 7) return 2;
  return 1;
}

function rollUpgrades(n){
  const pool = [];
  const wCount = weaponCount();
  const limit = slotLimit();
  const phase = upgradePhase();
  /* 【4.1】槽位回到 4 之后，牌的重心必须偏向"把手里这几把练满"，
     否则 4 个位子会在前 5 分钟就被新武器填满，然后一路缺升级卡。
     新武器在前期仍然是推荐项（帮你把方向立起来），
     中期开始明显让位给升级 / 改造 / 遗物。 */
  const W_NEW  = phase === 1 ? 1.6 : (phase === 2 ? 0.6 : 0.25);
  const W_UP   = phase === 1 ? 1.2 : (phase === 2 ? 2.1 : 1.7);
  const W_RELIC= phase === 1 ? 0.85 : (phase === 2 ? 1.25 : 2.0);

  /* ---- 已有武器：升级 / 改造（Lv2、Lv4 的两张改造卡直接进池） ---- */
  for(const id in P.weapons){
    const w = WEAPONS[id];
    const lv = P.weapons[id];
    if(!w || lv >= w.max) continue;
    const next = lv + 1;
    const choices = (next === 2 || next === 4) ? modChoices(id) : [];
    const isAwaken = next >= w.max;
    const base = (isAwaken ? 4.4 : 3.0) * W_UP * affinityMul(w.tags, w.school) * schoolWeight(w.tags);

    /* 分支觉醒：起始武器到 Lv5 不给"唯一觉醒"，而是两条路线二选一 */
    if(isAwaken && BRANCHES[id]){
      for(let bi = 0; bi < BRANCHES[id].length; bi++){
        const b = BRANCHES[id][bi];
        pool.push({
          kind:'evo', id, bid:b.id, name:'觉醒 · ' + b.name,
          color:w.color, icon:w.icon,
          tag:'分支 · ' + w.name,
          lvText:'Lv.' + lv + ' → Lv.' + next,
          desc:b.desc, hint:'', w: base * 1.15
        });
      }
      continue;
    }

    if(choices.length && choices.length > 0){
      for(let k = 0; k < choices.length; k++){
        const m = choices[k];
        /* 【防御】武器的 mods 列表写错一个键，整局会在升级界面直接崩。
           改造卡表里没有的键就跳过，而不是让客户端炸掉。 */
        if(!MODS[m]) continue;
        pool.push({
          kind:'wmod', id, mod:m, name:MODS[m].name,
          color: MOD_COL[m] || w.color, icon:w.icon,
          tag:'改造 · ' + w.name,
          lvText:'Lv.' + lv + ' → Lv.' + next,
          desc: MODS[m].desc,
          hint: synergyHintForMod(id, m),
          w: base * 0.55
        });
      }
      continue;
    }
    pool.push({
      kind:'wup', id, name:w.name, color:w.color, icon:w.icon,
      tag: isAwaken ? '⚡ 觉醒' : '武器升级',
      lvText:'Lv.' + lv + ' → Lv.' + next,
      desc: isAwaken ? (w.awaken || '大幅强化') : statDiff(w.stats(lv), w.stats(next), w.labels),
      hint:'',
      w: base
    });
  }

  /* ---- 新武器 ----
     一次升级最多出一张新武器卡（这条很关键：不然三张牌全是新武器，
     三四级就把四个槽填满，后面完全没得选）。槽位满了就一张都不出。 */
  if(wCount < limit){
    for(const id in WEAPONS){
      const w = WEAPONS[id];
      /* 已经有的武器：给一张"合并"卡（Brotato 做法），重复抽到不再是废卡 */
      if(P.weapons[id]){
        if(P.weapons[id] < w.max){
          pool.push({
            kind:'wmerge', id, name:'合并 · ' + w.name, color:w.color, icon:w.icon,
            tag:'同名合并', lvText:'Lv.' + P.weapons[id] + ' → Lv.' + (P.weapons[id] + 1),
            desc:'两把同名武器合成一把，等级直接 +1。', hint:'',
            w: 0.75 * schoolWeight(w.tags)
          });
        }
        continue;
      }
      if(!weaponForChar(id)) continue;
      pool.push({
        kind:'wnew', id, name:w.name, color:w.color, icon:w.icon,
        tag:'新武器', lvText:'获得 Lv.1',
        desc: w.blurb,
        hint: synergyHintForWeapon(id),
        w: (phase === 1 ? 1.0 : 0.6) * W_NEW * affinityMul(w.tags, w.school) * schoolWeight(w.tags)
      });
    }
  } else if(phase >= 2 && (P.swapUsed || 0) < 2 && Math.random() < 0.25){
    /* 极低概率的换武器机会：点了还要再确认一次换掉谁 */
    const cands = [];
    for(const id in WEAPONS) if(!P.weapons[id] && weaponForChar(id)) cands.push(id);
    if(cands.length){
      const id = pickOne(cands);
      const w = WEAPONS[id];
      pool.push({
        kind:'swapNew', id, name:w.name, color:w.color, icon:w.icon,
        tag:'换武器（需确认）', lvText:'替换一把现有武器',
        desc: w.blurb + ' 点开后选择要放弃的武器，可以反悔。',
        hint: synergyHintForWeapon(id),
        w: 0.55
      });
    }
  }

  /* ---- 精炼（Vampire Survivors 的 Limit Break）：满级武器还能继续叠 ---- */
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(!w || P.weapons[id] < w.max) continue;
    const cur = (P.refine[id] || 0);
    if(cur >= 12) continue;
    pool.push({
      kind:'wrefine', id, name:'精炼 · ' + w.name, color:'#c9b0ff', icon:w.icon,
      tag:'满级之后', lvText:'精炼 +' + cur + ' → +' + (cur + 1),
      desc:'武器已经满级，还能继续精炼：伤害 +10%（可叠 12 次）。',
      hint:'✦ 满级武器专属', w: 1.3
    });
  }

  /* ---- 进化（Vampire Survivors）：满级 + 同流派遗物 ---- */
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(!w || P.weapons[id] < w.max || P.wevo[id]) continue;
    if(!hasSameSchoolRelic(w)) continue;
    pool.push({
      kind:'wevo', id, name:'进化 · ' + w.name, color:'#ffd166', icon:w.icon,
      tag:'⚡ 进化', lvText:'永久强化',
      desc:'消耗同流派遗物的共鸣，让「' + w.name + '」进化：伤害 +35%、冷却 -15%，攻击附带额外效果。',
      hint:'✦ 只有满级武器 + 同流派遗物才会出现', w: 1.6
    });
  }

  /* ---- 遗物 ---- */
  const relicPity = P.relicPity || 0;
  for(const id in RELICS){
    const r = RELICS[id];
    if(P.relics[id]) continue;
    if(!rarityAllowed(r.rar)) continue;
    if(!relicForChar(id)) continue;
    const rw = RARITY[r.rar].weight / 46 * (r.own ? 1.6 : 1);
    pool.push({
      kind:'relic', id, name:r.name, color:RARITY[r.rar].color, icon:r.icon,
      rarity: r.rar,
      tag: RARITY[r.rar].name + '遗物',
      lvText: r.rar === 'curse' ? '⚠ 有代价' : '获得遗物',
      desc: r.desc,
      hint: r.tags.indexOf('curse') >= 0 ? '✦ 强力，但要付出代价'
            : (relicTagHint(r.tags) || archHint(r.tags) || ''),
      w: rw * (1.4 + relicPity * 0.5) * W_RELIC * affinityMul(r.tags)
         * schoolWeight(r.tags) * archWeight(r.tags)
    });
  }

  /* ---- 数值结晶 ---- */
  for(const id in PASSIVES){
    const p = PASSIVES[id];
    const lv = P.passives[id] || 0;
    if(lv >= p.max) continue;
    /* 武器流派专属结晶：没走这条流派就不出，避免塞一堆用不上的卡 */
    if(p.school && !(P.scT && P.scT[p.school])) continue;
    if(!crystalForChar(id)) continue;
    /* 3.0 资源流派结晶：已经在走这条路（角色禀赋或遗物）才出，
       否则前 10 级会把卡池塞满"你根本用不上的护盾结晶"。 */
    if(p.arch && !(P.arch && P.arch[p.arch] && P.arch[p.arch].pts > 0)) continue;
    pool.push({
      kind:'crystal', id, name:p.name, color:p.color, icon:p.icon, tag:'结晶',
      lvText: lv === 0 ? '获得 Lv.1' : ('Lv.' + lv + ' → Lv.' + (lv + 1)),
      desc: p.desc(lv, lv + 1),
      hint: p.arch ? archHint(p.tags) : '',
      w: 0.9 * archWeight(p.tags || [])
    });
  }

  /* ---- 治疗 ---- */
  if(P.hp < P.maxHp * 0.72){
    pool.push({
      kind:'heal', id:'heal', name:'热可可', color:'#ffd166', icon:'heal', tag:'补给',
      lvText:'瞬间回复', desc:'回复 40% 最大生命值',
      w: P.hp < P.maxHp * 0.35 ? 3.0 : 1.2
    });
  }

  /* 把新武器卡单独挑出来：整次 roll 只允许出现一张 */
  const out = [];
  let newWeaponUsed = false;
  while(out.length < n && pool.length){
    let total = 0;
    for(const p of pool) total += p.w;
    let r = Math.random() * total;
    let idx = 0;
    for(let i = 0; i < pool.length; i++){
      r -= pool[i].w;
      if(r <= 0){ idx = i; break; }
      idx = i;
    }
    const cand = pool.splice(idx, 1)[0];
    if(cand.kind === 'wnew'){
      if(newWeaponUsed) continue;      /* 本次升级已经给过新武器了 */
      newWeaponUsed = true;
    }
    out.push(cand);
  }
  while(out.length < n){
    out.push({ kind:'heal', id:'heal', name:'热可可', color:'#ffd166', icon:'heal',
      tag:'补给', lvText:'瞬间回复', desc:'回复 40% 最大生命值', w:1 });
  }

  /* 【保底】有空槽就必须给一张新武器卡。
     权重上后期 W_NEW 只有 0.15~0.5，而升级卡和遗物分别是 1.3~2.0，
     实测玩家会一路卡在 3 把武器、第 4 个槽永远空着——
     "有槽但没牌"是最没道理的体验，这里直接兜住。 */
  if(wCount < limit){
    let hasNew = false;
    for(let i = 0; i < out.length; i++) if(out[i].kind === 'wnew' || out[i].kind === 'swapNew'){ hasNew = true; break; }
    if(!hasNew){
      const cands = [];
      for(const id in WEAPONS) if(!P.weapons[id] && weaponForChar(id)) cands.push(id);
      if(cands.length){
        const id = pickOne(cands);
        const w = WEAPONS[id];
        const slot = Math.max(0, out.length - 1);
        out[slot] = {
          kind:'wnew', id, name:w.name, color:w.color, icon:w.icon,
          tag:'新武器 · 空槽待填', lvText:'获得 Lv.1',
          desc: w.blurb,
          hint: '你现在有 ' + wCount + '/' + limit + ' 个武器位在用'
        };
      }
    }
  }

  /* 遗物保底：连续 3 次升级没见到遗物，下一次必定给一张 */
  let gotRelic = false;
  for(let i = 0; i < out.length; i++) if(out[i].kind === 'relic'){ gotRelic = true; break; }
  P.relicPity = gotRelic ? 0 : (relicPity + 1);
  if(!gotRelic && (P.relicPity || 0) >= 3){
    P.relicPity = 0;
    const cands = [];
    for(const id in RELICS){
      if(P.relics[id]) continue;
      if(!rarityAllowed(RELICS[id].rar)) continue;
      if(!relicForChar(id)) continue;
      cands.push(id);
    }
    if(cands.length){
      const id = pickOne(cands);
      const r = RELICS[id];
      out[2] = { kind:'relic', id, name:r.name, color:RARITY[r.rar].color, icon:r.icon,
        tag: RARITY[r.rar].name + '遗物', lvText:'获得遗物', desc:r.desc,
        hint: relicTagHint(r.tags) };
    }
  }
  /* 【3.0】本命遗物保底：到 Lv3 还没见到任何"只属于这个角色"的遗物，
     就强制给一张。专属件是角色身份的锚点，不能全靠运气。 */
  if(P.level >= 3 && out.length){
    let hasOwn = false, hasCard = false;
    for(const rid in P.relics) if(RELICS[rid] && RELICS[rid].own) hasOwn = true;
    for(let i = 0; i < out.length; i++) if(out[i].kind === 'relic' && RELICS[out[i].id] && RELICS[out[i].id].own) hasCard = true;
    if(!hasOwn && !hasCard){
      const cands = [];
      for(const id in RELICS){
        if(P.relics[id] || !relicForChar(id)) continue;
        if(!RELICS[id].own) continue;
        if(!rarityAllowed(RELICS[id].rar)) continue;
        cands.push(id);
      }
      if(cands.length){
        const id = pickOne(cands);
        const r = RELICS[id];
        out[out.length - 1] = {
          kind:'relic', id, name:r.name, color:RARITY[r.rar].color, icon:r.icon,
          rarity:r.rar, tag:'⚡ 本命遗物', lvText:'仅限 ' + CHAR.name,
          desc:r.desc, hint:'✦ 只属于你的专属遗物'
        };
      }
    }
  }
  return out;
}

function relicTagHint(tags){
  const share = schoolShare();
  for(let i = 0; i < tags.length; i++){
    for(const sid in SCHOOLS){
      if(SCHOOLS[sid].tags.indexOf(tags[i]) >= 0 && (share[sid] || 0) > 0){
        return '✦ 与你的「' + SCHOOLS[sid].name + '」流派同路';
      }
    }
  }
  return '';
}

/* 升级界面底部的一行状态：流派浓度 + 已激活共鸣 */
function buildStateLine(){
  const top = topSchools(2).filter(function(x){ return x.share > 0; });
  const links = activeLinks();
  const archs = archSummary();
  const parts = [];
  if(top.length){
    parts.push('武器流派 ' + top.map(function(x){ return x.name + ' ' + Math.round(x.share * 100) + '%'; }).join(' · '));
  }
  if(archs.length){
    parts.push('构筑 ' + archs.slice(0, 3).map(function(a){
      return a.name + (a.tier >= 3 ? 'Ⅲ' : (a.tier === 2 ? 'Ⅱ' : (a.tier === 1 ? 'Ⅰ' : '')));
    }).join(' · '));
  }
  if(links.length){
    parts.push('机制 ' + links.slice(0, 3).map(function(l){
      return l.name + (l.tier >= 3 ? 'Ⅲ' : (l.tier === 2 ? 'Ⅱ' : ''));
    }).join('、'));
  }
  if(!parts.length) parts.push('选武器决定起手 · ' + CHAR.name);
  return parts.join('    ｜    ');
}

/* ---------------- 渲染卡片 ---------------- */
function renderCards(boxId, list){
  const box = $(boxId);
  box.innerHTML = '';
  list.forEach((o, i) => {
    const d = document.createElement('div');
    d.className = 'card';
    if(o.rarity === 'epic' || o.rarity === 'curse') d.classList.add('epic');
    d.style.setProperty('--cc', o.color);
    d.innerHTML =
      '<div class="c-key">' + (i + 1) + '</div>' +
      '<div class="c-tag">' + o.tag + '</div>' +
      '<canvas class="c-icon" width="16" height="16"></canvas>' +
      '<div class="c-name">' + o.name + '</div>' +
      '<div class="c-lv">' + o.lvText + '</div>' +
      '<div class="c-desc">' + o.desc + '</div>' +
      (o.hint ? '<div class="c-hint">' + o.hint + '</div>' : '');
    /* 【4.1】图标分三类：
         · 改造卡  → 自己的符文（30 张各不相同，原来全部套武器图标）
         · 遗物    → 家族形状 + 由 id 决定的角标
         · 武器    → 武器自己的图标（不加角标，和背包里保持一致） */
    const ic = o.kind === 'wmod' ? ('#' + o.mod) : o.icon;
    const seed = (o.kind === 'relic' || o.kind === 'crystal') ? (o.kind + ':' + o.id) : null;
    drawIcon(d.querySelector('canvas').getContext('2d'), ic, seed, o.color);
    d.addEventListener('click', function(){ chooseCard(i); });
    box.appendChild(d);
  });
}

function showLevelUp(){
  if(state.mode === 'levelup') return;
  state.mode = 'levelup';
  bgmDuck(0.1);
  curChoices = rollUpgrades(3);
  renderCards('cards', curChoices);
  $('comboTip').textContent = buildStateLine();
  $('levelup').classList.remove('hidden');
  sfx('level');
  state.shake = Math.max(state.shake, 2);
  state.flash = Math.max(state.flash, 0.42);
  rings.push({ x:P.x, y:P.y, r0:6, r1:46, life:0.3, max:0.3, col:'#fff6c8', w:4 });
  burst(P.x, P.y, '#ffe066', 18, 130);
}

/* ---------------- 选择：点一下就走完，没有第二层 ---------------- */
function chooseCard(i){
  if(state.mode !== 'levelup') return;
  const o = curChoices[i];
  if(!o) return;
  if(o.kind === 'swapNew'){ openSwapConfirm(o.id); return; }
  if(o.kind === 'swapBack'){
    if(swapBackup){ curChoices = swapBackup; swapBackup = null; renderCards('cards', curChoices); }
    return;
  }
  applyChoice(o);
  finishChoice();
}

function finishChoice(){
  state.pending = Math.max(0, state.pending - 1);
  $('levelup').classList.add('hidden');
  if(state.pending > 0){
    state.mode = 'playing';
    showLevelUp();
  } else {
    state.mode = 'playing';
    bgmDuck(BGM.vol);
  }
  updateHUD();
}

function applyChoice(o){
  if(o.kind === 'wmerge'){
    P.weapons[o.id] = Math.min(WEAPONS[o.id].max, P.weapons[o.id] + 1);
    addText(P.x, P.y - 30, '合并：' + WEAPONS[o.id].name + ' Lv.' + P.weapons[o.id], WEAPONS[o.id].color, 12);
    refreshSchools();
    return;
  }
  if(o.kind === 'wrefine'){
    P.refine[o.id] = (P.refine[o.id] || 0) + 1;
    addText(P.x, P.y - 30, '精炼 ' + WEAPONS[o.id].name + ' +' + P.refine[o.id], '#c9b0ff', 11);
    sfx('relic');
    return;
  }
  if(o.kind === 'evo'){
    applyEvo(o.id, o.bid);
    return;
  }
  if(o.kind === 'wevo'){
    P.wevo[o.id] = 1;
    showToast('⚡ ' + WEAPONS[o.id].name + ' 进化！');
    sfx('awaken');
    refreshSchools();
    return;
  }
  if(o.kind === 'swapTo'){
    delete P.weapons[o.id];
    delete P.cds[o.id];
    delete P.wmod[o.id];
    P.weapons[o.add] = 1;
    P.cds[o.add] = 0.2;
    P.wmod[o.add] = [];
    P.swapUsed = (P.swapUsed || 0) + 1;
    swapBackup = null;
    refreshSchools();
    addText(P.x, P.y - 30, '换装：' + WEAPONS[o.add].name, WEAPONS[o.add].color, 12);
    showToast('🔁 ' + WEAPONS[o.add].name + ' 上阵');
    return;
  }
  if(o.kind === 'wnew'){
    P.weapons[o.id] = 1;
    P.cds[o.id] = 0.2;
    P.wmod[o.id] = [];
    refreshSchools();
    addText(P.x, P.y - 26, '+ ' + WEAPONS[o.id].name, WEAPONS[o.id].color, 12);
  } else if(o.kind === 'wup'){
    const w = WEAPONS[o.id];
    P.weapons[o.id] = Math.min(w.max, P.weapons[o.id] + 1);
    if(P.weapons[o.id] >= w.max){
      showToast('⚡ ' + w.name + ' 觉醒！');
      sfx('awaken');
      state.flash = 0.55;
      state.shake = 5;
      rings.push({ x:P.x, y:P.y, r0:10, r1:90, life:0.5, max:0.5, col:w.color, w:4 });
      burst(P.x, P.y, w.color, 24, 180, 0);
    }
    refreshSchools();
  } else if(o.kind === 'wmod'){
    P.wmod[o.id] = P.wmod[o.id] || [];
    if(P.wmod[o.id].indexOf(o.mod) < 0) P.wmod[o.id].push(o.mod);
    P.weapons[o.id] = Math.min(WEAPONS[o.id].max, P.weapons[o.id] + 1);
    addText(P.x, P.y - 26, MODS[o.mod].name + '！', MOD_COL[o.mod] || '#ffd166', 12);
    showToast('🔧 ' + WEAPONS[o.id].name + ' · ' + MODS[o.mod].name);
    refreshSchools();
  } else if(o.kind === 'relic'){
    addRelic(o.id);
  } else if(o.kind === 'crystal'){
    P.passives[o.id] = (P.passives[o.id] || 0) + 1;
    if(o.id === 'heart'){
      P.maxHp += 35;
      P.hp = Math.min(P.maxHp, P.hp + 35);
    }
  } else if(o.kind === 'heal'){
    P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4);
    addText(P.x, P.y - 24, '+' + Math.round(P.maxHp * 0.4), '#8ee06b', 11);
  }
  /* 3.0：选完卡先刷新流派（可能刚好凑到下一级），再重算属性 */
  refreshArch();
  ST = getStats();
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.05);
  burst(P.x, P.y, o.color || '#ffd166', 14, 120, 0);
}

/* 选中一条觉醒分支：升到满级 + 记录分支 + 授予该分支的改造卡 */
function applyEvo(id, bid){
  const w = WEAPONS[id];
  if(!w) return false;
  const b = branchOf(id, bid);
  P.weapons[id] = Math.max(P.weapons[id] || 1, w.max);
  P.evoB = P.evoB || {};
  P.evoB[id] = bid;
  P.evoFlag = P.evoFlag || {};
  if(b){
    if(b.flag) P.evoFlag[id] = b.flag;
    if(b.mods && b.mods.length){
      P.wmod[id] = P.wmod[id] || [];
      for(let mi = 0; mi < b.mods.length; mi++){
        if(P.wmod[id].indexOf(b.mods[mi]) < 0) P.wmod[id].push(b.mods[mi]);
      }
    }
  }
  showToast('⚡ ' + w.name + ' · ' + (b ? b.name : '觉醒'));
  addText(P.x, P.y - 30, (b ? b.name : '觉醒'), '#ffd166', 13);
  sfx('awaken');
  state.flash = 0.55; state.shake = 5;
  rings.push({ x:P.x, y:P.y, r0:10, r1:90, life:0.5, max:0.5, col:w.color, w:4 });
  burst(P.x, P.y, w.color, 24, 180, 0);
  refreshSchools();
  return true;
}

function addRelic(id){
  const r = RELICS[id];
  if(!r || P.relics[id]) return;
  P.relics[id] = 1;
  P.relicOrder.push(id);
  /* 加最大生命的遗物：resetGame 里只在开局算过一次，局中抽到等于没生效。
     这里补一次即时结算（厚皮 / 血铠 / 硬化壳 / 骨肉牢笼）。
     【3.0 修复】原来 thickskin 在 FLAT_HP 和下面的 if 里各加了一次 35，
     抽到「厚皮」实际 +70 —— 描述与代码不一致的老毛病。现在只留一处。 */
  const FLAT_HP = { thickskin: 45, bloodarmor: 70, harden: 30, fleshcage: 50 };
  if(FLAT_HP[id]){
    P.maxHp += FLAT_HP[id];
    P.hp += FLAT_HP[id];
    addText(P.x, P.y - 30, '生命上限 +' + FLAT_HP[id], '#ff8fb0', 11);
  }
  /* 3.0：按百分比加生命的件（血肉流派），必须当场结算 */
  const PCT_HP = { fleshmass: 0.30, fleshblood: 0.20 };
  if(PCT_HP[id]){
    const add = Math.round(P.maxHp * PCT_HP[id]);
    P.maxHp += add;
    P.hp += add;
    addText(P.x, P.y - 30, '生命上限 +' + add, '#ff5f7e', 12);
    if(rings.length < 26) rings.push({ x:P.x, y:P.y, r0:6, r1:44, life:0.26, max:0.26, col:'#ff5f7e', w:2 });
  }
  /* 立刻生效的部分 */
  if(id === 'sacrifice'){
    /* 武器槽 -1：如果超出上限，最多留 limit 把 */
    const lim = slotLimit();
    const ids = Object.keys(P.weapons);
    for(let i = lim; i < ids.length; i++){ delete P.weapons[ids[i]]; delete P.cds[ids[i]]; }
  }
  if(id === 'glassheart'){
    P.maxHp = Math.max(40, Math.round(P.maxHp * 0.5));
    P.hp = Math.min(P.hp, P.maxHp);
  }
  if(id === 'pet'){ /* 占位，避免拼写错误导致崩溃 */ }
  refreshArch();
  ST = getStats();
  showToast(RARITY[r.rar].name + '遗物：' + r.name);
  sfx(r.rar === 'curse' ? 'curse' : 'relic');
  state.flash = Math.max(state.flash, r.rar === 'epic' ? 0.45 : 0.28);
  rings.push({ x:P.x, y:P.y, r0:8, r1:70, life:0.45, max:0.45, col: RARITY[r.rar].color, w:3 });
  if(r.rar === 'curse'){
    addText(P.x, P.y - 36, '⚠ 代价已支付', '#ff6b6b', 12);
  }
}

/* =========================================================
   暂停 / 结束
   ========================================================= */
function togglePause(){
  if(state.mode === 'playing'){
    state.mode = 'paused';
    ST = getStats();
    $('pausebox').classList.remove('hidden');
    const up = $('pauseUp');
    up.innerHTML = '';
    for(const id in P.weapons) up.appendChild(miniEl('w', id, P.weapons[id], P.wmod[id]));
    for(const id in P.passives) up.appendChild(miniEl('p', id, P.passives[id]));
    /* 遗物：之前完全没显示，玩家拿了什么、有什么用都看不到 */
    for(let i = 0; i < P.relicOrder.length; i++){
      const rid = P.relicOrder[i];
      if(RELICS[rid]) up.appendChild(miniEl('r', rid, 1));
    }
    $('pauseStats').innerHTML =
      row('角色', CHAR.name) +
      row('生存时间', fmtTime(state.time)) +
      row('等级', 'Lv.' + P.level) +
      row('击杀', state.kills) +
      row('生命', Math.ceil(P.hp) + '/' + Math.round(P.maxHp)) +
      row('护盾', Math.round(P.shield) + ' / ' + Math.round(ST.shieldMax || 0)) +
      row('武器槽', weaponCount() + ' / ' + slotLimit()) +
      row('遗物', relicCount()) +
      row('伤害加成', Math.round((ST.dmgMul - 1) * 100) + '%') +
      row('暴击', Math.round(ST.crit * 100) + '% / ×' + ST.critMul.toFixed(2)) +
      row('减伤', Math.round((ST.armor || 0) * 100) + '%') +
      row('怒气获取', Math.round((ST.rageGain || 1) * 100) + '% · 狂战 ' + (ST.rageDur || 6).toFixed(1) + 's') +
      row('充能速度', Math.round((ST.chargeRate || 1) * 100) + '%') +
      row('血肉伤害', ST.fleshPct > 0 ? (ST.fleshPct * 100).toFixed(1) + '% 最大生命' : '—') +
      row('武器流派', topSchools(2).map(x => x.name + ' ' + Math.round(x.share * 100) + '%').join(' / ') || '—') +
      row('构筑流派', archSummary().map(a => a.name + ' ' + (a.tier >= 3 ? 'Ⅲ' : (a.tier === 2 ? 'Ⅱ' : (a.tier || '·')))).join(' / ') || '—') +
      row('机制', activeLinks().map(l => l.name + (l.tier >= 3 ? 'Ⅲ' : (l.tier === 2 ? 'Ⅱ' : ''))).join(' / ') || '—');
  } else if(state.mode === 'paused'){
    state.mode = 'playing';
    $('pausebox').classList.add('hidden');
  }
}
function row(k, v){ return '<div class="k">' + k + '</div><div class="v">' + v + '</div>'; }

/* 【3.4】伤害来源的中文名。
   之前这张表只登记了一部分，`srcName` 又是 `SRC_NAME[id] || id` 直接兜底，
   于是没登记的 id 原样漏到结算面板上：玩家看到的是 "r_chain"、"shield"、
   "r_killchain" 这种内部变量名——纯英文，还带下划线，完全是实现细节泄漏。
   现在把代码里所有 src 字面量全部登记一遍，兜底也不再暴露原始 id。 */
const SRC_NAME = {
  /* --- 通用 / 元素 --- */
  burn:'燃烧', venom:'中毒', bleed:'流血', ice:'冰霜', react:'元素反应',
  boom:'爆炸', hazard:'地面伤害', misc:'其它',
  /* --- 武器与召唤物 --- */
  turret:'炮台', totem:'图腾', pet:'宠物', mine:'地雷', hole:'黑洞',
  aura:'辣椒光环', banana:'回旋香蕉', echo:'回响',
  hive:'蜂巢', prism:'棱镜', drum:'雷鼓', ember:'余烬瓶', claymore:'巨剑',
  /* --- 角色资源 --- */
  rage:'怒爆', shield:'护盾', flesh:'血肉', thorns:'反伤', knock:'撞击',
  /* --- 遗物触发 --- */
  relic:'遗物',
  r_chain:'电链', r_spark:'火花塞', r_voltdeath:'感应线圈',
  r_killchain:'猎杀连锁', r_frost:'冰霜之心', r_thunder:'落雷',
  /* --- 改造卡 / 调试 --- */
  chainkill:'连锁击杀', dbg:'调试'
};
function srcName(id){
  if(WEAPONS[id]) return WEAPONS[id].name;
  /* 兜底：认不出来的一律显示「其它」。
     宁可含糊，也不要把 r_xxx 这种内部 id 摆到玩家面前。 */
  return SRC_NAME[id] || '其它';
}

function gameOver(win){
  state.mode = win ? 'victory' : 'gameover';
  bgmStop();
  sfx(win ? 'awaken' : 'over');
  state.shake = win ? 6 : 8;
  burst(P.x, P.y, win ? '#fff3b0' : '#fff4e0', win ? 40 : 26, win ? 240 : 160);
  if(win){
    state.clears = (state.clears || 0) + 1;
    try{ localStorage.setItem('slipper_survivor_clears', String(state.clears)); }catch(e){}
    $('clearT').textContent = String(state.clears);
    for(let i = 0; i < 5; i++){
      rings.push({ x:P.x, y:P.y, r0:10 + i * 30, r1:120 + i * 90, life:0.9 + i * 0.12,
        max:0.9 + i * 0.12, col:['#fff3b0','#ffd166','#ff9dc0','#7ce3ff','#8ee6b3'][i], w:3 });
    }
  }
  /* 只有"死掉"才刷新存活纪录；通关是另一条成绩线 */
  const isNew = !win && state.time > state.best;
  if(isNew){ state.best = state.time; saveBest(state.best); }

  $('goTitle').textContent = win ? '👑 通 关 ！' : '你被吃掉了…';
  $('goTitle').style.color = win ? '#ffe066' : '#ff9fb6';
  /* 通关/死亡时把升级弹窗收掉：终局 BOSS 一死通常正好升一级，
     否则结算面板会被三选一盖住 */
  $('levelup').classList.add('hidden');
  $('pausebox').classList.add('hidden');
  $('restartBtn').textContent = win ? '再 来 一 局' : '再 来 一 局';
  /* 只有"第一次通关"才给继续无尽的选项；死亡 / 无尽里再死都不给 */
  state.winOnce = !!win;
  $('continueBtn').classList.toggle('hidden', !win || !!state.endless);

  $('goStats').innerHTML =
    row('角色', CHAR.name) +
    row('生存时间', fmtTime(state.time)) +
    row('击败敌人', state.kills) +
    row('达到等级', 'Lv.' + P.level) +
    row('击败 BOSS', state.bossKills || 0) +
    row('遗物', relicCount()) +
    (win ? row('通关次数', (state.clears || 0) + ' 次') : row('历史最久', fmtTime(state.best) + (isNew ? ' ★新纪录' : '')));
  const up = $('goUp');
  up.innerHTML = '';
  for(const id in P.weapons) up.appendChild(miniEl('w', id, P.weapons[id], P.wmod[id]));
  for(const id in P.passives) up.appendChild(miniEl('p', id, P.passives[id]));

  const links = activeLinks();
  if(links.length){
    const rd = document.createElement('div');
    rd.className = 'dmghd';
    rd.textContent = '机制：' + links.map(l => l.name + (l.tier >= 3 ? 'Ⅲ' : (l.tier === 2 ? 'Ⅱ' : ''))).join(' · ');
    up.appendChild(rd);
  }

  const rows = [];
  for(const id in DMG){
    if(DMG[id] < 1) continue;
    if(id === 'dbg') continue;      /* 调试接口打的伤害不参与排名 */
    rows.push({ id, v: DMG[id] });
  }
  rows.sort((a, b) => b.v - a.v);
  const tot = rows.reduce((n, o) => n + o.v, 0) || 1;
  const gd = $('goDmg');
  if(!rows.length){
    gd.innerHTML = '';
  } else {
    gd.innerHTML = '<div class="dmghd">伤害来源</div>' + rows.slice(0, 8).map(o => {
      const pct = Math.max(1, Math.round(o.v / tot * 100));
      const col = WEAPONS[o.id] ? WEAPONS[o.id].color : '#a9b7c9';
      return '<div class="dmgrow">' +
        '<span class="dmgn" style="color:' + col + '">' + srcName(o.id) + '</span>' +
        '<span class="dmgtrack"><i style="width:' + pct + '%;background:' + col + ';color:' + col + '"></i></span>' +
        '<span class="dmgv">' + fmtNum(o.v) + '<em>' + pct + '%</em></span>' +
        '</div>';
    }).join('');
  }
  $('gameover').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

/* 通关：复用结算面板，换上胜利文案与「继续无尽」 */
function victory(){
  gameOver(true);
}

/* 通关后继续玩：接着刷，进入无尽强化。
   【4.2】只能进一次，而且只有"打赢终局 BOSS"那一次能点。
   之前它是个可以反复点的按钮（CSS 的 .hidden 没生效），
   于是死了也能"继续"，还能一直继续下去——无尽变成了绕过失败的按钮。 */
function continueEndless(){
  if(!state.winOnce || state.endless) return;
  state.endless = true;
  state.mode = 'playing';
  state.bossAt = state.time + 40;
  state.bossIdx = (state.bossIdx || 0) + 1;
  $('gameover').classList.add('hidden');
  $('hud').classList.remove('hidden');
  bgmStart();
  showToast('♾ 无尽模式：每分钟强化一次');
}

/* --- 提示 --- */
let toastTimer = null;
function showToast(txt){
  const el = $('toast');
  if(!el) return;
  el.textContent = txt;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}
