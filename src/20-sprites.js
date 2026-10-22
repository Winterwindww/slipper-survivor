
const SPR = {};

/* =========================================================
   玩家角色：六套独立像素形象
   ---------------------------------------------------------
   旧版所有人共用同一个白色小人，只换一圈对话环颜色——
   选角色等于换数值，视觉上完全认不出谁是谁。
   现在每个角色有自己的**轮廓**（不只是配色）：
     · 游侠：瘦长 + 头带飘尾 + 单只拖鞋
     · 骑士：头盔 + 红缨 + 宽肩护甲（横向最宽）
     · 工程师：安全帽 + 护目镜 + 工装背带
     · 饲养员：宽檐草帽 + 围裙 + 爪印徽章（最圆）
     · 厨师：高帽 + 左火右冰的双色围裙
     · 赌徒：礼帽 + 燕尾外套 + 领结
   ========================================================= */

/* 1. 拖鞋游侠 */
SPR.ch_ranger = reg([
  '................',
  '....oooooooo....',
  '...ovvvvvvvvo...',
  '...osssssssso...',
  '...oswwsswwso...',
  '...oseesseeso...',
  '...osssssssso...',
  '..occcccccccco..',
  '.occcccccccccco.',
  'ocsccccccccccsco',
  'ocsccccccccccsco',
  '.occcccccccccco.',
  '..occcccccccco..',
  '...osso..osso...',
  '...ommo..ommo...',
  '....oo....oo....'
], {'o':'#3a2b44','v':'#ff8a5c','s':'#ffdcc0','w':'#fffdf6','e':'#2a2233','c':'#4fc4c4','m':'#ffc46b'});

/* 2. 平底锅骑士 */
SPR.ch_knight = reg([
  '................',
  '.......pp.......',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...oeeeeeeeeo...',
  '...ohhhhhhhho...',
  '.ossshhhhhsssso.',
  'ossccccccccccsso',
  'ossccccccccccsso',
  '.osccccccccccso.',
  '..occcccccccco..',
  '..occcccccccco..',
  '...osso..osso...',
  '...ommo..ommo...',
  '....oo....oo....'
], {'o':'#2f3242','p':'#ff5f6d','h':'#cfd8e6','s':'#c2ccda','e':'#1e2230','c':'#5b6c8a','m':'#8a94a8'});

/* 3. 炮台工程师 */
SPR.ch_engineer = reg([
  '................',
  '.....yyyyyy.....',
  '....oyyyyyyo....',
  '...oyyyyyyyyo...',
  '...osssssssso...',
  '...ogwwggwwgo...',
  '...osssssssso...',
  '..obbbbbbbbbbo..',
  '.obbbbbbbbbbbbo.',
  'obsbbbbbbbbbbso.',
  'obsbbbbbbbbbbso.',
  '.obbbbbbbbbbbbo.',
  '..obbbbbbbbbbo..',
  '...osso..osso...',
  '...ommo..ommo...',
  '....oo....oo....'
], {'o':'#3a2f24','y':'#ffd166','s':'#ffdcc0','g':'#2b3a4a','w':'#7ce3ff','b':'#c98b4b','m':'#7a5a34'});

/* 4. 宠物饲养员 */
SPR.ch_keeper = reg([
  '................',
  '....hhhhhhhh....',
  '..ohhhhhhhhhho..',
  '.ohhhhhhhhhhhho.',
  '...osssssssso...',
  '...oswwsswwso...',
  '...oseesseeso...',
  '..oggggggggggo..',
  '.oggggggggggggo.',
  'oggggggwwgggggo.',
  'oggggggwwgggggo.',
  '.oggggggggggggo.',
  '..oggggggggggo..',
  '...osso..osso...',
  '...ommo..ommo...',
  '....oo....oo....'
], {'o':'#3b3220','h':'#e8c886','s':'#ffdcc0','w':'#fffdf6','e':'#2a2233','g':'#7cc47f','m':'#8a6a3a'});

/* 5. 冰火厨师 */
SPR.ch_chef = reg([
  '................',
  '....hhhhhhhh....',
  '...ohhhhhhhho...',
  '...ohggggggho...',
  '...osssssssso...',
  '...oswwsswwso...',
  '...oseesseeso...',
  '..offiiiibbbbo..',
  '.offfiiiibbbbbo.',
  'offffiiiibbbbbbo',
  'offffiiiibbbbbbo',
  '.offffiiiibbbbo.',
  '..offfiiiibbbo..',
  '...osso..osso...',
  '...ommo..ommo...',
  '....oo....oo....'
], {'o':'#3a2b2b','h':'#fff7ea','g':'#d9cdbd','s':'#ffdcc0','w':'#fffdf6','e':'#2a2233','i':'#8fe8ff','f':'#ff8a3d','b':'#4fa8d8','m':'#8a5a3a'});

/* 6. 幸运赌徒 */
SPR.ch_gambler = reg([
  '................',
  '...oooooooooo...',
  '...okkkkkkkko...',
  '...oyyyyyyyyo...',
  '...oooooooooo...',
  '...osssssssso...',
  '...oswwsswwso...',
  '...oseesseeso...',
  '..ovvvvvvvvvvo..',
  '.oqqqqqqqqqqqqo.',
  'oqqqppppppppqqqo',
  'oqqqppppppppqqqo',
  '.oqqqqqqqqqqqqo.',
  '..oqqqqqqqqqqo..',
  '...osso..osso...',
  '...ommo..ommo...'
], {'o':'#2e2338','k':'#3c2b52','y':'#ffd166','s':'#ffdcc0','w':'#fffdf6','e':'#2a2233','v':'#8a5ad8','q':'#6f47b8','p':'#ff9dc0','m':'#ffb84d'});

/* 终局 BOSS「拖鞋之王」：用代码画，形状比 16x16 字符网格更容易精确控制。
   形象刻意和前面的糖果大王区分开——它是一只**巨型拖鞋**，不是又一个粉色团子。 */
SPR.slipperKing = (function(){
  const c = document.createElement('canvas');
  c.width = 24; c.height = 18;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

  /* 轮廓（比本体大一圈） */
  const OUT = '#5a3a12';
  const body = [
    [8, 5, 9], [6, 7, 12], [4, 9, 16], [3, 11, 18], [3, 12, 18],
    [3, 13, 18], [4, 14, 16], [6, 15, 12]
  ];
  for(const b of body) px(b[0] - 1, b[1], b[2] + 2, 1, OUT);
  /* 鞋面 */
  for(const b of body) px(b[0], b[1], b[2], 1, '#ffd166');
  /* 阴影（下半部分压暗，做出体积） */
  for(let i = 5; i < body.length; i++){
    const b = body[i];
    px(b[0], b[1], b[2], 1, '#f0b93f');
  }
  /* 鞋底 */
  px(4, 16, 16, 1, OUT);
  px(6, 17, 12, 1, '#c98b2a');

  /* 鞋带（横跨鞋面的一条） */
  px(5, 9, 14, 2, '#8a5a2a');
  px(5, 9, 14, 1, '#a8703a');

  /* 生气的眼睛 */
  px(7, 12, 3, 2, '#2a1a08');
  px(14, 12, 3, 2, '#2a1a08');
  px(7, 12, 1, 1, '#ffffff');
  px(14, 12, 1, 1, '#ffffff');
  /* 眉毛：向内压，显得凶 */
  px(6, 11, 4, 1, '#2a1a08');
  px(14, 11, 4, 1, '#2a1a08');
  /* 嘴：一道锯齿 */
  px(9, 14, 6, 1, '#2a1a08');
  px(10, 15, 1, 1, '#2a1a08');
  px(13, 15, 1, 1, '#2a1a08');

  /* 王冠 */
  px(7, 3, 10, 2, '#fff3b0');
  px(7, 4, 10, 1, '#ffd166');
  px(7, 1, 2, 2, '#fff3b0');
  px(11, 0, 2, 3, '#fff3b0');
  px(15, 1, 2, 2, '#fff3b0');
  px(9, 2, 1, 1, '#ff9dc0');
  px(13, 2, 1, 1, '#7ce3ff');

  return { img: c, white: whiteOf(c), w: c.width, h: c.height };
})();

/* --- 后半场三种怪：原本 SPAWN_TABLE 里引用了 brute / runner / nest，
       但 ENEMIES 里根本没有这三条数据，addEnemy() 直接 return ——
       于是 240 秒之后有将近 40% 的刷怪请求被静默丢弃，
       玩家看到的就是"后期只剩汉堡包一个怪"。这里补上形象。 --- */
function pxSprite(w, h, paint){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const px = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  paint(px);
  return { img: c, white: whiteOf(c), w: w, h: h };
}

/* 重甲兵：方头铁块 + 护甲板 + 红色观察窗 */
SPR.brute = pxSprite(20, 20, px => {
  const O = '#2b3442', S = '#9fb4c9', D = '#5d6f84', R = '#ff5f6d';
  px(5, 1, 10, 1, O);
  px(3, 2, 14, 12, O);
  px(4, 3, 12, 10, S);
  px(4, 3, 12, 3, D);        /* 肩甲 */
  px(6, 7, 8, 2, O);          /* 观察窗 */
  px(7, 7, 2, 2, R);
  px(11, 7, 2, 2, R);
  px(5, 10, 3, 3, D);         /* 胸口铆钉 */
  px(12, 10, 3, 3, D);
  px(4, 14, 4, 4, O);         /* 腿 */
  px(12, 14, 4, 4, O);
  px(5, 15, 2, 3, D);
  px(13, 15, 2, 3, D);
});

/* 疾行者：细长的紫色箭头，跑起来会拖尾 */
SPR.runner = pxSprite(16, 16, px => {
  const O = '#2e2340', P = '#c9a0ff', W = '#efe2ff';
  px(7, 1, 2, 1, O);
  px(6, 2, 4, 2, P);
  px(5, 4, 6, 3, P);
  px(4, 7, 8, 4, P);
  px(4, 7, 8, 1, W);
  px(2, 11, 4, 2, O);
  px(10, 11, 4, 2, O);
  px(6, 11, 4, 4, O);
  px(7, 12, 2, 3, P);
  px(3, 8, 2, 1, O);
  px(11, 8, 2, 1, O);
});

/* 巢母：一坨孵着崽的肉囊，会不停下崽 */
SPR.nest = pxSprite(22, 18, px => {
  const O = '#5a2438', B = '#ffb0c4', D = '#e0809c', E = '#8ce0a8';
  px(5, 2, 12, 1, O);
  px(3, 3, 16, 3, O);
  px(2, 6, 18, 8, O);
  px(3, 4, 16, 9, B);
  px(3, 12, 16, 2, D);
  px(6, 6, 4, 4, D);          /* 卵 */
  px(13, 6, 4, 4, D);
  px(9, 10, 4, 3, E);
  px(7, 7, 2, 2, '#fff3f6');
  px(14, 7, 2, 2, '#fff3f6');
  px(8, 15, 3, 3, O);
  px(12, 15, 3, 3, O);
  px(6, 8, 2, 2, '#3a1020');  /* 眼睛 */
  px(15, 8, 2, 2, '#3a1020');
});

/* 兜底形象（角色表里没有对应图时使用） */
SPR.player = SPR.ch_ranger;

SPR.slime = reg([
  '....oooo....',
  '..ooggggoo..',
  '.oggggggggo.',
  'oggglggggggo',
  'oggeggggeggo',
  'oggeggggeggo',
  'oggggggggggo',
  'oggglggggglo',
  '.oggggggggo.',
  '..ooggggoo..',
  '....oooo....'
], {'o':'#245040','g':'#a8f5af','l':'#dcffd8','e':'#1c3028'});

SPR.burger = reg([
  '...oooooooo...',
  '..obbbbbbbbo..',
  '.obbbbbbbbbbo.',
  '.obbebbbbbebbo',
  'ollllllllllllo',
  'ommmmmmmmmmmmo',
  'occcccccccccco',
  'ommmmmmmmmmmmo',
  '.ollllllllllo.',
  '.obbbbbbbbbbo.',
  '..oooooooooo..'
], {'o':'#5a3a2a','b':'#f2b45c','l':'#7fd06a','m':'#a2563f','c':'#ffe08a','e':'#2a2233'});

SPR.carrot = reg([
  '.....g.g....',
  '....gggg....',
  '...ggggg....',
  '..occcccco..',
  '..occcccco..',
  '..ocweewco..',
  '..occcccco..',
  '...occcco...',
  '...occcco...',
  '....occo....',
  '....occo....',
  '.....oo.....'
], {'o':'#8a3b12','c':'#ff8a3d','g':'#5ec95e','e':'#2a2233','w':'#ffe0b0'});

SPR.bat = reg([
  '..............',
  'ooo........ooo',
  'oppoo....ooppo',
  'opppoo..oopppo',
  '.opppoooppppo.',
  '..oppppppppo..',
  '..oppepppeppo.',
  '...oppppppo...',
  '....oo..oo....',
  '..............'
], {'o':'#43265a','p':'#bb8bdc','e':'#ff5f8f','w':'#e8d0ff'});

SPR.boss = reg([
  '....y......y......y.',
  '...yyy....yyy....yyy',
  '....yyyyyyyyyyyyyy..',
  '...oopppppppppppoo..',
  '..opppppppppppppppo.',
  '..oppwwwwwwwwwwwwpo.',
  '.oppwwwwwwwwwwwwwwpo',
  '.oppwweewwwweewwwwpo',
  '.opppppppppppppppppo',
  '.oppppwwwwwwwwpppppo',
  '..opppppppppppppppo.',
  '..oopppppppppppppoo.',
  '...ooppppppppppoo...',
  '.....ooooooooooo....'
], {'o':'#7a2d5a','p':'#ff8fc7','w':'#ffd9ea','e':'#3a1030','y':'#ffe066'});

SPR.candyBig = reg([
  '.pp.......pp.',
  'pppp.....pppp',
  '.ppppwwwpppp.',
  '..pwwwwwwwp..',
  '..pwwpppwwp..',
  '..pwwpwpwwp..',
  '..pwwwwwwwp..',
  '.ppppwwwpppp.',
  'pppp.....pppp',
  '.pp.......pp.'
], {'p':'#ff8fb0','w':'#fff6e6'});

/* 豌豆射手（远程） */
SPR.shooter = reg([
  '...oooooo...',
  '..oggggggo..',
  '.oggggggggo.',
  '.oggeggeggo.',
  '.oggggggggo.',
  '.oggggwwggo.',
  '..ogggwwggo.',
  '..oggggggo..',
  '...oggggo...',
  '....oooo....'
], {'o':'#245040','g':'#b6f78e','e':'#1c3028','w':'#4fc46a'});

/* 狙击手（远程 · 远距离高伤单发） */
SPR.sniper = reg([
  '............',
  '....oooo....',
  '...oxxxxo...',
  '..oxxxxxxo..',
  '..oxexxexo..',
  '..oxxxxxxo..',
  '...oxxxxo...',
  '..ooxxxxoo..',
  '..osssssso..',
  '..osssssso..',
  '...os..so...',
  '...oo..oo...'
], {'o':'#3a2020','x':'#e05575','e':'#ffe9a8','s':'#8a5a6a'});

/* 喷吐者（远程 · 三连扇形） */
SPR.spitter = reg([
  '............',
  '...oooooo...',
  '..ollllllo..',
  '.ollellello.',
  '.ollllllllo.',
  '.ollwwwwllo.',
  '..ollllllo..',
  '...oooooo...',
  '..ollllllo..',
  '...ollllo...',
  '...o....o...',
  '............'
], {'o':'#24402a','l':'#9cff6b','e':'#1c3028','w':'#ffe9a8'});

/* 投掷手（远程 · 抛掷爆弹） */
SPR.thrower = reg([
  '....oooo....',
  '...oTTTTo...',
  '..oTTTTTTo..',
  '..oTeTTeTo..',
  '..oTTTTTTo..',
  '...oTTTTo...',
  '..oooooooo..',
  '.oTTTTTTTTo.',
  '.oTTooooTTTo.',
  '.oTTobboTTo.',
  '..oo.bb.oo..',
  '.....oo.....'
], {'o':'#4a2a18','T':'#ffb066','e':'#2a1a10','b':'#ff5d5d'});

/* 暴躁番茄（自爆） */
SPR.bomb = reg([
  '.....gg.....',
  '....gggg....',
  '...oooooo...',
  '..orrrrrro..',
  '.orrrrrrrro.',
  '.orwrrrrwro.',
  '.oreerrreeo.',
  '.orrrrrrrro.',
  '..orrrrrro..',
  '...oooooo...'
], {'o':'#7a2418','r':'#ff5d5d','w':'#ffd9d9','e':'#3a1010','g':'#5ec95e'});

/* 布丁（分裂） */
SPR.pudding = reg([
  '...oooooo...',
  '..oyyyyyyo..',
  '.oyyyyyyyyo.',
  '.oyeeyyeeyo.',
  '.oyyyyyyyyo.',
  '.oyyywwyyyo.',
  '.oyyyyyyyyo.',
  '.oyyyyyyyyo.',
  '.ooyyyyyyoo.',
  '..oooooooo..'
], {'o':'#7a4a1f','y':'#ffcf8a','e':'#3a2410','w':'#fff0d0'});

/* 幽灵（直线冲） */
SPR.ghost = reg([
  '...oooooo...',
  '..owwwwwwo..',
  '.owwwwwwwwo.',
  'owweewweewwo',
  'owweewweewwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwwwwwwwwo',
  'owoowooowoow',
  '..o..oo..o..',
  '............'
], {'o':'#4a4a7a','w':'#dfe4ff','e':'#2a2440'});

/* 青蛙（蹦跳） */
SPR.frog = reg([
  '..oo....oo..',
  '.owwo..owwo.',
  '.owwoooowwo.',
  'owwwwwwwwwwo',
  'owweewweewwo',
  'owweewweewwo',
  'owwwwwwwwwwo',
  'owwwppppwwwo',
  '.owwwwwwwwo.',
  '..oowwwwwoo.',
  '...oooooo...',
  '............'
], {'o':'#1e5a4f','w':'#6fe0c8','e':'#14322c','p':'#ffe0d0'});

/* 蜜蜂（绕圈俯冲） */
SPR.bee = reg([
  '..w......w..',
  '.www....www.',
  '..ooyyyyoo..',
  '.oyykyyyyyo.',
  'oyykyyyykyyo',
  'oyyykkkkyyyo',
  '.oyykyykyyo.',
  '..oyyyyyyo..',
  '...oooooo...'
], {'o':'#6a4a10','y':'#ffd166','k':'#3a2a08','w':'#eaf6ff'});

/* 毒蘑菇（死亡留毒雾） */
SPR.mushroom = reg([
  '...oooooo...',
  '..orrrrrro..',
  '.orwwrrwwro.',
  '.orrrrrrrro.',
  '.orwwrrwwro.',
  '..orrrrrro..',
  '...oooooo...',
  '...owwwwo...',
  '...owwwwo...',
  '...owwwwo...',
  '...oooooo...',
  '............'
], {'o':'#7a2438','r':'#ff5d7a','w':'#fff0f4'});

