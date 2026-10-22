/* 图标预览：把所有遗物 / 结晶 / 改造卡的图标画成一张对照表，用真实浏览器截图。
   用法：node tools/_iconshot.mjs [输出文件] [all|mods|relics] [像素] */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_icons.png');
const PART = process.argv[3] || 'all';
const PX = Number(process.argv[4] || 48);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const inject = `
<script>
window.addEventListener('load', function(){
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;background:#1a1526;z-index:99999;overflow:auto;padding:12px;font:11px/1.2 monospace;color:#e8e0f4';
  document.body.appendChild(box);
  try{
    function cell(icon, seed, tint, label, sub){
      var d = document.createElement('div');
      d.style.cssText = 'display:inline-block;width:${PX + 36}px;margin:3px;text-align:center;vertical-align:top';
      var c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      c.style.cssText = 'width:${PX}px;height:${PX}px;image-rendering:pixelated;background:#2a2338;border-radius:4px';
      __SS.drawIcon(c.getContext('2d'), icon, seed, tint);
      d.appendChild(c);
      var t = document.createElement('div');
      t.textContent = label;
      t.style.cssText = 'color:' + (tint || '#fff') + ';margin-top:2px;font-size:10px;white-space:nowrap;overflow:hidden';
      t.title = label + ' ' + (sub || '');
      d.appendChild(t);
      box.appendChild(d);
    }
    function head(txt, col){
      var h = document.createElement('div');
      h.textContent = txt;
      h.style.cssText = 'color:' + col + ';margin:8px 0 4px;font-size:13px';
      box.appendChild(h);
    }
    var relics = ('${PART}' === 'all' || '${PART}' === 'relics') ? __SS.relicIcons() : [];
    if(relics.length){
      head('遗物 ' + relics.length + ' 件', '#ffd166');
      relics.forEach(function(r){ cell(r.icon, r.seed, r.color, r.name, r.id); });
    }
    var mods = ('${PART}' === 'all' || '${PART}' === 'mods') ? __SS.modIcons() : [];
    if(mods.length){
      head('改造卡 ' + mods.length + ' 张', '#9fe8ff');
      mods.forEach(function(m){ cell(m.icon, null, null, m.name, m.id); });
    }
    var ws = ('${PART}' === 'all') ? __SS.weaponCatalog() : [];
    if(ws.length){
      head('武器 ' + ws.length + ' 把', '#8ee6b3');
      ws.forEach(function(w){ cell(w.icon || 'star', null, w.color, w.name, w.id); });
    }
    document.title = 'ready';
  }catch(e){
    document.title = 'ERR ' + e.message;
    var eb = document.createElement('div');
    eb.textContent = 'ERR ' + e.message;
    eb.style.cssText = 'color:#ff6b8f;font-size:16px;padding:20px';
    box.appendChild(eb);
  }
});
</script>`;

const file = path.join(ROOT, '_icons.html');
fs.writeFileSync(file, html.replace('</body>', inject + '</body>'), 'utf8');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1180,2600', '--screenshot=' + OUT, '--virtual-time-budget=2500',
  'file:///' + file.replace(/\\/g, '/')], { stdio: 'ignore' });
console.log('saved', OUT);
