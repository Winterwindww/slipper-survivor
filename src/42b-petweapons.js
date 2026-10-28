/* =========================================================
   3.6 宠物武器
   ---------------------------------------------------------
   宠物不是"自动长出来的一堆"，而是**一把武器 = 一种宠物**：
   你选了「机械鸟」，才会有一只机械鸟；升级它，它变强、变多。
   这样"带什么宠物"是一次真正的构筑选择，而不是白送。
   ========================================================= */

function petCountOf(type){
  let n = 0;
  for(let i = 0; i < allies.length; i++){
    const a = allies[i];
    if(!a.dead && a.kind === 'pet' && a.ptype === type) n++;
  }
  return n;
}

/* 一把宠物武器的通用实现：
   每次开火把这种宠物补到应有数量（1 → Lv3 两只 → Lv5 三只） */
function makePetWeapon(cfg){
  return {
    name: cfg.name,
    blurb: cfg.blurb,
    color: cfg.color,
    icon: cfg.icon || 'pet',
    max: 5,
    school: 'beast',
    petType: cfg.type,
    tags: ['summon', 'pet'].concat(cfg.tags || []),
    mods: cfg.mods || ['crit', 'haste', 'size', 'count'],
    labels: { dmg:'宠物伤害', cd:'补员间隔', count:'数量' },
    stats: lv => ({
      dmg: (cfg.dmg[0] + cfg.dmg[1] * lv + cfg.dmg[2] * lv * lv),
      cd: Math.max(1.8, 5.0 - 0.55 * lv),
      /* 【6.0】Lv1 三只（旧公式 1+ceil(lv/2) 让开局只有 2 只，
         而选人页一直写着"宠物 +3"，玩家第一眼就对不上）。
         现在 Lv1 = 3，Lv4 起 = 4，和"每种上限 4 只"一致。 */
      count: Math.min(4, 2 + Math.ceil(lv / 3))
    }),
    awaken: cfg.awaken,
    fire(lv){
      const s = this.stats(lv);
      const want = s.count + (hasMod(cfg.id, 'count') ? 1 : 0);
      const have = petCountOf(cfg.type);
      const room = Math.min(want - have, petLimitOf(cfg.type) - have);
      for(let k = 0; k < room; k++){
        spawnPet(P.x + rand(-24, 24), P.y + rand(-24, 24), lv,
          s.dmg * wDmgMul(cfg.id), 0, cfg.type, cfg.id);
      }
      if(room > 0) sfx('pop');
    }
  };
}

const PET_WEAPONS = {
  /* 小狗：本体就是骑士的起始武器，保留 id 'pet' */
  pet: makePetWeapon({
    id:'pet', type:'dog', name:'小狗', color:'#e6c17a',
    blurb:'一只冲上去咬人的小狗。便宜、稳、能扛两下。',
    dmg:[24, 11, 3.2],
    mods: ['swift', 'heavy', 'crit', 'haste'],
    tags:['melee'],
    awaken:'兽王：三只小狗一起上，死亡时必定爆炸'
  }),
  petbird: makePetWeapon({
    id:'petbird', type:'bird', name:'机械鸟', color:'#9fe0ff', icon:'bolt',
    blurb:'悬在你头顶远程点射，不会冲进怪堆，但输出稳定。',
    dmg:[19, 9, 2.7],
    mods: ['scatter', 'haste', 'pierce', 'count'],
    tags:['proj'],
    awaken:'无人机群：三只机械鸟持续点射'
  }),
  petcat: makePetWeapon({
    id:'petcat', type:'cat', name:'胖猫', color:'#ffb0c4', icon:'pan',
    blurb:'慢吞吞的近身护卫，一巴掌拍到一片。血厚，替你挡刀。',
    dmg:[28, 12, 3.6],
    mods: ['size', 'haste', 'blast', 'heavy'],
    tags:['melee', 'blast'],
    awaken:'猫球：拍击范围翻倍，命中附带击退'
  }),
  petslime: makePetWeapon({
    id:'petslime', type:'slime', name:'小史莱姆', color:'#a8f5af', icon:'bubble',
    blurb:'最肉的一只。挨打会分裂出小史莱姆，越打越多。',
    dmg:[21, 9.5, 2.8],
    mods: ['swift', 'count', 'split', 'haste'],
    tags:['tank'],
    awaken:'粘液海：分裂更频繁，分裂体也带伤害'
  }),
  petlizard: makePetWeapon({
    id:'petlizard', type:'lizard', name:'喷火蜥蜴', color:'#ff8a3d', icon:'flamer',
    blurb:'贴上去喷火，给一片敌人挂燃烧。',
    dmg:[25, 11, 3.3],
    mods: ['size', 'haste', 'blast', 'swift'],
    tags:['fire', 'elem'],
    awaken:'熔岩吐息：火焰范围翻倍，燃烧强度翻倍'
  }),
  petpenguin: makePetWeapon({
    id:'petpenguin', type:'penguin', name:'冰企鹅', color:'#8fe8ff', icon:'frost',
    blurb:'远程冰弹，把冲过来的怪按住。',
    dmg:[21, 10, 3.0],
    mods: ['scatter', 'haste', 'size', 'crit'],
    tags:['ice', 'cc'],
    awaken:'极寒企鹅：冰弹变三连，命中直接冻结'
  }),
  pethamster: makePetWeapon({
    id:'pethamster', type:'hamster', name:'闪电仓鼠', color:'#ffe066', icon:'bolt',
    blurb:'跑得最快的一只，在怪之间跳来跳去放电。',
    dmg:[19, 9, 2.8],
    mods: ['haste', 'chainkill', 'scatter', 'crit'],
    tags:['volt'],
    awaken:'雷鼠：链电跳跃翻倍'
  }),
  petbomb: makePetWeapon({
    id:'petbomb', type:'bomb', name:'自爆蘑菇', color:'#ff6b8b', icon:'mine',
    blurb:'冲向敌人自爆，然后自动补员。一次性的高爆发。',
    dmg:[26, 10, 2.8],
    mods: ['size', 'blast', 'haste', 'count'],
    tags:['blast'],
    awaken:'连环爆：爆炸范围翻倍，并留下火圈'
  })
};

/* 合并进武器总表（'pet' 覆盖掉原来那个"一直补满"的版本） */
Object.assign(WEAPONS, PET_WEAPONS);
