/* 截图 UI：进游戏 → 暂停 → 悬停第一个武器 → 截图，用来看 tooltip 和按钮对比度 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_shot_ui.png');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const inject = `
<script>
window.addEventListener('load', function(){
  try{
    __SS.start('chef');
    __SS.giveWeapon('flamer', 3);
    __SS.giveWeapon('frost', 2);
    __SS.giveRelic('ember');
    __SS.giveRelic('chaincrit');
    __SS.giveRelic('furyspark');
    __SS.giveRelic('bloodoath');
    __SS.givePassive ? __SS.givePassive('crit', 2) : null;
    for(var i=0;i<200;i++){ if(__SS.state.mode==='levelup') __SS.autoPick(); __SS.step(1/60); }
    window.requestAnimationFrame = function(){ return 0; };
    document.getElementById('levelup').classList.add('hidden');
    /* 打开暂停面板 */
    __SS.state.mode = 'playing';
    var ev = new KeyboardEvent('keydown', {key:'Escape'});
    window.dispatchEvent(ev);
    setTimeout(function(){
      var all = document.querySelectorAll('#pauseUp .mini');
      var mini = all.length ? all[all.length - 1] : null;
      if(mini){
        mini.dispatchEvent(new MouseEvent('mouseenter', {bubbles:false}));
      }
      document.title = 'ready';
    }, 60);
  }catch(e){ document.title = 'ERR ' + e.message; }
});
</script>`;
const file = path.join(ROOT, '_shot_ui.html');
fs.writeFileSync(file, html.replace('</body>', inject + '</body>'), 'utf8');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
execFileSync(EDGE, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--window-size=1280,780','--virtual-time-budget=2500',
  '--screenshot=' + OUT.replace(/\//g,'\\'), 'file:///' + file.replace(/\\/g,'/')],
  { stdio:'ignore', timeout:60000 });
console.log('saved', OUT, fs.existsSync(OUT) ? fs.statSync(OUT).size : 'MISSING');
