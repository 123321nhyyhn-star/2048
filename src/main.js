import './style.css';
import { addTile, newBoard, move, canMove } from './engine.js';
import { sound, haptic, unlockAudio, suspendAudio } from './feedback.js';
import { readSave, writeSave } from './storage.js';
const nativePlatform = window.CoreNative ? (window.CoreNative.getPlatform?.() || '鸿蒙') : null;

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  settings:'<path d="M12 8v8M8 12h8"/><circle cx="12" cy="12" r="9"/>',
  sound:'<path d="m11 4-5 4H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  reset:'<path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3v.1"/>',
  chart:'<path d="M4 20V10m8 10V4m8 16v-7"/>',
  trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-4 1h8"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${icons[name]}</svg>`;
const tileCode = value => `<span class="tile-code mono" aria-hidden="true">CORE / ${String(Math.log2(value)).padStart(2,'0')}</span>`;
const $ = selector => document.querySelector(selector);
let storageFailed = false;
const saved = readSave();
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
const initial = { board: newBoard(), score: 0, turns: 0, elapsed: 0, won: false, continued: false };
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
    <a class="wordmark" href="#" aria-label="核芯首页"><span class="brand-symbol">${icon('grid')}</span><span>CORE<span class="brand-dot">.</span></span></a>
    <nav aria-label="导航"><button class="nav-item active" data-action="home">${icon('grid')}<span>合成</span></button><button class="nav-item" data-action="stats">${icon('chart')}<span>记录</span></button><button class="nav-item" data-action="guide">${icon('help')}<span>指南</span></button><button class="nav-item" data-action="settings">${icon('settings')}<span>设置</span></button></nav>
  </aside>
  <div class="workspace">
    <main>
      <section class="game-panel" aria-label="2048 游戏">
        <h1 class="game-title"><span class="huge-number">2048<span class="number-period">.</span></span></h1>
        <div class="score-row"><div class="score-box"><span class="score-label">分数</span><div class="score-value mono" id="score">0</div><span class="score-add mono" id="score-add"></span></div><div class="score-box best-box"><span class="score-label">最高分</span><div class="score-value mono" id="best">0</div>${icon('trophy','score-trophy')}</div></div>
        <div class="board-frame"><div id="board" class="board" role="grid" aria-label="4乘4棋盘，滑动或按方向键合并数字" tabindex="0"><div class="cell-layer">${Array.from({length:16}, (_, i)=>`<div class="cell" style="--x:${i%4};--y:${Math.floor(i/4)}"><span class="cell-cross">+</span></div>`).join('')}</div><div id="tile-layer"></div><div id="particles" aria-hidden="true"></div><div class="board-shine" aria-hidden="true"></div></div><span class="frame-corner tl"></span><span class="frame-corner tr"></span><span class="frame-corner bl"></span><span class="frame-corner br"></span></div>
        <div class="game-actions"><button class="action-primary" data-action="restart">${icon('reset')}<span>重新开始</span>${icon('arrow')}</button></div>
      </section>
    </main>
    <nav class="mobile-nav" aria-label="导航"><button data-action="home" class="selected">${icon('grid')}<span>合成</span></button><button data-action="stats">${icon('chart')}<span>记录</span></button><button data-action="guide">${icon('help')}<span>指南</span></button><button data-action="settings">${icon('settings')}<span>设置</span></button></nav>
  </div>
  <dialog id="dialog"><div class="dialog-top"><span class="mono" id="dialog-label">CORE SYSTEM</span><button class="icon-button" data-action="close" aria-label="关闭窗口">${icon('close')}</button></div><div id="dialog-content"></div></dialog>
  <div id="toast" role="status"></div><div class="sr-only" id="announcement" aria-live="polite"></div>
`;

function renderBoard(merged = [], spawn = -1) {
  $('#tile-layer').innerHTML = state.board.map((v, i) => v ? `<div class="tile tile-${Math.min(v, 4096)} ${merged.includes(i) && settings.effects ? 'merged' : ''} ${spawn === i && settings.effects ? 'spawn' : ''}" style="--x:${i%4};--y:${Math.floor(i/4)}" role="gridcell" aria-label="第${Math.floor(i/4)+1}行第${i%4+1}列，${v}"><span class="tile-tick"></span><span class="tile-number">${v}</span>${tileCode(v)}${v >= 128 ? '<span class="tile-corner">↗</span>' : ''}</div>` : '').join('');
  document.body.classList.toggle('reduced-motion', !settings.effects);
}
function renderMeta() {
  $('#score').textContent = state.score.toLocaleString(); $('#best').textContent = stats.best.toLocaleString();
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
  busy=true;
  combo = result.merges.length ? combo + 1 : 0;
  stats.totalMerges += result.merges.length; stats.bestCombo = Math.max(stats.bestCombo,combo);
  const highest = Math.max(0,...result.merges.map(m=>m.value));
  feedback(result.merges.length ? 'merge' : 'move',highest);
  if (settings.effects) $('#tile-layer').innerHTML = result.movements.map(m=>`<div class="tile tile-${Math.min(m.value,4096)} moving" style="--x:${m.from%4};--y:${Math.floor(m.from/4)}"><span class="tile-tick"></span><span class="tile-number">${m.value}</span>${tileCode(m.value)}</div>`).join('');
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
    $('#announcement').textContent = result.score ? `合并获得${result.score}分，当前分数${state.score}，最高数字${Math.max(...state.board)}` : `已向${({left:'左',right:'右',up:'上',down:'下'})[direction]}移动`;
    if(state.won && !state.continued) outcomeTimer = setTimeout(()=>showOutcome('win'),400);
    else if(!canMove(state.board)) outcomeTimer = setTimeout(()=>showOutcome('over'),350);
    else if(pending) { const dir=pending; pending=null; handleMove(dir); }
  },settings.effects ? 115 : 0);
}
function openDialog(label, content) { delete $('#dialog').dataset.outcome; $('#dialog-label').textContent=label; $('#dialog-content').innerHTML=content; if (!$('#dialog').open) $('#dialog').showModal(); }
function closeDialog() { $('#dialog').close(); $('#board').focus({preventScroll:true}); }
function restart() { clearTimeout(outcomeTimer); pending=null; combo=0; stats.games++; state={...initial,board:newBoard()}; closeDialog(); renderBoard(); renderMeta(); save(); toast('新核心已就绪'); }
function showOutcome(kind) {
  if (busy) return;
  pending = null;
  if(kind==='win') feedback('win',2048);
  openDialog(kind==='win'?'MISSION COMPLETE':'SESSION COMPLETE',`<div class="outcome-symbol">${kind==='win'?'✳':'↗'}</div><div class="eyebrow mono">${kind==='win'?'CORE UNLOCKED / 2048':'EVERY END IS A NEW START'}</div><h2>${kind==='win'?'核心突破！':'本次运行结束'}</h2><p>${kind==='win'?'你已合成 2048。继续探索更高能量。':'每一步都让你更接近下一次突破。'}</p><div class="result-score mono">${state.score.toLocaleString()}<small>本次分数</small></div><div class="dialog-actions">${kind==='win'?'<button class="action-primary" data-action="continue">继续合成 →</button>':''}<button class="${kind==='win'?'action-secondary':'action-primary'}" data-action="new">开启新运行 →</button></div>`);
  $('#dialog').dataset.outcome = kind;
}
function showStats() {
  const achievements = [[128,'初次点亮'],[512,'能量涌动'],[1024,'接近临界'],[2048,'核心突破']];
  openDialog('SESSION ARCHIVE / 运行记录',`<div class="eyebrow mono">YOUR SYNTHESIS JOURNEY</div><h2>每一次进化，都算数。</h2><p>你的记录保存在本机，随时继续下一次突破。</p><div class="stat-grid">${[[stats.best,'历史最高分'],[stats.bestTile,'最高合成核心'],[stats.totalMerges,'累计合并次数'],[stats.bestCombo,'最长合并连击']].map(([v,l])=>`<div><strong class="mono">${v.toLocaleString()}</strong><span>${l}</span></div>`).join('')}</div><div class="section-heading"><span class="mono">MILESTONES / 里程碑</span></div><div class="achievement-grid">${achievements.map(([v,l])=>`<div class="achievement ${stats.bestTile>=v?'unlocked':''}"><span class="mono">${v}</span><strong>${l}</strong><small>${stats.bestTile>=v?'已解锁':'等待突破'}</small></div>`).join('')}</div><button class="action-primary full-width" data-action="close">继续我的运行 ${icon('arrow')}</button>`);
}
function showGuide() {
  openDialog('OPERATOR MANUAL / 操作指南',`<div class="eyebrow mono">A SMALL GRID. ENDLESS POSSIBILITIES.</div><h2>从 2 开始，<br>向 2048 进化。</h2><div class="merge-demo"><span>2</span><b>+</b><span>2</span><b>→</b><span class="demo-result">4</span></div><ol class="instructions"><li><strong>滑动整个棋盘</strong><p>上下左右滑动，所有数字一起移动。也可使用方向键 / WASD。</p></li><li><strong>让相同数字相遇</strong><p>两个相同数字合成一个双倍数字。每个核心在同一步中只合并一次；有效移动后生成一个新数字。</p></li><li><strong>为下一步留出空间</strong><p>连续有效移动都发生合并时会触发连击。合成 2048 达成目标；棋盘填满且无法合并时，本次运行结束。</p></li></ol><div class="guide-note">小提示：把最大数字留在角落，往往能走得更远。重新开始会清空当前棋盘。</div><button class="action-primary full-width" data-action="close">开始合成 ${icon('arrow')}</button>`);
}
function showSettings() {
  openDialog('TERMINAL SETTINGS / 终端设置',`<div class="eyebrow mono">MAKE IT FEEL LIKE YOU</div><h2>找到你的手感。</h2><p>让声音、触感和动效配合你的节奏。</p><div class="setting-list">${[['sound','碰撞音效','合并时的电子脉冲与低频碰撞'],['haptics','触感反馈','轻触与高能合并的分级震动'],['effects','动态效果','数字弹跳、粒子与镜头冲击']].map(([k,title,desc])=>`<label class="setting-row"><span><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" data-setting="${k}" ${settings[k]?'checked':''}><span class="toggle"></span></label>`).join('')}<label class="volume-row"><span>音效音量 <strong class="mono" id="volume-label">${settings.volume}%</strong></span><input aria-label="音效音量" type="range" min="0" max="100" value="${settings.volume}" id="volume-input"></label></div><button class="action-secondary full-width" data-action="test">${icon('sound')}体验一次合并反馈</button><div class="settings-note">触感效果取决于设备支持；${nativePlatform ? nativePlatform + '安装版使用原生震动' : '浏览器触感取决于设备支持'}。声音会在首次触摸后启用。</div><button class="record-link" data-action="install"><span>${nativePlatform ? '已安装到本机' : '添加到主屏幕'}</span>${icon('arrow')}</button>`);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action], [data-direction]'); if (!button || button.disabled) return;
  if(button.dataset.direction) return handleMove(button.dataset.direction);
  tap();
  switch(button.dataset.action) {
    case 'home': closeDialog(); break;
    case 'stats': showStats(); break;
    case 'guide': showGuide(); break;
    case 'settings': showSettings(); break;
    case 'close': closeDialog(); break;
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
  if ($('#dialog').dataset.outcome === 'win' && state.won && !state.continued) {
    state.continued = true; save();
    if (!canMove(state.board)) outcomeTimer = setTimeout(()=>showOutcome('over'),100);
  }
  delete $('#dialog').dataset.outcome;
});
const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
document.addEventListener('keydown',event=>{ if(event.ctrlKey||event.altKey||event.metaKey||event.target.matches('input,textarea')||$('#dialog').open) return; const dir=directions[event.key]||directions[event.key.toLowerCase()]; if(dir) { event.preventDefault(); handleMove(dir); } });
let pointer=null;
$('#board').addEventListener('pointerdown',event=>{ if(!event.isPrimary || event.button !== 0 || !nativeActive || document.hidden || $('#dialog').open) return; event.preventDefault(); unlockAudio(); pointer={x:event.clientX,y:event.clientY,id:event.pointerId}; $('#board').setPointerCapture(event.pointerId); });
$('#board').addEventListener('pointermove',event=>{ if(pointer?.id===event.pointerId) event.preventDefault(); });
$('#board').addEventListener('pointerup',event=>{ if(!pointer||pointer.id!==event.pointerId) return; const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y; pointer=null; if(Math.max(Math.abs(dx),Math.abs(dy))<22) return; handleMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'); });
$('#board').addEventListener('pointercancel',()=>pointer=null);
$('#board').addEventListener('lostpointercapture',()=>pointer=null);
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
