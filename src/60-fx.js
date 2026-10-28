function burst(x, y, color, n, spd, gravity){
  const max = 420;
  for(let i = 0; i < n && parts.length < max; i++){
    const a = rand(0, TAU), s = rand(20, spd || 90);
    parts.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 20,
      life: rand(0.16, 0.42), max: 0.42, col: color,
      size: Math.random() < 0.32 ? 3 : (Math.random() < 0.5 ? 2 : 1),
      g: gravity === undefined ? 1 : gravity
    });
  }
}
/* 哪些词可以被合并成计数：短、无数字、是"事件名"而不是"数值" */
function mergeableText(v){
  if(!v || v.length > 5) return false;
  for(let i = 0; i < v.length; i++){
    const c = v.charCodeAt(i);
    if(c >= 48 && c <= 57) return false;     /* 含数字就不合并（伤害数字各自独立） */
  }
  return true;
}
function addText(x, y, v, col, size){
  /* 【6.0】同类事件合并
     ---------------------------------------------------------
     "满屏融化"的根因不是字太多，而是**同一件事被重复喊了 30 次**：
     反应对同目标的 CD 只有 0.14 秒，一次群体命中就能刷十几条。
     这里把 0.5 秒内的同一个词合并成「融化 ×7」，并跟到最新位置。
     信息量没少，屏幕干净了。 */
  if(mergeableText(v)){
    for(let i = texts.length - 1; i >= 0; i--){
      const t = texts[i];
      if(t.base !== v && !(t.base === undefined && t.v === v)) continue;
      /* 只合并"同一小片区域"的同类文字。
         不带距离检查 + 改写坐标，会让一个字从屏幕这头跳到那头，
         看起来就是"凭空冒出来的"。—— 位置永远停在第一次出现的地方。 */
      if(Math.abs(t.x - x) > 70 || Math.abs(t.y - y) > 70) continue;
      t.n = (t.n || 1) + 1;
      t.base = v;
      t.v = v + ' ×' + t.n;
      t.life = 0.5; t.max = 0.5;
      return;
    }
  }
  if(texts.length > 30) return;
  texts.push({ x, y, v, base: mergeableText(v) ? v : undefined, life: 0.7, max: 0.7, col, size: size || 8 });
}

