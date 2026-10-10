import './style.css';
import { addTile, newBoard, move, canMove } from './engine.js';
import { sound, haptic, unlockAudio, suspendAudio } from './feedback.js';
import { readSave, writeSave } from './storage.js';
const nativePlatform = window.CoreNative ? (window.CoreNative.getPlatform?.() || '鸿蒙') : null;

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  settings:'<path d="M12 8v8M8 12h8"/><circle cx="12" cy="12" r="9"/>',
  sound:'<path d="m11 4-5 4H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-5 4H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  reset:'<path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3v.1"/>',
  chart:'<path d="M4 20V10m8 10V4m8 16v-7"/>',
  chevron:'<path d="m8 5 7 7-7 7"/>',
  trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-4 1h8"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${icons[name]}</svg>`;
const $ = selector => document.querySelector(selector);
let storageFailed = false;
const saved = readSave();
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
const initial = { board: newBoard(), score: 0, turns: 0, elapsed: 0, won: false, continued: false, undo: null };
let state = saved ? { ...initial, ...saved.game } : initial;
let stats = { best: 0, bestTile: 2, games: 0, totalMerges: 0, bestCombo: 0, ...saved?.stats };
for (const key of Object.keys(stats)) if (!nonnegative(stats[key])) stats[key] = 0;
let settings = { sound: true, haptics: true, effects: !matchMedia('(prefers-reduced-motion: reduce)').matches, volume: 55, ...saved?.settings };
stats.best = Math.max(stats.best, state.score);
stats.bestTile = Math.max(stats.bestTile, ...state.board);
settings.volume = Math.max(0, Math.min(100, Number(settings.volume) || 0));
for (const key of ['sound','haptics','effects']) settings[key] = Boolean(settings[key]);
let combo = 0, busy = false, pending = null, toastTimer, outcomeTimer, installPrompt;
let nativeActive = true;
function save() { try { writeSave({ game: state, stats, settings }); } catch { if (!storageFailed) { storageFailed = true; toast('存档空间不可用，本次仍可正常游戏'); } } }
function feedback(kind, value = 4) { if (settings.sound) sound(kind, value, combo, settings.volume / 100); if (settings.haptics && kind !== 'move') haptic(kind === 'win' || value >= 128 ? 'heavy' : kind === 'merge' ? 'medium' : 'light'); }
function tap() { unlockAudio(); feedback('tap'); }

$('#app').innerHTML = `
  <aside class="sidebar">
    <a class="wordmark" href="#" aria-label="核芯首页"><span class="brand-symbol">${icon('grid')}</span><span>CORE<span class="brand-dot">.</span><small>数字合成终端</small></span></a>
    <div class="sidebar-label mono">WORKSPACE / 工作台</div>
    <nav><button class="nav-item active" data-action="home">${icon('grid')}<span>核心合成</span><span class="nav-index mono">01</span></button><button class="nav-item" data-action="stats">${icon('chart')}<span>运行记录</span><span class="nav-index mono">02</span></button><button class="nav-item" data-action="guide">${icon('help')}<span>操作指南</span><span class="nav-index mono">03</span></button></nav>
    <div class="side-bottom"><div class="system-badge"><span class="status-dot"></span><span class="mono">SYSTEM ONLINE</span></div><button class="nav-item" data-action="settings">${icon('settings')}<span>终端设置</span></button><div class="side-version mono">CORE SYSTEM <span>V.1.0</span></div></div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="breadcrumbs"><span class="mono">CORE LAB</span><span class="slash">/</span><span>核心合成</span></div><div class="topbar-right"><span class="top-online mono"><span class="status-dot"></span>LOCAL SESSION</span><button class="icon-button" data-action="sound" id="sound-button" aria-label="关闭音效"></button><button class="icon-button" data-action="settings" aria-label="终端设置">${icon('settings')}</button></div></header>
    <main>
      <section class="page-heading"><div><div class="eyebrow mono"><span class="tiny-square"></span> INTERACTIVE SYNTHESIS SYSTEM</div><h1>核芯合成<span class="heading-line"></span></h1><p>每一次碰撞，都是新的可能。</p></div><span class="chapter mono">01<span>/ PLAY</span></span></section>
      <div class="game-layout">
        <section class="game-panel" aria-label="2048 游戏">
          <div class="game-title"><div class="game-title-left"><span class="huge-number">2048<span class="number-period">.</span></span><span class="game-subtitle">核心合成协议<br><span class="mono">CORE SYNTHESIS</span></span></div><span class="mode-chip"><span></span>经典模式</span></div>
          <div class="score-row"><div class="score-box"><span class="score-label">当前算力 <small class="mono">SCORE</small></span><div class="score-value mono" id="score">0</div><span class="score-add mono" id="score-add"></span></div><div class="score-box best-box"><span class="score-label">历史峰值 <small class="mono">BEST</small></span><div class="score-value mono" id="best">0</div>${icon('trophy','score-trophy')}</div></div>
          <div class="board-topline mono"><span><span class="status-dot"></span> SYNTHESIS MATRIX</span><span id="combo-label">4 × 4 / READY</span></div>
          <div class="board-frame"><div id="board" class="board" role="grid" aria-label="4乘4棋盘，滑动或按方向键合并数字" tabindex="0"><div class="cell-layer">${Array.from({length:16}, (_, i)=>`<div class="cell" style="--x:${i%4};--y:${Math.floor(i/4)}"><span class="cell-cross">+</span></div>`).join('')}</div><div id="tile-layer"></div><div id="particles" aria-hidden="true"></div><div class="board-shine" aria-hidden="true"></div></div><span class="frame-corner tl"></span><span class="frame-corner tr"></span><span class="frame-corner bl"></span><span class="frame-corner br"></span></div>
          <div class="board-caption"><span class="mono">${icon('expand')} SWIPE TO SYNTHESIZE</span><span>滑动 · 碰撞 · 进化</span></div>
          <div class="game-actions"><button class="action-secondary" data-action="undo" id="undo-button">${icon('undo')}<span>撤销一步</span><small class="mono">UNDO</small></button><button class="action-primary" data-action="restart">${icon('reset')}<span>重新开始</span>${icon('arrow')}</button></div>
          <div class="session-line mono"><span>STEP <strong id="turns">000</strong></span><span class="session-divider"></span><span>TIME <strong id="elapsed">00:00</strong></span><span class="autosave"><span class="status-dot"></span> 自动存档</span></div>
        </section>
        <aside class="info-panel">
          <div class="section-heading"><span class="mono">MISSION / 目标</span><span class="mono">01 — 03</span></div>
          <section class="mission-card"><div class="mission-overline mono"><span class="tiny-square"></span> MAIN OBJECTIVE</div><h2>让数字，<br>突破边界<span>。</span></h2><p>合并相同数字，逐级提升核心能量。<br>你的下一个目标是 <strong id="next-target">4</strong>。</p><div class="target-graphic" aria-hidden="true"><span class="target-orbit"></span><span class="target-core mono" id="target-display">4</span><span class="target-line line-one"></span><span class="target-line line-two"></span><span class="target-marker">+</span><span class="target-index mono">ENERGY<br>LEVEL UP</span></div><div class="progress-label"><span>通向 2048</span><span class="mono" id="progress-percent">9%</span></div><div class="progress-track"><div id="progress-bar"></div></div><div class="milestones mono"><span>2</span><span>128</span><span>2048</span></div></section>
          <section class="feedback-card"><div class="section-heading"><span class="mono">FEEDBACK / 感官反馈</span><span class="small-plus">+</span></div><div class="feedback-row"><span class="mini-icon">${icon('sound')}</span><div><strong>听见每一次进化</strong><p>数字越大，碰撞越有分量。</p></div><div class="waveform" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i style="--height:${[8,16,24,12,30,20,12,22,8][i]}px;--delay:${i*.1}s"></i>`).join('')}</div></div><div class="feedback-row"><span class="mini-icon tactile">◎</span><div><strong>触感，恰到好处</strong><p>轻触响应，合并瞬间脉冲。</p></div><span class="feedback-state mono" id="haptic-state">ON</span></div></section>
          <section class="guide-card"><div class="section-heading"><span class="mono">QUICK GUIDE / 操作</span>${icon('help')}</div><div class="direction-pad" aria-label="方向控制"><button data-direction="up" class="dir-up" aria-label="向上移动">↑</button><button data-direction="left" class="dir-left" aria-label="向左移动">←</button><span class="dir-center">${icon('grid')}</span><button data-direction="right" class="dir-right" aria-label="向右移动">→</button><button data-direction="down" class="dir-down" aria-label="向下移动">↓</button></div><div class="guide-copy"><strong>向任意方向滑动</strong><p>也可使用方向键 / WASD<br>相同数字相遇，即可合成</p></div></section>
          <button class="record-link" data-action="stats"><span>${icon('chart')}查看运行记录</span>${icon('arrow')}</button>
        </aside>
      </div>
      <footer class="page-footer"><span class="mono">CORE LAB. <span class="footer-dim">DESIGNED FOR YOUR NEXT MOVE.</span></span><span>保持好奇，继续合成 <span class="footer-star">✳</span></span></footer>
    </main>
    <nav class="mobile-nav" aria-label="导航"><button data-action="home" class="selected">${icon('grid')}<span>合成</span></button><button data-action="stats">${icon('chart')}<span>记录</span></button><button data-action="guide">${icon('help')}<span>指南</span></button><button data-action="settings">${icon('settings')}<span>设置</span></button></nav>
  </div>
  <dialog id="dialog"><div class="dialog-top"><span class="mono" id="dialog-label">CORE SYSTEM</span><button class="icon-button" data-action="close" aria-label="关闭窗口">${icon('close')}</button></div><div id="dialog-content"></div></dialog>
  <div id="toast" role="status"></div><div class="sr-only" id="announcement" aria-live="polite"></div>
`;

function renderBoard(merged = [], spawn = -1) {
  $('#tile-layer').innerHTML = state.board.map((v, i) => v ? `<div class="tile tile-${Math.min(v, 4096)} ${merged.includes(i) && settings.effects ? 'merged' : ''} ${spawn === i && settings.effects ? 'spawn' : ''}" style="--x:${i%4};--y:${Math.floor(i/4)}" role="gridcell" aria-label="第${Math.floor(i/4)+1}行第${i%4+1}列，${v}"><span class="tile-tick"></span><span class="tile-number">${v}</span><span class="tile-code mono">${v>=128 ? 'HIGH ENERGY' : 'CORE / '+String(Math.log2(v)).padStart(2,'0')}</span>${v >= 128 ? '<span class="tile-corner">↗</span>' : ''}</div>` : '').join('');
  document.body.classList.toggle('reduced-motion', !settings.effects);
}
function renderMeta() {
  $('#score').textContent = state.score.toLocaleString(); $('#best').textContent = stats.best.toLocaleString();
  $('#turns').textContent = String(state.turns).padStart(3,'0');
  $('#elapsed').textContent = `${String(Math.floor(state.elapsed/60)).padStart(2,'0')}:${String(state.elapsed%60).padStart(2,'0')}`;
  $('#undo-button').disabled = !state.undo || busy;
  const max = Math.max(...state.board), next = max * 2, progress = Math.min(100, Math.round(Math.log2(max)/11*100));
  $('#next-target').textContent = next; $('#target-display').textContent = next; $('#progress-percent').textContent = `${progress}%`; $('#progress-bar').style.width = `${progress}%`;
  $('#sound-button').innerHTML = icon(settings.sound ? 'sound' : 'mute'); $('#sound-button').setAttribute('aria-label',settings.sound ? '关闭音效' : '打开音效');
  $('#haptic-state').textContent = settings.haptics ? 'ON' : 'OFF';
  $('#combo-label').textContent = combo >= 2 ? `${String(combo).padStart(2,'0')} CHAIN / 连击` : '4 × 4 / READY';
  $('#combo-label').classList.toggle('combo-on', combo >= 2);
}
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').classList.add('visible'); toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),2200); }
function particles(merges) {
  if (!settings.effects) return;
  for (const m of merges) for(let p = 0; p < 8; p++) {
    const el = document.createElement('i'); el.className='particle'; el.style.cssText=`--x:${m.index%4};--y:${Math.floor(m.index/4)};--dx:${Math.cos(p*Math.PI/4)*(24+Math.random()*25)}px;--dy:${Math.sin(p*Math.PI/4)*(24+Math.random()*25)}px;--rot:${p*45}deg`;
    $('#particles').append(el); setTimeout(()=>el.remove(),550);
  }
}
function handleMove(direction) {
  unlockAudio();
  if (!nativeActive || document.hidden || $('#dialog').open || !canMove(state.board) || state.won && !state.continued) return;
  if (busy) { pending = direction; return; }
  const result = move(state.board,direction);
  if (!result.changed) { feedback('blocked'); if (settings.effects) { $('#board').classList.remove('blocked'); void $('#board').offsetWidth; $('#board').classList.add('blocked'); } return; }
  state.undo = { board:[...state.board], score:state.score, turns:state.turns, elapsed:state.elapsed, won:state.won, continued:state.continued };
  busy=true;
  combo = result.merges.length ? combo + 1 : 0;
  stats.totalMerges += result.merges.length; stats.bestCombo = Math.max(stats.bestCombo,combo);
  const highest = Math.max(0,...result.merges.map(m=>m.value));
  feedback(result.merges.length ? 'merge' : 'move',highest);
  if (settings.effects) $('#tile-layer').innerHTML = result.movements.map(m=>`<div class="tile tile-${Math.min(m.value,4096)} moving" style="--x:${m.from%4};--y:${Math.floor(m.from/4)}"><span class="tile-tick"></span><span class="tile-number">${m.value}</span><span class="tile-code mono">CORE / ${String(Math.log2(m.value)).padStart(2,'0')}</span></div>`).join('');
  if (settings.effects) { void $('#tile-layer').offsetWidth; [...$('#tile-layer').children].forEach((el,i)=>{ el.style.setProperty('--x',result.movements[i].to%4); el.style.setProperty('--y',Math.floor(result.movements[i].to/4)); }); }
  const spawned = addTile(result.board); state.board = spawned.board; state.score += result.score; state.turns++;
  stats.best = Math.max(stats.best,state.score); stats.bestTile = Math.max(stats.bestTile,...state.board);
  if (state.board.some(v => v >= 2048)) state.won=true;
  renderMeta(); save();
  setTimeout(()=>{
    renderBoard(result.merges.map(m=>m.index),spawned.index); particles(result.merges);
    if(result.score) { $('#score-add').textContent=`+${result.score}`; $('#score-add').classList.remove('score-rise'); void $('#score-add').offsetWidth; $('#score-add').classList.add('score-rise'); }
    if(highest >= 128 && settings.effects) { $('.board-frame').classList.remove('impact'); void $('.board-frame').offsetWidth; $('.board-frame').classList.add('impact'); }
    busy=false; renderMeta();
    $('#announcement').textContent = result.score ? `合并获得${result.score}分，当前算力${state.score}，最高数字${Math.max(...state.board)}` : `已向${({left:'左',right:'右',up:'上',down:'下'})[direction]}移动`;
    if(state.won && !state.continued) outcomeTimer = setTimeout(()=>showOutcome('win'),400);
    else if(!canMove(state.board)) outcomeTimer = setTimeout(()=>showOutcome('over'),350);
    else if(pending) { const dir=pending; pending=null; handleMove(dir); }
  },settings.effects ? 115 : 0);
}
function openDialog(label, content) { delete $('#dialog').dataset.outcome; $('#dialog-label').textContent=label; $('#dialog-content').innerHTML=content; if (!$('#dialog').open) $('#dialog').showModal(); }
function closeDialog() { $('#dialog').close(); $('#board').focus({preventScroll:true}); }
function restart() { clearTimeout(outcomeTimer); pending=null; combo=0; stats.games++; state={...initial,board:newBoard(),undo:null}; closeDialog(); renderBoard(); renderMeta(); save(); toast('新核心已就绪'); }
function showOutcome(kind) {
  if (busy) return;
  pending = null;
  if(kind==='win') feedback('win',2048);
  openDialog(kind==='win'?'MISSION COMPLETE':'SESSION COMPLETE',`<div class="outcome-symbol">${kind==='win'?'✳':'↗'}</div><div class="eyebrow mono">${kind==='win'?'CORE UNLOCKED / 2048':'EVERY END IS A NEW START'}</div><h2>${kind==='win'?'核心突破！':'本次运行结束'}</h2><p>${kind==='win'?'你已合成 2048。继续探索更高能量。':'每一步都让你更接近下一次突破。'}</p><div class="result-score mono">${state.score.toLocaleString()}<small>本次算力</small></div><div class="dialog-actions">${kind==='win'?'<button class="action-primary" data-action="continue">继续合成 →</button>':`<button class="action-secondary" data-action="undo" ${!state.undo?'disabled':''}>撤销最后一步</button>`}<button class="${kind==='win'?'action-secondary':'action-primary'}" data-action="new">开启新运行 →</button></div>`);
  $('#dialog').dataset.outcome = kind;
}
function showStats() {
  const achievements = [[128,'初次点亮'],[512,'能量涌动'],[1024,'接近临界'],[2048,'核心突破']];
  openDialog('SESSION ARCHIVE / 运行记录',`<div class="eyebrow mono">YOUR SYNTHESIS JOURNEY</div><h2>每一次进化，都算数。</h2><p>你的记录保存在本机，随时继续下一次突破。</p><div class="stat-grid">${[[stats.best,'历史最高算力'],[stats.bestTile,'最高合成核心'],[stats.totalMerges,'累计合并次数'],[stats.bestCombo,'最长合并连击']].map(([v,l])=>`<div><strong class="mono">${v.toLocaleString()}</strong><span>${l}</span></div>`).join('')}</div><div class="section-heading"><span class="mono">MILESTONES / 里程碑</span></div><div class="achievement-grid">${achievements.map(([v,l])=>`<div class="achievement ${stats.bestTile>=v?'unlocked':''}"><span class="mono">${v}</span><strong>${l}</strong><small>${stats.bestTile>=v?'已解锁':'等待突破'}</small></div>`).join('')}</div><button class="action-primary full-width" data-action="close">继续我的运行 ${icon('arrow')}</button>`);
}
function showGuide() {
  openDialog('OPERATOR MANUAL / 操作指南',`<div class="eyebrow mono">A SMALL GRID. ENDLESS POSSIBILITIES.</div><h2>从 2 开始，<br>向 2048 进化。</h2><div class="merge-demo"><span>2</span><b>+</b><span>2</span><b>→</b><span class="demo-result">4</span></div><ol class="instructions"><li><strong>滑动整个棋盘</strong><p>上下左右滑动，所有数字一起移动。也可点击方向按钮，或使用方向键 / WASD。</p></li><li><strong>让相同数字相遇</strong><p>两个相同数字合成一个双倍数字。每个核心在同一步中只合并一次；有效移动后生成一个新数字。</p></li><li><strong>为下一步留出空间</strong><p>连续有效移动都发生合并时会触发连击。合成 2048 达成目标；棋盘填满且无法合并时，本次运行结束。</p></li></ol><div class="guide-note">小提示：把最大数字留在角落，往往能走得更远。撤销可回到上一有效步；重新开始会清空当前棋盘。</div><button class="action-primary full-width" data-action="close">开始合成 ${icon('arrow')}</button>`);
}
function showSettings() {
  openDialog('TERMINAL SETTINGS / 终端设置',`<div class="eyebrow mono">MAKE IT FEEL LIKE YOU</div><h2>找到你的手感。</h2><p>让声音、触感和动效配合你的节奏。</p><div class="setting-list">${[['sound','碰撞音效','合并时的电子脉冲与低频碰撞'],['haptics','触感反馈','轻触与高能合并的分级震动'],['effects','动态效果','数字弹跳、粒子与镜头冲击']].map(([k,title,desc])=>`<label class="setting-row"><span><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" data-setting="${k}" ${settings[k]?'checked':''}><span class="toggle"></span></label>`).join('')}<label class="volume-row"><span>音效音量 <strong class="mono" id="volume-label">${settings.volume}%</strong></span><input aria-label="音效音量" type="range" min="0" max="100" value="${settings.volume}" id="volume-input"></label></div><button class="action-secondary full-width" data-action="test">${icon('sound')}体验一次合并反馈</button><div class="settings-note">触感效果取决于设备支持；${nativePlatform ? nativePlatform + '安装版使用原生震动' : '浏览器触感取决于设备支持'}。声音会在首次触摸后启用。</div><button class="record-link" data-action="install"><span>${nativePlatform ? '已安装到本机' : '添加到主屏幕'}</span>${icon('arrow')}</button>`);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action], [data-direction]'); if (!button || button.disabled) return;
  if(button.dataset.direction) return handleMove(button.dataset.direction);
  tap();
  switch(button.dataset.action) {
    case 'home': closeDialog(); window.scrollTo({top:0,behavior:settings.effects?'smooth':'instant'}); break;
    case 'sound': settings.sound=!settings.sound; renderMeta(); save(); toast(settings.sound?'音效已开启':'音效已关闭'); break;
    case 'stats': showStats(); break;
    case 'guide': showGuide(); break;
    case 'settings': showSettings(); break;
    case 'close': closeDialog(); break;
    case 'undo': if(state.undo && !busy) { clearTimeout(outcomeTimer); const previous=state.undo; state={...previous,undo:null}; combo=0; pending=null; closeDialog(); renderBoard(); renderMeta(); save(); toast('已回到上一有效步'); } break;
    case 'restart': openDialog('REINITIALIZE / 重启核心',`<h2>开启新的运行？</h2><p>当前棋盘将重置，历史峰值和里程碑会保留。</p><div class="dialog-actions"><button class="action-secondary" data-action="close">继续本局</button><button class="action-primary" data-action="new">重新开始 →</button></div>`); break;
    case 'new': restart(); break;
    case 'continue': state.continued=true; save(); closeDialog(); if(!canMove(state.board)) showOutcome('over'); break;
    case 'test': feedback('merge',128); toast('128 / 高能核心合成'); break;
    case 'install': if(nativePlatform) toast(`你正在使用${nativePlatform}安装版`); else if(installPrompt) installPrompt.prompt(); else toast('浏览器菜单 → 添加到主屏幕（需 HTTPS）'); break;
  }
});
document.addEventListener('change',event=>{ const key=event.target.dataset.setting; if (!key) return; settings[key]=event.target.checked; tap(); renderMeta(); renderBoard(); save(); });
document.addEventListener('input',event=>{ if(event.target.id==='volume-input') { settings.volume=Number(event.target.value); $('#volume-label').textContent=`${settings.volume}%`; save(); } });
$('#dialog').addEventListener('click',event=>{ if(event.target===$('#dialog')) { const rect=$('#dialog').getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) closeDialog(); } });
$('#dialog').addEventListener('cancel',()=>$('#board').focus({preventScroll:true}));
$('#dialog').addEventListener('close',()=>{
  // Back/Escape also continues a won game, avoiding an invisible input lock.
  if ($('#dialog').dataset.outcome === 'win' && state.won && !state.continued) {
    state.continued = true; save();
    if (!canMove(state.board)) outcomeTimer = setTimeout(()=>showOutcome('over'),100);
  }
  delete $('#dialog').dataset.outcome;
});
const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
document.addEventListener('keydown',event=>{ if(event.ctrlKey||event.altKey||event.metaKey||event.target.matches('input,textarea')||$('#dialog').open) return; const dir=directions[event.key]||directions[event.key.toLowerCase()]; if(dir) { event.preventDefault(); handleMove(dir); } });
let pointer=null;
$('#board').addEventListener('pointerdown',event=>{ if(!event.isPrimary) return; unlockAudio(); pointer={x:event.clientX,y:event.clientY,id:event.pointerId}; $('#board').setPointerCapture(event.pointerId); });
$('#board').addEventListener('pointerup',event=>{ if(!pointer||pointer.id!==event.pointerId) return; const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y; pointer=null; if(Math.max(Math.abs(dx),Math.abs(dy))<22) return; handleMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'); });
$('#board').addEventListener('pointercancel',()=>pointer=null);
function pauseSession() { nativeActive=false; pending=null; pointer=null; save(); suspendAudio(); }
function resumeSession() { nativeActive=true; }
setInterval(()=>{ if(nativeActive && !document.hidden && !$('#dialog').open && canMove(state.board) && (!state.won || state.continued)) { state.elapsed++; renderMeta(); if(state.elapsed%5===0) save(); } },1000);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) pauseSession(); else resumeSession(); });
document.addEventListener('core:pause',pauseSession);
document.addEventListener('core:resume',resumeSession);
document.addEventListener('core:back',()=>{ if($('#dialog').open) closeDialog(); });
window.addEventListener('pagehide',pauseSession);
window.addEventListener('pageshow',resumeSession);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
if(!window.CoreNative && 'serviceWorker' in navigator && ['http:','https:'].includes(location.protocol) && !import.meta.env.DEV) navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderBoard(); renderMeta();
if(!canMove(state.board)) outcomeTimer=setTimeout(()=>showOutcome('over'),500);
else if(state.won&&!state.continued) outcomeTimer=setTimeout(()=>showOutcome('win'),500);
