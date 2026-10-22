/* 视觉验证：用真实浏览器把游戏推进到指定时刻再截图
   不靠 rAF 实时跑，而是手动 step 到目标帧，然后冻结并渲染一帧，
   这样每次截图都是确定性画面，能稳定拍到挥击中的某一帧。
   用法：
     node tools/shot.mjs --char knight --weapons pan --ms 1800 --out _shot.png
     node tools/shot.mjs --char ranger --weapons slipper,gun --ms 3000 --enemies 40 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const CHAR = arg('char', 'knight');
const WEAPONS = arg('weapons', 'pan').split(',').filter(Boolean);
const RELICS = arg('relics', '').split(',').filter(Boolean);
const MS = Number(arg('ms', 2000));
const OUT = path.resolve(ROOT, arg('out', '_shot.png'));
const ENEMIES = Number(arg('enemies', 26));
const WARM = Number(arg('warm', 900));      /* 提前热身多少毫秒，让 buff/召唤物起来 */
const STOP = Number(arg('stop', 1500));
const FREEZE = arg('freeze', '');   /* swing = 停在某次挥击的命中帧 */

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const inject = `
<script>
window.addEventListener('load', function(){
  try{
    __SS.start('${CHAR}');
    ${WEAPONS.map(w => `__SS.giveWeapon('${w}', 5);`).join('\n    ')}
    ${RELICS.map(r => `__SS.giveRelic('${r}');`).join('\n    ')}
    var kinds = ['slime','burger','bat','shooter','pudding','iron'];
    function ring(n, d0){
      for(var i = 0; i < n; i++){
        var a = i / n * Math.PI * 2 + Math.random() * 0.2;
        var d = d0 + (i % 5) * 14 + Math.random() * 10;
        __SS.spawn(kinds[i % kinds.length], 1);
        var e = __SS.enemies[__SS.enemies.length - 1];
        if(e){ e.x = __SS.P.x + Math.cos(a) * d; e.y = __SS.P.y + Math.sin(a) * d; }
      }
    }
    ring(${ENEMIES}, 44);

    var DT = 1/60;
    var steps = Math.round(${MS} / 1000 / DT);
    var warm = Math.round(${WARM} / 1000 / DT);
    function hasActiveSwing(){
      var arr = __SS.swings;
      for(var k = 0; k < arr.length; k++){
        var sw = arr[k];
        if(sw.t > sw.windup + sw.active * 0.45 && sw.t < sw.windup + sw.active * 0.95) return true;
      }
      return false;
    }
    var FREEZE = '${FREEZE}';
    for(var i = 0; i < steps; i++){
      if(i === warm) ring(${ENEMIES}, 40);
      if(__SS.state.mode === 'levelup'){ var g = 0; while(__SS.state.mode === 'levelup' && g++ < 40) __SS.autoPick(); }
      if(__SS.state.mode === 'gameover') break;
      __SS.step(DT);
      if(FREEZE === 'swing' && i > warm && hasActiveSwing()) break;
    }
    /* 冻结：停掉 rAF，保留当前这一帧 */
    window.requestAnimationFrame = function(){ return 0; };
    ['levelup','pausebox','charselect','title','gameover'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.classList.add('hidden');
    });
    __SS.state.mode = 'paused';
    __SS.render();
    document.title = 'T=' + __SS.state.time.toFixed(2);
  }catch(err){
    document.title = 'ERR ' + err.message;
    console.error(err);
  }
});
</script>
`;
const file = path.join(ROOT, '_shot.html');
fs.writeFileSync(file, html.replace('</body>', inject + '</body>'), 'utf8');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
execFileSync(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--window-size=1280,780',
  '--virtual-time-budget=' + STOP,
  '--screenshot=' + OUT.replace(/\//g, '\\'),
  'file:///' + file.replace(/\\/g, '/')
], { stdio: 'ignore', timeout: 90000 });

if(!fs.existsSync(OUT)){ console.error('screenshot failed'); process.exit(1); }
console.log('saved', OUT, fs.statSync(OUT).size, 'bytes');
