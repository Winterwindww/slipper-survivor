/* =========================================================
   6.0 遗物进化 + 共鸣
   ---------------------------------------------------------
   两件事，都只挂在**已有的遗物位**上，不新增系统：

   1) 进化：每件遗物有 1 个进化槽。条件是一个看得见的计数器
      （"累计受伤 60 次"），达成后进化卡必进下一次三选一，
      点开 A/B 二选一，本局不可逆。
   2) 共鸣：两件指定遗物同时持有 → 解锁一条专属被动
      （哈迪斯双重祝福的做法：A + B → C）。

   为什么进化不自动触发：选 A 还是选 B 本身就是一次抉择。
   自动触发等于白送，等于又一次"拿满就完事"。
   ========================================================= */

/* ---------------- 计数器 ----------------
   全部存在 P 上，随局重置，不进存档。
   能在别处直接读到状态的（击杀 / 时间 / 怒气引爆）不重复计数，
   只有"事件次数"才在这里累加，避免两套真相。 */
function evoN(k){ return (P && P.evoN && P.evoN[k]) || 0; }
function evoAdd(k, n){
  if(!P) return;
  if(!P.evoN) P.evoN = {};
  P.evoN[k] = (P.evoN[k] || 0) + (n === undefined ? 1 : n);
}
/* 获得遗物时记一次基线：进化条件都是"从你拿到它开始"算 */
function evoBaseline(rid){
  if(!P) return;
  if(!P.evoBase) P.evoBase = {};
  if(!P.evoBase[rid]) P.evoBase[rid] = Object.assign({}, P.evoN || {});
}
function evoPick(rid){ return (P && P.relicEvo && P.relicEvo[rid]) || ''; }
/* flag 查询：给"加一个数说不清"的进化分支用 */
function evoFlag(rid, f){ return evoPick(rid) === f; }

function evoState(rid){
  const e = EVO[rid];
  if(!e || !P || !P.relics || !P.relics[rid] || evoPick(rid)) return null;
  const b = (P.evoBase && P.evoBase[rid]) || {};
  const cur = Math.min(e.n, evoN(e.k) - (b[e.k] || 0));
  return { k: e.k, cur: Math.max(0, cur), need: e.n, ready: cur >= e.n, label: e.l };
}
function evoReadyList(){
  const out = [];
  for(const rid in EVO){
    const st = evoState(rid);
    if(st && st.ready) out.push(rid);
  }
  return out;
}

/* 每帧推进"可以自己长"的计数器 */
function evoTick(dt){
  if(!P) return;
  if(!P.evoN) P.evoN = {};
  const N = P.evoN;
  N.time = (N.time || 0) + dt;
  if(typeof isBerserk === 'function' && isBerserk()) N.berserk = (N.berserk || 0) + dt;
  /* 峰值类：护甲 / 最大生命 只记最高值，掉下来不清零 */
  const st = (typeof ST !== 'undefined' && ST) ? ST : null;
  if(st){
    N.armorHi = Math.max(N.armorHi || 0, st.armorPts || 0);
  }
  N.hpHi = Math.max(N.hpHi || 0, P.maxHp || 0);
  /* 击杀与引爆本来就一直记着，直接同步，不造假事件 */
  if(typeof state !== 'undefined' && state){
    N.kill = state.kills || 0;
    if(typeof P.rageCount === 'number') N.detonate = P.rageCount;
  }
}

/* ---------------- 进化效果聚合 ----------------
   分支效果写成补丁，统一叠进 relicStat 的 s。
   这样"进化"永远不需要第二套公式，也不会漏掉某个乘区。 */
function evoBonus(){
  const o = {
    dmg: 1, maxHp: 0, maxHpMul: 1, armor: 0, crit: 0, critMul: 0,
    multi: 0, pierce: 0, thornsAdd: 0, thornsMul: 1, speed: 1,
    flatDR: 0, hitCap: 0, healMul: 1, killHealMul: 1,
    petDmg: 1, turretLife: 1, turretRate: 1, elemDur: 1, regenMul: 1,
    dmgAdd: 0
  };
  if(!P || !P.relicEvo) return o;
  for(const rid in P.relicEvo){
    const e = EVO[rid];
    if(!e) continue;
    const pick = P.relicEvo[rid];
    const b = (pick === 'a') ? e.a : (pick === 'b' ? e.b : null);
    if(!b || !b.mod) continue;
    const m = b.mod;
    if(m.dmg) o.dmg *= m.dmg;
    if(m.maxHp) o.maxHp += m.maxHp;
    if(m.maxHpMul) o.maxHpMul *= m.maxHpMul;
    if(m.armor) o.armor += m.armor;
    if(m.crit) o.crit += m.crit;
    if(m.critMul) o.critMul += m.critMul;
    if(m.multi) o.multi += m.multi;
    if(m.pierce) o.pierce += m.pierce;
    if(m.thornsAdd) o.thornsAdd += m.thornsAdd;
    if(m.thornsMul) o.thornsMul *= m.thornsMul;
    if(m.speed) o.speed *= m.speed;
    if(m.flatDR) o.flatDR += m.flatDR;
    if(m.hitCap) o.hitCap = Math.max(o.hitCap, m.hitCap);
    if(m.healMul) o.healMul *= m.healMul;
    if(m.killHealMul) o.killHealMul *= m.killHealMul;
    if(m.petDmg) o.petDmg *= m.petDmg;
    if(m.turretLife) o.turretLife *= m.turretLife;
    if(m.turretRate) o.turretRate *= m.turretRate;
    if(m.elemDur) o.elemDur *= m.elemDur;
    if(m.regenMul) o.regenMul *= m.regenMul;
    if(m.dmgAdd) o.dmgAdd += m.dmgAdd;
  }
  return o;
}

/* 把进化补丁写进 relicStat 的结果里（在 relicStat 末尾调用） */
function applyEvoPatch(s){
  const E = evoBonus();
  s.dmg *= E.dmg;
  s.maxHp += E.maxHp;
  s.maxHpMul *= E.maxHpMul;
  s.armor += E.armor;
  s.crit += E.crit;
  s.critMul += E.critMul;
  s.multi += E.multi;
  s.pierce += E.pierce;
  if(E.thornsAdd) s.thorns = s.thorns * E.thornsMul + E.thornsAdd;
  s.speed *= E.speed;
  s.flatDR += E.flatDR;
  if(E.hitCap) s.hitCap = Math.max(s.hitCap, E.hitCap);
  s.healMul *= E.healMul;
  s.killHealMul *= E.killHealMul;
  s.petDmg *= E.petDmg;
  s.turretLife *= E.turretLife;
  s.turretRate *= E.turretRate;
  s.elemDur *= E.elemDur;
  s.regenMul *= E.regenMul;
  return s;
}

/* =========================================================
   进化表：64 件（公共 24 + 专属 40）
   k = 计数器，n = 目标，l = 卡面文字
   ========================================================= */
const EVO = {
  /* ---------- 公共 · 防御 8 ---------- */
  heartsteel: { k:'kill', n:200, l:'累计击杀 200 只',
    a:{ name:'厚壁', text:'每层 +2 最大生命（翻倍）', flag:'hs2' },
    b:{ name:'血涌', text:'每层额外 +0.3 反伤', mod:{ thornsAdd: 0.3 } } },
  steelheart: { k:'kill', n:400, l:'累计击杀 400 只',
    a:{ name:'再淬', text:'心之钢层数再 ×2', flag:'sh2' },
    b:{ name:'回响', text:'每层生命回复 +0.04%/秒', flag:'shregen' } },
  tankengine: { k:'kill', n:375, l:'累计击杀 375 只',
    a:{ name:'歌利亚', text:'每层 +4% 最大生命', flag:'te4' },
    b:{ name:'稳压', text:'不再因为被 BOSS 贴身掉层', flag:'tenolose' } },
  gargoyle: { k:'kill', n:100, l:'累计击杀 100 只',
    a:{ name:'石像', text:'每只贴身敌人改 +15 护甲', flag:'gar15' },
    b:{ name:'反击', text:'贴身敌人每秒受（护甲 × 1.5）伤害', flag:'garcounter' } },
  thornmail: { k:'thorn', n:200, l:'反伤累计 8000',
    a:{ name:'重刺', text:'反伤可以暴击', flag:'tmcrit' },
    b:{ name:'缠刺', text:'反伤附带冰缓', flag:'tmice' } },
  renewal: { k:'heal', n:200, l:'累计治疗 200',
    a:{ name:'回春', text:'改成每 4 秒回 1.5%', flag:'rnfast' },
    b:{ name:'丰饶', text:'改成每 5 秒回 2.2%', flag:'rnbig' } },
  ironwall:  { k:'armorHi', n:50, l:'护甲达到 50 点',
    a:{ name:'堡垒', text:'护甲 +30 点', mod:{ armor: 30 } },
    b:{ name:'轻装', text:'再 +12 点，移速 +6%', mod:{ armor: 12, speed: 1.06 } } },
  revenge: { k:'hurt', n:80, l:'累计受伤 80 次',
    a:{ name:'不屈', text:'每档护甲改 +8 点', flag:'rv2' },
    b:{ name:'背水', text:'生命 <30% 时伤害 +25%', flag:'rvback' } },

  /* ---------- 公共 · 控制 5 ---------- */
  frostring: { k:'elem', n:83, l:'元素命中累计 83 次',
    a:{ name:'深寒', text:'减速 -25%', flag:'fs25' },
    b:{ name:'冻土', text:'每秒 5% 概率眩晕 0.5 秒', flag:'fsstun' } },
  gravity: { k:'react', n:60, l:'触发反应 60 次',
    a:{ name:'奇点', text:'范围 +60%、拉得更远', flag:'gvbig' },
    b:{ name:'坍缩', text:'拉过来时造成（护甲 ×2）伤害', flag:'gvdmg' } },
  quake: { k:'knock', n:0, l:'击退 300 个敌人',
    a:{ name:'余震', text:'击退距离 +50%、冷却 2 秒', flag:'qkbig' },
    b:{ name:'撞墙', text:'被击退撞到人时双方都受伤', flag:'qkbump' } },
  voltpool: { k:'elem', n:100, l:'元素命中累计 100 次',
    a:{ name:'电网', text:'感电会传给附近 2 个', flag:'vpchain' },
    b:{ name:'过载', text:'感电目标受到伤害 +15%', flag:'vpvuln' } },
  icebind: { k:'elem', n:133, l:'元素命中累计 133 次',
    a:{ name:'长冻', text:'冰缓再 +1 秒', flag:'iblong' },
    b:{ name:'碎冰', text:'被冰缓的敌人死亡时炸开一圈', flag:'ibburst' } },

  /* ---------- 公共 · 成长 3 ---------- */
  furnace:   { k:'armorHi', n:60, l:'护甲达到 60 点',
    a:{ name:'熔甲', text:'每 10 点护甲 +0.7%', flag:'fn7' },
    b:{ name:'淬火', text:'每 10 点护甲 +1.2%，护甲 -20 点', flag:'fn12' } },
  harvest: { k:'gem', n:133, l:'拾取 133 颗宝石',
    a:{ name:'丰饶', text:'每次掉 2 颗', flag:'hv2' },
    b:{ name:'精选', text:'宝石经验 +30%', flag:'hvxp' } },
  ironstomach: { k:'heal', n:30, l:'吃 30 个血包',
    a:{ name:'消化', text:'每个血包 +5 最大生命', flag:'is5' },
    b:{ name:'储存', text:'血包回复量再 +50%', flag:'is50' } },

  /* ---------- 公共 · 转化 3 ---------- */
  bloodtax: { k:'hurt', n:100, l:'累计受伤 100 次',
    a:{ name:'重税', text:'转化率改 20%', flag:'bt20' },
    b:{ name:'减免', text:'转化时再 +1 护甲点（3 秒）', flag:'btarmor' } },

  /* ---------- 公共 · 功能 2 ---------- */
  magnetcore: { k:'gem', n:133, l:'拾取 133 颗宝石',
    a:{ name:'吸引', text:'拾取范围再 +150', mod:{ pickup: 150 } },
    b:{ name:'虹吸', text:'每 20 颗回血翻倍', flag:'mc2' } },
  quickboot: { k:'time', n:150, l:'存活 150 秒',
    a:{ name:'疾行', text:'移速改 +20%', flag:'qb20' },
    b:{ name:'踏风', text:'移动时每秒 +0.5 护甲点', flag:'qbarmor' } },

  /* ---------- 骑士 8 ---------- */
  ironheart: { k:'berserk', n:40, l:'狂战累计 90 秒',
    a:{ name:'厚壁', text:'每 80 生命 +0.3 秒', flag:'ih80' },
    b:{ name:'血涌', text:'每 100 生命 +5% 怒气', flag:'ih5' } },
  ragevent: { k:'detonate', n:25, l:'引爆 25 次',
    a:{ name:'双爆', text:'1.5 秒后再爆 70%', flag:'rvdbl' },
    b:{ name:'回流', text:'引爆返还 30 怒气', flag:'rvback' } },
  ragekettle: { k:'berserk', n:60, l:'狂战累计 60 秒',
    a:{ name:'长燃', text:'狂战时长 +3 秒', mod:{}, flag:'rk3' },
    b:{ name:'沸血', text:'狂战期间吸血 +2%', flag:'rkleech' } },
  bloodarmor:{ k:'hpHi', n:900, l:'最大生命达到 900',
    a:{ name:'重铠', text:'最大生命再 +25%', mod:{ maxHpMul: 1.25 } },
    b:{ name:'血刃', text:'真伤改 1.4% 最大生命', flag:'ba14' } },
  bloodpump: { k:'hurt', n:40, l:'累计受伤 40 次',
    a:{ name:'双泵', text:'转化率改 40%', flag:'bp40' },
    b:{ name:'逆流', text:'转化时回 15% 转化量', flag:'bpback' } },
  thorncrown: { k:'thorn', n:200, l:'反伤累计 6000',
    a:{ name:'王权', text:'暴击伤害 +60%', mod:{ critMul: 0.60 } },
    b:{ name:'冠冕', text:'反伤给目标挂 8% 易伤', flag:'tcmark' } },
  ironhide:  { k:'armorHi', n:60, l:'护甲达到 60 点',
    a:{ name:'厚骨', text:'护甲 +22 点', mod:{ armor: 22 } },
    b:{ name:'软骨', text:'不加甲，改为每次受伤 -1.5 秒冲刺冷却', flag:'ihsoft' } },
  warcry: { k:'hurt', n:40, l:'累计受伤 40 次',
    a:{ name:'长啸', text:'范围 +50%', flag:'wcbig' },
    b:{ name:'恐吓', text:'被击退的敌人 3 秒内伤害 -25%', flag:'wcfear' } },

  /* ---------- 游侠 8 ---------- */
  tachometer: { k:'react', n:0, l:'超载 25 次',
    a:{ name:'超频', text:'超载期间伤害 +25%', flag:'tc25' },
    b:{ name:'余压', text:'超载结束保留 40 充能', flag:'tc40' } },
  thousandblade: { k:'kill', n:150, l:'累计击杀 150 只',
    a:{ name:'刃雨', text:'暴击伤害 +50%（不再给弹道：箭袋本来就给）', mod:{ critMul: 0.50 } },
    b:{ name:'精准', text:'每条弹道暴击 +6%（与千刃叠加）', flag:'tb6' } },
  deadeye: { k:'kill', n:80, l:'累计击杀 80 只',
    a:{ name:'鹰击', text:'暴击伤害 +40%', mod:{ critMul: 0.40 } },
    b:{ name:'鹰视', text:'暴击无视 30% 护甲', flag:'de30' } },
  piercepin: { k:'kill', n:80, l:'累计击杀 80 只',
    a:{ name:'穿心', text:'穿透 +2', mod:{ pierce: 2 } },
    b:{ name:'连锁', text:'穿透不衰减', flag:'ppfull' } },
  dashboot: { k:'time', n:200, l:'存活 200 秒',
    a:{ name:'疾影', text:'冲刺再 +1 段', mod:{}, flag:'db2' },
    b:{ name:'残影', text:'冲刺路径 1 秒内造成伤害', flag:'dbtrail' } },
  breakwind: { k:'kill', n:80, l:'累计击杀 80 只',
    a:{ name:'破阵', text:'撞击范围 +50%', flag:'bwbig' },
    b:{ name:'贯穿', text:'撞击同时穿透 +2', mod:{ pierce: 2 } } },
  phasecloak: { k:'hurt', n:60, l:'累计受伤 60 次',
    a:{ name:'相位', text:'闪避后免疫 0.6 秒', flag:'pcimm' },
    b:{ name:'折射', text:'闪避时对周围放电', flag:'pczap' } },
  quiver: { k:'kill', n:80, l:'累计击杀 80 只',
    a:{ name:'满弦', text:'再 +1 弹道', mod:{ multi: 1 } },
    b:{ name:'轻羽', text:'取消单发 -8% 的惩罚', flag:'qvfree' } },

  /* ---------- 工程师 8 ---------- */
  mainframe: { k:'time', n:120, l:'存活 120 秒',
    a:{ name:'联控', text:'每座炮台冷却 -14%', flag:'mf14' },
    b:{ name:'自毁', text:'炮台到期爆炸范围 +60%', flag:'mfboom' } },
  shdbattery: { k:'shield', n:200, l:'护盾累计吸收 8000',
    a:{ name:'永动', text:'护盾自然回充', flag:'sbauto' },
    b:{ name:'过载', text:'有护盾时伤害 +40%', flag:'sb40' } },
  syncer: { k:'time', n:180, l:'存活 180 秒',
    a:{ name:'并联', text:'每座炮台 -6% 全武器冷却', flag:'sy6' },
    b:{ name:'解耦', text:'取消移速惩罚', flag:'syfree' } },
  reflector: { k:'hurt', n:40, l:'累计受伤 40 次',
    a:{ name:'镜面', text:'护盾期减伤改 30%', flag:'rf30' },
    b:{ name:'荆棘', text:'护盾期间反伤 +60%', mod:{ thornsMul: 1.6 } } },
  shdbreak: { k:'shield', n:200, l:'护盾累计吸收 4000',
    a:{ name:'碎星', text:'破盾爆发范围 +50%', flag:'sbbig' },
    b:{ name:'余震', text:'破盾后护盾恢复 +100%', flag:'sbback' } },
  firegrid: { k:'kill', n:100, l:'累计击杀 100 只',
    a:{ name:'密网', text:'标记期间炮台伤害 +40%', flag:'fg40' },
    b:{ name:'共享', text:'标记也让你 +15%', flag:'fgself' } },
  thunderlord: { k:'elem', n:133, l:'感电累计 800 次',
    a:{ name:'雷池', text:'感电跳数 +2', flag:'tl2' },
    b:{ name:'引雷', text:'感电死亡炸电环', flag:'tlring' } },
  repairarm: { k:'time', n:150, l:'存活 150 秒',
    a:{ name:'快修', text:'炮台寿命再 +80%', mod:{ turretLife: 1.8 } },
    b:{ name:'回收', text:'炮台到期返还 50% 冷却', flag:'rarecycle' } },

  /* ---------- 饲养员 8 ---------- */
  beastheart: { k:'petkill', n:67, l:'宠物击杀 400 只',
    a:{ name:'同心', text:'每只宠物 +7% 伤害', flag:'bh7' },
    b:{ name:'独狼', text:'只留 1 只，但这只伤害 ×3', flag:'bhlone' } },
  sacpact: { k:'petkill', n:200, l:'宠物击杀 200 只',
    a:{ name:'血祭', text:'爆炸范围 +60%', flag:'spbig' },
    b:{ name:'轮回', text:'死亡后立刻在怪堆重生', flag:'spback' } },
  broodnest: { k:'time', n:120, l:'存活 120 秒',
    a:{ name:'巢穴', text:'每种宠物上限再 +1', flag:'bn2' },
    b:{ name:'精简', text:'宠物伤害 +20%', mod:{ petDmg: 1.20 } } },
  beastmatk: { k:'elem', n:40, l:'宠物触发反应 200 次',
    a:{ name:'元素兽', text:'宠物同时带两种元素', flag:'bm2' },
    b:{ name:'纯化', text:'只带一种，但反应 +60%', flag:'bm60' } },
  fangbeast: { k:'petkill', n:83, l:'宠物击杀 500 只',
    a:{ name:'裂齿', text:'宠物无视 30% 护甲', flag:'fb30' },
    b:{ name:'尖牙', text:'宠物伤害再 +40%', mod:{ petDmg: 1.40 } } },
  behemoth: { k:'petkill', n:50, l:'宠物击杀 300 只',
    a:{ name:'泰坦', text:'巨兽生命 ×4、伤害 +70%', flag:'bh4' },
    b:{ name:'兽王', text:'巨兽攻击范围 +80%', flag:'bhwide' } },
  splitnest: { k:'petkill', n:40, l:'宠物死亡 60 次',
    a:{ name:'远巢', text:'重生距离 +100', flag:'snfar' },
    b:{ name:'近巢', text:'重生在你身边且冷却 -50%', flag:'snnear' } },

  /* ---------- 厨师 8 ---------- */
  molecular: { k:'react', n:50, l:'触发反应 300 次',
    a:{ name:'分子', text:'元素残留 2 秒', flag:'mo2' },
    b:{ name:'爆炒', text:'反应伤害 +60%', flag:'mo60' } },
  pressurepot: { k:'react', n:100, l:'触发反应 100 次',
    a:{ name:'压力', text:'爆炸范围 +40%', flag:'ppbig' },
    b:{ name:'泄压', text:'爆炸额外挂毒', flag:'ppvenom' } },
  hotoil: { k:'react', n:200, l:'触发反应 200 次',
    a:{ name:'沸油', text:'燃烧伤害 +45%', flag:'ho45' },
    b:{ name:'泼油', text:'传染半径 +50%', flag:'hospread' } },
  charcoalspat: { k:'kill', n:400, l:'累计击杀 400 只',
    a:{ name:'炭化', text:'烧死回复改 2.5%', flag:'cs25' },
    b:{ name:'余温', text:'留下火 3 秒', flag:'csfire' } },
  freezer: { k:'elem', n:133, l:'冰缓累计 800 次',
    a:{ name:'深冻', text:'冰缓变眩晕 0.6 秒', flag:'fzstun' },
    b:{ name:'寒气', text:'冰缓目标受伤 +15%', flag:'fzvuln' } },
  flashfreeze: { k:'react', n:150, l:'触发反应 150 次',
    a:{ name:'广域', text:'范围改 160', flag:'ffwide' },
    b:{ name:'急速', text:'冷却改 5 秒', flag:'fffast' } },
  spicerack: { k:'react', n:40, l:'触发反应 200 次',
    a:{ name:'浓郁', text:'元素持续再 +50%', mod:{ elemDur: 1.5 } },
    b:{ name:'调味', text:'反应回血 0.9%', flag:'spice9' } },
  stockpot: { k:'heal', n:200, l:'累计治疗 200',
    a:{ name:'浓汤', text:'治疗 +70%', mod:{ healMul: 1.7 } },
    b:{ name:'分食', text:'宠物与炮台也吃一半', flag:'stshare' } }
};

/* =========================================================
   共鸣（双重祝福）：两件指定遗物同时持有 → 解锁一条被动
   ---------------------------------------------------------
   这是把"搭配"从数值相加变成"发现"的关键。
   检测每帧一次（结果缓存 0.25 秒），不做每帧全表扫描。
   ========================================================= */
const RESONANCE = {
  steelragon: { a:'heartsteel', b:'stackragon', name:'钢龙', col:'#ff5f7e',
    desc:'心之钢每层 +2 最大生命（叠角龙与厚壁叠加时再翻）' },
  steeleengine:{ a:'steelheart', b:'tankengine', name:'钢引擎', col:'#ffb056',
    desc:'坦克引擎的百分比同时作用于心之钢给的固定生命' },
  thorncity:  { a:'thornmail', b:'gargoyle', name:'刺城', col:'#ffb0c4',
    desc:'被 3 只以上围住时，反伤 ×2' },
  rageburst2: { a:'bloodpump', b:'ragevent', name:'怒爆', col:'#ff5a3d',
    desc:'挨打攒的怒气直接计入引爆伤害（每 100 怒气 +12% 引爆伤害）' },
  bladeeye:   { a:'thousandblade', b:'deadeye', name:'刃眼', col:'#ffd166',
    desc:'每条弹道给暴击率 +4%（与千刃叠加）' },
  perpetual:  { a:'tachometer', b:'chgcore', name:'永动', col:'#7ce3ff',
    desc:'超载期间击杀立刻再充能 30' },
  shieldwall: { a:'mainframe', b:'shdbattery', name:'盾阵', col:'#9fe8ff',
    desc:'每座炮台给你 +5 点护盾上限' },
  kingofbeast:{ a:'beastheart', b:'behemoth', name:'兽王', col:'#8ee6b3',
    desc:'巨兽也吃"每只宠物 +5% 伤害"' },
  doublepot:  { a:'molecular', b:'pressurepot', name:'爆锅', col:'#ff8a3d',
    desc:'一次爆炸同时触发两种反应' },
  ironwall2:  { a:'carapace', b:'ironlaw', name:'铁壁', col:'#c9d4e2',
    desc:'硬壳的固定减伤在护甲之后结算（等于双重减伤）' }
};

function resonanceList(){
  const out = [];
  if(!P || !P.relics) return out;
  for(const id in RESONANCE){
    const r = RESONANCE[id];
    if(P.relics[r.a] && P.relics[r.b]) out.push(id);
  }
  return out;
}
function hasRes(id){
  if(!P) return false;
  if(!P.resCache || state.time - (P.resT || -9) > 0.25){
    P.resCache = {};
    const l = resonanceList();
    for(let i = 0; i < l.length; i++) P.resCache[l[i]] = 1;
    P.resT = state.time;
  }
  return !!P.resCache[id];
}


/* =========================================================
   五类角标
   ---------------------------------------------------------
   现在 219 件遗物平级，所以三选一看起来总是"三张差不多的卡"。
   角标不改变任何数值，只让玩家一眼看出"这次是在哪个维度上做取舍"。
   判定顺序：显式表 → 标签兜底 → 功能。
   ========================================================= */
const CAT_MARK = {
  def:  { mark:'🛡', name:'防御', col:'#9fb4c9' },
  ctrl: { mark:'◈', name:'控制', col:'#8fe8ff' },
  grow: { mark:'▲', name:'成长', col:'#a6e05a' },
  conv: { mark:'⇄', name:'转化', col:'#ffb056' },
  util: { mark:'✦', name:'功能', col:'#c39bff' }
};
const CAT_OVERRIDE = {
  /* 转化：把"已经发生的某件事"换成另一种资源 */
  conv: ['furnace', 'bloodtax', 'broth', 'ironheart', 'bloodpump',
         'overflow', 'ragevent', 'bloodpump', 'sacrifice', 'hunger'],
  /* 成长：靠行为累积，越打越强 */
  grow: ['heartsteel', 'steelheart', 'tankengine', 'stackragon',
         'harvest', 'ironstomach',
         'bloodarmor', 'fleshmass', 'growseed', 'growgreed',
         'growdevour', 'devourfang'],
  /* 控制：这个游戏真的有的四种（冰缓 / 眩晕 / 击退 / 减速） */
  ctrl: ['frostring', 'gravity', 'quake', 'voltpool', 'icebind', 'warcry',
         'flashfreeze', 'freezer', 'frostblade', 'thunderlord', 'shdbreak'],
  /* 防御：护甲 / 生命 / 护盾 / 闪避 / 反伤 */
  def: ['gargoyle', 'thornmail', 'renewal', 'revenge', 'carapace', 'ironlaw',
        'lastlight', 'repel', 'astral', 'shdaegis', 'shdbarrier', 'shdbattery',
        'reflector', 'ironwall', 'anvil',
        'bloodarmor']
};
let _catCache = null;
function relicCat(id){
  if(!_catCache){
    _catCache = {};
    for(const k in CAT_OVERRIDE) for(const v of CAT_OVERRIDE[k]) _catCache[v] = k;
  }
  if(_catCache[id]) return _catCache[id];
  const r = (typeof RELICS !== 'undefined' && RELICS[id]) ? RELICS[id] : null;
  const t = (r && r.tags) || [];
  const has = x => t.indexOf(x) >= 0;
  if(has('control') || has('knock')) return 'ctrl';
  if(has('tank') || has('shield') || has('thorns') || has('dodge')) return 'def';
  if(has('growth') || has('flesh')) return 'grow';
  return 'util';
}
function relicCatOf(id){
  const k = relicCat(id);
  return CAT_MARK[k] || CAT_MARK.util;
}
