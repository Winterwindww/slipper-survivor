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
function addText(x, y, v, col, size){
  if(texts.length > 30) return;
  texts.push({ x, y, v, life: 0.7, max: 0.7, col, size: size || 8 });
}

