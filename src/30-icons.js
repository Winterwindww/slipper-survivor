/* =========================================================
   2. 图标（16x16 程序绘制）
   ---------------------------------------------------------
   【4.1】图标分成三层，解决"不同东西长得一模一样"：

     1) 手绘图标（下面的 switch）—— 每个是**一种东西**的形状。
        火焰就是火焰、炮台就是炮台。同类物品共用同一个形状是对的，
        玩家需要"一眼看出这是元素件"，而不是背 151 个图标。

     2) 改造图标 drawRune() —— 每张卡使用与效果相符的轮廓，
        如弹射弹丸、击中的盾牌、火焰、雪花、毒瓶、闪电和重锤。

     3) 角标 stampMark() —— 给遗物用。
        同一个家族（比如 13 件"护甲/反伤"件）共用形状，
        但每件盖一个由 id 哈希决定的角标（4 个位置 × 6 种记号），
        于是"同类一眼可辨、个体互不相同"。
   ========================================================= */

/* 稳定哈希：同一个 id 永远得到同一个角标，重开一局也不会变 */
function iconHash(s){
  let h = 2166136261;
  for(let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/* ---- 角标：4x4 像素记号，画在四个角之一 ---- */
function stampMark(g, seed, color){
  const h = iconHash(String(seed));
  const corner = h % 4;
  const kind = (h >>> 3) % 8;
  /* 将同一形状的遗物用不同印记标识，印记至少有 6×6，避免旧的
     5px 小字章缩放后只剩色点。 */
  const ox = (corner === 1 || corner === 3) ? 10 : 0;
  const oy = (corner >= 2) ? 10 : 0;
  /* 先铺一层暗底，保证角标在任何底色上都读得出来 */
  g.fillStyle = 'rgba(12,8,20,.88)';
  g.fillRect(ox, oy, 6, 6);
  const R = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, hh); };
  const c = color || '#ffe066';
  if(kind === 0){ R(1, 1, 4, 4, c); }
  else if(kind === 1){ R(0, 0, 6, 1, c); R(0, 5, 6, 1, c); }
  else if(kind === 2){ R(0, 0, 1, 6, c); R(5, 0, 1, 6, c); }
  else if(kind === 3){ R(0, 0, 2, 2, c); R(4, 0, 2, 2, c); R(2, 4, 2, 2, c); }
  else if(kind === 4){ R(2, 0, 2, 6, c); R(0, 2, 6, 2, c); }
  else if(kind === 5){ R(0, 0, 2, 2, c); R(4, 0, 2, 2, c); R(0, 4, 2, 2, c); R(4, 4, 2, 2, c); }
  else if(kind === 6){ R(0, 1, 6, 1, c); R(0, 4, 6, 1, c); R(1, 0, 1, 6, c); R(4, 0, 1, 6, c); }
  else { R(2, 0, 2, 2, c); R(0, 2, 6, 2, c); R(2, 4, 2, 2, c); }
}

/* 每张改造卡对应明确的动作或物件；相近效果可以共用物件，
   但加上方向、数量或命中状态的细节来表达它自己的作用。 */
const MOD_ICON_SHAPES = {
  scatter:'fan', flank:'flank', pierce:'pierce', bounce:'bounce', split:'split',
  blast:'blast', burn:'flame', chill:'snowflake', venom:'potion', volt:'lightning',
  haste:'stopwatch', heavy:'hammer', knock:'fist', reach:'spear', size:'expand',
  crit:'bullseye', bleed:'bleed', combo:'twinblades', echo:'echo', count:'pellets',
  spread:'spread', detonate:'bomb', chainkill:'chain', momentum:'momentum',
  overload:'overload', shatter:'shatter', swift:'boot', ragefuel:'rage-shot',
  chargeup:'battery', bloodpact:'blood-shot', opener:'opener', execute:'execute',
  longshot:'rifle', hunter:'crosshair', splash:'impact', mark:'mark'
};

function drawRune(g, key){
  const shape = MOD_ICON_SHAPES[key];
  if(!shape) return;
  const col = MOD_RUNE_COL[key] || '#c9b0ff';
  const ink = '#493432', cream = '#fff4d9', gold = '#ffd166', red = '#ed7668';
  const R = (x,y,w,h,c) => { g.fillStyle = c; g.fillRect(x,y,w,h); };
  const L = (x0,y0,x1,y1,c) => {
    let x=x0,y=y0,dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
    while(true){R(x,y,1,1,c);if(x===x1&&y===y1)break;const e=2*err;if(e>=dy){err+=dy;x+=sx}if(e<=dx){err+=dx;y+=sy}}
  };
  const bullet = (x,y,c) => {
    R(x,y+1,7,4,ink); R(x+1,y+2,5,2,c); R(x+6,y,3,6,ink);
    R(x+7,y+1,1,4,gold); R(x+2,y+2,2,1,cream);
  };
  const miniBullet = (x,y,c) => {
    R(x,y+1,4,2,ink); R(x+1,y+1,2,1,c); R(x+3,y,3,4,ink); R(x+4,y+1,1,2,gold);
  };
  const circle = (cx,cy,r,c) => {
    for(let y=-r;y<=r;y++){const w=Math.round(Math.sqrt(r*r-y*y));R(cx-w,cy+y,w*2+1,1,c)}
  };
  const ray = (cx,cy,dx,dy,len,c) => L(cx,cy,cx+dx*len,cy+dy*len,c);
  const burst = (cx,cy,c) => {
    for(const [dx,dy,len] of [[0,-1,4],[1,-1,3],[1,0,4],[1,1,3],[0,1,4],[-1,1,3],[-1,0,4],[-1,-1,3]]) ray(cx,cy,dx,dy,len,ink);
    circle(cx,cy,3,c); R(cx-1,cy-1,3,3,gold); R(cx,cy,1,1,cream);
  };
  const flame = (x,y,c) => {
    R(x+3,y,3,2,ink); R(x+2,y+2,5,2,ink); R(x+1,y+4,8,3,ink);
    R(x,y+7,10,3,ink); R(x+2,y+10,6,2,ink); R(x+4,y+12,3,1,ink);
    R(x+3,y+2,2,3,gold); R(x+2,y+5,6,4,c); R(x+4,y+7,3,4,gold); R(x+5,y+9,1,2,cream);
  };
  const target = (cx,cy,c) => {
    R(cx-1,cy-6,3,3,ink); R(cx-1,cy+4,3,3,ink); R(cx-6,cy-1,3,3,ink); R(cx+4,cy-1,3,3,ink);
    R(cx,cy-5,1,2,c); R(cx,cy+4,1,2,c); R(cx-5,cy,2,1,c); R(cx+4,cy,2,1,c);
    R(cx-3,cy-3,7,7,ink); R(cx-2,cy-2,5,5,c); R(cx-1,cy-1,3,3,cream); R(cx,cy,1,1,red);
  };

  switch(shape){
    case 'fan':
      miniBullet(7,1,col); miniBullet(2,6,gold); miniBullet(7,11,col);
      R(1,5,2,1,ink); R(4,4,2,1,ink); R(1,9,2,1,ink); R(4,10,2,1,ink); break;
    case 'flank':
      bullet(6,1,col); L(5,3,2,6,ink); L(2,6,0,8,ink);
      R(7,7,2,2,ink); R(8,8,1,1,cream);
      R(0,8,2,2,ink); R(1,8,1,1,col); L(3,9,6,12,ink); bullet(6,10,gold); break;
    case 'pierce':
      R(1,6,2,5,ink); R(2,7,2,3,col); R(3,8,1,1,cream);
      R(3,8,8,2,ink); R(5,9,6,1,gold); R(10,6,4,6,ink); R(11,7,2,4,col); R(13,8,2,2,ink); R(14,9,1,1,cream); break;
    case 'bounce':
      circle(4,10,3,ink); circle(4,10,2,gold); R(3,8,2,1,cream);
      R(7,9,6,1,col); R(12,4,1,6,col); R(8,3,5,1,col);
      R(12,2,1,2,ink); R(10,3,3,1,ink); R(14,4,1,7,ink);
      R(10,5,2,1,cream); R(8,7,2,1,gold); break;
    case 'split':
      bullet(1,5,col); L(7,7,10,3,ink); L(7,7,12,7,ink); L(7,7,10,12,ink);
      R(10,1,3,4,ink); R(11,2,1,2,gold); R(12,6,3,4,ink); R(13,7,1,2,cream); R(10,11,3,4,ink); R(11,12,1,2,col); break;
    case 'blast': burst(7,7,col); R(6,5,3,5,ink); R(7,6,1,3,cream); break;
    case 'flame': flame(3,1,col); break;
    case 'snowflake':
      L(7,1,7,14,ink); L(1,7,14,7,ink); L(3,3,12,12,ink); L(12,3,3,12,ink);
      L(7,2,5,4,col); L(7,2,9,4,col); L(7,13,5,11,col); L(7,13,9,11,col);
      L(2,7,4,5,col); L(2,7,4,9,col); L(13,7,11,5,col); L(13,7,11,9,col);
      R(6,6,3,3,cream); break;
    case 'potion':
      R(5,1,5,2,ink); R(6,3,3,3,ink); R(4,5,7,1,ink); R(3,6,9,7,ink); R(4,13,7,2,ink);
      R(6,2,3,1,cream); R(7,4,1,2,gold); R(5,7,6,5,col); R(6,7,3,2,'#d6ff9e'); R(5,12,5,1,gold); break;
    case 'lightning':
      L(9,0,4,7,ink); L(4,7,9,7,ink); L(9,7,5,15,ink);
      L(8,1,5,6,gold); L(5,8,8,8,gold); L(8,8,6,13,cream);
      R(1,4,2,1,col); R(0,10,2,1,col); R(12,3,2,1,gold); break;
    case 'stopwatch':
      R(6,1,4,2,ink); R(7,0,2,2,gold); R(3,4,10,9,ink); R(4,5,8,7,cream);
      L(8,6,8,9,col); L(8,9,11,10,col); R(5,14,2,1,gold); R(10,14,2,1,gold); break;
    case 'hammer':
      L(6,7,12,14,ink); L(7,7,13,13,'#b98649');
      R(2,2,10,5,ink); R(1,4,12,3,col); R(4,1,6,2,ink); R(5,2,4,1,cream); R(6,7,2,2,ink); break;
    case 'fist':
      R(5,4,8,7,ink); R(3,6,4,5,ink); R(6,3,2,3,ink); R(9,2,2,4,ink); R(12,4,2,3,ink);
      R(6,5,6,5,col); R(4,7,2,3,gold); R(6,4,1,2,cream); R(8,12,4,2,ink); R(9,13,3,1,col);
      L(1,3,3,4,gold); L(0,9,2,9,gold); break;
    case 'spear':
      L(2,13,12,3,ink); L(3,13,13,4,'#9b6d46');
      R(10,1,4,4,ink); R(11,1,3,2,cream); R(12,3,2,2,col); R(9,4,3,3,ink); R(9,5,2,1,gold);
      R(1,12,3,3,ink); break;
    case 'expand':
      R(6,6,4,4,ink); R(7,7,2,2,col);
      L(7,6,7,1,ink); L(7,1,5,3,col); L(7,1,9,3,col);
      L(9,9,14,9,ink); L(14,9,12,7,col); L(14,9,12,11,col);
      L(7,9,2,9,ink); L(2,9,4,7,col); L(2,9,4,11,col);
      L(9,7,9,2,ink); L(9,2,7,4,col); L(9,2,11,4,col); break;
    case 'bullseye': target(7,8,col); R(5,1,5,2,gold); R(6,0,3,1,gold); break;
    case 'bleed':
      R(7,1,3,2,ink); R(5,3,7,3,ink); R(4,6,9,3,ink); R(5,9,7,3,ink); R(7,12,4,2,ink); R(8,14,2,1,ink);
      R(7,3,4,3,red); R(6,7,6,4,col); R(8,11,3,2,red); R(7,5,2,1,cream); L(12,2,14,0,gold); break;
    case 'twinblades':
      L(1,12,8,4,ink); L(2,12,9,5,cream); L(4,14,2,12,ink); L(3,13,5,15,ink);
      L(8,12,14,3,ink); L(9,12,14,4,cream); L(10,14,8,12,ink); L(13,13,15,11,ink);
      R(7,7,3,2,gold); break;
    case 'echo':
      R(1,5,7,5,'#b7dff0'); R(2,6,4,2,cream); R(6,4,3,7,'#b7dff0');
      R(7,3,7,6,ink); R(8,4,5,4,col); R(12,2,2,8,ink); R(13,3,1,5,gold);
      R(2,12,2,2,gold); R(4,14,2,1,gold); break;
    case 'pellets':
      circle(4,4,2,ink); circle(4,4,1,gold); circle(11,4,2,ink); circle(11,4,1,col);
      circle(7,10,3,ink); circle(7,10,2,col); R(6,8,2,1,cream); R(11,10,2,2,gold); R(2,10,2,2,gold); break;
    case 'spread':
      flame(0,3,col); circle(12,3,2,ink); circle(12,3,1,gold); circle(13,8,2,ink); circle(13,8,1,col); circle(11,13,2,ink); circle(11,13,1,gold);
      L(7,7,10,4,col); L(7,9,10,12,col); break;
    case 'bomb':
      circle(7,9,5,ink); circle(7,9,4,col); R(6,6,3,6,'#b84d42'); R(7,7,1,3,gold); R(6,3,3,2,ink); L(8,4,11,1,ink);
      R(11,0,2,2,gold); R(13,2,2,2,red); R(9,1,2,1,cream); R(3,12,3,2,ink); R(10,12,3,2,ink); break;
    case 'chain':
      circle(3,4,2,ink); circle(3,4,1,col); circle(12,11,2,ink); circle(12,11,1,gold);
      L(5,5,8,7,col); L(8,7,10,9,ink); L(7,6,10,8,cream); L(9,7,12,4,gold); R(11,3,4,1,ink); break;
    case 'momentum':
      R(2,3,8,8,ink); R(3,4,5,5,col); R(7,9,5,4,ink); R(8,10,3,2,gold);
      R(1,12,6,2,ink); R(0,14,5,1,col); L(9,5,14,2,gold); L(10,8,15,6,gold); break;
    case 'overload':
      R(2,3,11,11,ink); R(4,5,7,7,col); R(5,4,4,1,gold); R(5,2,4,2,ink); R(6,1,2,1,gold);
      L(9,5,6,9,gold); L(6,9,9,9,gold); L(9,9,7,12,cream); R(13,6,2,2,red); break;
    case 'shatter':
      R(5,1,6,3,ink); R(3,4,10,7,ink); R(5,11,6,3,ink); R(6,3,4,2,col); R(4,5,8,5,'#b7e9f4'); R(6,10,5,2,col);
      L(9,4,7,7,ink); L(7,7,9,8,ink); L(9,8,6,12,ink); L(2,3,4,1,gold); L(12,13,14,14,gold); break;
    case 'boot':
      R(4,2,4,7,ink); R(6,7,3,3,ink); R(8,9,5,2,ink); R(11,10,3,3,ink); R(3,11,11,3,ink); R(2,13,13,2,ink);
      R(5,3,2,5,cream); R(7,9,4,1,col); R(4,12,9,1,gold); L(1,5,3,4,gold); L(0,8,2,7,gold); break;
    case 'rage-shot': bullet(2,7,col); flame(7,1,red); break;
    case 'battery':
      R(2,4,12,9,ink); R(4,6,8,5,'#f2cf72'); R(5,2,6,2,ink); R(6,3,4,2,gold);
      L(9,6,7,9,col); L(7,9,9,9,col); L(9,9,8,11,ink); R(3,14,2,1,ink); R(12,14,2,1,ink); break;
    case 'blood-shot': bullet(1,7,col); R(9,2,3,2,ink); R(7,4,7,3,ink); R(8,7,6,3,ink); R(9,10,4,2,ink); R(10,12,2,2,ink); R(10,4,4,2,red); R(9,7,4,2,col); R(10,9,3,2,red); break;
    case 'opener':
      target(7,8,col); R(0,1,5,2,gold); R(0,1,2,5,gold); R(11,1,5,2,gold); R(14,1,2,5,gold);
      R(0,13,5,2,gold); R(0,10,2,5,gold); R(11,13,5,2,gold); R(14,10,2,5,gold); break;
    case 'execute':
      L(12,1,7,8,ink); L(7,8,5,5,ink); L(6,4,9,8,red); L(7,3,10,7,cream); R(2,12,8,2,ink); R(4,14,5,1,ink); R(5,13,3,1,gold); break;
    case 'rifle':
      R(1,7,10,3,ink); R(3,6,7,1,col); R(11,8,4,1,ink); R(14,7,2,3,ink); R(5,10,3,3,ink); R(6,11,1,2,'#b98649');
      R(2,8,7,1,cream); R(4,5,2,2,ink); R(5,4,2,1,gold); R(12,5,2,1,gold); R(14,4,2,3,col); break;
    case 'crosshair':
      target(7,8,col); L(7,0,7,4,gold); L(7,12,7,15,gold); L(0,8,3,8,gold); L(11,8,15,8,gold);
      R(4,6,2,2,ink); R(10,6,2,2,ink); R(5,10,5,1,ink); R(6,10,3,1,cream); break;
    case 'impact':
      burst(7,8,col); R(6,7,3,3,ink); R(7,8,1,1,cream);
      L(1,2,3,4,gold); L(0,8,2,8,gold); L(2,13,4,12,gold); L(12,3,14,1,gold); L(13,12,15,14,gold); break;
    case 'mark':
      target(7,8,red); R(10,1,4,4,ink); R(11,2,2,2,gold); R(12,3,1,1,red);
      L(11,5,9,7,ink); R(10,12,4,2,red); R(11,14,2,1,ink); break;
  }
}

function drawIcon(g, id, seed, tint){
  g.setTransform(1,0,0,1,0,0);
  g.clearRect(0, 0, 16, 16);
  const R = (x,y,w,h,c) => { g.fillStyle = c; g.fillRect(x,y,w,h); };
  const C = (cx,cy,r,c) => {
    g.fillStyle = c;
    for(let y = -r; y <= r; y++){
      const w = Math.round(Math.sqrt(Math.max(0, r*r - y*y)));
      g.fillRect(cx - w, cy + y, w*2 + 1, 1);
    }
  };
  /* 改造卡的符文图标 */
  if(typeof id === 'string' && id.charAt(0) === '#'){
    drawRune(g, id.slice(1));
    return;
  }
  switch(id){
    case 'slipper':
      R(3,6,10,5,'#ff9dc0'); R(3,6,10,2,'#ffc7dc');
      R(2,10,12,3,'#fff2e2'); R(2,12,12,1,'#e8d6c4');
      R(5,8,7,1,'#e0527c');
      break;
    case 'banana':
      C(8,7,6,'#ffd83d');
      g.globalCompositeOperation = 'destination-out';
      C(9,4,5,'#000');
      g.globalCompositeOperation = 'source-over';
      C(8,11,2,'#ffd83d'); R(11,2,2,3,'#a8792a');
      break;
    case 'candy':
      R(1,7,2,3,'#ffd166'); R(13,7,2,3,'#ffd166');
      C(8,8,5,'#ff8fb0'); C(8,8,3,'#fff6e6'); C(8,8,1,'#ff8fb0');
      break;
    case 'bubble':
      C(8,8,6,'#5fd8ff'); C(8,8,4,'#9de9ff');
      C(6,6,2,'#ffffff'); R(11,11,1,1,'#ffffff');
      break;
    case 'tomato':
      C(8,9,6,'#ff5d5d'); C(7,8,2,'#ff9b9b');
      R(6,2,4,3,'#5ec95e'); R(8,3,2,1,'#3f9e3f'); R(3,4,3,2,'#5ec95e'); R(10,4,3,2,'#5ec95e');
      break;
    case 'bolt':
      R(9,1,4,2,'#ffe066'); R(7,3,4,3,'#ffe066'); R(5,6,5,3,'#ffe066');
      R(7,9,4,3,'#ffc93d'); R(9,11,3,3,'#ffc93d'); R(4,7,3,2,'#fff3a8');
      break;
    case 'heart':
      C(5,5,3,'#ff6b8f'); C(11,5,3,'#ff6b8f');
      R(3,6,11,3,'#ff6b8f'); R(4,9,9,2,'#ff6b8f'); R(5,11,7,2,'#ff6b8f');
      R(6,12,5,1,'#ff6b8f'); R(7,13,3,1,'#ff6b8f');
      C(5,4,1,'#ffc2d1');
      break;
    case 'shoe':
      R(4,5,6,6,'#8ee06e'); R(3,10,11,3,'#7bcf5e');
      R(2,13,12,2,'#fff6e6'); R(5,7,4,1,'#e8fbe0');
      break;
    case 'sauce':
      R(6,1,4,2,'#3a2b3f'); R(5,3,6,2,'#ff5c3d');
      R(6,5,4,8,'#ff5c3d'); R(7,6,2,6,'#ff8a5c');
      R(5,13,6,2,'#c73d22');
      break;
    case 'lens':
      C(7,7,6,'#bfe9ff'); C(7,7,4,'#e8fbff'); C(6,6,2,'#ffffff');
      R(11,11,2,2,'#8a6a4a'); R(12,13,2,2,'#6d5138');
      break;
    case 'reach':
      R(1,9,14,3,'#a6ffcb'); R(1,9,14,1,'#e6fff4');
      R(3,6,2,3,'#d8ffe9'); R(7,7,2,2,'#d8ffe9'); R(11,6,2,3,'#d8ffe9');
      R(1,12,14,1,'#4fbf8f');
      break;
    case 'clover':
      C(5,5,3,'#6fdc8c'); C(11,5,3,'#6fdc8c');
      C(5,11,3,'#6fdc8c'); C(11,11,3,'#6fdc8c');
      R(7,6,2,4,'#4fbf6f'); R(9,10,2,4,'#4fbf6f');
      break;
    case 'star':
      R(7,1,2,3,'#ffe066'); R(5,4,6,3,'#ffe066'); R(1,5,14,3,'#ffd166');
      R(3,8,10,3,'#ffd166'); R(4,11,3,3,'#ffcf4d'); R(9,11,3,3,'#ffcf4d');
      R(6,13,4,2,'#ffb84d'); R(6,5,2,2,'#fff6c2');
      break;
    case 'magnet':
      R(4,3,3,8,'#ff5d5d'); R(9,3,3,8,'#ff5d5d');
      R(4,3,8,3,'#ff5d5d'); R(4,10,3,2,'#e8e8f0'); R(9,10,3,2,'#e8e8f0');
      R(5,4,1,5,'#ff9b9b');
      break;
    case 'glove':
      R(4,5,8,7,'#ffa8c8'); R(6,2,5,4,'#ffa8c8');
      R(3,7,2,4,'#ffa8c8'); R(4,11,8,3,'#ff8fb0');
      R(6,3,3,1,'#ffd0e0');
      break;
    case 'popcorn':
      R(4,4,4,3,'#fff6e0'); R(7,3,3,3,'#fff6e0'); R(5,6,3,3,'#fff6e0');
      R(10,4,3,3,'#fff6e0'); R(2,6,3,3,'#fff6e0');
      R(4,10,8,4,'#ff6b6b'); R(5,11,6,1,'#fff6e6'); R(5,13,6,1,'#fff6e6');
      break;
    case 'multi':
      C(8,4,2,'#c9b0ff'); C(4,10,2,'#e0d3ff'); C(12,10,2,'#e0d3ff');
      R(7,5,2,6,'#a78bfa'); R(4,12,2,2,'#a78bfa'); R(11,12,2,2,'#a78bfa');
      break;
    case 'pierce':
      R(2,7,10,2,'#9fe0ff'); R(11,5,2,2,'#9fe0ff'); R(11,9,2,2,'#9fe0ff');
      R(13,7,2,2,'#e6f7ff'); C(6,7,3,'#5fa8d8');
      break;
    case 'vamp':
      C(8,6,4,'#ff6b8f'); R(6,9,2,4,'#ffffff'); R(9,9,2,4,'#ffffff');
      break;
    case 'aura':
      C(8,8,7,'#ff5a2a'); C(8,8,5,'#ff9a3d'); C(8,8,3,'#ffd166'); C(8,8,1,'#fff6d0');
      R(2,7,2,2,'#ff9a3d'); R(12,7,2,2,'#ff9a3d'); R(7,2,2,2,'#ff9a3d'); R(7,12,2,2,'#ff9a3d');
      break;
    case 'fan':
      R(7,1,2,6,'#b6f0ff'); R(7,9,2,6,'#8fdcf5'); R(1,7,6,2,'#b6f0ff'); R(9,7,6,2,'#8fdcf5');
      C(8,8,2,'#ffffff'); C(8,8,1,'#4fb8d8');
      break;
    case 'beam':
      R(1,7,14,2,'#ff7ae0'); R(1,7,14,1,'#ffd6f7');
      R(2,5,12,1,'#ff9ae8'); R(2,10,12,1,'#ff9ae8');
      C(14,8,2,'#ffffff');
      break;
    case 'mine':
      C(8,9,5,'#ff5f8f'); C(7,8,2,'#ffa8c4');
      R(7,2,2,3,'#7a4a1f'); R(8,1,3,2,'#ffd166');
      R(5,9,2,1,'#fff6e6'); R(9,11,2,1,'#fff6e6');
      break;
    case 'hole':
      C(8,8,7,'#b98cff'); C(8,8,5,'#6b3fb8'); C(8,8,3,'#2a1046'); C(8,8,1,'#000000');
      R(1,7,2,2,'#e0c8ff'); R(13,7,2,2,'#e0c8ff');
      break;
    case 'chain':
      R(4,2,2,3,'#8fd8ff'); R(6,5,2,3,'#d8f4ff'); R(4,8,2,3,'#8fd8ff'); R(6,11,2,3,'#d8f4ff');
      R(3,4,3,1,'#bde9ff'); R(5,9,3,1,'#bde9ff');
      C(8,4,2,'#ffffff'); C(8,13,2,'#ffffff');
      break;
    case 'missile':
      R(2,7,9,2,'#ff8f6b'); R(2,6,7,4,'#ff8f6b'); R(10,6,2,4,'#ffd0b8');
      R(1,7,2,2,'#ffd166'); R(4,7,4,1,'#fff2e6');
      break;
    case 'gun':
      R(2,6,9,4,'#ffd166'); R(3,7,7,2,'#fff2c0');
      R(11,7,4,2,'#ffe066'); R(11,9,2,2,'#c9a03c');
      R(4,10,2,4,'#a8762a'); R(8,10,2,3,'#a8762a');
      break;
    case 'snipe':
      R(1,7,14,2,'#c7a2ff'); R(1,7,14,1,'#eadcff');
      C(14,8,2,'#ffffff'); C(2,8,2,'#9a76e0');
      R(5,4,2,2,'#e0c8ff'); R(7,10,2,2,'#e0c8ff');
      break;
    case 'frost':
      R(7,1,2,14,'#9fe8ff'); R(1,7,14,2,'#9fe8ff');
      R(4,4,2,2,'#d8f6ff'); R(10,4,2,2,'#d8f6ff'); R(4,10,2,2,'#d8f6ff'); R(10,10,2,2,'#d8f6ff');
      C(8,8,2,'#ffffff');
      break;
    case 'heal':
      C(8,8,6,'#ffd166'); R(6,4,4,8,'#fff6e6'); R(4,6,8,4,'#fff6e6');
      break;
    /* ---- 2.0 新增 ---- */
    case 'pan':
      C(7,10,6,'#5a6270'); C(7,10,5,'#8a93a3'); C(7,10,3,'#4e5665');
      R(11,3,3,3,'#c9d4e2'); R(12,5,2,2,'#8a93a3'); R(13,6,2,5,'#6b7382');
      break;
    case 'turret':
      R(3,9,10,5,'#ffe066'); R(4,10,8,3,'#fff2b0');
      R(6,4,4,5,'#ffd166'); R(7,1,2,3,'#fff6e6');
      R(2,13,3,2,'#c9a03c'); R(11,13,3,2,'#c9a03c');
      R(8,6,6,2,'#ffb84d');
      break;
    case 'pet':
      C(8,8,5,'#e6c17a'); C(6,6,1,'#3a2b3f'); C(10,6,1,'#3a2b3f');
      C(8,10,2,'#fff2e0'); C(8,9,1,'#3a2b3f');
      R(2,4,3,3,'#c9a45c'); R(11,4,3,3,'#c9a45c');
      break;
    case 'flamer':
      R(2,12,5,3,'#8a93a3'); R(6,10,4,4,'#c9d4e2');
      R(10,4,2,7,'#ff5a2a'); R(9,7,3,4,'#ff9a3d'); R(11,9,2,3,'#ffd166');
      break;
    case 'dice':
      R(3,3,10,10,'#fff6e6'); R(4,4,8,8,'#ff9dc0');
      R(5,5,2,2,'#ffffff'); R(9,9,2,2,'#ffffff'); R(5,9,2,2,'#ffffff'); R(9,5,2,2,'#ffffff');
      break;
    case 'boomerang':
      R(3,4,3,3,'#a6ffcb'); R(10,4,3,3,'#a6ffcb'); R(4,7,8,3,'#7be0a8');
      R(6,10,4,3,'#7be0a8'); R(7,12,2,2,'#a6ffcb');
      break;
    case 'totem':
      R(7,2,2,3,'#ffe066'); C(8,7,3,'#ffd166');
      R(5,10,6,2,'#8a6a4a'); R(4,12,8,3,'#6b5138');
      R(2,7,1,2,'#ffe066'); R(13,7,1,2,'#ffe066');
      break;
    case 'gem':
      R(7,2,2,2,'#7df9ff'); R(5,4,6,4,'#5fd8ff'); R(6,8,4,3,'#9de9ff'); R(7,11,2,2,'#e0fbff');
      break;
    case 'cleaver':
      R(4,2,7,3,'#cfd6e2'); R(3,4,9,6,'#e6eefc'); R(4,5,7,4,'#ffffff');
      R(11,4,2,6,'#aab4c4'); R(5,10,3,5,'#8a6a4a'); R(9,10,2,4,'#6b5138');
      break;
    case 'bat':
      R(4,2,6,6,'#f2b45c'); R(5,3,4,4,'#ffd7a0'); R(9,7,3,3,'#d99b45');
      R(10,9,2,4,'#a8792a'); R(11,12,2,3,'#8a5f1f');
      break;
    case 'chainsaw':
      R(2,7,7,4,'#ff9d4d'); R(3,8,5,2,'#ffcf7a'); R(1,8,2,2,'#c9d4e2');
      R(9,6,5,6,'#c9d4e2'); R(10,7,1,4,'#8a93a3'); R(12,7,1,4,'#8a93a3');
      R(6,11,4,3,'#8a6a4a');
      break;
    case 'mop':
      R(2,11,10,2,'#a6ffcb'); R(3,12,8,2,'#7be0a8'); R(10,3,2,9,'#8a6a4a');
      R(9,1,4,3,'#c9d4e2'); R(2,9,3,2,'#d8ffe9');
      break;
    case 'ladle':
      C(6,10,5,'#c7a2ff'); C(6,10,3,'#e6d6ff');
      R(9,3,2,8,'#8a93a3'); R(8,1,4,3,'#c9d4e2');
      break;
    case 'nunchaku':
      R(2,3,2,7,'#ffe066'); R(3,10,2,2,'#c9a03c');
      R(11,6,2,7,'#ffe066'); R(10,5,2,2,'#c9a03c');
      R(4,11,7,2,'#8a93a3');
      break;
    case 'pizza':
      C(8,8,6,'#ffd166'); C(8,8,4,'#ff8fb0'); C(8,8,2,'#fff6e6');
      R(1,7,3,2,'#c9d4e2'); R(13,7,3,2,'#c9d4e2');
      break;
    case 'vial':
      R(6,1,4,3,'#8a93a3'); R(5,4,6,9,'#a6e05a'); R(6,5,4,7,'#d6ff7a');
      R(5,12,6,2,'#4f9e2a');
      break;
    /* ---------- 3.0：五条新流派 ---------- */
    case 'rage':            /* 一团向上窜的火 */
      R(6,2,4,2,'#ffb056'); R(5,4,6,4,'#ff8a5c'); R(4,7,8,5,'#ff5a3d');
      R(6,9,4,4,'#ffd166'); R(3,5,2,3,'#ff5a3d'); R(11,5,2,3,'#ff5a3d');
      R(7,11,2,3,'#fff3c4');
      break;
    case 'flesh':           /* 一块带骨头的肉 */
      C(8,9,5,'#ff5f7e'); C(7,8,3,'#ff9db0');
      R(3,9,3,2,'#fff2e2'); R(11,4,2,5,'#fff2e2'); R(5,3,2,4,'#fff2e2');
      R(7,13,5,1,'#c23d5a');
      break;
    case 'gear':            /* 齿轮 */
      C(8,8,5,'#7ce3ff'); C(8,8,2,'#1b2b3d');
      R(7,0,2,3,'#7ce3ff'); R(7,13,2,3,'#7ce3ff');
      R(0,7,3,2,'#7ce3ff'); R(13,7,3,2,'#7ce3ff');
      R(2,2,3,2,'#5fd8ff'); R(11,2,3,2,'#5fd8ff');
      R(2,12,3,2,'#5fd8ff'); R(11,12,3,2,'#5fd8ff');
      break;
    case 'shield':          /* 六边形护盾 */
      R(6,1,4,2,'#bff0ff'); R(4,3,8,5,'#9fe8ff'); R(5,8,6,4,'#7ce3ff');
      R(6,12,4,2,'#5fd8ff'); R(7,4,2,5,'#e8fbff');
      break;
    case 'devour':          /* 一张嘴 / 吞噬 */
      C(8,7,6,'#6fdc5c'); C(8,7,4,'#12300f');
      R(4,3,2,2,'#d6ff7a'); R(10,3,2,2,'#d6ff7a');
      R(5,9,2,2,'#ffffff'); R(9,9,2,2,'#ffffff');
      R(6,12,4,1,'#a6e05a');
      break;
    /* ---------- 4.1：把"长得一样"的几组拆开 ---------- */
    case 'pot':             /* 高压锅：带阀的圆锅 */
      C(8,10,5,'#c9d4e2'); C(8,10,3,'#8a93a3');
      R(4,4,8,2,'#e6eefc'); R(7,1,2,3,'#ff9d4d'); R(10,2,2,2,'#ff6b4d');
      R(3,14,10,1,'#6b7382');
      break;
    case 'jar':             /* 余烬瓶：短颈陶瓶 + 火星 */
      R(6,1,4,2,'#8a6a4a'); R(5,3,6,2,'#a8792a');
      C(8,9,5,'#b06a3d'); C(7,8,3,'#d98a56');
      R(6,5,4,1,'#ff9d4d'); R(9,7,2,2,'#ffd166'); R(5,10,2,2,'#ff6b4d');
      break;
    case 'crossbow':        /* 连发弩：横向弩臂 + 弹匣 */
      R(1,6,14,2,'#c9a03c'); R(1,5,2,4,'#ffe066'); R(13,5,2,4,'#ffe066');
      R(2,8,12,1,'#a8762a'); R(6,9,3,5,'#8a6a4a');
      R(7,4,2,3,'#9fe0ff'); R(9,10,4,3,'#e6eefc');
      break;
    case 'spire':           /* 塔：细长的炮塔轮廓 */
      R(6,1,4,3,'#ffe066'); R(5,4,6,6,'#c9a03c');
      R(3,10,10,3,'#8a93a3'); R(2,13,12,2,'#5e6675');
      R(7,5,2,4,'#fff6e6');
      break;
    case 'factory':         /* 工厂：厂房 + 烟囱 */
      R(2,7,12,7,'#9fb4c9'); R(2,7,12,2,'#c9d4e2');
      R(10,1,3,6,'#8a93a3'); R(10,0,3,2,'#ff5f8f');
      R(4,10,3,3,'#2a2233'); R(9,10,3,3,'#2a2233');
      break;
    case 'comb':            /* 蜂巢：六格蜂房 */
      R(4,2,8,11,'#ffd166');
      R(5,3,2,2,'#8a5f1f'); R(9,3,2,2,'#8a5f1f');
      R(4,6,2,2,'#8a5f1f'); R(8,6,2,2,'#8a5f1f');
      R(5,9,2,2,'#8a5f1f'); R(9,9,2,2,'#8a5f1f');
      R(3,5,1,5,'#e8b84d'); R(12,5,1,5,'#e8b84d');
      C(8,8,1,'#fff2c0');
      break;
    case 'coil':            /* 线圈：两圈铜线 + 电弧 */
      R(3,3,10,2,'#c9a03c'); R(3,7,10,2,'#c9a03c'); R(3,11,10,2,'#c9a03c');
      R(2,2,2,13,'#8a6a4a'); R(12,2,2,13,'#8a6a4a');
      R(6,5,4,2,'#9fe8ff'); R(7,9,2,2,'#ffffff');
      break;
    case 'drum':            /* 雷鼓：鼓面 + 闪电 */
      C(8,9,5,'#ff8a3d'); C(8,9,4,'#ffe066'); C(8,9,2,'#ff5a2a');
      R(3,3,10,1,'#a8762a'); R(3,14,10,1,'#a8762a');
      R(1,7,2,4,'#ff9d4d'); R(13,7,2,4,'#ff9d4d');
      R(9,1,2,2,'#9fe8ff'); R(7,2,2,2,'#9fe8ff'); R(8,3,2,3,'#ffffff');
      break;
    case 'icetower':        /* 冰冻炮塔：塔座 + 上方雪花 */
      R(5,7,6,6,'#8fe8ff'); R(4,12,8,3,'#5fa8d8'); R(3,14,10,1,'#3d7fa8');
      R(7,1,2,2,'#d8f6ff'); R(4,3,8,2,'#bff0ff'); R(6,2,4,2,'#e8fbff');
      R(6,9,4,2,'#e8fbff');
      break;
    default:
      R(4,4,8,8,'#cccccc');
  }
  /* 第三层：同类物品的个体角标 */
  if(seed !== undefined && seed !== null) stampMark(g, seed, tint);
}

/* 改造卡符文的配色：按改造的类型分组，同类同色、个体不同符 */
const MOD_RUNE_COL = {
  scatter:'#9fe0ff', pierce:'#9fe0ff', bounce:'#9fe0ff', split:'#9fe0ff',
  blast:'#ff9d4d', heavy:'#ff9d4d', knock:'#ff9d4d', detonate:'#ff9d4d', size:'#ff9d4d',
  burn:'#ff6b4d', shatter:'#8fe8ff', chill:'#8fe8ff', venom:'#a6e05a', volt:'#ffe066',
  haste:'#7ce3ff', swift:'#7ce3ff', momentum:'#7ce3ff', reach:'#a6ffcb',
  crit:'#ffd166', bleed:'#ff6b8f', combo:'#ffd166',
  echo:'#c9b0ff', count:'#c9b0ff', spread:'#c9b0ff',
  overload:'#ff7ae0', chargeup:'#ff7ae0', chainkill:'#9fe8ff',
  flank:'#8ee6b3', ragefuel:'#ff8a5c', bloodpact:'#ff6b8f'
};

