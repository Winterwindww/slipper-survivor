(function(){
'use strict';

/* =========================================================
   0. 基础工具
   ========================================================= */
const $ = id => document.getElementById(id);
const stage = $('stage');
const cvs = $('game');
const ctx = cvs.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = 640, H = 360;
const ARENA = { w: 1720, h: 1000 };

const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const pickOne = a => a[Math.floor(Math.random() * a.length)];

function dist(ax, ay, bx, by){ const dx = ax - bx, dy = ay - by; return Math.sqrt(dx*dx + dy*dy); }

/* =========================================================
   1. 像素精灵
   ========================================================= */
function makeSprite(rows, pal){
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for(let y = 0; y < h; y++){
    const row = rows[y];
    const off = Math.floor((w - row.length) / 2);
    for(let x = 0; x < row.length; x++){
      const col = pal[row[x]];
      if(!col) continue;
      g.fillStyle = col;
      g.fillRect(x + off, y, 1, 1);
    }
  }
  return c;
}
function whiteOf(img){
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
function reg(rows, pal){
  const img = makeSprite(rows, pal);
  return { img, white: whiteOf(img), w: img.width, h: img.height };
}
