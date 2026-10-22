/* =========================================================
   7. 音频：音效总线 + 芯片音乐 BGM
   ---------------------------------------------------------
   所有声音都是 WebAudio 现场合成：一个振荡器 + 一段噪声就能
   做出"塑料感"的 8-bit 味道。2.0 新增了元素反应、召唤、遗物、
   觉醒等音色，并用"每音色独立冷却"避免满屏连锁时糊成白噪音。
   ========================================================= */
let AC = null, masterGain = null, sfxGain = null, bgmGain = null;
let muted = false, lastSfx = 0;

let audioDead = false;
function audioInit(){
  if(AC) return AC;
  if(audioDead) return null;
  try{
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(AC.destination);

    sfxGain = AC.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(masterGain);

    bgmGain = AC.createGain();
    bgmGain.gain.value = 0.0001;
    bgmGain.connect(masterGain);
  }catch(e){ AC = null; audioDead = true; }
  return AC;
}

/* ---------------- 音色表 ---------------- */
/* n = 噪声层：{ dur, vol, hp, lp } ；双音 = 前一个音之后再叠一个 */
const SFX_DEF = {
  shoot:   { f0:620, f1:380, dur:0.05, vol:0.016, wave:'square', cd:35 },
  pop:     { f0:700, f1:1100, dur:0.06, vol:0.018, wave:'square', cd:40 },
  splat:   { f0:300, f1:160, dur:0.07, vol:0.020, wave:'sawtooth', cd:40 },
  bubble:  { f0:420, f1:900, dur:0.14, vol:0.022, wave:'sine', cd:60 },
  zap:     { f0:1200, f1:200, dur:0.10, vol:0.020, wave:'sawtooth', cd:70 },
  hit:     { f0:240, f1:150, dur:0.05, vol:0.016, wave:'square', cd:45 },
  kill:    { f0:520, f1:240, dur:0.07, vol:0.018, wave:'square', cd:45 },
  gem:     { f0:880, f1:1320, dur:0.05, vol:0.012, wave:'sine', cd:30 },
  level:   { f0:520, f1:1040, dur:0.25, vol:0.032, wave:'triangle', cd:200 },
  hurt:    { f0:180, f1:90, dur:0.16, vol:0.045, wave:'sawtooth', cd:180 },
  boss:    { f0:120, f1:60, dur:0.50, vol:0.055, wave:'sawtooth', cd:400,
             n:{ dur:0.35, vol:0.10, lp:900 } },
  over:    { f0:400, f1:60, dur:0.70, vol:0.045, wave:'triangle', cd:600 },

  /* --- 2.0 新增 --- */
  crit:    { f0:1500, f1:820, dur:0.07, vol:0.022, wave:'triangle', cd:55,
             n:{ dur:0.05, vol:0.03, hp:5200 } },
  melt:    { f0:340, f1:120, dur:0.22, vol:0.028, wave:'sawtooth', cd:110,
             n:{ dur:0.26, vol:0.06, hp:1800 } },
  toxblast:{ f0:210, f1:70, dur:0.20, vol:0.030, wave:'sawtooth', cd:110,
             n:{ dur:0.18, vol:0.05, hp:900 } },
  superconduct:{ f0:1900, f1:520, dur:0.13, vol:0.024, wave:'square', cd:110,
             n:{ dur:0.10, vol:0.035, hp:6500 } },
  conduct: { f0:980, f1:330, dur:0.10, vol:0.020, wave:'square', cd:110 },
  knock:   { f0:160, f1:110, dur:0.06, vol:0.018, wave:'square', cd:70 },
  deploy:  { f0:190, f1:130, dur:0.09, vol:0.024, wave:'square', cd:80,
             n:{ dur:0.05, vol:0.025, hp:2600 } },
  turret:  { f0:760, f1:520, dur:0.04, vol:0.012, wave:'square', cd:60 },
  petDie:  { f0:520, f1:170, dur:0.20, vol:0.026, wave:'triangle', cd:180 },
  relic:   { f0:660, f1:990, dur:0.10, vol:0.026, wave:'triangle', cd:250,
             second:{ f0:1320, f1:1320, dur:0.16, vol:0.020, wave:'sine', delay:0.08 } },
  curse:   { f0:230, f1:62, dur:0.42, vol:0.038, wave:'sawtooth', cd:400,
             n:{ dur:0.30, vol:0.04, lp:600 } },
  awaken:  { f0:520, f1:1560, dur:0.36, vol:0.034, wave:'triangle', cd:350,
             second:{ f0:2080, f1:2080, dur:0.24, vol:0.018, wave:'sine', delay:0.12 } },
  swarm:   { f0:95, f1:52, dur:0.55, vol:0.045, wave:'sawtooth', cd:500,
             n:{ dur:0.40, vol:0.07, lp:800 } },
  boom:    { f0:200, f1:60, dur:0.14, vol:0.028, wave:'square', cd:70,
             n:{ dur:0.16, vol:0.06, lp:1200 } },
  chain:   { f0:1250, f1:640, dur:0.06, vol:0.014, wave:'square', cd:45 },

  /* --- 近战：每种手感一个音色，不能都用一个 "hit" --- */
  whoosh:  { f0:300, f1:1200, dur:0.09, vol:0.014, wave:'sine', cd:55,
             n:{ dur:0.10, vol:0.030, hp:700 } },
  slash:   { f0:900, f1:260, dur:0.07, vol:0.020, wave:'sawtooth', cd:45,
             n:{ dur:0.07, vol:0.045, hp:2600 } },
  clang:   { f0:1350, f1:520, dur:0.11, vol:0.026, wave:'square', cd:70,
             n:{ dur:0.09, vol:0.055, hp:4200 },
             second:{ f0:2100, f1:1450, dur:0.09, vol:0.014, wave:'triangle', delay:0.01 } },
  spin:    { f0:640, f1:900, dur:0.05, vol:0.010, wave:'triangle', cd:60 },
  chainLoop:{ f0:150, f1:190, dur:0.09, vol:0.012, wave:'sawtooth', cd:120 },

  /* --- 3.0 资源音色 --- */
  rageEnter:{ f0:180, f1:720, dur:0.34, vol:0.040, wave:'sawtooth', cd:260,
              n:{ dur:0.26, vol:0.075, lp:1600 },
              second:{ f0:720, f1:1080, dur:0.22, vol:0.020, wave:'square', delay:0.10 } },
  rageExit:{ f0:520, f1:150, dur:0.16, vol:0.020, wave:'triangle', cd:160 },
  rageBurst:{ f0:120, f1:48, dur:0.26, vol:0.038, wave:'square', cd:140,
              n:{ dur:0.24, vol:0.075, lp:1100 } },
  overload:{ f0:260, f1:1400, dur:0.20, vol:0.032, wave:'square', cd:240,
             n:{ dur:0.16, vol:0.045, hp:5200 },
             second:{ f0:1400, f1:880, dur:0.22, vol:0.020, wave:'triangle', delay:0.14 } },
  shieldBreak:{ f0:1800, f1:420, dur:0.18, vol:0.028, wave:'triangle', cd:120,
                n:{ dur:0.16, vol:0.050, hp:5200 } },
  heartbeat:{ f0:96, f1:58, dur:0.20, vol:0.034, wave:'sine', cd:900,
              second:{ f0:80, f1:48, dur:0.16, vol:0.026, wave:'sine', delay:0.18 } },
  devour:  { f0:210, f1:96, dur:0.10, vol:0.022, wave:'square', cd:150,
             n:{ dur:0.10, vol:0.028, lp:900 } },
  arch:    { f0:660, f1:990, dur:0.16, vol:0.026, wave:'triangle', cd:400,
             second:{ f0:1480, f1:1480, dur:0.28, vol:0.018, wave:'sine', delay:0.10 } },
  streak:  { f0:1180, f1:1560, dur:0.10, vol:0.020, wave:'square', cd:220,
             second:{ f0:1560, f1:1560, dur:0.12, vol:0.014, wave:'sine', delay:0.07 } }
};

/* 每个音色的独立冷却，避免满屏触发时糊成噪音 */
const SFX_CD = Object.create(null);

function sfx(type){
  if(muted) return;
  const def = SFX_DEF[type];
  if(!def) return;
  const now = performance.now();
  if(now - lastSfx < 20) return;
  const cd = def.cd || 40;
  if(SFX_CD[type] && now - SFX_CD[type] < cd) return;
  if(!audioInit()) return;
  try{
    if(AC.state === 'suspended') AC.resume();
    SFX_CD[type] = now;
    lastSfx = now;
    const t0 = AC.currentTime;
    tone(def.f0, def.f1, t0, def.dur, def.wave, def.vol);
    if(def.n) noise(t0, def.n.dur, def.n.vol, def.n.hp, def.n.lp);
    if(def.second){
      const s = def.second;
      tone(s.f0, s.f1, t0 + (s.delay || 0.08), s.dur, s.wave, s.vol);
    }
  }catch(e){ /* 忽略音频错误 */ }
}

function tone(f0, f1, when, dur, wave, vol){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = wave || 'square';
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(Math.max(25, f1), when + dur);
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(when); o.stop(when + dur + 0.02);
}

function noise(when, dur, vol, hp, lp){
  const len = Math.max(1, Math.floor(AC.sampleRate * dur));
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter();
  if(lp){ f.type = 'lowpass'; f.frequency.value = lp; }
  else { f.type = 'highpass'; f.frequency.value = hp || 3000; }
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(when);
}

/* --- 芯片音乐：C 大调 I–V–vi–IV，按幕逐层加入声部 --- */
const BGM = {
  bpm: 146,
  step: 0,
  next: 0,
  timer: null,
  on: false,
  act: 1,
  /* 【2.6】两段进行交替（A 段偏大调、B 段偏小调），16 小节一轮，
     原来只有 4 个和弦、32 步无限循环，听两分钟就开始腻。
     A: C - G - Am - F - C - G - F - G
     B: Am - F - C - G - Am - Dm - F - G */
  progA: [
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [53, 57, 60, 65],
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [53, 57, 60, 65],
    [55, 59, 62, 67]
  ],
  progB: [
    [57, 60, 64, 69],
    [53, 57, 60, 65],
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [62, 65, 69, 74],
    [53, 57, 60, 65],
    [55, 59, 62, 67]
  ],
  /* 四套旋律型轮换，避免每 8 拍都是同一句 */
  leadPats: [
    [0, 1, 2, 3, 2, 3, 1, 2],
    [0, 2, 1, 3, 2, 0, 3, 1],
    [3, 2, 1, 0, 1, 2, 3, 2],
    [0, 1, 3, 2, 3, 1, 2, 0]
  ],
  vol: 0.22,
  boss: false
};

function mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); }

function bgmTone(freq, when, dur, wave, vol){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(bgmGain);
  o.start(when); o.stop(when + dur + 0.03);
}

function bgmNoise(when, dur, vol, hp){
  const len = Math.max(1, Math.floor(AC.sampleRate * dur));
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 6500;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(bgmGain);
  src.start(when);
}

/* --- 3.0 新增声部：铺底 pad / 滤波贝斯 / 战斗层 ---
   2.x 的 BGM 只有方波琶音 + 三角波低音，听感像"红白机单声道"。
   这里补两层：
     pad   —— 两个微失谐的锯齿波 + 低通，把和弦垫成"有空间"的背景；
     bass  —— 方波 + 低通，比三角波更有"推进感"，是节奏的骨架。 */
function bgmPad(freq, when, dur, vol){
  const o1 = AC.createOscillator(), o2 = AC.createOscillator();
  const g = AC.createGain(), f = AC.createBiquadFilter();
  o1.type = 'sawtooth'; o2.type = 'sawtooth';
  o1.frequency.value = freq;
  o2.frequency.value = freq * 1.006;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(700, when);
  f.frequency.linearRampToValueAtTime(1300, when + dur * 0.6);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.28);
  g.gain.linearRampToValueAtTime(0.0001, when + dur);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(bgmGain);
  o1.start(when); o2.start(when);
  o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
}

function bgmBass(freq, when, dur, vol){
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, when);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(360, when);
  f.frequency.exponentialRampToValueAtTime(180, when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(f); f.connect(g); g.connect(bgmGain);
  o.start(when); o.stop(when + dur + 0.03);
}

/* 按幕切换编曲：1 幕只有骨架，2 幕加和声与踩镲，3 幕加十六分琶音与更强打击 */
function bgmSetAct(act){
  BGM.act = act;
  BGM.bpm = act >= 3 ? 154 : (act === 2 ? 150 : 146);
}

/* Boss 战配乐层：低音 ostinato + 金属撞击 */
function bgmSetBoss(on){ BGM.boss = !!on; }

function bgmSchedule(){
  if(!AC || !BGM.on) return;
  const now = AC.currentTime;
  if(BGM.next < now - 0.35) BGM.next = now + 0.05;
  const eighth = 60 / BGM.bpm / 2;
  const act = BGM.act;
  let guard = 0;
  while(BGM.next < now + 0.18 && guard++ < 12){
    const s = BGM.step;
    /* 16 小节一轮：前 8 小节 A 段，后 8 小节 B 段 */
    const bar = Math.floor(s / 8) % 16;
    const i = s % 8;
    const ch = (bar < 8 ? BGM.progA : BGM.progB)[bar % 8];
    /* 旋律型每 4 小节换一次，第三幕之后换得更勤 */
    const patIdx = Math.floor(s / 32) % BGM.leadPats.length;
    const pat = BGM.leadPats[(patIdx + (act >= 3 ? 1 : 0)) % BGM.leadPats.length];
    const vol = BGM.vol;
    const inB = bar >= 8;
    const fillBar = (bar === 7 || bar === 15);      /* 每段最后一小节：加过门 */

    /* 铺底长音：每小节一个，把和弦"垫"住，原来只有断奏，听感很干 */
    if(i === 0){
      bgmPad(mtof(ch[0] + 12), BGM.next, eighth * 7.6, vol * 0.07);
      bgmPad(mtof(ch[2] + 12), BGM.next, eighth * 7.6, vol * 0.05);
      /* 第三幕之后再叠一层高八度，把"高潮段"和前面区分开 */
      if(act >= 3) bgmPad(mtof(ch[3] + 24), BGM.next, eighth * 3.8, vol * 0.035);
    }

    /* 低音：滤波方波，比三角波更有推进力 */
    if(i === 0 || i === 4) bgmBass(mtof(ch[0] - 24), BGM.next, eighth * 1.5, vol * 1.15);
    if(i === 3 || i === 7) bgmBass(mtof(ch[0] - 17), BGM.next, eighth * 0.55, vol * 0.7);
    if(inB && i === 6) bgmBass(mtof(ch[0] - 12), BGM.next, eighth * 0.5, vol * 0.55);

    /* Boss 战：低音八分音符 ostinato + 每两拍一次金属撞击，制造压迫感 */
    if(BGM.boss){
      bgmBass(mtof(ch[0] - 12), BGM.next, eighth * 0.42, vol * 0.55);
      if(i % 2 === 0) bgmNoise(BGM.next, 0.05, vol * 0.18, 2400);
      if(i === 0) bgmTone(mtof(ch[0] + 6), BGM.next, eighth * 0.5, 'square', vol * 0.22);
    }

    /* 主旋律琶音 */
    const note = ch[pat[i]] + ((i === 7 && bar % 2 === 1) ? 12 : 0);
    bgmTone(mtof(note), BGM.next, eighth * 1.3, 'square', vol * 0.62);
    /* 高音装饰 */
    if(i === 0) bgmTone(mtof(ch[3] + 12), BGM.next, eighth * 0.85, 'triangle', vol * 0.34);
    if(i === 5 && bar === 3) bgmTone(mtof(ch[3] + 7), BGM.next, eighth * 0.5, 'square', vol * 0.3);
    if(inB && i === 2) bgmTone(mtof(ch[1] + 12), BGM.next, eighth * 0.7, 'square', vol * 0.24);

    /* 第二幕起：和声层 */
    if(act >= 2 && (i === 2 || i === 6)){
      bgmTone(mtof(ch[1] + 12), BGM.next, eighth * 0.9, 'triangle', vol * 0.22);
    }
    /* 第三幕：十六分琶音 */
    if(act >= 3){
      const sub = eighth * 0.5;
      for(let k = 0; k < 2; k++){
        const n2 = ch[(i + k) % 4] + 24;
        bgmTone(mtof(n2), BGM.next + k * sub, sub * 0.9, 'square', vol * 0.14);
      }
    }

    /* 过门：每段最后一小节的后两拍，上行走句 + 密集军鼓 */
    if(fillBar && i >= 5){
      const rise = ch[(i - 4) % 4] + 12 + (i - 5) * 2;
      bgmTone(mtof(rise), BGM.next, eighth * 0.42, 'square', vol * 0.3);
      bgmNoise(BGM.next, 0.03, vol * 0.34, 5200);
      bgmNoise(BGM.next + eighth * 0.5, 0.03, vol * 0.26, 6000);
    }

    /* 打击 */
    bgmNoise(BGM.next, 0.03, vol * 0.24);
    if(act >= 2 && i % 2 === 1) bgmNoise(BGM.next, 0.035, vol * 0.18, 8000);
    if(i === 2 || i === 6) bgmNoise(BGM.next, 0.07, vol * 0.5, 3200);
    if(i === 3 && inB) bgmNoise(BGM.next, 0.05, vol * 0.3, 4200);
    if(i === 0 || i === 4){
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, BGM.next);
      o.frequency.exponentialRampToValueAtTime(46, BGM.next + 0.1);
      g.gain.setValueAtTime(vol * (act >= 3 ? 2.0 : 1.6), BGM.next);
      g.gain.exponentialRampToValueAtTime(0.0001, BGM.next + 0.12);
      o.connect(g); g.connect(bgmGain);
      o.start(BGM.next); o.stop(BGM.next + 0.14);
    }

    BGM.next += eighth;
    BGM.step = (BGM.step + 1) % 128;      /* 16 小节 × 8 步 */
  }
}

function bgmStart(){
  if(!audioInit()) return;
  if(AC.state === 'suspended') AC.resume();
  BGM.on = true;
  BGM.step = 0;
  BGM.next = AC.currentTime + 0.08;
  if(!BGM.timer) BGM.timer = setInterval(bgmSchedule, 40);
  bgmGain.gain.cancelScheduledValues(AC.currentTime);
  bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), AC.currentTime);
  bgmGain.gain.linearRampToValueAtTime(BGM.vol, AC.currentTime + 0.8);
}

function bgmDuck(v){
  if(!AC) return;
  const t = AC.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), t);
  bgmGain.gain.linearRampToValueAtTime(v, t + 0.2);
}

function bgmStop(){
  if(!AC) return;
  BGM.on = false;
  const t = AC.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), t);
  bgmGain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
}
