/* =========================================================
   3.0 构筑流派（Archetype）
   ---------------------------------------------------------
   2.x 的"流派"只有 12 个武器标签，且几乎全部落回两条路：
   元素反应，或者"暴击 + 穿透"。3.0 补上五条**能用遗物和结晶堆出来**的
   独立流派，每条都有 3 级里程碑，凑齐就开始滚雪球：

     怒气   攒怒 → 狂战 → 快进快出 → 冲击波
     血肉   生命上限 → 按最大生命百分比打真实伤害
     过载   命中攒充能 → 超载齐射 → 整套武器转起来
     吞噬   击杀永久成长，越杀越强
     护盾   可再生血条 → 护盾换伤害 → 破碎反击

   流派只做三件事（和 2.x 的 SCHOOLS 一致）：
     1) 卡池倾斜 —— 已经投入的方向更容易继续出牌
     2) 里程碑 —— 2 / 5 / 8 点给三级小机制
     3) UI 呈现 —— 升级界面和暂停面板能看见自己在走哪条路
   ========================================================= */

const ARCH = {
  rage: {
    own:'knight',
    name:'怒气', col:'#ff7a4d', icon:'rage', tags:['rage'],
    blurb:'攒满怒气进入狂战；快进快出的循环流',
    tiers:[
      '怒气获取 +20%',
      '狂战时长 +1.5 秒',
      '狂战入场 / 引爆时都会震退周围敌人'
    ]
  },
  flesh: {
    own:'knight',
    name:'血肉', col:'#ff5f7e', icon:'flesh', tags:['flesh'],
    blurb:'堆最大生命，把血条当成武器',
    tiers:[
      '最大生命 +10%',
      '攻击附加 1% 最大生命的真实伤害',
      '所有治疗 +30%'
    ]
  },
  charge: {
    own:'ranger',
    name:'过载', col:'#7ce3ff', icon:'gear', tags:['charge'],
    blurb:'命中攒充能，超载时全武器齐射',
    tiers:[
      '充能速度 +25%',
      '超载期间伤害 +20%',
      '超载结束时再齐射一轮'
    ]
  },
  growth: {
    own:'keeper',
    name:'吞噬', col:'#a6e05a', icon:'devour', tags:['growth'],
    blurb:'永久成长：杀得越多，底子越厚',
    tiers:[
      '每 20 秒 +1 最大生命',
      '击杀有 4% 概率掉落血包',
      '每 12 秒回复 1.6% 最大生命'
    ]
  },
  barrage: {
    own:'ranger',
    name:'弹幕', col:'#ffc46b', icon:'multi', tags:['proj','multi','rapid','barrage'],
    blurb:'用覆盖面说话：冷却与弹道',
    tiers:['攻击间隔 -8%','弹道 +1','每 10 次命中让一把武器立刻装填']
  },
  crit: {
    name:'暴击', col:'#ffd166', icon:'star', tags:['crit','lucky'],
    blurb:'把伤害押在每一次 roll 上',
    tiers:['暴击率 +5%','暴击伤害 +25%','暴击时 15% 伤害溅射周围']
  },
  elem: {
    own:'chef',
    name:'元素', col:'#ff8a3d', icon:'flamer', tags:['fire','ice','volt','venom','elem'],
    blurb:'元素挂得越久，反应越密',
    tiers:['元素持续时间 +25%','反应伤害 +20%','反应溅射半径 +30%']
  },

  /* ---- 3.2 新增：游侠 / 工程师 / 厨师 的专属路线 ---- */
  pierce: {
    own:'ranger', name:'贯穿', col:'#9fe0ff', icon:'pierce', tags:['pierce','proj','snipe'],
    blurb:'一箭穿一条线，越厚的队列越吃亏',
    tiers:['穿透 +1','穿透命中不衰减','每穿过一个目标，后续伤害 +10%']
  },
  turret: {
    own:'engineer', name:'炮台', col:'#ffe066', icon:'turret', tags:['turret','summon','proj'],
    blurb:'布得越多越强，炮台之间互相充能',
    tiers:['每种炮台上限 +1','炮台冷却 -13%','每座炮台让全武器冷却 -5%']
  },
  grid: {
    own:'engineer', name:'电网', col:'#ffd166', icon:'bolt', tags:['volt','grid','blast'],
    blurb:'铺开场，让电流自己找路',
    tiers:['感电多跳 1 次','雷区半径 +30%','感电目标受到的伤害 +15%']
  },
  heat: {
    own:'chef', name:'火候', col:'#ff6b4d', icon:'flamer', tags:['fire','burn','blast'],
    blurb:'点燃、烧透、炸开——不需要冰',
    tiers:['燃烧伤害 +30%','燃烧中死亡的敌人爆炸','燃烧持续 +80%']
  },
  freeze: {
    own:'chef', name:'冷冻', col:'#8fd8ff', icon:'frost', tags:['ice','freeze','control'],
    blurb:'冻住、打碎——不需要火',
    tiers:['冰缓减速 +15%','冻结时长 +1 秒','攻击冻结目标伤害 +40%']
  },

  thorns: {
    own:'knight',
    name:'反伤', col:'#ffb0c4', icon:'mine', tags:['thorns','tank'],
    blurb:'不躲了，站着让它们打',
    tiers:[
      '反伤 +25%',
      '反伤可以暴击',
      '贴身敌人每秒被扎一次'
    ]
  },
  beast: {
    own:'keeper',
    name:'兽群', col:'#8ee6b3', icon:'pet', tags:['pet','beast'],
    blurb:'宠物活着才是战斗力',
    tiers:[
      '宠物伤害 +15%',
      '每种宠物上限 +1',
      '每只存活宠物让你伤害 +6%'
    ]
  },
  sacrifice: {
    own:'keeper',
    name:'爆裂', col:'#ff6b8b', icon:'devour', tags:['summon','sacrifice'],
    blurb:'宠物每次撕咬都会炸开一圈',
    tiers:[
      '宠物攻击附带范围爆炸',
      '爆炸伤害 +50%',
      '爆炸范围 +40%'
    ]
  },

  shield: {
    own:'engineer',
    name:'护盾', col:'#9fe8ff', icon:'shield', tags:['shield'],
    blurb:'可再生护盾，先扛后打',
    tiers:[
      '护盾上限 +25%',
      '有护盾时减伤 +8%',
      '护盾破碎时释放冲击波'
    ]
  }
};

/* 顺序 = 卡池权重与界面的展示顺序。crit 是**公用流派**（谁都能走），
   其余 15 条各自只属于一个角色。 */
const ARCH_IDS = ['rage', 'flesh', 'thorns',
                  'charge', 'barrage', 'pierce',
                  'turret', 'shield', 'grid',
                  'beast', 'sacrifice', 'growth',
                  'heat', 'freeze', 'elem',
                  'crit'];
const ARCH_TIER_MIN = [2, 5, 8];        /* 三级里程碑所需点数 */

/* 每个角色的 2~3 条路线。第一条是"本命"（起步就有一点倾斜），
   其余靠玩家自己用遗物与结晶把点数堆上去。 */
const CHAR_ROUTES = {
  knight:   ['rage', 'flesh', 'thorns'],
  ranger:   ['charge', 'barrage', 'crit'],
  engineer: ['shield', 'thorns', 'crit'],
  keeper:   ['beast', 'sacrifice', 'growth'],
  chef:     ['elem', 'crit', 'flesh'],
};

/* 角色天生倾斜：起始就把对应流派推到 I 级附近，
   但后面的 2 / 3 级必须靠遗物与结晶真金白银地堆出来。 */


/* 结晶与改造卡对流派点数的贡献 */
const ARCH_GEM_PTS = { ragegem:1.0, fleshgem:1.0, chargegem:1.0, shieldgem:1.0 };
const ARCH_MOD_PTS = { ragefuel:1.2, bloodpact:1.2, chargeup:1.2 };

/* 一件遗物只喂**一个**流派：取它标签里第一个能对上流派的那个。
   原来只要标签有交集就给 2 点，于是一件 ['rage','tank'] 同时喂怒气和反伤、
   一件 ['fire','blast'] 同时喂火候和暴击——十几条流派一起长，
   最后条条点满，"选流派"这件事等于没做。 */
let RELIC_ARCH = null;
function relicArch(rid){
  if(!RELIC_ARCH){
    RELIC_ARCH = {};
    for(const rid2 in RELICS){
      const r = RELICS[rid2];
      if(!r || !r.tags) continue;
      let found = '';
      for(let i = 0; i < r.tags.length && !found; i++){
        for(let k = 0; k < ARCH_IDS.length; k++){
          if(ARCH[ARCH_IDS[k]].tags.indexOf(r.tags[i]) >= 0){ found = ARCH_IDS[k]; break; }
        }
      }
      RELIC_ARCH[rid2] = found;
    }
  }
  return RELIC_ARCH[rid] || '';
}

function archPtsRaw(id){
  const def = ARCH[id];
  if(!def || !P) return 0;
  /* 【铁律】一条流派只属于一个角色。别人即使因为历史存档带了同标签的件，
     也不该在这条流派上有任何进度。 */
  if(def.own && def.own !== (CHAR && CHAR.id)) return 0;
  let n = 0;
  /* 角色禀赋：只给本命第一条路线 */
  const routes = CHAR_ROUTES[CHAR && CHAR.id] || [];
  if(routes[0] === id) n += 2.5;
  else if(routes.indexOf(id) > 0) n += 0.8;
  /* 遗物：每件 2 点，但只算给它的主流派 */
  for(const rid in P.relics){
    if(relicArch(rid) === id) n += 2;
  }
  /* 结晶：每级 1 点 */
  for(const gid in ARCH_GEM_PTS){
    if(!P.passives || !P.passives[gid]) continue;
    const p = PASSIVES[gid];
    if(p && p.arch === id) n += (P.passives[gid] || 0) * ARCH_GEM_PTS[gid];
  }
  /* 改造卡：每条 1.2 点 */
  for(const wid in P.wmod){
    const list = P.wmod[wid] || [];
    for(let i = 0; i < list.length; i++){
      const mid = list[i];
      const owner = ARCH_MOD_PTS[mid];
      if(owner && owner === id) n += ARCH_MOD_PTS[mid];
    }
  }
  return n;
}

function archTier(id){
  const a = P && P.arch ? P.arch[id] : null;
  return a ? a.tier : 0;
}

/* 每局开始 / 每次选卡后重算，避免每帧遍历遗物 */
/* 专精折扣：投入最多的那条拿满，第二条 52%、第三条 32%、第四条往后 20%。
   这是回答"为什么所有流派都能点满"的正解——**不加门槛，加分心的代价**。
   集中投资的人能摸到 Ⅲ 级（8 点），摊大饼的人每条都停在 Ⅰ 级门口。
   门槛仍然是 2 / 5 / 8，没有为了"卡住玩家"而调高数字。 */
const ARCH_RANK_MUL = [1, 0.52, 0.32, 0.20];

function refreshArch(silent){
  if(!P) return;
  const raw = {};
  for(let i = 0; i < ARCH_IDS.length; i++) raw[ARCH_IDS[i]] = archPtsRaw(ARCH_IDS[i]);
  /* 排名按原始点数；同分时按 ARCH_IDS 顺序稳定排序，避免每帧抖动 */
  const ranked = ARCH_IDS.slice().sort(function(a, b){
    if(raw[b] !== raw[a]) return raw[b] - raw[a];
    return ARCH_IDS.indexOf(a) - ARCH_IDS.indexOf(b);
  });
  const out = {};
  for(let r = 0; r < ranked.length; r++){
    const id = ranked[r];
    /* 只有真正投了点的流派才吃折扣位次，0 点的直接 0，不占名额 */
    if(raw[id] <= 0){ out[id] = { pts: 0, tier: 0 }; continue; }
    const mul = ARCH_RANK_MUL[Math.min(ARCH_RANK_MUL.length - 1, r)];
    const pts = raw[id] * mul;
    let tier = 0;
    for(let k = 0; k < ARCH_TIER_MIN.length; k++) if(pts >= ARCH_TIER_MIN[k]) tier = k + 1;
    out[id] = { pts: pts, tier: tier, raw: raw[id] };
  }
  P.arch = out;
  if(!P.archSeen) P.archSeen = {};
  for(let i = 0; i < ARCH_IDS.length; i++){
    const id = ARCH_IDS[i];
    const t = out[id].tier;
    const seen = P.archSeen[id] || 0;
    if(t > seen){
      P.archSeen[id] = t;
      if(silent) continue;
      if(t === 1){
        showToast('◈ 流派成型：' + ARCH[id].name);
        state.flash = Math.max(state.flash, 0.18);
        sfx('arch');
      } else {
        showToast('◈ ' + ARCH[id].name + ' 提升至 ' + (t === 2 ? 'Ⅱ' : 'Ⅲ') + ' 级');
        state.flash = Math.max(state.flash, 0.22);
        sfx('arch');
      }
    } else if(t < seen){
      P.archSeen[id] = t;
    }
  }
  /* 血肉Ⅰ：最大生命 +10%（一次性，避免反复乘） */
  if(out.flesh.tier >= 1 && !P.fleshHpApplied){
    P.fleshHpApplied = true;
    const add = Math.round(P.maxHp * 0.10);
    P.maxHp += add;
    P.hp = Math.min(P.maxHp, P.hp + add);
  }
  /* 护盾流派的护盾上限只在有护盾来源时才成立，但字段本身由 getStats 乘 1.25 处理 */
}

/* 卡池倾斜：选定的流派持续主导三选一。
   原来最多 +48%，而新武器 / 升级卡的权重本来就有 1.3~3.0，
   这点倾斜完全被淹没，玩家仍然是在"随机抽卡"。
   现在：已成型流派 ×1.6 ~ ×2.4，完全无关的 ×0.62——差距接近 4 倍，
   "我选了这条路"在每一次三选一里都看得见。 */
function archWeight(tags){
  if(!tags || !tags.length || !P || !P.arch) return 1;
  let best = 0;
  for(let i = 0; i < ARCH_IDS.length; i++){
    const id = ARCH_IDS[i];
    const a = P.arch[id];
    if(!a || !a.tier) continue;
    const def = ARCH[id];
    let hit = false;
    for(let k = 0; k < def.tags.length; k++) if(tags.indexOf(def.tags[k]) >= 0){ hit = true; break; }
    if(hit && a.tier / 3 > best) best = a.tier / 3;
  }
  if(best > 0) return 1 + best * 1.4;
  return 0.62;
}

/* UI：当前流派的一行摘要（只显示已经有进度的） */
function archSummary(){
  const out = [];
  if(!P || !P.arch) return out;
  for(let i = 0; i < ARCH_IDS.length; i++){
    const id = ARCH_IDS[i];
    const a = P.arch[id];
    if(!a || a.pts <= 0) continue;
    out.push({
      id: id, name: ARCH[id].name, col: ARCH[id].col, icon: ARCH[id].icon,
      tier: a.tier, pts: a.pts,
      next: a.tier >= 3 ? 0 : ARCH_TIER_MIN[a.tier],
      nextName: a.tier >= 3 ? '' : ARCH[id].tiers[a.tier]
    });
  }
  out.sort(function(a, b){ return b.pts - a.pts; });
  return out;
}

/* 悬停说明用 */
function archHtml(id){
  const def = ARCH[id];
  if(!def) return '';
  const a = (P && P.arch && P.arch[id]) ? P.arch[id] : { pts:0, tier:0 };
  const lines = [];
  for(let i = 0; i < def.tiers.length; i++){
    const on = a.tier > i;
    lines.push('<div style="color:' + (on ? def.col : '#6f6285') + '">' +
      (on ? '✔ ' : '○ ') + '[' + (i + 1) + '] ' + def.tiers[i] + '</div>');
  }
  const next = a.tier >= 3 ? '已满级' : ('下一级还需 ' + Math.ceil(Math.max(0, ARCH_TIER_MIN[a.tier] - a.pts)) + ' 点');
  return '<b style="color:' + def.col + '">◈ ' + def.name + ' · ' + a.tier + ' 级</b>' +
    '<div style="margin-top:3px;color:#a99ac2">' + def.blurb + '（' + Math.round(a.pts) + ' 点 / ' + next + '）</div>' +
    lines.join('');
}
