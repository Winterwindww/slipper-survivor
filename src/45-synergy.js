/* =========================================================
   4.6 流派（Build School）
   ---------------------------------------------------------
   流派只做三件事，不再提供任何自动属性加成：
     1) 卡池权重 —— 你已经成型的方向更容易继续出牌（最多 +55%）
     2) 角色亲和 —— 每个角色天生擅长两三个流派（×1.9）
     3) UI 呈现 —— 升级/暂停界面能看见自己现在的流派浓度

   真正的"1+1>2"靠机制：击退撞人、冰火融化、毒火毒爆、
   宠物继承元素、炮台共享目标……这些在 LINKS 里能被检测出来，
   并且会明确告诉玩家"你现在吃到了哪条联动"。
   ========================================================= */
const SCHOOLS = {
  barrage: { name:'弹幕', col:'#ffc46b', tags:['proj','multi','rapid'],
             desc:'多弹道短冷却，用覆盖面清场' },
  pierce:  { name:'穿甲', col:'#9fe0ff', tags:['pierce','beam'],
             desc:'一条线串到底，越密越强' },
  blast:   { name:'爆破', col:'#ff9d4d', tags:['blast','aoe','lob'],
             desc:'爆炸连锁，靠范围吃满屏' },
  melee:   { name:'近战', col:'#e6eefc', tags:['melee','knock','guard','bleed'],
             desc:'真实挥击、击退撞人、格挡反击' },
  fire:    { name:'灼烧', col:'#ff8a3d', tags:['fire'],
             desc:'点燃铺场，靠燃烧与融化连锁' },
  ice:     { name:'霜寒', col:'#8fe8ff', tags:['ice','cc'],
             desc:'冻住再打，控场与易伤' },
  volt:    { name:'感电', col:'#ffe066', tags:['volt','chain'],
             desc:'电流在怪群里来回跳' },
  venom:   { name:'剧毒', col:'#a6e05a', tags:['venom','bleed'],
             desc:'中毒与流血叠层' },
  beast:   { name:'兽群', col:'#8ee6b3', tags:['pet','summon'],
             desc:'一群各有 AI 的宠物围绕你作战' },
  fort:    { name:'阵地', col:'#ffd166', tags:['turret','trap','turf'],
             desc:'炮台与地雷，铺一片自动火力' },
  crit:    { name:'暴击', col:'#ffd166', tags:['crit','lucky'],
             desc:'堆暴击率与爆伤，靠单发质变' },
  orbit:   { name:'环绕', col:'#b6f0ff', tags:['orbit'],
             desc:'贴身的旋转防线，能挡子弹' },

  /* ---- 3.0：五条不靠武器、靠遗物与结晶堆出来的流派 ---- */
  rage:    { name:'怒气', col:'#ff7a4d', tags:['rage'],
             desc:'攒怒进入狂战；快进快出也能变成输出循环' },
  flesh:   { name:'血肉', col:'#ff5f7e', tags:['flesh'],
             desc:'堆最大生命，按生命百分比打真实伤害' },
  charge:  { name:'过载', col:'#7ce3ff', tags:['charge'],
             desc:'命中攒充能，超载时整套武器一起开火' },
  growth:  { name:'吞噬', col:'#a6e05a', tags:['growth'],
             desc:'击杀永久成长，越打底子越厚' },
  shield:  { name:'护盾', col:'#9fe8ff', tags:['shield'],
             desc:'可再生护盾，先扛后打' }
};

/* 一把武器属于哪些流派（按标签匹配） */
function schoolsOfWeapon(w){
  const out = [];
  if(!w || !w.tags) return out;
  for(const sid in SCHOOLS){
    const tags = SCHOOLS[sid].tags;
    for(let i = 0; i < w.tags.length; i++){
      if(tags.indexOf(w.tags[i]) >= 0){ out.push(sid); break; }
    }
  }
  return out;
}

/* 当前阵容的流派浓度：0~1，按武器数量占比算 */
function schoolShare(){
  const share = {};
  const ids = Object.keys(P ? P.weapons : {});
  if(!ids.length) return share;
  for(let i = 0; i < ids.length; i++){
    const w = WEAPONS[ids[i]];
    /* 主流派：每把武器只归一个流派，否则"投递方式"会把所有 build 拉成同一类 */
    const list = (w && w.school) ? [w.school] : schoolsOfWeapon(w);
    for(let k = 0; k < list.length; k++) share[list[k]] = (share[list[k]] || 0) + 1;
  }
  for(const sid in share) share[sid] = share[sid] / ids.length;
  return share;
}

function topSchools(n){
  const share = schoolShare();
  const arr = [];
  for(const sid in share) arr.push({ id:sid, share:share[sid], name:SCHOOLS[sid].name, col:SCHOOLS[sid].col });
  arr.sort((a, b) => b.share - a.share);
  return arr.slice(0, n || 2);
}

/* 卡池权重：往已有流派收敛，但只给到 +55%，不锁死玩法 */
function schoolWeight(tags){
  if(!tags || !P) return 1;
  const share = schoolShare();
  let best = 0;
  for(const sid in SCHOOLS){
    const st = SCHOOLS[sid].tags;
    let hit = false;
    for(let i = 0; i < tags.length; i++) if(st.indexOf(tags[i]) >= 0){ hit = true; break; }
    if(hit && (share[sid] || 0) > best) best = share[sid] || 0;
  }
  return 1 + best * 0.55;
}

/* 选完卡后刷新：流派换了会提示一次，同时重算属性 */
function refreshSchools(){
  if(!P) return;
  const top = topSchools(1)[0];
  if(top && top.id !== P.topSchool){
    P.topSchool = top.id;
    if(top.share >= 0.5){
      showToast('流派成型：' + top.name);
      state.flash = Math.max(state.flash, 0.16);
    }
  }
  recomputeSchoolTiers();
  ST = getStats();
}

function charSchoolNames(c){
  if(!c || !c.schools) return '';
  return c.schools.map(s => (SCHOOLS[s] ? SCHOOLS[s].name : s)).join(' / ');
}

/* =========================================================
   4.7 真实联动：能被检测出来的机制组合
   ---------------------------------------------------------
   不发放任何数值，只负责"承认"玩家已经凑出来的组合，
   并在界面上写清楚它为什么成立、效果是什么。
   ========================================================= */
const LINKS = [
  { id:'knockSmash', name:'撞 击', desc:'被击退的敌人撞到别人，双方都吃伤害',
    has(){ return hasWeaponTag('knock'); } },
  { id:'melt', name:'冰火爆破', desc:'冰缓中的敌人吃到火 → 融化爆开',
    has(){ return hasSchool('ice') && hasSchool('fire'); } },
  { id:'toxblast', name:'毒火引爆', desc:'中毒中的敌人吃到火 → 毒爆并传染',
    has(){ return hasSchool('venom') && hasSchool('fire'); } },
  { id:'superconduct', name:'超 导', desc:'冰与电互相触发范围伤害并扩散冰缓',
    has(){ return hasSchool('ice') && hasSchool('volt'); } },
  { id:'petElem', name:'兽群附魔', desc:'宠物攻击继承你最近使用的元素',
    has(){ return hasAlly('pet') && (hasSchool('fire') || hasSchool('ice') || hasSchool('venom') || hasSchool('volt')); } },
  { id:'turretGrid', name:'火 力 网', desc:'两座以上炮台交叉覆盖同一片区域',
    has(){ return allyCount('turret') >= 2; } },
  { id:'thornsWave', name:'反伤震荡', desc:'挨打时向周围释放震荡波',
    has(){ return relic('thornsplate') || !!P.passives.plate; } },
  { id:'deathChain', name:'亡语连锁', desc:'燃烧单位 / 召唤物死亡时引发爆炸',
    has(){ return relic('emberkill') || relic('ember') || relic('soulharvest'); } }
];

function hasWeaponTag(tag){
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(w && w.tags && w.tags.indexOf(tag) >= 0) return true;
  }
  return false;
}
function hasSchool(sid){
  return (schoolShare()[sid] || 0) > 0;
}
function hasAlly(kind){ return allyCount(kind) > 0; }

function activeLinks(){
  /* 现在是"你实际吃到的流派机制"，不是一堆自动触发的属性共鸣 */
  const out = [];
  if(!P || !P.scT) return out;
  const order = ['melee','pierce','fort','beast','blast','barrage','crit','orbit','fire','ice','volt','venom'];
  for(let i = 0; i < order.length; i++){
    const sid = order[i];
    const t = P.scT[sid] || 0;
    if(!t) continue;
    const m = SCHOOL_MECH[sid];
    if(!m) continue;
    out.push({ id:sid, name:m.icon + ' ' + m.name, tier:t, desc:m.desc });
  }
  return out;
}

/* 卡片上的联动提示：这张卡会把你带进哪条机制 */
function synergyHintForWeapon(id){
  const w = WEAPONS[id];
  if(!w || !w.tags) return '';
  const hit = [];
  const share = schoolShare();
  for(const t of w.tags){
    for(const sid in SCHOOLS){
      if(SCHOOLS[sid].tags.indexOf(t) >= 0 && (share[sid] || 0) > 0){
        if(hit.indexOf(SCHOOLS[sid].name) < 0) hit.push(SCHOOLS[sid].name);
      }
    }
  }
  if(!hit.length) return '';
  return '✦ 与现有流派同路：' + hit.join('、');
}

/* 3.0：遗物 / 结晶的流派归属提示（含新五条流派） */
function archHint(tags){
  if(!tags || !tags.length || typeof P === 'undefined' || !P || !P.arch) return '';
  const hit = [];
  for(let i = 0; i < ARCH_IDS.length; i++){
    const id = ARCH_IDS[i];
    const def = ARCH[id];
    const a = P.arch[id];
    if(!a || !a.pts) continue;
    for(let k = 0; k < def.tags.length; k++){
      if(tags.indexOf(def.tags[k]) >= 0){ hit.push(def.name); break; }
    }
  }
  return hit.length ? ('✦ 接续「' + hit[0] + '」流派') : '';
}

function synergyHintForMod(wid, modId){
  const map = { burn:'fire', chill:'ice', venom:'venom', volt:'volt', blast:'blast',
                pierce:'pierce', crit:'crit', bounce:'chain', size:'aoe', bleed:'venom',
                knock:'melee', combo:'melee', reach:'melee' };
  const t = map[modId];
  if(!t) return '';
  const share = schoolShare();
  let best = '';
  for(const sid in SCHOOLS){
    if(SCHOOLS[sid].tags.indexOf(t) >= 0 && (share[sid] || 0) > 0) best = SCHOOLS[sid].name;
  }
  return best ? ('✦ 吃到「' + best + '」流派加成') : '';
}
