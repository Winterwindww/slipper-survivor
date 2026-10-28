/* =========================================================
   12. 渲染
   ========================================================= */
let groundPat = null;
function makeGround(){
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#77c25a';
  g.fillRect(0, 0, size, size);

  // 极低对比度的草皮起伏（用点簇而不是矩形块，避免网格感）
  for(let i = 0; i < 26; i++){
    const cx = ri(0, size), cy = ri(0, size);
    const col = Math.random() < 0.5 ? '#71ba55' : '#7dcb60';
    g.fillStyle = col;
    for(let k = 0; k < 26; k++){
      const a = rand(0, TAU), r = Math.pow(Math.random(), 0.6) * rand(14, 44);
      g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 3, 3);
    }
  }
  // 细密草点
  for(let i = 0; i < 130; i++){
    g.fillStyle = Math.random() < 0.5 ? '#6db250' : '#85d468';
    g.fillRect(ri(0, size - 2), ri(0, size - 2), 2, 2);
  }
  // 草叶
  for(let i = 0; i < 26; i++){
    const x = ri(2, size - 8), y = ri(4, size - 8);
    g.fillStyle = '#63a948';
    g.fillRect(x, y, 1, 4);
    g.fillRect(x + 2, y + 1, 1, 3);
    g.fillRect(x + 4, y - 1, 1, 5);
    g.fillStyle = '#a6e886';
    g.fillRect(x, y - 1, 1, 1);
    g.fillRect(x + 4, y - 2, 1, 1);
  }
  // 小花
  for(let i = 0; i < 5; i++){
    const cx = ri(8, size - 10), cy = ri(8, size - 10);
    const col = pickOne(['#ffe066', '#ffb3c7', '#ffffff', '#c9b0ff']);
    g.fillStyle = col;
    g.fillRect(cx, cy, 2, 2);
    g.fillRect(cx - 2, cy + 2, 6, 2);
    g.fillRect(cx, cy + 4, 2, 2);
    g.fillStyle = '#ffcf4d';
    g.fillRect(cx, cy + 2, 2, 2);
  }
  groundPat = ctx.createPattern(c, 'repeat');
}

/* --- 世界装饰物（固定随机，不参与碰撞） --- */
const PROPS = [];
function makeProps(){
  PROPS.length = 0;
  let seed = 20261017;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const kinds = ['bush', 'bush', 'mush', 'cane', 'rock', 'tuft', 'tuft'];
  for(let i = 0; i < 120; i++){
    const x = 40 + rnd() * (ARENA.w - 80);
    const y = 40 + rnd() * (ARENA.h - 80);
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    PROPS.push({ x, y, kind, s: 0.8 + rnd() * 0.5, flip: rnd() < 0.5 });
  }
  PROPS.sort((a, b) => a.y - b.y);
}

/* --- 低频草地色块：打散平铺纹理的重复感 --- */
const BLOBS = [];
let blobCanvas = null;
let vigCanvas = null;

function makeBlobs(){
  BLOBS.length = 0;
  let seed = 991733;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const cols = ['110,190,86', '92,172,72', '134,208,104', '80,158,64'];
  for(let i = 0; i < 18; i++){
    BLOBS.push({
      x: rnd() * ARENA.w, y: rnd() * ARENA.h,
      rx: 80 + rnd() * 130, ry: 58 + rnd() * 90,
      col: cols[Math.floor(rnd() * cols.length)],
      a: 0.12 + rnd() * 0.09
    });
  }

  // 一次性烘焙到离屏画布
  blobCanvas = document.createElement('canvas');
  blobCanvas.width = ARENA.w;
  blobCanvas.height = ARENA.h;
  const g = blobCanvas.getContext('2d');
  for(const b of BLOBS){
    g.save();
    g.translate(b.x, b.y);
    g.scale(1, b.ry / b.rx);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, b.rx);
    grad.addColorStop(0, 'rgba(' + b.col + ',' + b.a + ')');
    grad.addColorStop(0.65, 'rgba(' + b.col + ',' + (b.a * 0.45) + ')');
    grad.addColorStop(1, 'rgba(' + b.col + ',0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, b.rx, 0, TAU);
    g.fill();
    g.restore();
  }
}

function drawBlobs(){
  if(!blobCanvas) return;
  const sx0 = clamp(cam.x, 0, ARENA.w - W);
  const sy0 = clamp(cam.y, 0, ARENA.h - H);
  ctx.drawImage(blobCanvas, sx0, sy0, W, H, sx0 - cam.x, sy0 - cam.y, W, H);
}

function makeVignette(){
  vigCanvas = document.createElement('canvas');
  vigCanvas.width = W;
  vigCanvas.height = H;
  const g = vigCanvas.getContext('2d');
  const vg = g.createRadialGradient(W/2, H/2, H*0.45, W/2, H/2, H*0.98);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(24,10,36,0.34)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}

function drawProps(){
  for(let i = 0; i < PROPS.length; i++){
    const p = PROPS[i];
    if(p.x < cam.x - 40 || p.x > cam.x + W + 40 || p.y < cam.y - 40 || p.y > cam.y + H + 40) continue;
    const x = Math.round(p.x), y = Math.round(p.y);
    ctx.fillStyle = 'rgba(40,70,30,.16)';
    ctx.fillRect(x - 7 * p.s, y + 2, 14 * p.s, 3);
    if(p.kind === 'bush'){
      ctx.fillStyle = '#4e9b3d';
      ctx.fillRect(x - 8, y - 5, 16, 8);
      ctx.fillRect(x - 5, y - 9, 10, 5);
      ctx.fillStyle = '#63b84d';
      ctx.fillRect(x - 6, y - 6, 8, 4);
      ctx.fillStyle = '#7fd165';
      ctx.fillRect(x - 4, y - 8, 4, 2);
    } else if(p.kind === 'mush'){
      ctx.fillStyle = '#f4e6cf';
      ctx.fillRect(x - 2, y - 3, 4, 6);
      ctx.fillStyle = '#ff6b8f';
      ctx.fillRect(x - 6, y - 8, 12, 5);
      ctx.fillRect(x - 4, y - 10, 8, 3);
      ctx.fillStyle = '#fff0f4';
      ctx.fillRect(x - 4, y - 8, 2, 2);
      ctx.fillRect(x + 2, y - 7, 2, 2);
    } else if(p.kind === 'cane'){
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y - 12, 4, 14);
      ctx.fillStyle = '#ff7fa6';
      ctx.fillRect(x - 2, y - 12, 4, 3);
      ctx.fillRect(x - 2, y - 6, 4, 3);
      ctx.fillRect(x - 2, y - 12, 2, 14);
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(x - 1, y - 11, 1, 2);
    } else if(p.kind === 'rock'){
      ctx.fillStyle = '#b9b2c9';
      ctx.fillRect(x - 6, y - 5, 12, 7);
      ctx.fillRect(x - 4, y - 7, 8, 3);
      ctx.fillStyle = '#d6d0e0';
      ctx.fillRect(x - 4, y - 5, 5, 3);
    } else {
      ctx.fillStyle = '#5fae4a';
      ctx.fillRect(x - 4, y - 3, 1, 4);
      ctx.fillRect(x - 2, y - 5, 1, 6);
      ctx.fillRect(x, y - 4, 1, 5);
      ctx.fillRect(x + 2, y - 2, 1, 3);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(x - 1, y - 6, 2, 2);
    }
  }
}

function render(){
  const t = state.t;

  let sx = 0, sy = 0;
  if(state.shake > 0.1){
    sx = rand(-1, 1) * state.shake;
    sy = rand(-1, 1) * state.shake;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#6fbf4f';
  ctx.fillRect(0, 0, W, H);

  const camX = Math.round(cam.x + sx);
  const camY = Math.round(cam.y + sy);

  // 地面纹理：锚定世界坐标并对齐 256 网格，移动时不跳变
  if(groundPat){
    const G = 256;
    const ox = -(((camX % G) + G) % G);
    const oy = -(((camY % G) + G) % G);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = groundPat;
    ctx.fillRect(0, 0, W + G, H + G);
    ctx.restore();
  }

  // 低频色块（预烘焙，单次 blit）
  if(blobCanvas){
    const bx = clamp(camX, 0, ARENA.w - W);
    const by = clamp(camY, 0, ARENA.h - H);
    ctx.drawImage(blobCanvas, bx, by, W, H, bx - camX, by - camY, W, H);
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  drawArenaEdge();
  drawProps();
  drawHoles(t);
  drawHazards(t);
  drawGems(t);
  drawDrops(t);
  drawMines(t);
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(e.dead) continue;
    if(e.x < cam.x - 50 || e.x > cam.x + W + 50 || e.y < cam.y - 50 || e.y > cam.y + H + 50) continue;
    drawEnemy(e, t);
  }
  drawAura(t);
  drawOrbitals(t);
  drawAllies(t);
  drawPlayer(t);
  drawSwings(t);
  drawMeleeContinuous(t);
  drawHeldMelee(t);
  drawBullets();
  drawBeams();
  drawEBullets();
  drawStrikes();
  drawRings();
  drawParts();
  drawTexts();

  ctx.restore();

  drawBossBar();

  if(state.flash > 0){
    ctx.fillStyle = 'rgba(255,245,210,' + Math.min(0.5, state.flash * 0.7) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  if(state.hurtFlash > 0){
    ctx.fillStyle = 'rgba(255,60,90,' + (state.hurtFlash * 0.42) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  if(vigCanvas && (state.mode === 'playing' || state.mode === 'levelup' || state.mode === 'paused')){
    ctx.drawImage(vigCanvas, 0, 0);
  }
}

function drawArenaEdge(){
  const b = 12;
  ctx.fillStyle = '#4f9a3c';
  ctx.fillRect(0, 0, ARENA.w, b);
  ctx.fillRect(0, ARENA.h - b, ARENA.w, b);
  ctx.fillRect(0, 0, b, ARENA.h);
  ctx.fillRect(ARENA.w - b, 0, b, ARENA.h);
  ctx.fillStyle = '#3d7a2d';
  for(let x = 0; x < ARENA.w; x += 22){
    ctx.fillRect(x, 0, 11, b);
    ctx.fillRect(x + 11, ARENA.h - b, 11, b);
  }
  for(let y = 0; y < ARENA.h; y += 22){
    ctx.fillRect(0, y, b, 11);
    ctx.fillRect(ARENA.w - b, y + 11, b, 11);
  }
}

function drawGems(t){
  for(let i = 0; i < gems.length; i++){
    const g = gems[i];
    if(g.x < cam.x - 20 || g.x > cam.x + W + 20 || g.y < cam.y - 20 || g.y > cam.y + H + 20) continue;
    const bob = Math.sin(t * 4 + g.seed) * 1.4;
    const x = Math.round(g.x), y = Math.round(g.y + bob);
    ctx.fillStyle = 'rgba(30,20,40,.16)';
    ctx.fillRect(x - 2, Math.round(g.y + 4), 5, 1);
    // 光晕
    ctx.globalAlpha = 0.28 + Math.sin(t * 6 + g.seed) * 0.12;
    ctx.fillStyle = g.col;
    ctx.fillRect(x - 3, y - 4, 7, 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g.col;
    ctx.fillRect(x - 1, y - 3, 3, 6);
    ctx.fillRect(x - 2, y - 1, 5, 2);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(x - 1, y - 2, 1, 1);
  }
}

/* 血包 */
function drawDrops(t){
  for(let i = 0; i < drops.length; i++){
    const d = drops[i];
    if(d.x < cam.x - 20 || d.x > cam.x + W + 20 || d.y < cam.y - 20 || d.y > cam.y + H + 20) continue;
    const bob = Math.sin(t * 3.4 + d.seed) * 2;
    const x = Math.round(d.x), y = Math.round(d.y + bob);
    ctx.fillStyle = 'rgba(30,20,40,.2)';
    ctx.fillRect(x - 5, Math.round(d.y) + 6, 11, 2);
    // 光晕
    ctx.globalAlpha = 0.22 + Math.sin(t * 5 + d.seed) * 0.1;
    ctx.fillStyle = '#8ee06b';
    ctx.fillRect(x - 8, y - 8, 17, 17);
    ctx.globalAlpha = 1;
    // 药箱
    ctx.fillStyle = '#fff6e6';
    ctx.fillRect(x - 5, y - 4, 11, 9);
    ctx.fillStyle = '#e8d6c4';
    ctx.fillRect(x - 5, y + 3, 11, 2);
    ctx.fillStyle = '#ff5f7e';
    ctx.fillRect(x - 1, y - 3, 3, 7);
    ctx.fillRect(x - 4, y, 9, 3);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - 2, y - 6, 5, 2);
  }
}

function drawCrown(cx, cy, col, sc){
  const s = Math.max(1, Math.min(2, Math.round(sc * 0.85)));
  ctx.fillStyle = col;
  ctx.fillRect(cx - 8*s, cy - 1*s, 16*s, 3*s);
  ctx.fillRect(cx - 8*s, cy - 5*s, 2*s, 4*s);
  ctx.fillRect(cx - 3*s, cy - 6*s, 2*s, 5*s);
  ctx.fillRect(cx + 3*s, cy - 5*s, 2*s, 4*s);
  ctx.fillStyle = '#fff6c2';
  ctx.fillRect(cx - 1*s, cy, 2*s, 1*s);
}

function drawEnemy(e, t){
  const s = SPR[e.spr];
  const bob = Math.sin(t * 5 + e.seed) * (e.big ? 1.4 : 0.9);
  const w = s.w * e.sc, h = s.h * e.sc;
  const sx = e.hitT > 0 ? rand(-1.5, 1.5) : 0;
  const x = Math.round(e.x + sx), y = Math.round(e.y + bob);

  /* 【4.1】破韧标记已删除。它会和"咬击前摇红弧"、"元素附着"、
     "眩晕星星"叠在同一只怪身上，屏幕上同时亮着三四种圈，
     玩家分不清哪一个才是"现在该躲的"。留下的只有咬击前摇——它唯一
     对应一个真实的、马上要发生的事件。 */

  /* 【4.1】咬击前摇的红圈已删除。
     ---------------------------------------------------------
     它的本意是"看到红弧就躲"，但实际效果是：怪群贴在身上时，
     十几只怪同时亮红圈，屏幕上多出一层谁也不知道是什么意思的光晕
     （用户原话："怪物上面亮个红圈是什么意思？"）。
     一个每时每刻都在闪、又不对应任何可执行动作的提示，就是噪音。

     伤害本身现在是可以直接读懂的：被几只围就掉几口血，数字会跳出来。
     需要预警的地方改由**敌人本体**承担——冲刺型怪有前摇动作，
     BOSS 技能有落点圈，那些才是"看到要躲"的东西。 */

  ctx.fillStyle = 'rgba(30,20,40,.2)';
  ctx.fillRect(x - e.r, y + e.r * 0.74, e.r * 2, e.big ? 4 : 2);
  if(e.elite){
    const p = 0.5 + Math.sin(t * 6 + e.seed) * 0.5;
    ctx.globalAlpha = 0.35 + p * 0.35;
    ctx.strokeStyle = e.affix === 'charge' ? '#ff9d4d' : (e.affix === 'summon' ? '#8ee6b3' : '#ff7a3d');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + e.r * 0.55, e.r * 1.35 + p * 2, 0, TAU);
    ctx.stroke();
    /* 词缀标记：一个像素小三角，冲锋/召唤/爆裂三种颜色 */
    if(e.affix){
      const ac = e.affix === 'charge' ? '#ff9d4d' : (e.affix === 'summon' ? '#8ee6b3' : '#ff5a3d');
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = ac;
      const my = y - h / 2 - 7;
      ctx.beginPath();
      ctx.moveTo(x, my - 3);
      ctx.lineTo(x + 3, my + 2);
      ctx.lineTo(x - 3, my + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 蓄力冲刺预警
  if(e.dashState === 'wind'){
    ctx.strokeStyle = 'rgba(255,110,90,.9)';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5 + Math.sin(t * 30) * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, e.r + 5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 自爆预警
  if(e.ai === 'kamikaze' && Math.sin(t * 22 + e.seed) > 0.2){
    ctx.fillStyle = 'rgba(255,90,70,.55)';
    ctx.fillRect(x - e.r - 2, y - e.r - 2, e.r * 2 + 4, e.r * 2 + 4);
  }

  const prevA = ctx.globalAlpha;
  const ea = e.alpha === undefined ? 1 : e.alpha;
  ctx.globalAlpha = ea;
  ctx.drawImage(s.img, x - w / 2, y - h / 2 + (e.big ? 2 : 3), w, h);
  if(e.flash > 0){
    ctx.globalAlpha = ea * (e.big ? 0.34 : 0.55);
    ctx.drawImage(s.white, x - w / 2, y - h / 2 + (e.big ? 2 : 3), w, h);
  }
  if(e.slowT > 0){
    const pp = 0.5 + Math.sin(t * 8 + e.seed) * 0.5;
    ctx.globalAlpha = 0.55 + pp * 0.3;
    ctx.strokeStyle = '#8fe8ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y + 1, e.r + 3 + pp * 1.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#e6fbff';
    ctx.fillRect(x - 1, y - e.r - 7, 1, 5);
    ctx.fillRect(x - 3, y - e.r - 5, 5, 1);
    ctx.globalAlpha = prevA;
  }
  ctx.globalAlpha = prevA;

  /* --- 元素状态：燃烧 / 中毒 / 感电 --- */
  if(e.st){
    if(e.st.fire > 0){
      const p = 0.55 + Math.sin(t * 14 + e.seed) * 0.35;
      ctx.globalAlpha = 0.30 * p;
      ctx.fillStyle = '#ff7a2a';
      ctx.fillRect(x - e.r, y - e.r - 2, e.r * 2, e.r * 2 + 2);
      ctx.globalAlpha = 0.85 * p;
      ctx.fillStyle = '#ffd166';
      const fy = y - e.r - 4 - Math.abs(Math.sin(t * 9 + e.seed)) * 4;
      ctx.fillRect(x - 2, Math.round(fy), 2, 3);
      ctx.fillRect(x + 1, Math.round(fy + 2), 2, 2);
      ctx.globalAlpha = prevA;
    }
    if(e.st.venom > 0){
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#a6e05a';
      for(let i = 0; i < 3; i++){
        const a = t * 2.2 + i * 2.1 + e.seed;
        ctx.fillRect(Math.round(x + Math.cos(a) * (e.r + 2)), Math.round(y + Math.sin(a) * (e.r + 1)), 2, 2);
      }
      ctx.globalAlpha = prevA;
    }
    if(e.st.volt > 0 && Math.sin(t * 18 + e.seed) > 0.3){
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - e.r - 3, y - e.r);
      ctx.lineTo(x - e.r + 1, y - 1);
      ctx.lineTo(x - e.r - 2, y + e.r * 0.6);
      ctx.stroke();
      ctx.globalAlpha = prevA;
    }
  }
  if(e.stun > 0){
    ctx.fillStyle = '#ffe066';
    for(let i = 0; i < 3; i++){
      const a = t * 6 + i * 2.1;
      ctx.fillRect(Math.round(x + Math.cos(a) * 7), Math.round(y - e.r - 8 + Math.sin(a) * 2), 2, 2);
    }
  }

  // 王冠
  if(e.crown) drawCrown(x, y - h / 2 + 1, e.crown, e.sc);

  // 血条（小怪只在精英/受伤时显示）
  if(!e.big && e.hp < e.maxHp && (e.type === 'burger' || e.type === 'pudding')){
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x - 8, y - h/2 + (e.big ? 2 : 1), 16, 2);
    ctx.fillStyle = e.col;
    ctx.fillRect(x - 8, y - h/2 + 1, 16 * (e.hp / e.maxHp), 2);
  }
}

/* 角色标志物：让六个人在同一屏战斗里也能靠"身边的东西"认出来 */
function drawCharAccent(t, x, y){
  const id = CHAR ? CHAR.id : 'ranger';
  const f = P.facing || 1;
  const fx = x + f * 8;                    /* 面朝方向的侧边 */
  if(id === 'ranger'){
    /* 手里那只会飞来飞去的拖鞋 + 头带飘尾 */
    const o = Math.sin(t * 7) * 1.6;
    ctx.fillStyle = '#ffc46b';
    ctx.fillRect(fx - 1, y - 5 + o, 6, 3);
    ctx.fillStyle = '#ff8a5c';
    ctx.fillRect(fx + 4, y - 5 + o, 2, 3);
  } else if(id === 'knight'){
    /* 背在身侧的平底锅：圆形锅身 + 短柄 */
    ctx.fillStyle = '#3a3f4e';
    ctx.beginPath(); ctx.arc(fx * 0.0 + x - f * 10, y - 2, 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a94a8';
    ctx.beginPath(); ctx.arc(x - f * 10, y - 2, 4.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a3f4e';
    ctx.fillRect(x - f * 10 - 1, y + 2, 2, 5);
  } else if(id === 'engineer'){
    /* 背后的工具箱 + 缓慢转动的扳手 */
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x - 6, y - 9, 12, 5);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 4, y - 8, 3, 1);
    const a = t * 2;
    ctx.save(); ctx.translate(x + f * 11, y - 4); ctx.rotate(a);
    ctx.fillStyle = '#c9d4e2'; ctx.fillRect(-1, -4, 2, 8);
    ctx.fillStyle = '#c9d4e2'; ctx.fillRect(-3, -6, 6, 2);
    ctx.restore();
  } else if(id === 'keeper'){
    /* 牵引绳 + 脚边的一只小爪印 */
    ctx.strokeStyle = 'rgba(255,246,224,.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + f * 6, y + 2);
    ctx.quadraticCurveTo(x + f * 14, y + 6, x + f * 16, y + 9);
    ctx.stroke();
    ctx.fillStyle = '#e8c886';
    ctx.fillRect(x + f * 16 - 1, y + 8, 3, 2);
    ctx.fillRect(x + f * 17, y + 6, 1, 1);
    ctx.fillRect(x + f * 19, y + 6, 1, 1);
  } else if(id === 'chef'){
    /* 一手火一手冰，随呼吸上下浮动 */
    const b = Math.sin(t * 3.2) * 1.4;
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.arc(x - 12, y - 4 + b, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x - 12, y - 5 + b, 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8fe8ff';
    ctx.fillRect(x + 11, y - 7 + b, 2, 6);
    ctx.fillRect(x + 10, y - 5 + b, 4, 2);
    ctx.fillStyle = '#e6ffff';
    ctx.fillRect(x + 11, y - 7 + b, 1, 2);
  }
}

/* 人物脚下的怒气条：宽 26px、高 3px。平时是"攒了多少"，
   狂战期间变成"还剩多久"。骑士专属，其它角色不画。 */
function drawPlayerRage(t){
  if(!P || typeof hasRage !== 'function' || !hasRage()) return;
  const berserk = P.berserk > 0;
  const k = berserk
    ? clamp(P.berserk / Math.max(0.2, (ST && ST.rageDur) || RES.berserkBase), 0, 1)
    : clamp((P.rage || 0) / RES.rageMax, 0, 1);
  if(k <= 0) return;
  const w = 26, h = 3;
  const bx = Math.round(P.x - w / 2), by = Math.round(P.y) + 14;
  /* 底槽 */
  ctx.fillStyle = 'rgba(12,8,18,.72)';
  ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  /* 填充 */
  const fw = Math.max(1, Math.round(w * k));
  const pulse = berserk ? (0.72 + 0.28 * Math.sin(t * 16)) : 1;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = berserk ? '#ffe066' : '#ff6a2d';
  ctx.fillRect(bx, by, fw, h);
  /* 尖端高光：让"还差一点点就满"一眼可读 */
  ctx.fillStyle = berserk ? '#fff6c8' : '#ffd166';
  ctx.fillRect(bx + fw - Math.min(3, fw), by, Math.min(3, fw), h);
  ctx.globalAlpha = 1;
}

/* 头顶的冲刺指示：每段一个点，蓝色可冲、黑色已用。
   放在头顶而不是 UI 角落，是因为"我还能不能闪"必须在眼睛看怪的时候就读到。 */
function drawPlayerDash(t){
  if(!P || typeof dashMaxNow !== 'function') return;
  const n = dashMaxNow();
  if(n <= 0) return;
  const gap = 7, w = 4;
  const total = n * gap - (gap - w);
  const bx = Math.round(P.x - total / 2), by = Math.round(P.y) - 20;
  const c = P.dashCharge || 0;
  for(let i = 0; i < n; i++){
    const x = bx + i * gap;
    const on = c >= i + 1;
    /* 底槽（黑） */
    ctx.fillStyle = 'rgba(6,10,16,.78)';
    ctx.fillRect(x - 1, by - 1, w + 2, w + 2);
    /* 填充（蓝 / 黑） */
    if(on){
      ctx.fillStyle = '#4fd0ff';
      ctx.fillRect(x, by, w, w);
      ctx.fillStyle = '#c8f2ff';
      ctx.fillRect(x, by, w, 1);
    } else {
      ctx.fillStyle = '#16202c';
      ctx.fillRect(x, by, w, w);
    }
  }
}

function drawPlayer(t){
  const s = (CHAR && SPR['ch_' + CHAR.id]) || SPR.player;
  const bob = P.moving ? Math.sin(P.anim * 12) * 1.2 : Math.sin(t * 2.4) * 0.7;
  const x = Math.round(P.x), y = Math.round(P.y + bob);

  /* 【4.0】冲刺残影：让"我刚刚飞过去了"这件事在画面上留下痕迹 */
  if(P.dashTrail && P.dashTrail.length){
    for(let i = 0; i < P.dashTrail.length; i++){
      const g = P.dashTrail[i];
      const a = Math.max(0, g.t / 0.28);
      ctx.globalAlpha = a * 0.40;
      ctx.fillStyle = i % 2 ? '#9fe8ff' : '#5fd8ff';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 4.5 + a * 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(30,20,40,.22)';
  ctx.fillRect(x - 6, Math.round(P.y) + 7, 12, 3);

  /* 角色色环：一眼看出这局玩的是谁 */
  if(CHAR){
    const p = 0.5 + Math.sin(t * 3) * 0.5;
    ctx.globalAlpha = 0.22 + p * 0.18;
    ctx.strokeStyle = CHAR.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(P.x, P.y + 1, 11 + p * 1.5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /* 骑士狂战 / 赌徒押注的视觉提示 */
  if(P.berserk > 0){
    const k = 0.5 + Math.sin(t * 14) * 0.5;
    ctx.globalAlpha = 0.26 + k * 0.14;
    ctx.fillStyle = '#ff5a3d';
    ctx.beginPath(); ctx.arc(P.x, P.y, 18, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    /* 环绕的三颗火星：让"狂战"在满屏弹幕里也一眼可辨 */
    for(let i = 0; i < 3; i++){
      const a = t * 5.2 + i * TAU / 3;
      ctx.fillStyle = i === 0 ? '#fff3c4' : '#ff9d6b';
      ctx.fillRect(Math.round(P.x + Math.cos(a) * 20) - 1, Math.round(P.y + Math.sin(a) * 20) - 1, 2, 2);
    }
    if(parts.length < 380 && Math.random() < 0.55){
      parts.push({ x: P.x + rand(-8, 8), y: P.y + rand(0, 6), vx: rand(-14, 14), vy: rand(-70, -30),
        life: rand(0.18, 0.36), max: 0.36, col: Math.random() < 0.5 ? '#ff8a5c' : '#ffd166', size: 2, g: -0.25, spark: true });
    }
  } else if(P.rage > 0){
    /* 怒气蓄积：越接近满，脚边的橙色环越亮 */
    const k = clamp(P.rage / RES.rageMax, 0, 1);
    ctx.strokeStyle = 'rgba(255,120,70,' + (0.10 + 0.30 * k) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(P.x, P.y + 2, 12 + k * 4 + Math.sin(t * 7) * 1.2, 0, TAU);
    ctx.stroke();
    if(k > 0.6 && parts.length < 380 && Math.random() < 0.25){
      parts.push({ x: P.x + rand(-7, 7), y: P.y + 4, vx: rand(-10, 10), vy: rand(-46, -18),
        life: 0.26, max: 0.26, col: '#ff8a5c', size: 1, g: -0.2, spark: true });
    }
  }

  /* 【4.1】怒气条搬到人物脚下。
     ---------------------------------------------------------
     原来它在整个 UI 的最底下，和血条、时间、技能条挤在一条线上，
     玩家的视线在角色身上，根本不会去看屏幕底部那条橙色的东西。
     怒气是"我现在离狂战还有多远"，这是一个**关乎角色本体**的状态，
     所以它应该长在角色身上——和血条一样的地方。
     狂战期间同一条条改成倒计时（从满流到空），不再需要另一行文字。 */
  drawPlayerRage(t);
  /* 【4.2】冲刺段数显示在头顶：蓝色 = 可用，黑色 = 已用掉 */
  drawPlayerDash(t);

  /* 护盾：一圈会呼吸的青色屏障 */
  if(P.shield > 0){
    const maxS = shieldMaxNow() || 1;
    const k = clamp(P.shield / maxS, 0, 1);
    ctx.globalAlpha = 0.28 + k * 0.4;
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 17 + Math.sin(t * 3.2) * 1.2, 0, TAU);
    ctx.stroke();
    /* 六段弧：读起来像"能量盾"而不是"又一个光圈" */
    ctx.globalAlpha = 0.55 + k * 0.3;
    for(let i = 0; i < 6; i++){
      const a0 = t * 0.9 + i * TAU / 6;
      ctx.beginPath();
      ctx.arc(P.x, P.y, 19.5, a0, a0 + 0.42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* 超载：电弧绕着角色跳，提示"现在冷却减半" */
  if(P.overload > 0){
    ctx.strokeStyle = 'rgba(124,227,255,.85)';
    ctx.lineWidth = 1;
    for(let i = 0; i < 4; i++){
      const a0 = t * 9 + i * TAU / 4;
      let px = P.x + Math.cos(a0) * 14, py = P.y + Math.sin(a0) * 14;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for(let k = 1; k <= 3; k++){
        const aa = a0 + k * 0.28;
        const rr = 14 + k * 3 + rand(-2, 2);
        px = P.x + Math.cos(aa) * rr;
        py = P.y + Math.sin(aa) * rr;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // 拾取范围提示（磁铁升级后很直观）
  if(ST.pickup > 40){
    ctx.strokeStyle = 'rgba(195,155,255,.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(P.x, P.y, ST.pickup, 0, TAU);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y);
  if(P.facing < 0) ctx.scale(-1, 1);
  if(P.invuln > 0 && Math.floor(P.invuln * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.drawImage(s.img, -Math.round(s.w/2), -Math.round(s.h/2));
  ctx.restore();

  /* 角色标志物画在人像外侧（不跟随翻转，避免镜像后位置跳） */
  drawCharAccent(t, x, y);

  // 升级光圈
  if(state.mode === 'levelup'){
    const pulse = 0.5 + Math.sin(t * 9) * 0.5;
    ctx.strokeStyle = 'rgba(255,225,140,' + (0.35 + pulse * 0.4) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 16 + pulse * 5, 0, TAU);
    ctx.stroke();
  }
}

/* 友方单位：炮台（固定阵地）与宠物（围绕主人的小队） */
function drawAllies(t){
  for(let i = 0; i < allies.length; i++){
    const a = allies[i];
    if(a.dead) continue;
    if(a.x < cam.x - 40 || a.x > cam.x + W + 40 || a.y < cam.y - 40 || a.y > cam.y + H + 40) continue;

    ctx.fillStyle = 'rgba(30,20,40,.22)';
    ctx.fillRect(Math.round(a.x - a.r), Math.round(a.y + a.r * 0.7), a.r * 2, 2);

    if(a.kind === 'turret') drawTurret(a, t);
    else drawPet(a, t);

    if(a.flash > 0){
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(a.x - a.r, a.y - a.r, a.r * 2, a.r * 2);
      ctx.globalAlpha = 1;
    }
  }
}

function drawTurret(a, t){
  const x = Math.round(a.x), y = Math.round(a.y);
  const col = a.col || '#ffe066';
  const lv = a.lv || 1;

  /* 底座：所有炮台共有，便于一眼看出这是"建筑" */
  ctx.fillStyle = '#6b7382';
  ctx.fillRect(x - 8, y + 3, 16, 4);
  ctx.fillStyle = '#3f4552';
  ctx.fillRect(x - 8, y + 7, 16, 2);

  if(a.ttype === 'mg'){
    ctx.fillStyle = '#c9a03c'; ctx.fillRect(x - 7, y, 14, 4);
    ctx.fillStyle = col; ctx.fillRect(x - 6, y - 7, 12, 8);
    ctx.fillStyle = '#fff2b0'; ctx.fillRect(x - 4, y - 6, 8, 3);
    ctx.save(); ctx.translate(x, y - 4); ctx.rotate(a.ang);
    ctx.fillStyle = '#ffb84d'; ctx.fillRect(0, -2, 10, 4);
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(8, -1, 2, 2);
    ctx.restore();
  } else if(a.ttype === 'rocket'){
    ctx.fillStyle = col; ctx.fillRect(x - 7, y - 7, 14, 9);
    ctx.fillStyle = '#ffd0b8'; ctx.fillRect(x - 5, y - 6, 4, 4); ctx.fillRect(x + 1, y - 6, 4, 4);
    ctx.save(); ctx.translate(x, y - 3); ctx.rotate(a.ang);
    ctx.fillStyle = '#a33f28'; ctx.fillRect(0, -3, 9, 6);
    ctx.restore();
  } else if(a.ttype === 'laser'){
    ctx.fillStyle = '#4a3f5a'; ctx.fillRect(x - 6, y - 6, 12, 9);
    ctx.fillStyle = col; ctx.fillRect(x - 4, y - 5, 8, 5);
    ctx.save(); ctx.translate(x, y - 3); ctx.rotate(a.ang);
    ctx.fillStyle = '#ff9ae8'; ctx.fillRect(0, -1, 12, 2);
    ctx.restore();
    const p = 0.5 + Math.sin(t * 10 + a.seed) * 0.5;
    ctx.globalAlpha = 0.25 + p * 0.2;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 3, 8, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  } else if(a.ttype === 'frost'){
    ctx.fillStyle = '#3f4f66'; ctx.fillRect(x - 6, y - 6, 12, 9);
    ctx.fillStyle = col; ctx.fillRect(x - 3, y - 9, 6, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 8, 2, 4);
    const p = 0.5 + Math.sin(t * 6 + a.seed) * 0.5;
    ctx.globalAlpha = 0.2 + p * 0.15;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 5, 9, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  } else if(a.ttype === 'tesla'){
    ctx.fillStyle = '#4a4a2a'; ctx.fillRect(x - 3, y - 10, 6, 13);
    ctx.fillStyle = col; ctx.fillRect(x - 5, y - 13, 10, 4);
    if(Math.sin(t * 14 + a.seed) > 0.4){
      ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 13); ctx.lineTo(x - 1, y - 17); ctx.lineTo(x + 2, y - 14);
      ctx.stroke();
    }
  } else if(a.ttype === 'flame'){
    ctx.fillStyle = '#6b3a1f'; ctx.fillRect(x - 7, y - 4, 14, 7);
    ctx.fillStyle = col; ctx.fillRect(x - 5, y - 3, 10, 4);
    ctx.save(); ctx.translate(x, y - 2); ctx.rotate(a.ang);
    ctx.fillStyle = '#8a93a3'; ctx.fillRect(0, -2, 8, 4);
    ctx.restore();
    if(a.muzzle > 0){
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x + Math.cos(a.ang) * 10 - 2, y - 2 + Math.sin(a.ang) * 10 - 2, 4, 4);
    }
  } else if(a.ttype === 'factory'){
    ctx.fillStyle = '#4a2a3a'; ctx.fillRect(x - 8, y - 8, 16, 11);
    ctx.fillStyle = col; ctx.fillRect(x - 6, y - 6, 12, 6);
    ctx.fillStyle = '#ffd166';
    const g = (t * 3) % 1;
    ctx.fillRect(x - 2, y - 2 + g * 6, 4, 2);
    ctx.fillStyle = '#ffa8c4'; ctx.fillRect(x - 1, y - 10, 2, 3);
  } else {
    /* 维修机 */
    ctx.fillStyle = '#2f4a3a'; ctx.fillRect(x - 7, y - 7, 14, 10);
    ctx.fillStyle = col; ctx.fillRect(x - 5, y - 5, 10, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 9, 2, 6); ctx.fillRect(x - 3, y - 7, 6, 2);
    const p = 0.5 + Math.sin(t * 4 + a.seed) * 0.5;
    ctx.globalAlpha = 0.12 + p * 0.1;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 18 + p * 4, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* 炮口火光 */
  if(a.muzzle > 0){
    ctx.globalAlpha = Math.min(1, a.muzzle * 10);
    ctx.fillStyle = '#fff6c8';
    const mx = x + Math.cos(a.ang) * 11, my = y - 3 + Math.sin(a.ang) * 11;
    ctx.fillRect(mx - 2, my - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  /* 血条 + 存在时间 */
  const hp = a.hp / a.maxHp, lf = a.life / a.maxLife;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(x - 9, y - 17, 18, 2);
  ctx.fillStyle = col;
  ctx.fillRect(x - 9, y - 17, 18 * clamp(hp, 0, 1), 2);
  ctx.fillStyle = 'rgba(126,240,192,.7)';
  ctx.fillRect(x - 9, y - 15, 18 * clamp(lf, 0, 1), 1);
  /* 从炮口指出去一小段瞄准线，让"它在瞄谁"看得见 */
  if(a.muzzle > 0){
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a.ang) * 12, y - 3 + Math.sin(a.ang) * 12);
    ctx.lineTo(x + Math.cos(a.ang) * (12 + a.range * 0.35), y - 3 + Math.sin(a.ang) * (12 + a.range * 0.35));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawPet(a, t){
  const x = Math.round(a.x), y = Math.round(a.y);
  const bob = Math.sin(t * 9 + a.seed) * 1.3;
  const yy = Math.round(y + bob);
  const col = a.col;
  const moving = Math.abs(a.vx) + Math.abs(a.vy) > 20;
  const flip = a.vx < -6 ? -1 : 1;

  ctx.save();
  ctx.translate(x, yy);
  ctx.scale(flip, 1);

  if(a.ptype === 'bird'){
    ctx.fillStyle = col; ctx.fillRect(-5, -4, 10, 7);
    ctx.fillRect(4, -2, 3, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(1, -3, 2, 2);
    const wf = moving ? Math.sin(t * 18) * 3 : Math.sin(t * 6) * 1;
    ctx.fillStyle = col; ctx.fillRect(-2, -7 + wf, 6, 2);
  } else if(a.ptype === 'cat'){
    ctx.fillStyle = col; ctx.fillRect(-7, -5, 14, 9);
    ctx.fillRect(-6, -8, 3, 3); ctx.fillRect(3, -8, 3, 3);
    ctx.fillStyle = '#3a2b3f';
    ctx.fillRect(-3, -3, 2, 2); ctx.fillRect(2, -3, 2, 2);
    ctx.fillRect(-1, 1, 3, 1);
  } else if(a.ptype === 'slime'){
    const sq = 1 + Math.sin(t * 7 + a.seed) * 0.08;
    ctx.fillStyle = col;
    ctx.fillRect(-7, yy === 0 ? -3 : -3, 14, 7 * sq);
    ctx.fillRect(-5, -6, 10, 4);
    ctx.fillStyle = '#e8ffe8'; ctx.fillRect(-2, -4, 2, 2);
  } else if(a.ptype === 'lizard'){
    ctx.fillStyle = col; ctx.fillRect(-7, -3, 12, 6);
    ctx.fillRect(5, -2, 5, 3);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(7, -1, 3, 2);
    ctx.fillStyle = '#3a2b3f'; ctx.fillRect(-4, -2, 2, 2);
    if(a.state === 'attack'){
      ctx.fillStyle = '#ff5a2a';
      ctx.fillRect(10, -3, 4 + Math.random() * 3, 5);
    }
  } else if(a.ptype === 'penguin'){
    ctx.fillStyle = '#1f2a3a'; ctx.fillRect(-4, -5, 8, 10);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -2, 6, 7);
    ctx.fillStyle = col; ctx.fillRect(-4, -7, 8, 3);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(3, -3, 3, 2);
  } else if(a.ptype === 'hamster'){
    ctx.fillStyle = col; ctx.fillRect(-5, -4, 10, 7);
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(-3, -2, 6, 4);
    ctx.fillStyle = '#3a2b3f'; ctx.fillRect(-2, -3, 2, 2); ctx.fillRect(1, -3, 2, 2);
    if(Math.sin(t * 20) > 0.6){
      ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(9, -4); ctx.lineTo(7, 1); ctx.stroke();
    }
  } else if(a.ptype === 'bomb'){
    ctx.fillStyle = '#e0d6e8'; ctx.fillRect(-5, -2, 10, 5);
    ctx.fillStyle = col; ctx.fillRect(-7, -6, 14, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -4, 2, 2); ctx.fillRect(1, -4, 2, 2);
    const pulse = 0.5 + Math.sin(t * 18) * 0.5;
    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.fillStyle = '#ff6b8b';
    ctx.beginPath(); ctx.arc(0, -2, 12, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = col; ctx.fillRect(-5, -4, 10, 7);
    ctx.fillRect(-8, -6, 3, 4);
    ctx.fillStyle = '#fff2e0'; ctx.fillRect(2, -2, 4, 3);
    ctx.fillStyle = '#3a2b3f'; ctx.fillRect(5, -2, 2, 2);
  }
  ctx.restore();

  /* 【4.2】宠物不再有血条：它们不会受伤、不会死。 */
}

/* 近战挥击的绘制已移到 72-melee-fx.js（武器本体 + 残影 + 刀光） */

function drawAura(t){
  const lv = P.weapons.aura;
  if(!lv) return;
  const R = P.auraR || 60;
  const pulse = Math.max(0, P.auraPulse || 0);
  const g = ctx.createRadialGradient(P.x, P.y, R * 0.2, P.x, P.y, R);
  g.addColorStop(0, 'rgba(255,120,40,' + (0.05 + pulse * 0.07) + ')');
  g.addColorStop(0.72, 'rgba(255,150,60,' + (0.16 + pulse * 0.18) + ')');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,90,' + (0.34 + pulse * 0.5) + ')';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(P.x, P.y, R * (0.95 + pulse * 0.05), 0, TAU); ctx.stroke();
  for(let i = 0; i < 8; i++){
    const a = t * 1.5 + i * TAU / 8;
    const rr = R * (0.85 + Math.sin(t * 5 + i) * 0.06);
    ctx.fillStyle = 'rgba(255,205,120,' + (0.3 + pulse * 0.45) + ')';
    ctx.fillRect(P.x + Math.cos(a) * rr - 1, P.y + Math.sin(a) * rr - 1, 2, 2);
  }
}

function drawBeams(){
  for(let i = 0; i < beams.length; i++){
    const b = beams[i];
    const p = Math.max(0, b.life / b.max);
    const ex = b.x + Math.cos(b.ang) * b.len;
    const ey = b.y + Math.sin(b.ang) * b.len;
    ctx.lineCap = 'round';
    const bc = b.col || '#ff7ae0';
    ctx.globalAlpha = p * 0.3;
    ctx.strokeStyle = bc;
    ctx.lineWidth = b.width * 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = p * 0.95;
    ctx.strokeStyle = bc;
    ctx.globalAlpha = p * 0.85;
    ctx.lineWidth = b.width;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = p;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, b.width * 0.34);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawMines(t){
  for(let i = 0; i < mines.length; i++){
    const m = mines[i];
    const armed = m.arm <= 0;
    const blink = armed ? (Math.sin(t * 12 + m.seed) > 0 ? 1 : 0.55) : 0.45;
    ctx.fillStyle = 'rgba(20,10,26,.32)';
    ctx.fillRect(m.x - 7, m.y + 5, 14, 3);
    ctx.fillStyle = armed ? '#ff5f8f' : '#a8485f';
    ctx.beginPath(); ctx.arc(m.x, m.y, 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * blink) + ')';
    ctx.fillRect(m.x - 2, m.y - 2, 3, 2);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(m.x - 1, m.y - 9, 2, 4);
    if(armed){
      ctx.globalAlpha = 0.2 + Math.sin(t * 10 + m.seed) * 0.14;
      ctx.strokeStyle = '#ff9dc0';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawHoles(t){
  for(let i = 0; i < holes.length; i++){
    const h = holes[i];
    if(h.x < cam.x - 160 || h.x > cam.x + W + 160 || h.y < cam.y - 160 || h.y > cam.y + H + 160) continue;
    const k = Math.min(1, (h.max - h.life) * 4);
    const r = h.r * (0.55 + 0.45 * k);
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#3a1f66';
    ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#2a1046';
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.66, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#b98cff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.9, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#0d0418';
    ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#e0c8ff';
    ctx.lineWidth = 1;
    for(let j = 0; j < 3; j++){
      const a0 = t * 2.4 + j * TAU / 3;
      ctx.beginPath();
      ctx.arc(h.x, h.y, r * (0.42 + j * 0.16), a0, a0 + 1.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawHazards(t){
  for(let i = 0; i < hazards.length; i++){
    const h = hazards[i];
    const p = Math.max(0, h.life / h.max);
    ctx.globalAlpha = 0.18 + 0.16 * p;
    ctx.fillStyle = '#8b3fd8';
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.45 * p;
    ctx.strokeStyle = '#c07af0';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.9 + Math.sin(t * 3 + h.seed) * 0.07), 0, TAU); ctx.stroke();
    for(let k = 0; k < 4; k++){
      const a = h.seed + k * 1.7 + t * 0.8;
      const rr = h.r * (0.3 + (k % 3) * 0.24);
      ctx.globalAlpha = 0.34 * p;
      ctx.fillStyle = '#e0b6ff';
      ctx.fillRect(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr * 0.8, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

function drawOrbitals(t){
  const lv = P.weapons.banana;
  if(!lv) return;
  const s = WEAPONS.banana.stats(lv);
  const R = P.orbR || s.radius * ST.area;
  const dual = P.orbDual || lv >= 5;
  const loops = dual ? 2 : 1;
  for(let r = 0; r < loops; r++){
    const dir = r === 0 ? 1 : -1;
    const rr = r === 0 ? R : R * 0.64;
    const cnt = s.count;
    for(let i = 0; i < cnt; i++){
      const a = (P.orbAngle || 0) * dir + i * TAU / cnt + r * 0.55;
      const bx = Math.round(P.x + Math.cos(a) * rr);
      const by = Math.round(P.y + Math.sin(a) * rr);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + t * 6);
      const sz = s.size / 5;
      const c1 = dual ? '#ffe066' : '#ffd83d';
      // 弯月香蕉：三段弧形排布
      ctx.fillStyle = c1;
      ctx.fillRect(-7*sz, -3*sz, 4*sz, 2*sz);
      ctx.fillRect(-4*sz, -1*sz, 8*sz, 3*sz);
      ctx.fillRect(3*sz, -2*sz, 4*sz, 2*sz);
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(-5*sz, -1*sz, 4*sz, 1*sz);
      ctx.fillStyle = '#a8792a';
      ctx.fillRect(6*sz, -2*sz, 2*sz, 2*sz);
      ctx.restore();
    }
  }
}

function drawBullets(){
  ctx.lineCap = 'round';
  for(let i = 0; i < bullets.length; i++){
    const b = bullets[i];
    if(b.x < cam.x - 24 || b.x > cam.x + W + 24 || b.y < cam.y - 24 || b.y > cam.y + H + 24) continue;

    /* 快到射程尽头时淡出，让"打不到"看得见 */
    const left = b.range ? b.range - (b.trav || 0) : 999;
    const fade = left < 34 ? Math.max(0.12, left / 34) : 1;

    // 拖尾
    const sp = Math.hypot(b.vx, b.vy) || 1;
    ctx.globalAlpha = 0.22 * fade;
    ctx.strokeStyle = b.col || '#ffd166';
    ctx.lineWidth = Math.max(1, b.r * 0.55);
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx / sp * (b.r * 1.9), b.y - b.vy / sp * (b.r * 1.9));
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.globalAlpha = fade;
    if(b.type === 'slipper'){
      const k = b.r / 5;
      ctx.rotate(b.rot);
      ctx.scale(k, k);
      ctx.fillStyle = b.boom ? '#ffe066' : '#ff9dc0';
      ctx.fillRect(-5, -2, 9, 4);
      ctx.fillStyle = '#fff2e2';
      ctx.fillRect(-5, 1, 9, 2);
      ctx.fillStyle = b.boom ? '#c98b1a' : '#e0527c';
      ctx.fillRect(-1, -1, 3, 1);
      if(b.boom){
        ctx.fillStyle = 'rgba(255,240,160,.85)';
        ctx.fillRect(-6, -3, 3, 1);
        ctx.fillRect(4, 1, 2, 1);
      }
    } else if(b.type === 'candy'){
      ctx.rotate(b.rot);
      ctx.fillStyle = '#ff9dc0';
      ctx.fillRect(-1, -5, 3, 10);
      ctx.fillRect(-5, -1, 10, 3);
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = '#ff6b95';
      ctx.fillRect(-1, -1, 2, 2);
    } else if(b.type === 'tomato'){
      ctx.rotate(b.rot);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(-3, -2, 6, 4);
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillStyle = '#ffb3b3';
      ctx.fillRect(-1, -2, 2, 2);
    } else if(b.type === 'shot'){
      ctx.rotate(b.rot);
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(-5, -1, 9, 2);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(2, -1, 4, 2);
    } else if(b.type === 'frost'){
      ctx.rotate(b.rot);
      ctx.fillStyle = '#8fe8ff';
      ctx.fillRect(-1, -4, 2, 8);
      ctx.fillRect(-4, -1, 8, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -1, 2, 2);
    } else if(b.type === 'missile'){
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-7, -1, 3, 3);
      ctx.fillStyle = '#ff8f6b';
      ctx.fillRect(-4, -2, 8, 5);
      ctx.fillStyle = '#ffd0b8';
      ctx.fillRect(2, -1, 4, 3);
      ctx.fillStyle = '#a33f28';
      ctx.fillRect(-3, -1, 2, 2);
    } else if(b.type === 'flame'){
      const fl = 0.6 + Math.sin(state.t * 26 + b.x) * 0.4;
      ctx.globalAlpha = fade * (0.55 + fl * 0.35);
      ctx.fillStyle = '#ff5a2a';
      ctx.fillRect(-b.r * 0.6, -b.r * 0.6, b.r * 1.2, b.r * 1.2);
      ctx.fillStyle = '#ff9a3d';
      ctx.fillRect(-b.r * 0.4, -b.r * 0.4, b.r * 0.8, b.r * 0.8);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(-b.r * 0.2, -b.r * 0.2, b.r * 0.4, b.r * 0.4);
    } else if(b.type === 'dice'){
      ctx.rotate(b.rot);
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = b.col || '#ff9dc0';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = '#ffffff';
      const pips = b.roll || 3;
      for(let k = 0; k < Math.min(6, pips); k++){
        const px = (k % 2 ? 1 : -2), py = (Math.floor(k / 2) - 1) * 2;
        ctx.fillRect(px, py, 1.6, 1.6);
      }
    } else if(b.type === 'tshot'){
      ctx.fillStyle = b.col || '#ffe066';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -1, 2, 2);
    } else if(b.type === 'boomerang'){
      ctx.rotate(b.rot);
      ctx.fillStyle = b.col || '#a6ffcb';
      ctx.fillRect(-6, -1, 5, 2);
      ctx.fillRect(1, -1, 5, 2);
      ctx.fillRect(-2, 0, 4, 2);
      ctx.fillStyle = '#7be0a8';
      ctx.fillRect(-1, 1, 2, 2);
    }
    ctx.restore();
  }
  ctx.lineCap = 'butt';
}

function drawEBullets(){
  for(let i = 0; i < ebullets.length; i++){
    const b = ebullets[i];
    if(b.x < cam.x - 20 || b.x > cam.x + W + 20 || b.y < cam.y - 20 || b.y > cam.y + H + 20) continue;
    const x = b.x, y = b.y;
    const r = b.r;
    // 深色底衬：在绿色草地上把弹道轮廓垫出来
    ctx.fillStyle = 'rgba(26,4,36,.55)';
    ctx.beginPath(); ctx.arc(x, y, r + 3.2, 0, TAU); ctx.fill();
    // 外发光
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // 弹体
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // 高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.46, 0, TAU); ctx.fill();
  }
}

function drawStrikes(){
  for(let i = 0; i < strikes.length; i++){
    const s = strikes[i];
    const p = 1 - s.delay / s.max;
    if(s.x < cam.x - 40 || s.x > cam.x + W + 40 || s.y < cam.y - 40 || s.y > cam.y + H + 40) continue;

    if(s.kind === 'bomb'){
      // 落点警示 + 空中小球
      ctx.strokeStyle = 'rgba(255,220,150,' + (0.25 + p * 0.6) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (1.25 - p * 0.25), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,190,' + (0.06 + p * 0.13) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      const ballY = s.y - (1 - p) * 90;
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(s.x - 3, ballY - 3, 7, 7);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(s.x - 3, ballY + 2, 7, 2);
    } else if(s.kind === 'slam'){
      /* 蓄力砸地：先是收缩的警示圈，落地瞬间炸开一圈裂纹 */
      if(s.delay > 0){
        /* 预警交给挥击层的虚线环，这里只留一点落点阴影，别糊成三层大圈 */
        ctx.fillStyle = 'rgba(199,162,255,' + (0.04 + p * 0.07) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.55, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.35, 0, TAU); ctx.fill();
      }
    } else if(s.kind === 'bubble'){
      ctx.strokeStyle = 'rgba(160,235,255,' + (0.3 + p * 0.5) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.5 + p * 0.5), 0, TAU);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,225,120,' + (0.25 + p * 0.5) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (1.5 - p * 0.5), 0, TAU);
      ctx.stroke();
      if(p > 0.5){
        ctx.fillStyle = 'rgba(255,240,160,' + (p - 0.5) * 2 + ')';
        const x = s.x, y = s.y - 90;
        ctx.fillRect(x, y, 2, 90);
        ctx.fillRect(x - 4, y + 18, 2, 18);
        ctx.fillRect(x + 5, y + 40, 2, 16);
        ctx.fillRect(x - 8, y + 52, 2, 12);
      }
    }
  }
}

function drawRings(){
  for(let i = 0; i < rings.length; i++){
    const r = rings[i];
    const p = 1 - r.life / r.max;
    const rad = lerp(r.r0, r.r1, p);
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.95;
    ctx.strokeStyle = r.col;
    ctx.lineWidth = (r.w || 2) * (1 - p * 0.45);
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, TAU);
    ctx.stroke();
    // 内芯高光，让冲击波更有能量感
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.8, (r.w || 2) * 0.3);
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, TAU);
    ctx.stroke();
    // 内圈淡填充，让爆炸更有体积感
    if(r.w && r.w >= 3){
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.13;
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawParts(){
  for(let i = 0; i < parts.length; i++){
    const p = parts[i];
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if(p.spark){
      /* 火花画成短线段，方向和速度一致，比方块更像"被打到" */
      ctx.strokeStyle = p.col;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.028, p.y - p.vy * 0.028);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTexts(){
  /* 无头环境下没有 2D 覆盖层：静默跳过，不能因此把整个渲染打断 */
  if(!txtCtx || !txtCvs || typeof txtCtx.clearRect !== 'function') return;
  resizeTxtLayer();
  const cw = txtCvs.width || 0, ch = txtCvs.height || 0;
  txtCtx.clearRect(0, 0, cw, ch);
  if(!cw || !ch || !texts.length) return;
  const sx = cw / W, sy = ch / H;
  /* 【6.0 修复】文字层是独立画布，必须自己补上相机偏移。
     第一版漏了这一步：所有飘字画的是"世界坐标"，却按"屏幕坐标"贴在画布上，
     于是文字整体偏移一个相机位置 —— 玩家看到的就是"暴击从莫名其妙的地方蹦出来"。 */
  const camX = Math.round(cam.x), camY = Math.round(cam.y);
  txtCtx.save();
  txtCtx.scale(sx, sy);
  txtCtx.translate(-camX, -camY);
  txtCtx.textAlign = 'center';
  for(let i = 0; i < texts.length; i++){
    const t = texts[i];
    txtCtx.globalAlpha = Math.max(0, t.life / t.max);
    /* 字号在原基础上 +2：之前 8px 是给"被放大 3 倍的马赛克"看的，
       现在有独立分辨率，8px 的中文仍然是糊的。 */
    txtCtx.font = '700 ' + ((t.size || 8) + 2) + 'px "Microsoft YaHei","PingFang SC",sans-serif';
    txtCtx.lineWidth = 2.6;
    txtCtx.strokeStyle = 'rgba(14,8,22,.92)';
    txtCtx.strokeText(t.v, t.x, t.y);
    txtCtx.fillStyle = t.col;
    txtCtx.fillText(t.v, t.x, t.y);
  }
  txtCtx.restore();
  txtCtx.globalAlpha = 1;
}

/* 顶部 Boss 血条 */
function drawBossBar(){
  if(state.mode !== 'playing' && state.mode !== 'paused' && state.mode !== 'levelup') return;
  /* 终局 BOSS 优先显示：否则场上有常规 BOSS 时，血条会一直挂在别人身上 */
  let boss = null, fin = null;
  for(let i = 0; i < enemies.length; i++){
    const e = enemies[i];
    if(!e.big || e.dead) continue;
    if(e.final){ fin = e; break; }
    if(!boss) boss = e;
  }
  if(fin) boss = fin;
  if(!boss) return;
  const bw = 300, bh = 8;
  const x = (W - bw) / 2, y = 30;
  ctx.fillStyle = 'rgba(18,10,28,.78)';
  ctx.fillRect(x - 3, y - 11, bw + 6, bh + 14);
  ctx.strokeStyle = boss.final ? 'rgba(255,225,140,.75)' : 'rgba(255,255,255,.22)';
  ctx.lineWidth = boss.final ? 1.5 : 1;
  ctx.strokeRect(x - 3.5, y - 11.5, bw + 7, bh + 15);
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(x, y, bw, bh);
  const p = Math.max(0, boss.hp / boss.maxHp);
  const g = ctx.createLinearGradient(x, 0, x + bw, 0);
  if(boss.final){
    g.addColorStop(0, '#ff8f3d');
    g.addColorStop(0.6, '#ffd166');
    g.addColorStop(1, '#fff3b0');
  } else {
    g.addColorStop(0, '#ff5f7e');
    g.addColorStop(0.6, boss.col);
    g.addColorStop(1, '#ffd166');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, bw * p, bh);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(x, y, bw * p, 1);
  /* 终局 BOSS 的三阶段分界线：玩家能看出"再过 1/3 它要换招了" */
  if(boss.final){
    ctx.fillStyle = 'rgba(20,10,30,.65)';
    ctx.fillRect(x + bw * 0.33, y, 1, bh);
    ctx.fillRect(x + bw * 0.66, y, 1, bh);
  }
  ctx.font = 'bold 8px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = boss.final ? '#fff3b0' : '#ffe9a8';
  ctx.fillText((boss.final ? '👑 ' : '') + (boss.name || 'BOSS'), W / 2, y - 3);
  ctx.textAlign = 'left';
}

/* 连击计数（屏幕坐标） */
/* --- 标题画面装饰 --- */
function renderTitle(){
  const t = state.t;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a1226';
  ctx.fillRect(0, 0, W, H);

  if(groundPat){
    ctx.save();
    const ox = -(t * 12) % 160;
    const oy = -(t * 5) % 160;
    ctx.translate(ox, oy);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = groundPat;
    ctx.fillRect(0, 0, W + 160, H + 160);
    ctx.restore();
  }

  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(18,10,30,.94)');
  vg.addColorStop(0.62, 'rgba(18,10,30,.82)');
  vg.addColorStop(1, 'rgba(18,10,30,.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // 底部草地台
  ctx.fillStyle = 'rgba(24,14,36,.5)';
  ctx.fillRect(0, H - 46, W, 46);
  ctx.fillStyle = 'rgba(140,215,110,.28)';
  ctx.fillRect(0, H - 46, W, 2);

  // 排队入场的小怪物
  const list = ['slime', 'burger', 'shooter', 'bomb', 'pudding', 'carrot', 'bat', 'boss'];
  for(let i = 0; i < 10; i++){
    const key = list[i % list.length];
    const s2 = SPR[key];
    const x = 26 + i * 68 + Math.sin(t * 0.9 + i) * 4;
    const y = H - 18 + Math.sin(t * 3.2 + i * 0.9) * 4;
    const sc = key === 'boss' ? 1.8 : 1;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(s2.img, Math.round(x - s2.w * sc / 2), Math.round(y - s2.h * sc / 2), s2.w * sc, s2.h * sc);
  }
  // 主角在中间蹦跶
  const ps = SPR.player;
  const px = W / 2 + Math.sin(t * 0.8) * 26;
  const py = H - 26 - Math.abs(Math.sin(t * 3.4)) * 10;
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(20,10,30,.25)';
  ctx.fillRect(px - 7, H - 20, 14, 3);
  ctx.drawImage(ps.img, Math.round(px - ps.w / 2), Math.round(py - ps.h / 2));
  ctx.globalAlpha = 1;
}

