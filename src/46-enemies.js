/* =========================================================
   敌人数据
   ---------------------------------------------------------
   dmg 是**绝对值**：一口咬 / 一发子弹打掉多少点生命。
   它乘 atkCurve(t)（1 → 2.45）成为实际伤害。

   上一版把整张表按"打在 300 血身上该有多疼"重新排了一遍：
     6~12%   蚂蚁 / 蝙蝠：数量压制，单只不痛，被围才危险
     8~14%   常规杂兵：一口能让血条明显掉一截
     17~19%  重甲 / 自爆 / 疾行：必须躲，站桩吃两口就危险
     15%+    BOSS 贴身：连续吃三下就该死了
   旧表里史莱姆是 7（300 血身上掉 2%），要挨 50 下才会死——
   玩家说的"这不搞笑吗"指的就是这个。数值定错，不是机制不够花。
   ========================================================= */
const ENEMIES = {
  /* --- 前期：又慢又软 --- */
  slime:   { spr:'slime',   hp:12,  spd:24, r:5.5, dmg:16, xp:2, sc:1,   col:'#a8f5af', ai:'chase' },
  /* --- 第 18 秒起 --- */
  carrot:  { spr:'carrot',  hp:18,  spd:32, r:5.2, dmg:19, xp:3, sc:1,   col:'#ff8a3d', ai:'dash' },
  /* --- 第 38 秒起 --- */
  bat:     { spr:'bat',     hp:10,  spd:58, r:5.0, dmg:12, xp:2, sc:1,   col:'#bb8bdc', ai:'weave' },
  /* --- 第 55 秒起 --- */
  shooter: { spr:'shooter', hp:26,  spd:24, r:5.5, dmg:14, xp:5, sc:1,   col:'#b6f78e', ai:'ranged',
             shot:{ keep:[150,215], range:330, cd:2.6, n:1, spd:112, mul:1.35, col:'#ff4fd8', r:4 } },
  /* --- 第 70 秒起 --- */
  bomb:    { spr:'bomb',    hp:16,  spd:66, r:6.0, dmg:36, xp:4, sc:1,   col:'#ff5d5d', ai:'kamikaze' },
  /* --- 第 85 秒起 --- */
  pudding: { spr:'pudding', hp:36,  spd:30, r:6.5, dmg:19, xp:6, sc:1,   col:'#ffcf8a', ai:'split' },
  /* --- 第 100 秒起 --- */
  burger:  { spr:'burger',  hp:54,  spd:26, r:7.5, dmg:26, xp:8, sc:1.1, col:'#f2b45c', ai:'chase', tank:true },
  /* --- 第 115 秒起：幽灵，直线加速冲过来 --- */
  ghost:   { spr:'ghost',   hp:20,  spd:66, r:5.4, dmg:16, xp:4, sc:1,   col:'#cfd6ff', ai:'ghost', alpha:0.78 },
  /* --- 第 130 秒起：青蛙，蹦跳突进 --- */
  frog:    { spr:'frog',    hp:32,  spd:30, r:6.0, dmg:20, xp:5, sc:1,   col:'#6fe0c8', ai:'hop' },
  /* --- 第 148 秒起：蜜蜂，绕着玩家转圈后俯冲 --- */
  bee:     { spr:'bee',     hp:18,  spd:84, r:4.8, dmg:16, xp:4, sc:1,   col:'#ffd166', ai:'circle' },
  /* --- 第 195 秒起：铁罐兵，又慢又厚 --- */
  iron:    { spr:'burger',  hp:150, spd:17, r:9.0, dmg:31, xp:14, sc:1.35, col:'#9fb4c9', ai:'chase', tank:true },
  /* --- 第 215 秒起：蚁群，小快灵，一次来一群 --- */
  ant:     { spr:'slime',   hp:9,   spd:104,r:3.4, dmg:8, xp:2, sc:0.55, col:'#c58b5a', ai:'chase' },
  /* --- 第 165 秒起：毒蘑菇，死后留下毒雾 --- */
  mushroom:{ spr:'mushroom',hp:44,  spd:21, r:6.6, dmg:19, xp:6, sc:1,   col:'#ff8fb0', ai:'chase', poison:true },

  /* --- 后半场专属 --- */
  /* 重甲兵：血厚 + 45% 减伤 + 强击退抗性，逼你换"爆炸/穿透"而不是硬砍 */
  brute:   { spr:'brute',   hp:130, spd:17,  r:8.5, dmg:36, xp:24, sc:1.0, col:'#9fb4c9', ai:'chase', tank:true, armor:0.45, knockRes:0.7 },
  /* 疾行者：绕行走位 + 极快，专门惩罚站桩 */
  runner:  { spr:'runner',  hp:40,  spd:118, r:5.0, dmg:23, xp:14, sc:1.0, col:'#c9a0ff', ai:'weave' },
  /* 巢母：站在远处不停下崽，放着不管会越积越多 */
  nest:    { spr:'nest',    hp:210, spd:10,  r:9.5, dmg:19, xp:34, sc:1.0, col:'#ffb0c4', ai:'spawner' },

  /* --- 远程线（2.6 新增）---
     弹幕单独给百分比（shot.pct），不再共用接触伤害的 dmg。
     远程是可以躲的，所以每一发都要"值得躲"——比贴身咬更疼。
       sniper  10% · 5.4 秒一发，慢但看得见，逼你横向移动
       spitter  7% · 3.2 秒一发三连扇形
       thrower  8% · 4.2 秒一发，落点炸一小片 */
  sniper:  { spr:'sniper',  hp:34, spd:20, r:5.8, dmg:17, xp:7,  sc:1.0,  col:'#e05575', ai:'ranged',
             shot:{ keep:[380,520], range:600, cd:5.4, n:1, spd:170, mul:2.20, col:'#ff2040', r:4.5 } },
  spitter: { spr:'spitter', hp:46, spd:28, r:6.4, dmg:19, xp:8,  sc:1.0,  col:'#9cff6b', ai:'ranged',
             shot:{ keep:[200,310], range:360, cd:3.2, n:1, spd:120, mul:1.50, col:'#ff8a00', r:4 } },
  thrower: { spr:'thrower', hp:72, spd:16, r:7.4, dmg:20, xp:11, sc:1.05, col:'#ffb066', ai:'ranged',
             shot:{ keep:[300,440], range:500, cd:4.2, n:1, spd:130, mul:1.60, col:'#ff8a00', r:6, boom:48 } }
};

const BOSSES = {
  candyKing: {
    name:'糖果大王', spr:'boss', sc:2.3, hp:1450, spd:26, r:15, dmg:56, xp:70,
    col:'#ff8fc7', crown:'#ffe066', ai:'candyKing',
    tag:'环形弹幕', hint:'⚠ 糖果大王 出现：环形弹幕'
  },
  colaKing: {
    name:'可乐喷泉', spr:'shooter', sc:2.6, hp:1550, spd:20, r:17, dmg:56, xp:90,
    col:'#ff6b6b', crown:'#7ce3ff', ai:'colaKing',
    tag:'螺旋弹幕', hint:'⚠ 可乐喷泉 出现：螺旋弹幕，注意走位'
  },
  burgerKing: {
    name:'汉堡巨兽', spr:'burger', sc:3.0, hp:1650, spd:25, r:19, dmg:66, xp:100,
    col:'#f2b45c', crown:'#ffd166', ai:'burgerKing',
    tag:'召唤 + 冲撞', hint:'⚠ 汉堡巨兽 出现：会叫小弟、会冲撞'
  },
  jellyPope: {
    name:'果冻教皇', spr:'pudding', sc:3.1, hp:1750, spd:23, r:18, dmg:62, xp:112,
    col:'#a0ffd0', crown:'#ffe066', ai:'jellyPope',
    tag:'召唤精英', hint:'⚠ 果冻教皇 出现：它会把精英怪叫出来'
  },
  veggieQueen: {
    name:'蔬菜女王', spr:'carrot', sc:3.0, hp:1850, spd:30, r:19, dmg:66, xp:130,
    col:'#ff8a3d', crown:'#9cff8a', ai:'veggieQueen',
    tag:'追踪弹 + 毒雾', hint:'⚠ 蔬菜女王 出现：追踪弹和毒雾'
  },
  puddingTyrant: {
    name:'布丁暴君', spr:'candyBig', sc:3.2, hp:1950, spd:26, r:19, dmg:70, xp:125,
    col:'#ffd166', crown:'#ff9dc0', ai:'puddingTyrant',
    tag:'三连冲刺', hint:'⚠ 布丁暴君 出现：会连续三次冲撞'
  },
  /* --- 10 分钟终局 BOSS：整局的明确目标 --- */
  slipperKing: {
    name:'拖鞋之王', spr:'slipperKing', sc:3.1, hp:3600, spd:23, r:25, dmg:84, xp:300,
    col:'#ffd166', crown:'#fff3b0', ai:'slipperKing',
    tag:'三阶段 · 终局', hint:'👑 拖鞋之王降临！击败它就能通关'
  }
};

