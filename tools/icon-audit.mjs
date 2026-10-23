import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const icons = fs.readFileSync(path.join(root, 'src/30-icons.js'), 'utf8');
const weapons = fs.readFileSync(path.join(root, 'src/42-weapons.js'), 'utf8');
const modBlock = weapons.split('const MODS = {')[1]?.split('\n};')[0] || '';
const mods = [...modBlock.matchAll(/^\s{2}([\w]+):\s*\{/gm)].map(m => m[1]);
const ctx = { fillStyle:'', pixels:[] };
ctx.fillRect = (x,y,w,h) => ctx.pixels.push([x,y,w,h,ctx.fillStyle]);
const sandbox = vm.createContext({ g:ctx, key:'' });
const api = vm.runInContext(icons + '\n;({keys:Object.keys(MOD_ICON_SHAPES),draw:drawRune})', sandbox);
const missing = mods.filter(id => !api.keys.includes(id));
if(missing.length) throw new Error('改造卡缺少专用像素图标: ' + missing.join(', '));

function signature(id){
  ctx.pixels = [];
  sandbox.key = id;
  api.draw(ctx, id);
  return JSON.stringify(ctx.pixels.map(([x,y,w,h]) => [x,y,w,h]));
}

const core = ['scatter','pierce','bounce'];
const signatures = core.map(signature);
if(new Set(signatures).size !== core.length){
  throw new Error('散射、穿透、弹跳三个效果图标仍无法仅凭轮廓区分');
}
console.log(`通过：${mods.length} 张改造卡都有专用图标；弹射类效果轮廓各不相同。`);
