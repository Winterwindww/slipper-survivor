/* =========================================================
   4. 遗物
   ---------------------------------------------------------
   遗物才是"改变规则"的东西：它们不直接加成数值，而是监听事件，
   在别人打完之后再插一脚。所以「暴击→雷→击杀→爆炸→再暴击」
   这种链条是自然长出来的，不是写死的配方。
   ========================================================= */

/* ---------------- 4.1 数值结晶（保底强化，卡池填充） ---------------- */
const PASSIVES = {
  heart:  { name:'生命结晶', color:'#ff8fb0', icon:'heart',  max:4, desc:()=>'最大生命 +35，并立刻回复 35 点' },
  glove:  { name:'力量结晶', color:'#ffa8c8', icon:'glove',  max:4, desc:()=>'全部伤害 +11%' },
  sauce:  { name:'急速结晶', color:'#ff6b4a', icon:'sauce',  max:3, desc:()=>'全部武器冷却 -9%' },
  multi:  { name:'分裂结晶', color:'#c9b0ff', icon:'multi',  max:2, desc:()=>'每种武器投射物 +1' },
  pierce: { own:'ranger', name:'穿透结晶', color:'#9fe0ff', icon:'pierce', max:2, desc:()=>'投射物穿透 +1' },
  lens:   { name:'范围结晶', color:'#7cc7ff', icon:'lens',   max:3, desc:()=>'攻击范围 +13%' },
  reach:  { name:'射程结晶', color:'#a6ffcb', icon:'reach',  max:3, desc:()=>'所有武器射程 +14%' },
  blast:  { name:'爆裂结晶', color:'#ff9d4d', icon:'aura',   max:3, desc:()=>'爆炸 / 光环范围 +13%' },
  shoe:   { name:'疾风结晶', color:'#8ee06e', icon:'shoe',   max:3, desc:()=>'移动速度 +9%' },
  /* 【4.1】冲刺也有自己的结晶：它是唯一能"逐级变强"的位移资源，
     和遗物（一次到位）互补 —— 遗物决定方向，结晶决定厚度。 */
  dashgem:{ name:'踏风结晶', color:'#7ce3ff', icon:'gear',   max:3, desc:(l)=>'冲刺回复 -8% / 级' },
  magnet: { name:'磁力结晶', color:'#c39bff', icon:'magnet', max:4, desc:()=>'经验拾取范围 +40' },
  clover: { name:'幸运结晶', color:'#6fdc8c', icon:'clover', max:3, desc:()=>'经验获取 +16%' },
  vamp:   { name:'吸血结晶', color:'#ff6b8f', icon:'vamp',   max:3, desc:()=>'每杀 1 只额外回复 0.02% 最大生命 / 级' },
  regen:  { name:'愈合结晶', color:'#7ef0c0', icon:'heart',  max:2, desc:()=>'每 5 秒回复 1.2% 最大生命 / 级' },
  crit:   { name:'暴击星糖', color:'#ffd166', icon:'star',   max:4, desc:()=>'暴击率 +7%' },
  critdmg:{ name:'爆伤印章', color:'#ff8f6b', icon:'star',   max:3, desc:()=>'暴击伤害 +26%' },
  dodge:  { name:'闪避软糖', color:'#a6ffcb', icon:'shoe',   max:3, desc:()=>'闪避率 +7%（上限 30%）' },
  plate:  { name:'铁皮罐头', color:'#9fb4c9', icon:'mine',   max:3, desc:()=>'减伤 +4%' },
  bossmul:{ name:'猎王徽章', color:'#c7a2ff', icon:'star',   max:3, desc:()=>'对 Boss / 精英伤害 +11%' },

  /* ===== 流派专属结晶：只在你真的走这条流派时才会出现 ===== */
  combogem: { name:'连击刻印', color:'#e6eefc', icon:'pan',   max:3, school:'melee',
              desc:(l)=>'近战连击上限 +3，每层额外 +2% 近战伤害' },
  breakpin: { own:'ranger', name:'破甲锥',   color:'#9fe0ff', icon:'pierce',max:3, school:'pierce',
              desc:(l)=>'破甲上限 +2 层，每层效果 +3%' },
  gridchip: { own:'engineer', name:'火力网格', color:'#ffe066', icon:'totem', max:3, school:'fort',
              desc:(l)=>'炮台标记时长 +1 秒，打标记目标再加 +10%' },
  packhorn: { name:'兽群号角', color:'#8ee6b3', icon:'vamp',  max:3, school:'beast',
              desc:(l)=>'宠物伤害 +15%；2 级起宠物上限 +1' },
  corebomb: { name:'引爆核心', color:'#ff9d4d', icon:'mine',  max:3,
              desc:(l)=>'爆炸半径 +15%，连锁引爆概率 +10%' },
  magchip:  { name:'弹幕弹匣', color:'#ffc46b', icon:'multi', max:3,
              desc:(l)=>'「压制」所需命中次数 -2' },
  whetstone:{ name:'锐气磨石', color:'#ffd166', icon:'star',  max:3,
              desc:(l)=>'锐气上限 +3 层' },
  guardring:{ name:'环绕护盾', color:'#9fe8ff', icon:'aura',  max:3,
              desc:(l)=>'环绕格挡间隔 -0.1 秒' },

  /* ===== 通用结晶补充：给"没有专属流派"的构筑也有零件可捡 ===== */
  thorn:    { name:'荆棘结晶', color:'#ffb0c4', icon:'mine',  max:4,
              desc:(l)=>'反伤 +14 / 级（跟随最大生命与护甲成长）' },
  shell:    { name:'甲壳结晶', color:'#9fb4c9', icon:'mine',  max:4,
              desc:(l)=>'减伤 +3% / 级' },
  razor:    { name:'锋刃结晶', color:'#ffd166', icon:'star',  max:3,
              desc:(l)=>'暴击伤害 +20% / 级' },
  swerve:   { name:'疾影结晶', color:'#a6ffcb', icon:'shoe',  max:3,
              desc:(l)=>'闪避率 +5% / 级（上限 30%）' },

  /* ===== 3.0 五条新流派的专属结晶 ===== */
  ragegem:  { name:'怒意结晶', own:'knight', color:'#ff7a4d', icon:'rage',  max:3, arch:'rage', tags:['rage'],
              desc:(l)=>'怒气获取 +15% / 级' },
  fleshgem: { name:'血肉结晶', color:'#ff5f7e', icon:'flesh', max:4, arch:'flesh', tags:['flesh'],
              desc:(l)=>'最大生命 +40，攻击附加 0.4%/级 最大生命的真实伤害' },
  chargegem:{ name:'充能结晶', own:'ranger', color:'#7ce3ff', icon:'gear',  max:3, arch:'charge', tags:['charge'],
              desc:(l)=>'充能速度 +15% / 级' },
  shieldgem:{ name:'护盾结晶', own:'engineer', color:'#9fe8ff', icon:'shield',max:3, arch:'shield', tags:['shield'],
              desc:(l)=>'护盾上限 +35 / 级，脱战 3 秒后自动回充' },
  beastgem: { name:'兽群结晶', own:'keeper', color:'#8ee6b3', icon:'pet',   max:3, arch:'beast', tags:['pet','beast'],
              desc:(l)=>'宠物伤害 +12% / 级' },
  elemgem:  { name:'元素结晶', own:'chef', color:'#ff8a3d', icon:'flamer',max:3, arch:'elem', tags:['elem'],
              desc:(l)=>'元素持续时间 +12% / 级，反应伤害 +6% / 级' },
  luckgem:  { name:'幸运结晶', color:'#ffe066', icon:'dice', max:3, tags:['crit','lucky'],
              desc:(l)=>'暴击率 +3% / 级，暴击伤害 +8% / 级（公用）' }
};

/* ---------------- 4.2 遗物表 ---------------- */
const RELICS = {
  /* ===== 4.2 扩充：补"手感缺口"，不是补数字 =====
     上一版的问题不是数量少，而是**同质**：一堆"某属性 +X%"。
     这一批优先补玩家真正会去做的动作：
       走位（移速 / 冷却）· 换弹道（多重）· 打元素（单系强化）
       · 堆防御（护甲 / 护盾）· 召唤（宠物 / 炮台）· 经济（拾取 / 经验）
     每件只做一件事，描述一行说得完。 */
  whetstone:  { name:'磨刀石', rar:'common', tags:['crit'], color:'#ffd166', icon:'cleaver',
                desc:'暴击率 +6%' },
  counterweight:{ name:'秤砣', rar:'common', tags:['blast'], color:'#ff9d4d', icon:'aura',
                desc:'爆炸范围 +15%' },
  springshoe: { name:'弹簧鞋', rar:'common', tags:['move'], color:'#8ee06e', icon:'shoe',
                desc:'移动速度 +8%' },
  lodestone:  { name:'磁石芯', rar:'common', tags:['util'], color:'#c39bff', icon:'magnet',
                desc:'拾取范围 +60' },
  coldpack:   { name:'冰袋', rar:'common', tags:['ice'], color:'#8fe8ff', icon:'frost',
                desc:'冰霜伤害 +25%' },
  pepperjar:  { name:'辣椒罐', rar:'common', tags:['fire'], color:'#ff6b4d', icon:'flamer',
                desc:'燃烧伤害 +25%' },
  copperwire: { name:'铜线', rar:'common', tags:['volt'], color:'#ffe066', icon:'coil',
                desc:'元素反应伤害 +20%' },
  venomgland: { name:'毒囊', rar:'common', tags:['venom'], color:'#a6e05a', icon:'vial',
                desc:'元素持续时间 +25%' },
  anvil:      { name:'铁砧', rar:'rare', tags:['tank'], color:'#9fb4c9', icon:'mine',
                desc:'护甲 +14 点，移速 -6%' },
  luckydie:   { name:'幸运骰', rar:'rare', tags:['lucky'], color:'#6fdc8c', icon:'dice',
                desc:'暴击率 +5%，暴击伤害 +30%' },
  stopwatch:  { name:'老式表', rar:'rare', tags:['util'], color:'#7ce3ff', icon:'gear',
                desc:'全部武器冷却 -8%' },
  powderkeg:  { name:'火药桶', rar:'rare', tags:['blast'], color:'#ff9d4d', icon:'missile',
                desc:'爆炸伤害 +20%，范围 +10%' },
  fangbeast:  { name:'兽牙', rar:'rare', tags:['pet'], color:'#8ee6b3', icon:'pet',
                desc:'宠物伤害 +25%' },
  deepocket:  { name:'深口袋', rar:'rare', tags:['util'], color:'#c9b0ff', icon:'gem',
                desc:'武器槽 +1' },
  bloodsac:   { name:'血囊', rar:'rare', tags:['heal'], color:'#ff6b8f', icon:'heart',
                desc:'击杀回血 +80%' },
  magazine:   { name:'弹匣', rar:'rare', tags:['barrage'], color:'#9fe0ff', icon:'multi',
                desc:'弹道 +1，全部武器冷却 +6%（代价）' },
  platewall:  { name:'加固板', rar:'epic', tags:['tank'], color:'#9fb4c9', icon:'shield',
                desc:'护甲 +24 点' },
  huntereye:  { name:'猎手之眼', rar:'epic', tags:['crit'], color:'#ffd166', icon:'star',
                desc:'暴击伤害 +45%' },

  /* ===== 普通：小机制，凑数量也是拼图 ===== */
  ember:      { name:'余烬', rar:'common', tags:['fire'], color:'#ff8a3d', icon:'aura',
                desc:'被点燃的敌人死亡时，原地炸开一小片火焰' },
  sparkplug:  { name:'火花塞', rar:'common', tags:['crit','volt'], color:'#ffe066', icon:'bolt',
                desc:'暴击时 30% 概率对周围放电，附带感电' },
  fang:       { name:'血牙', rar:'common', tags:['heal'], color:'#ff6b8f', icon:'vamp',
                desc:'击杀回血翻倍（基础每杀 0.05%，所有来源合计每秒最多 2%）' },
  luckycoin:  { name:'幸运币', rar:'common', tags:['lucky'], color:'#6fdc8c', icon:'clover',
                desc:'暴击率 +3%，幸运 +25%（影响随机强化）' },
  steadypan:  { name:'铁锅护心', rar:'common', tags:['tank'], color:'#9fb4c9', icon:'pan',
                desc:'减伤 +6%' },
  quickboot:  { name:'快步鞋', rar:'common', tags:['move'], color:'#8ee06e', icon:'shoe',
                desc:'移动速度 +12%' },
  piercepin:  { own:'ranger', name:'穿甲钉', rar:'common', tags:['pierce'], color:'#9fe0ff', icon:'pierce',
                desc:'所有投射物穿透 +1' },
  twinbarrel: { name:'双管', rar:'common', tags:['multi'], color:'#c9b0ff', icon:'multi',
                desc:'所有武器弹道 +1' },
  coldtouch:  { name:'霜之触', rar:'common', tags:['ice'], color:'#8fe8ff', icon:'frost',
                desc:'命中时 12% 概率冰缓敌人' },
  venomgland: { name:'毒腺', rar:'common', tags:['venom'], color:'#a6e05a', icon:'vial',
                desc:'命中时 12% 概率使敌人中毒' },
  longfuse:   { name:'长引信', rar:'common', tags:['blast'], color:'#ff9d4d', icon:'aura',
                desc:'爆炸范围 +20%' },
  magnetstone:{ name:'磁石', rar:'common', tags:['util'], color:'#c39bff', icon:'magnet',
                desc:'经验拾取范围 +60' },
  xplens:     { name:'经验透镜', rar:'common', tags:['util'], color:'#7cc7ff', icon:'lens',
                desc:'经验获取 +20%' },
  thickskin:  { name:'厚皮', rar:'common', tags:['tank'], color:'#ff8fb0', icon:'heart',
                desc:'最大生命 +35' },

  /* ===== 稀有：改变一条链路 ===== */
  chaincrit:  { own:'engineer', name:'连锁闪电', rar:'rare', tags:['crit','volt'], color:'#8fd8ff', icon:'chain',
                desc:'暴击时 55% 概率放一道链电，在敌人之间跳 3 次，附带感电' },
  emberkill:  { name:'燃爆', rar:'rare', tags:['fire','blast'], color:'#ff6b4b', icon:'aura',
                desc:'燃烧中的敌人死亡时爆炸，范围与伤害都更大' },
  turretcrit: { own:'engineer', name:'炮台校准', rar:'rare', tags:['turret','crit'], color:'#ffe066', icon:'turret',
                desc:'炮台 / 图腾完整继承你的暴击率与暴击伤害' },
  petelem:    { name:'兽性元素', rar:'rare', tags:['pet','elem'], color:'#8ee6b3', icon:'pet',
                desc:'宠物攻击必定附加你最近一次使用的元素' },
  meltsurge:  { name:'融化冲击', rar:'rare', tags:['elem'], color:'#ffcf7a', icon:'flamer',
                desc:'元素反应伤害 +50%' },
  killshot:   { name:'击杀弹幕', rar:'rare', tags:['proj'], color:'#ffc46b', icon:'slipper',
                desc:'击杀时 25% 概率朝随机方向打出一发弹片' },
  dodgeprism: { name:'闪避棱镜', rar:'rare', tags:['crit','dodge'], color:'#a6ffcb', icon:'star',
                desc:'闪避成功后，下一次攻击必定暴击' },
  bloodrage:  { name:'血怒', rar:'rare', tags:['rage'], color:'#ff8a5c', icon:'star',
                desc:'生命低于 40% 时，冷却 -29%、伤害 +20%' },
  thornsplate:{ name:'尖刺甲', rar:'rare', tags:['tank'], color:'#ffb0c4', icon:'mine',
                desc:'挨打时反弹周围敌人；反伤随最大生命与护甲一起成长' },
  killchain:  { name:'猎杀连锁', rar:'rare', tags:['aoe'], color:'#ff9dc0', icon:'bolt',
                desc:'每击杀 12 个敌人，释放一次全屏冲击波' },
  ricochet:   { name:'跳弹', rar:'rare', tags:['proj','bounce'], color:'#b6f0ff', icon:'candy',
                desc:'投射物命中后 35% 概率弹向新目标' },
  frostbite:  { name:'霜噬', rar:'rare', tags:['ice'], color:'#8fe8ff', icon:'frost',
                desc:'被冰缓 / 冻结的敌人，受到的所有伤害 +25%' },
  voltcoil:   { own:'engineer', name:'感应线圈', rar:'rare', tags:['volt'], color:'#ffe066', icon:'bolt',
                desc:'感电中的敌人死亡时释放电环' },
  scavenger:  { name:'拾荒者', rar:'rare', tags:['util'], color:'#6fdc8c', icon:'gem',
                desc:'每拾取 18 颗宝石，在原地爆开一圈' },
  burstcore:  { name:'爆裂核心', rar:'rare', tags:['blast'], color:'#ff9d4d', icon:'aura',
                desc:'爆炸有 30% 概率再炸一次（不递归触发）' },
  packleader: { name:'小队长', rar:'rare', tags:['pet'], color:'#8ee6b3', icon:'pet',
                desc:'宠物上限 +2，宠物伤害 +35%' },

  /* ===== 史诗：直接定义 build ===== */
  singularity:{ name:'奇点', rar:'epic', tags:['elem','cc'], color:'#b98cff', icon:'hole',
                desc:'元素反应会留下 2 秒的吸引场，把周围敌人拽进来' },
  echoheart:  { name:'回响之心', rar:'epic', tags:['echo'], color:'#9fe0ff', icon:'aura',
                desc:'每次开火有 10% 概率让所有武器立刻再齐射一轮' },
  soulharvest:{ name:'灵魂收割', rar:'epic', tags:['summon'], color:'#c7a2ff', icon:'pet',
                desc:'击杀有 8% 概率召唤一只临时宠物，持续 10 秒（1.2 秒冷却，场上最多 10 只）' },
  statuesmash:{ name:'石像碎裂', rar:'epic', tags:['proj'], color:'#c9d4e2', icon:'pan',
                desc:'敌人死亡时 15% 概率碎成 3 枚弹片' },
  overclock:  { own:'engineer', name:'超频核心', rar:'epic', tags:['turret'], color:'#ffe066', icon:'turret',
                desc:'炮台 / 图腾冷却 -33%，但存在时间 -30%' },
  elementalist:{ name:'元素使', rar:'epic', tags:['elem'], color:'#ff8a3d', icon:'flamer',
                desc:'元素持续时间 +50%，元素反应的连锁冷却近乎取消' },
  lonestsoul:{ name:'孤注之魂', rar:'epic', tags:['crit'], color:'#ff9dc0', icon:'dice',
                desc:'暴击伤害 +80%，暴击率 -10%' },
  thunderlord:{ own:'engineer', name:'雷神', rar:'epic', tags:['volt'], color:'#ffd166', icon:'bolt',
                desc:'处于感电的敌人之间会持续互相放电' },
  frostheart: { name:'冰霜之心', rar:'epic', tags:['ice'], color:'#8fe8ff', icon:'frost',
                desc:'被冰缓的敌人死亡时炸出 4 枚冰锥' },

  /* ===== 非元素路线：暴击 / 闪避 / 护甲 / 击杀溢出 =====
     元素件已经够多了，这里补的是"看不出来但用起来有反应"的东西。 */
  executioner:{ name:'处刑者', rar:'rare', tags:['crit'], color:'#ffd166', icon:'star',
                desc:'对生命低于 25% 的敌人必定暴击' },
  phasecloak:{ name:'相位斗篷', rar:'rare', tags:['dodge'], color:'#a6ffcb', icon:'shoe',
                desc:'闪避成功后 1.2 秒内冷却 −45%' },
  ironwall:  { name:'铁壁', rar:'rare', tags:['tank'], color:'#9fb4c9', icon:'mine',
                desc:'护甲 +18 点' },
  /* ---- 4.1：冲刺的配套件 ----
     4.0 的冲刺只是一个"位移 + 无敌"，没有养成空间。
     4.1 把它拆成四件各管一件事的遗物：段数 / 撞人 / 顺势 / 回复。
     拿齐之后冲刺从"逃命键"变成一套真正的进攻位移。 */
  dashboot:  { name:'疾影靴', rar:'common', tags:['move'], color:'#7ce3ff', icon:'shoe',
                desc:'冲刺 +1 段充能' },
  breakwind: { name:'破风', rar:'rare', tags:['move', 'melee'], color:'#9fe8ff', icon:'boomerang',
                desc:'冲刺途中撞到的敌人受到伤害（可叠 2 层，伤害 +55%/层）' },
  afterflow: { name:'余势', rar:'common', tags:['move'], color:'#ffd166', icon:'reach',
                desc:'冲刺后的「顺势」延长 0.8 秒，期间伤害加成 +12%' },
  quickstep: { name:'速充', rar:'common', tags:['move'], color:'#a6ffcb', icon:'gear',
                desc:'冲刺回复速度 +35%' },
  overkill:  { name:'溢出斩', rar:'epic', tags:['blast'], color:'#ff9d4d', icon:'mine',
                desc:'击杀时把这一击 40% 的伤害溅到周围' },
  moonstep:  { name:'月步', rar:'common', tags:['move','dodge'], color:'#a6ffcb', icon:'shoe',
                desc:'移速 +10%，闪避 +5%' },
  harden:    { name:'硬化壳', rar:'common', tags:['tank'], color:'#9fb4c9', icon:'mine',
                desc:'减伤 +6%，最大生命 +30' },

  /* ===== 反伤流派的核心件：把"挨打"做成一条真正的构筑，而不是一件孤零零的遗物 ===== */
  thornheart: { name:'荆棘之心', rar:'epic', tags:['tank'], color:'#ffb0c4', icon:'heart',
                desc:'反伤 +45%，且反伤可以暴击' },
  ironvine:   { name:'铁藤甲', rar:'rare', tags:['tank'], color:'#9fb4c9', icon:'mine',
                desc:'减伤 +10%，反伤 +50%' },
  bloodarmor: { name:'血铠', rar:'rare', tags:['tank','heal'], color:'#ff6b8f', icon:'heart',
                desc:'最大生命 +70，反伤额外 +1% 最大生命' },

  /* ===== 各流派"再来一件"：让非元素路线也有本命遗物 ===== */
  razorwind:  { own:'ranger', name:'锐风之翼', rar:'rare', tags:['proj'], color:'#9fe0ff', icon:'pierce',
                desc:'弹道 +1，穿透 +1' },
  bulwark:    { name:'壁垒核心', rar:'rare', tags:['turret'], color:'#ffe066', icon:'turret',
                desc:'炮台上限 +1' },
  packalpha:  { name:'头狼', rar:'rare', tags:['summon'], color:'#8ee6b3', icon:'pet',
                desc:'宠物上限 +2' },
  focusprism: { name:'聚焦棱镜', rar:'rare', tags:['crit'], color:'#ffd166', icon:'star',
                desc:'暴击率 +8%，暴击伤害 +25%' },

  /* ===== 诅咒：给你更强的，也拿走一些 ===== */
  sacrifice:  { name:'献祭', rar:'curse', tags:['curse'], color:'#ff6b6b', icon:'star',
                desc:'武器槽 -1，但全伤害 +70%' },
  glassheart: { name:'玻璃心', rar:'curse', tags:['curse','crit'], color:'#ff8fb0', icon:'heart',
                desc:'最大生命 -50%，暴击伤害 +150%' },
  greedpact:  { name:'贪婪契约', rar:'curse', tags:['curse','util'], color:'#6fdc8c', icon:'clover',
                desc:'敌人移速 +20%，但经验 +60%' },
  bloodoath:  { name:'血誓', rar:'curse', tags:['curse'], color:'#ff5f7e', icon:'vamp',
                desc:'失去自然回血；伤害 +45%，击杀回血 ×2.4' },
  heavycurse: { name:'沉重诅咒', rar:'curse', tags:['curse','tank'], color:'#9fb4c9', icon:'shoe',
                desc:'移速 -20%，但减伤 +25%、范围 +30%' },
  chaosdice:  { name:'混沌骰', rar:'curse', tags:['curse','elem'], color:'#ff9dc0', icon:'dice',
                desc:'攻击附带随机元素并每 8 秒轮换，但受到的伤害 +15%' },

  /* =========================================================
     3.0 新增：五条独立构筑流派的核心件
     ========================================================= */

  /* ---------- 怒气（骑士专属）：三条腿的构筑 ----------
     ① 叠加速度件：让"满怒"来得更快（攻击 / 受伤 / 击杀 / 暴击四种来源）
     ② 形态强化件：让狂战本身更凶（时长 / 伤害 / 附加燃烧）
     ③ 引爆转化件：满怒不再进狂战，直接炸掉 —— 把攒怒变成输出循环
     --------------------------------------------------------- */
  ragewhet:   { name:'怒火磨石', own:'knight', rar:'common', tags:['rage'], color:'#ff9d6b', icon:'rage',
                desc:'【叠加速度】每次攻击额外 +20% 怒气获取' },
  ragekettle: { name:'沸怒水壶', own:'knight', rar:'common', tags:['rage','tank'], color:'#ff8a5c', icon:'rage',
                desc:'【叠加速度】每次受伤额外 +10 怒气，减伤 +4%' },
  ragefeast:  { name:'尸潮之怒', own:'knight', rar:'rare', tags:['rage'], color:'#ffb056', icon:'rage',
                desc:'【叠加速度】附近有敌人死亡时 +1.5 怒气 —— 清场越快，怒气越猛' },
  ragecrit:   { name:'怒不可遏', own:'knight', rar:'rare', tags:['rage','crit'], color:'#ffcf7a', icon:'rage',
                desc:'【叠加速度】每次暴击 +3.5 怒气，暴击伤害 +12%' },

  ragecore:   { name:'怒潮之核', own:'knight', rar:'rare', tags:['rage'], color:'#ff7a4d', icon:'rage',
                desc:'【形态强化】怒气获取 +30%，狂战时长 +1.5 秒' },
  ragebrand:  { name:'怒焰烙铁', own:'knight', rar:'rare', tags:['rage','fire'], color:'#ffb056', icon:'rage',
                desc:'【形态强化】狂战期间伤害 +40%，命中附带燃烧' },

  ragevent:   { name:'裂怒阀门', own:'knight', rar:'epic', tags:['rage','blast'], color:'#ff5a3d', icon:'rage',
                desc:'【引爆转化】满怒时不再进入狂战，而是引爆一次：半径 130，伤害约为 1.8 秒输出 + 6% 最大生命，随后怒气清零' },
  rageburst:  { name:'怒爆脉冲', own:'knight', rar:'epic', tags:['rage','blast'], color:'#ff7a4d', icon:'rage',
                desc:'【引爆转化】引爆时额外再炸一次（70% 伤害）并给 2 秒冷却；没有阀门时改为狂战冷却 -13%' },

  /* 厨师 · 火候（不需要冰的三件） */
  hotoil:      { name:'热油锅', own:'chef', rar:'common', tags:['fire','burn'], color:'#ffb066', icon:'flamer',
                 desc:'【火候】燃烧伤害 +25%，被点燃的敌人会点燃贴身的目标' },
  charcoalspat:{ name:'炭火铲', own:'chef', rar:'epic', tags:['fire','burn'], color:'#ff6b4d', icon:'flamer',
                 desc:'【火候】燃烧伤害 +40%；每次烧死敌人回复 1.5% 最大生命' },

  /* 厨师 · 冷冻（不需要火的三件） */
  freezer:     { name:'冰柜', own:'chef', rar:'common', tags:['ice','freeze'], color:'#8fd8ff', icon:'frost',
                 desc:'【冷冻】冰缓减速 +12%，冰伤 +20%' },
  frostblade:  { name:'霜刃', own:'chef', rar:'rare', tags:['ice','freeze'], color:'#9fe0ff', icon:'frost',
                 desc:'【冷冻】攻击被冰住的目标时，额外炸开一圈冰片（范围 60）' },
  flashfreeze: { name:'急冻喷雾', own:'chef', rar:'epic', tags:['ice','freeze'], color:'#7ce3ff', icon:'frost',
                 desc:'【冷冻】每 8 秒把周围 110 范围内的敌人全部冻住 1.5 秒' },

  /* 工程师 · 炮台 */
  syncer:      { name:'同步器', own:'engineer', rar:'rare', tags:['turret'], color:'#ffe066', icon:'turret',
                 desc:'【炮台】每座炮台让全武器冷却 -4%，移动速度 -4%' },

  /* ---------- 3.2 各角色的专属零件 ----------
     每件都绑一个 own，别人抽不到；而且都是"围绕该角色资源"的齿轮，
     不是通用数值换皮。 */

  /* 游侠：弹幕 / 暴击 */
  quiver:     { name:'箭袋', own:'ranger', rar:'common', tags:['proj','multi','barrage'], color:'#ffc46b', icon:'multi',
                desc:'【弹幕】投射武器 +1 弹道，单发伤害 -8%' },
  deadeye:    { name:'鹰眼', own:'ranger', rar:'rare', tags:['crit','barrage'], color:'#ffd166', icon:'star',
                desc:'【暴击】暴击率 +8%，暴击伤害 +15%' },

  /* 厨师：元素 */
  spicerack:  { name:'香料罐', own:'chef', rar:'common', tags:['elem','fire'], color:'#ffb066', icon:'flamer',
                desc:'【元素】元素持续时间 +30%' },
  hotsauce:   { name:'辣酱', own:'chef', rar:'rare', tags:['elem','fire'], color:'#ff6b4d', icon:'flamer',
                desc:'【元素】燃烧伤害 +50%；燃烧中死亡的敌人会炸开' },
  molecular:  { name:'分子料理', own:'chef', rar:'epic', tags:['elem'], color:'#ff8a3d', icon:'flamer',
                desc:'【元素】反应伤害 +35%，且反应后元素残留更久' },
  stockpot:   { name:'高汤锅', own:'chef', rar:'rare', tags:['flesh','elem'], color:'#a6e05a', icon:'heart',
                desc:'【血肉】所有治疗 +40%' },

  /* 赌徒：暴击 */

  /* 骑士：血肉 / 反伤 */
  fleshplate: { name:'血肉铠甲', own:'knight', rar:'rare', tags:['flesh','tank'], color:'#ff5f7e', icon:'heart',
                desc:'【血肉】最大生命 +18%，移速 -6%' },
  bloodpump:  { name:'血泵', own:'knight', rar:'epic', tags:['flesh','rage'], color:'#ff7a6b', icon:'rage',
                desc:'【血肉】受到伤害时，把其中 30% 换成怒气' },
  thorncrown: { name:'荆棘王冠', own:'knight', rar:'epic', tags:['thorns','crit'], color:'#ffb0c4', icon:'mine',
                desc:'【反伤】反伤可以暴击，暴击伤害 +50%' },

  /* 工程师：护盾 */
  overcharge: { name:'过载放电', own:'engineer', rar:'rare', tags:['shield','blast'], color:'#8fe8ff', icon:'shield',
                desc:'【护盾】护盾被打空的瞬间，对周围放电一次' },
  reflector:  { name:'反射装甲', own:'engineer', rar:'epic', tags:['shield','tank'], color:'#bff0ff', icon:'shield',
                desc:'【护盾】护盾 > 0 时受到的伤害 -20%' },

  /* 饲养员：兽群 */
  broodnest:  { name:'母巢', own:'keeper', rar:'epic', tags:['pet','beast'], color:'#8ee6b3', icon:'pet',
                desc:'【兽群】宠物上限 +2，但宠物伤害 -12%' },

  /* ---------- 反伤（骑士）：站着让它们打 ---------- */
  ironhide:   { name:'铁皮', own:'knight', rar:'common', tags:['thorns','tank'], color:'#9fb4c9', icon:'mine',
                desc:'【反伤】减伤 +10%，反伤 +50%' },
  thornaura:  { name:'荆棘领域', own:'knight', rar:'rare', tags:['thorns','tank'], color:'#ffb0c4', icon:'mine',
                desc:'【反伤】反伤 +25%；每秒对贴身 70 范围内的敌人再扎一次' },

  /* ---------- 兽群 / 献祭（饲养员）：两条互斥的养法 ---------- */
  beastheart: { name:'兽群之心', own:'keeper', rar:'rare', tags:['pet','beast'], color:'#8ee6b3', icon:'pet',
                desc:'【兽群】每只存活宠物让你伤害 +5%；宠物死亡不再爆炸，只算损失' },
  sacpact:    { name:'献祭契约', own:'keeper', rar:'epic', tags:['summon','sacrifice'], color:'#ff6b8b', icon:'devour',
                desc:'【献祭】切换流派：宠物死亡时爆炸，并永久 +2% 伤害（最多 10 层），补员更快' },

  /* ---------- 血肉：按最大生命百分比输出 ---------- */
  fleshcage:  { name:'骨肉牢笼', rar:'common', tags:['flesh','tank'], color:'#e05a6f', icon:'flesh',
                desc:'最大生命 +50，减伤 +5%' },
  fleshblood: { name:'血之泉', rar:'common', tags:['flesh','heal'], color:'#ff6b8f', icon:'flesh',
                desc:'最大生命 +20%，击杀回血 +50%' },
  fleshmass:  { name:'血肉增生', rar:'rare', tags:['flesh'], color:'#ff5f7e', icon:'flesh',
                desc:'最大生命 +30%；每 100 最大生命让全部伤害 +4%（最多 +28%）' },
  fleshpump:  { name:'心跳泵', rar:'rare', tags:['flesh'], color:'#ff7a8f', icon:'flesh',
                desc:'每 4 秒对周围 90 范围来一次心跳：越残血打得越痛' },
  fleshhammer:{ name:'血肉重锤', rar:'epic', tags:['flesh'], color:'#ff3d63', icon:'flesh',
                desc:'攻击附加 1.5% 最大生命的真实伤害（无视护甲，每 0.12 秒最多一次）' },
  fleshfeast: { name:'血肉盛宴', rar:'epic', tags:['flesh','growth'], color:'#ff6b8f', icon:'flesh',
                desc:'每击杀 2 只 +1 最大生命（本局最多 +150）；每 50 点额外 +1% 伤害' },

  /* ---------- 过载：命中攒充能，全武器齐射 ---------- */
  chgspring:  { name:'发条弹簧', own:'ranger', rar:'common', tags:['charge','move'], color:'#8fe8ff', icon:'gear',
                desc:'充能速度 +20%，移速 +6%' },
  chgcoil:    { name:'回馈线圈', own:'ranger', rar:'common', tags:['charge','crit'], color:'#9fe8ff', icon:'gear',
                desc:'暴击时额外 +7 充能，暴击伤害 +10%' },
  chggear:    { name:'传导齿轮', own:'ranger', rar:'rare', tags:['charge'], color:'#7ce3ff', icon:'gear',
                desc:'每次开火时，其它武器的冷却 -0.35 秒（0.8 秒一次）' },
  chgres:     { name:'共鸣腔', own:'ranger', rar:'rare', tags:['charge'], color:'#5fd8ff', icon:'gear',
                desc:'超载时长 +2 秒，超载期间伤害 +20%' },
  chgcap:     { name:'超载电容', own:'ranger', rar:'epic', tags:['charge'], color:'#4fc8ff', icon:'gear',
                desc:'充能速度 +70%，超载期间冷却额外 -20%' },
  chgcore:    { name:'永动核心', own:'ranger', rar:'epic', tags:['charge'], color:'#7ce3ff', icon:'gear',
                desc:'超载结束后保留 40 充能，充能速度 +30%' },

  /* ---------- 吞噬：永久滚雪球 ---------- */
  growseed:   { name:'生长之种', own:'keeper', rar:'common', tags:['growth'], color:'#a6e05a', icon:'devour',
                desc:'每 20 秒 +1 最大生命，并缓慢积累伤害（最多 30 层）' },
  growgreed:  { name:'贪婪之卵', own:'keeper', rar:'rare', tags:['growth','util'], color:'#8ee06e', icon:'devour',
                desc:'每拾取 1 颗宝石，永久 +0.06% 伤害（最多 +40%），拾取范围 +40' },
  growdevour: { name:'吞噬之心', own:'keeper', rar:'epic', tags:['growth'], color:'#6fdc5c', icon:'devour',
                desc:'每击杀 15 只：+1% 伤害、+2 最大生命（最多 60 层）' },

  /* ---------- 护盾：可再生血条 ---------- */
  shdbattery: { name:'盾电池', own:'engineer', rar:'common', tags:['shield'], color:'#9fe8ff', icon:'shield',
                desc:'护盾上限 +50；护盾存在时移速 +6%' },
  shdbarrier: { name:'能量护罩', own:'engineer', rar:'rare', tags:['shield','tank'], color:'#8fe8ff', icon:'shield',
                desc:'获得 90 点护盾：先于生命值吸收伤害，脱战 3 秒后每秒回充 12%' },
  shdbreak:   { name:'盾反', own:'engineer', rar:'rare', tags:['shield','blast'], color:'#7ce3ff', icon:'shield',
                desc:'护盾破碎时对周围造成一次爆发伤害并眩晕 0.6 秒' },
  shdaegis:   { name:'圣盾', own:'engineer', rar:'epic', tags:['shield'], color:'#bff0ff', icon:'shield',
                desc:'护盾上限 +40；只要护盾还在，伤害 +30%' }
};

const RARITY = {
  common: { name:'普通', color:'#a9b7c9', weight: 46 },
  rare:   { name:'稀有', color:'#7cc7ff', weight: 30 },
  epic:   { name:'史诗', color:'#c7a2ff', weight: 16 },
  curse:  { name:'诅咒', color:'#ff6b6b', weight: 8 }
};

/* ---------------- 4.3 遗物查询 ---------------- */
function relic(id){ return !!(P && P.relics && P.relics[id]); }
/* 角色专属遗物：只在对应角色身上出现 */
function relicForChar(id){
  const r = RELICS[id];
  if(!r) return false;
  return !r.own || r.own === (CHAR && CHAR.id);
}
function crystalForChar(id){
  const p = PASSIVES[id];
  if(!p) return false;
  return !p.own || p.own === (CHAR && CHAR.id);
}
function relicCount(){ return P && P.relics ? Object.keys(P.relics).length : 0; }
function relicsWithTag(tag){
  const out = [];
  for(const id in RELICS) if(P.relics[id] && RELICS[id].tags.indexOf(tag) >= 0) out.push(id);
  return out;
}

/* 遗物提供的静态数值（在 getStats 里汇总） */
function relicStat(){
  const s = {
    dmg: 1, speed: 1, area: 1, range: 1, blast: 1, armor: 0, maxHp: 0, maxHpMul: 1,
    crit: 0, critMul: 1, multi: 0, pierce: 0, pickup: 0, xp: 1, vamp: 0,
    enemySpeed: 1, elemDur: 1, reactMul: 1, petDmg: 1,
    turretRate: 1, turretLife: 1, dodge: 0, thorns: 0, slots: 0, regenMul: 1,
    petBonus: 0, turretBonus: 0,
    /* 3.0 资源向字段 */
    rageGain: 1, rageDur: 0, rageDecay: 1,
    chargeRate: 1, overloadDur: 0,
    shieldMax: 0, fleshPct: 0,
    healMul: 1, killHealMul: 1,
    /* 4.1：冲刺配件。它替代了 4.0 的"破韧支撑件"。
       armor 一律是**护甲点数**（每点 ≈ 1/58 的相对收益），
       不再有 hurtTaken 这种平行的免伤百分比。 */
    dashExtra: 0, dashImpact: 0, dashCd: 1, dashFlowBonus: 0, dashDmgBonus: 0,
    /* 4.2：遗物也能给"冷却"，和武器自己的冷却走同一条乘法（没有第二套速度） */
    cdMul: 1
  };
  const R = P ? P.relics : {};
  if(R.sacrifice)  { s.slots -= 1; s.dmg *= 1.70; }
  if(R.glassheart) { s.maxHpMul *= 0.50; s.critMul += 1.50; }
  if(R.greedpact)  { s.enemySpeed *= 1.20; s.xp *= 1.60; }
  if(R.bloodoath)  { s.dmg *= 1.45; s.regenMul = 0; }
  if(R.heavycurse) { s.speed *= 0.80; s.armor += 30; s.area *= 1.30; s.blast *= 1.30; }
  /* 混沌骰子是诅咒：不再用 hurtTaken 这个平行字段，直接扣护甲点数 */
  if(R.chaosdice)  { s.armor -= 15; }
  if(R.luckycoin)  { s.crit += 0.06; }
  if(R.steadypan)  { s.armor += 6; }
  /* 【P0 修复】尖刺甲的 desc 写着"受到伤害时对周围反伤"，
     applyContact 里也确实有反伤逻辑，但**这里从来没给它加过 thorns**：
     ST.thorns 永远等于 0（除非你额外拿了铁皮罐头结晶），
     所以这件遗物 100% 不生效 —— 玩家觉得"反伤没触发"是对的。 */
  if(R.thornsplate){ s.thorns += 18; }
  /* 非元素件 */
  if(R.ironwall)    { s.armor += 18; }
  /* 【4.1】冲刺四件套：段数 / 撞人 / 顺势 / 回复 */
  if(R.breakwind)   { s.dashImpact += 1; }
  if(R.afterflow)   { s.dashFlowBonus += 0.8; s.dashDmgBonus += 0.12; }
  if(R.quickstep)   { s.dashCd *= 0.65; }
  if(R.dashboot)    { s.dashExtra += 1; }
  /* ---------- 4.2 新增 18 件 ---------- */
  if(R.whetstone)   { s.crit += 0.06; }
  if(R.counterweight){ s.blast *= 1.15; }
  if(R.springshoe)  { s.speed *= 1.08; }
  if(R.lodestone)   { s.pickup += 60; }
  if(R.coldpack)    { s.iceMul0 = (s.iceMul0 || 1) * 1.25; }
  if(R.pepperjar)   { s.burnMul0 = (s.burnMul0 || 1) * 1.25; }
  if(R.copperwire)  { s.reactMul *= 1.20; }
  if(R.venomgland)  { s.elemDur *= 1.25; }
  if(R.anvil)       { s.armor += 14; s.speed *= 0.94; }
  if(R.luckydie)    { s.crit += 0.05; s.critMul += 0.30; }
  if(R.stopwatch)   { s.cdMul *= 0.92; }
  if(R.powderkeg)   { s.blast *= 1.20; s.area *= 1.10; }
  if(R.fangbeast)   { s.petDmg *= 1.25; }
  if(R.deepocket)   { s.slots += 1; }
  if(R.bloodsac)    { s.killHealMul *= 1.80; }
  if(R.magazine)    { s.multi += 1; s.cdMul *= 1.06; }
  if(R.platewall)   { s.armor += 24; }
  if(R.huntereye)   { s.critMul += 0.45; }
  if(R.moonstep)    { s.speed *= 1.10; s.dodge += 0.05; }
  if(R.harden)      { s.armor += 9; s.maxHp += 30; }
  /* 反伤流派的支撑件。thornheart 让反伤可以暴击，是"挨打流"真正的质变点 */
  if(R.thornheart)  { s.thorns = s.thorns * 1.45 + 26; s.thornCrit = 1; }
  if(R.ironvine)    { s.armor += 16; s.thorns = s.thorns * 1.50 + 12; }
  if(R.bloodarmor)  { s.maxHp += 70; s.thorns += 24; }
  /* 各流派的补强件 */
  if(R.razorwind)   { s.multi += 1; s.pierce += 1; }
  if(R.bulwark)     { s.turretBonus += 1; }
  if(R.packalpha)   { s.petBonus += 2; }
  if(R.focusprism)  { s.crit += 0.08; s.critMul += 0.25; }
  if(R.quickboot)  { s.speed *= 1.12; }
  if(R.piercepin)  { s.pierce += 1; }
  if(R.twinbarrel) { s.multi += 1; }
  if(R.longfuse)   { s.blast *= 1.20; }
  if(R.magnetstone){ s.pickup += 60; }
  if(R.xplens)     { s.xp *= 1.20; }
  if(R.thickskin)  { s.maxHp += 35; }
  if(R.meltsurge)  { s.reactMul *= 1.50; }
  if(R.frostbite)  { s.reactMul *= 1; }
  if(R.lonestsoul) { s.critMul += 0.80; s.crit -= 0.10; }
  if(R.elementalist){ s.elemDur *= 1.50; }
  if(R.overclock)  { s.turretRate *= 1.50; s.turretLife *= 0.70; }
  if(R.packleader) { s.petDmg *= 1.35; s.petBonus += 2; }
  if(R.bloodoath)  { s.regenMul = 0; }

  /* ---- 3.2 专属件 ---- */
  if(R.hotoil)      { s.burnMul0 = (s.burnMul0 || 1) * 1.25; }
  if(R.charcoalspat) { s.burnMul0 = (s.burnMul0 || 1) * 1.40; }
  if(R.freezer)     { s.iceMul0 = (s.iceMul0 || 1) * 1.20; }
  if(R.frostblade)  { s.frostblade = 1; }
  if(R.syncer)      { s.syncerOn = 1; }
  if(R.quiver)     { s.multi += 1; s.dmg *= 0.92; }
  if(R.deadeye)    { s.crit += 0.08; s.critMul += 0.15; }
  if(R.spicerack)  { s.elemDur *= 1.30; }
  if(R.molecular)  { s.reactMul *= 1.35; }
  if(R.stockpot)   { s.killHealMul *= 1.40; }
  if(R.fleshplate) { s.maxHpMul += 0.18; s.speed *= 0.94; }
  if(R.thorncrown) { s.thornCrit = 1; s.critMul += 0.50; }
  if(R.reflector)  { s.armor += 12; }
  if(R.broodnest)  { s.petDmg *= 0.88; s.petBonus += 2; }

  if(R.ironhide)   { s.armor += 16; s.thorns = s.thorns * 1.50 + 10; }
  if(R.thornaura)  { s.thorns = s.thorns * 1.25 + 30; }

  /* ---------- 3.0：怒气 ---------- */
  if(R.ragewhet)   { s.rageGain *= 1.20; }
  if(R.ragecrit)   { s.critMul += 0.12; }
  if(R.ragekettle) { s.armor += 6; }
  if(R.ragecore)   { s.rageGain *= 1.30; s.rageDur += 1.5; }
  /* ---------- 3.0：血肉 ---------- */
  if(R.fleshcage)  { s.armor += 8; s.maxHp += 50; }
  if(R.fleshblood) { s.maxHpMul *= 1.20; s.killHealMul *= 1.50; }
  if(R.fleshmass)  { s.maxHpMul *= 1.30; }
  if(R.fleshhammer){ s.fleshPct += 0.015; }
  /* ---------- 3.0：过载 ---------- */
  if(R.chgspring)  { s.chargeRate *= 1.20; s.speed *= 1.06; }
  if(R.chgcoil)    { s.critMul += 0.10; }
  if(R.chgres)     { s.overloadDur += 2; }
  if(R.chgcap)     { s.chargeRate *= 1.70; }
  if(R.chgcore)    { s.chargeRate *= 1.30; }
  /* ---------- 3.0：吞噬 ---------- */
  if(R.growgreed)  { s.pickup += 40; }
  /* ---------- 3.0：护盾 ---------- */
  if(R.shdbattery) { s.shieldMax += 50; }
  if(R.shdbarrier) { s.shieldMax += 90; }
  if(R.shdaegis)   { s.shieldMax += 40; }
  return s;
}

/* ---------------- 4.4 监听器注册（每局开始时执行一次） ---------------- */
function initRelics(){
  /* ---- 命中类 ---- */
  on('hit', function(h){
    const e = h.e;
    if(!e || e.dead) return;
    /* 暴击 → 连锁闪电 */
    if(h.crit && relic('chaincrit') && Math.random() < 0.55){
      let fx = e.x, fy = e.y;
      const hit = new Set([e.id]);
      let dmg = h.dmg * 0.45;
      for(let k = 0; k < 3; k++){
        let best = null, bd = 1e9;
        eachNear(fx, fy, 170, function(o){
          if(hit.has(o.id)) return;
          const d = dist(fx, fy, o.x, o.y);
          if(d < bd){ bd = d; best = o; }
        });
        if(!best) break;
        hit.add(best.id);
        beams.push({ x:fx, y:fy, ang: Math.atan2(best.y - fy, best.x - fx),
          len: dist(fx, fy, best.x, best.y), width: 2, life: 0.12, max: 0.12, col:'#9fe8ff', src:'relic' });
        dealDamage(best, dmg, { src:'r_chain', elem:'volt' });
        dmg *= 0.8;
        fx = best.x; fy = best.y;
      }
    }
    /* 暴击 → 火花塞 */
    if(h.crit && relic('sparkplug') && Math.random() < 0.30){
      eachNear(e.x, e.y, 60, function(o){
        dealDamage(o, h.dmg * 0.35, { src:'r_spark', elem:'volt' });
      });
      rings.push({ x:e.x, y:e.y, r0:6, r1:60, life:0.22, max:0.22, col:'#ffe066', w:2 });
    }
    /* 霜之触 */
    if(relic('coldtouch') && Math.random() < 0.12) applyElem(e, 'ice', 1.6, h.dmg * 0.2, 'relic');
    /* 毒腺 */
    if(relic('venomgland') && Math.random() < 0.12) applyElem(e, 'venom', 2.2, h.dmg * 0.25, 'relic');
    /* 怒焰烙铁：狂战期间命中带火，让怒气流也能自己搓反应 */
    if(relic('ragebrand') && isBerserk() && Math.random() < 0.35) applyElem(e, 'fire', 1.8, h.dmg * 0.25, 'relic');
  });

  /* ---- 闪避类 ---- */
  on('dodge', function(){
    if(relic('dodgeprism')) P.guaranteedCrit = true;
  });

  /* ---- 暴击类 ---- */
  on('crit', function(h){ charHook('onCrit', h); });

  /* ---- 命中类 ----
     【P0 修复】`emit('hit')` 一直在发，但**没有任何地方把它转给角色钩子**。
     结果是骑士的"近战命中 +7 怒"和游侠的"连续命中同一目标叠专注"这两套
     核心机制全都收不到事件：怒气只能靠挨打涨，专注永远是 0。
     角色专属机制等于没实现，而且完全不报错。 */
  on('hit', function(h){ charHook('onHit', h); });

  /* ---- 击杀类 ---- */
  on('kill', function(h){
    const e = h.e;

    /* 余烬 / 燃爆 */
    if(e.st && e.st.fire > 0){
      if(relic('emberkill')){
        explode(e.x, e.y, 62, 24 + P.level * 6, '#ff8a3d', false, 'relic');
      } else if(relic('ember') && spend('boom')){
        explode(e.x, e.y, 34, 12 + P.level * 3, '#ff8a3d', true, 'relic');
      }
    }
    /* 感应线圈 */
    if(relic('voltcoil') && e.st && e.st.volt > 0 && spend('boom')){
      rings.push({ x:e.x, y:e.y, r0:6, r1:72, life:0.28, max:0.28, col:'#ffe066', w:3 });
      eachNear(e.x, e.y, 72, function(o){ dealDamage(o, 14 + P.level * 4, { src:'r_voltdeath', elem:'volt' }); });
    }
    /* 击杀弹幕 */
    if(relic('killshot') && Math.random() < 0.25 && bullets.length < 600){
      const a = rand(0, TAU);
      bullets.push({
        type:'slipper', x:e.x, y:e.y,
        vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
        r:5, dmg: 16 + P.level * 5, life: 1.1, pierce: 1,
        range: 260, hitSet: new Set(), hitCount: 0, rot: a, spin: 12,
        col:'#ffc46b', src:'relic'
      });
    }
    /* 石像碎裂 */
    if(relic('statuesmash') && Math.random() < 0.15){
      for(let i = 0; i < 3; i++){
        const a = (i / 3) * TAU + rand(-0.3, 0.3);
        bullets.push({
          type:'shot', x:e.x, y:e.y,
          vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
          r:4, dmg: 10 + P.level * 3, life: 0.8, pierce: 0,
          range: 200, hitSet: new Set(), hitCount: 0, rot: a, spin: 0,
          col:'#c9d4e2', src:'relic'
        });
      }
    }
    /* 亡语弹片：不该只是「石像碎裂」这一件遗物的专利。
       弹幕 / 穿甲 流派浓度越高，敌人死亡时炸出弹片的概率越高——
       这是这两个流派自己的连锁，和元素反应完全无关。 */
    const shardChance = schoolTier('barrage') * 0.09 + schoolTier('pierce') * 0.09;
    if(shardChance > 0 && Math.random() < shardChance && bullets.length < 700){
      const n = 2 + (Math.random() < 0.35 ? 1 : 0);
      for(let i = 0; i < n; i++){
        const a = (i / n) * TAU + rand(-0.4, 0.4);
        bullets.push({
          type:'shot', x:e.x, y:e.y,
          vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
          r:4, dmg: 12 + P.level * 4, life: 0.9, pierce: 1,
          range: 220, hitSet: new Set(), hitCount: 0, rot: a, spin: 0,
          col:'#ffc46b', src:'relic'
        });
      }
    }
    /* 灵魂收割：后期击杀几十只/秒时，"8% 概率"等于每秒白送两三只，
       场上瞬间堆满。加 1.2 秒冷却、单场上限 10 只，保留"爽"但不再刷屏。 */
    if(relic('soulharvest') && allies.length < 10
       && (state.time - (P.soulT || -9)) > 1.2
       && Math.random() < 0.08){
      if(spend('summon')){
        P.soulT = state.time;
        spawnPet(e.x, e.y, 3, 20 + P.level * 5, 10);
      }
    }
    /* 猎杀连锁 */
    /* 猎杀连锁：12 杀触发一次，但加了 0.9 秒冷却。
       后期 30 杀/秒时，"每 12 杀"等于每秒 2.5 次全屏爆炸，
       单件遗物就能顶掉所有武器 —— 触发频率必须有个上限，不能只按击杀数。 */
    if(relic('killchain')){
      P.killCounter = (P.killCounter || 0) + 1;
      if(P.killCounter >= 12 && state.time - (P.kcT || -9) > 0.9){
        P.kcT = state.time;
        P.killCounter = 0;
        explode(P.x, P.y, 118, 24 + P.level * 5, '#ff9dc0', false, 'r_killchain');
        rings.push({ x:P.x, y:P.y, r0:20, r1:180, life:0.4, max:0.4, col:'#ff9dc0', w:4 });
      }
    }
    /* 冰霜之心：冻结敌人死亡炸冰锥
       【P0 修复】冰锥本身带冰元素 → 冻住下一批 → 它们死了又炸 4 根 →
       形成正反馈循环。厨师一局靠这一件遗物打出 1000 万伤害（是全部武器之和的 5 倍），
       结算面板里"遗物"永远第一。现在限流 0.45 秒最多触发一次，且 2 根。 */
    if(relic('frostheart') && (e.slowT || 0) > 0 && state.time - (P.frostT || -9) > 0.45){
      P.frostT = state.time;
      for(let i = 0; i < 2; i++){
        const a = (i / 2) * TAU + rand(-0.4, 0.4);
        bullets.push({
          type:'frost', x:e.x, y:e.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
          r:5, dmg: 10 + P.level * 2, life: 0.6, pierce: 1, range: 160,
          hitSet: new Set(), hitCount: 0, elem:['ice'], rot:a, spin:0, col:'#8fe8ff', src:'r_frost'
        });
      }
    }
  });

  /* ---- 反应类 ---- */
  on('reaction', function(h){
    if(relic('meltsurge')){
      eachNear(h.e.x, h.e.y, 70, function(o){
        if(o !== h.e) dealDamage(o, h.dmg * 0.35, { src:'react' });
      });
    }
    if(relic('singularity') && holes.length < 6){
      holes.push({ x:h.e.x, y:h.e.y, r: 70, dmg: 8 + P.level * 2, tick: 0.3,
        t:0, life: 2.0, max: 2.0, evo:false, seed: rand(0, 10), src:'relic' });
    }
  });

  /* ---- 受伤类 ---- */
  on('hurt', function(d){
    if(relic('thornsplate') && spend('boom')){
      eachNear(P.x, P.y, 84, function(o){ dealDamage(o, 8 + P.level * 4, { src:'r_killchain' }); });
      rings.push({ x:P.x, y:P.y, r0:10, r1:84, life:0.24, max:0.24, col:'#ffb0c4', w:3 });
    }
    /* 沸怒水壶：挨打额外攒怒，把"被围"变成"要开狂战了" */
    if(relic('ragekettle')) rageGainRaw(10);
    charHook('onHurt', d);
  });

  /* ---- 暴击：回馈线圈 ---- */
  on('crit', function(h){
    /* 【3.3】回馈线圈原来每次暴击给 7 点充能。
       暴击率高 + 命中数大时，一次齐射触发十几次 = 一帧满槽，
       "0.1 秒充能"的观感有一半来自这一件。降到 2.2 并走每秒令牌桶。 */
    if(relic('chgcoil')) chargeGain(2.2);
  });

  /* ---- 爆炸类 ---- */
  on('boom', function(h){
    if(relic('burstcore') && Math.random() < 0.30 && spend('boom')){
      explode(h.x, h.y, h.r * 0.8, h.dmg * 0.6, '#ff9d4d', true, 'relic');
    }
  });

  /* ---- 宝石 ---- */
  on('gem', function(g){
    if(relic('scavenger')){
      P.gemCounter = (P.gemCounter || 0) + 1;
      if(P.gemCounter >= 18){
        P.gemCounter = 0;
        explode(g.x, g.y, 70, 18 + P.level * 5, '#6fdc8c', true, 'relic');
      }
    }
    /* 贪婪之卵：每颗宝石都变成永久伤害（上限 +40%），
       和"吞噬"一样是滚雪球，但滚的是经济线 */
    if(relic('growgreed')){
      P.gemDmg = Math.min(0.40, (P.gemDmg || 0) + 0.0006);
    }
  });
}

/* 每帧跑的遗物逻辑 */
function tickRelics(dt){
  /* 回响之心原来固定 5 秒齐射一次——每秒 5 发时，这个效果等于噪音。
     改成"每次开火有概率立刻再齐射一轮"（见 64-update），强度自然跟着出手频率长。 */
  if(P.phaseT > 0) P.phaseT -= dt;
  if((P.wallCd || 0) > 0) P.wallCd -= dt;
  /* 血怒：低血冷却 */
  if(relic('bloodrage')){
    P.bloodrageOn = P.hp < P.maxHp * 0.40;
  }
  /* 雷神：感电敌人互相放电 */
  if(relic('thunderlord')){
    P.thunderT = (P.thunderT || 0) - dt;
    if(P.thunderT <= 0){
      P.thunderT = 1.0;
      let n = 0;
      for(let i = 0; i < enemies.length && n < 8; i++){
        const e = enemies[i];
        if(e.dead || !e.st || e.st.volt <= 0) continue;
        n++;
        eachNear(e.x, e.y, 56, function(o){
          if(o !== e) dealDamage(o, 10 + P.level * 3, { src:'r_thunder', elem:'volt' });
        });
      }
    }
  }
  /* 混沌骰：随机元素附魔 */
  if(relic('chaosdice')){
    P.chaosT = (P.chaosT || 0) - dt;
    if(P.chaosT <= 0){
      P.chaosT = 8;
      const list = ['fire', 'ice', 'venom', 'volt'];
      P.chaosElem = pickOne(list);
      showToast('🎲 附魔：' + ELEM_NAME[P.chaosElem]);
    }
  }

  /* ---------- 3.0：血肉 · 心跳泵 ---------- */
  if(relic('fleshpump')){
    P.pumpT = (P.pumpT === undefined ? 4 : P.pumpT) - dt;
    if(P.pumpT <= 0){
      P.pumpT = 4;
      const missing = 1 - clamp(P.hp / P.maxHp, 0, 1);
      const R = 90 * (ST.area || 1);
      const d = powerBase() * 0.8 * (1 + missing * 1.2);
      if(rings.length < 30) rings.push({ x:P.x, y:P.y, r0:R * 0.25, r1:R, life:0.26, max:0.26, col:'#ff5f7e', w:3 });
      burst(P.x, P.y, '#ff5f7e', 8, 120, -0.2);
      let n = 0;
      eachNear(P.x, P.y, R, function(e){
        if(e.dead || n >= 20) return;
        n++;
        dealDamage(e, d, { src:'flesh', noFlesh:true });
      });
      addText(P.x, P.y - 32, '心跳', '#ff7a8f', 10);
      sfx('heartbeat');
    }
  }

  /* ---------- 3.2：冷冻 · 急冻喷雾 ---------- */
  if(relic('flashfreeze')){
    P.freezeT = (P.freezeT === undefined ? 8 : P.freezeT) - dt;
    if(P.freezeT <= 0){
      P.freezeT = 8;
      let n = 0;
      eachNear(P.x, P.y, 110, function(e){
        if(e.dead || n >= 14) return;
        n++;
        applyElem(e, 'ice', 1.5, 0, 'freeze');
        e.stun = Math.max(e.stun || 0, 0.35);
      });
      if(n > 0){
        rings.push({ x:P.x, y:P.y, r0:12, r1:110, life:0.3, max:0.3, col:'#7ce3ff', w:3 });
        sfx('chill');
      }
    }
  }

  /* ---------- 3.1：反伤 · 荆棘领域与流派Ⅲ ---------- */
  if(relic('thornaura') || archTier('thorns') >= 3){
    P.thornT = (P.thornT === undefined ? 1 : P.thornT) - dt;
    if(P.thornT <= 0){
      P.thornT = 1;
      const R = relic('thornaura') ? 70 : 56;
      const d = (ST.thorns || 0) * 0.35;
      if(d > 1){
        let n = 0;
        eachNear(P.x, P.y, R, function(e){
          if(e.dead || n >= 12) return;
          n++;
          dealDamage(e, d, { src:'thorns', noFlesh:true });
          burst(e.x, e.y, '#ffb0c4', 1, 50, 0);
        });
      }
    }
  }

  /* ---------- 3.0：吞噬 · 流派Ⅲ ---------- */
  if(archTier('growth') >= 3){
    P.growHealT = (P.growHealT === undefined ? 12 : P.growHealT) - dt;
    if(P.growHealT <= 0){
      P.growHealT = 12;
      if(P.hp < P.maxHp) healPlayer(P.maxHp * 0.016);
    }
  }
}

/* 齐射：把所有武器立刻放一轮 */
function volleyAll(){
  for(const id in P.weapons){
    const w = WEAPONS[id];
    if(!w || !w.fire) continue;
    if(w.continuous) continue;
    w.fire(P.weapons[id]);
  }
}
