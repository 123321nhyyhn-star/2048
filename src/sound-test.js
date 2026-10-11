import { sound, mergeSound, soundFrequencies, unlockAudio, suspendAudio } from './feedback.js';

const $ = selector => document.querySelector(selector);
const sounds = [
  { kind: 'tap', title: '点击', glyph: '⌁', tag: 'TAP / 45 ms', trigger: '点击游戏操作按钮，或切换音效、触感、动效设置时触发。', example: '例如：打开设置、查看记录、重新开始、确认新局、继续合成。', value: 4, duration: 100 },
  { kind: 'move', title: '移动', glyph: '↗', tag: 'MOVE / 75 ms', trigger: '向某个方向移动，棋盘发生变化，但这一步没有任何数字合并。', example: '例如：一个 2 从中间滑到左边，途中没有碰到另一个 2。', value: 4, duration: 130 },
  { kind: 'blocked', title: '受阻', glyph: '⊣', tag: 'BLOCKED / 70 ms', trigger: '游戏仍能继续，但向当前方向操作时，棋盘没有发生变化。', example: '例如：数字已靠左且不能合并，再向左滑动。已结束的死局不会触发。', value: 4, duration: 130 },
  { kind: 'merge', title: '合并', glyph: '✳', tag: 'MERGE / UP TO 390 ms', trigger: '一次有效移动中发生至少一组合并。音高由本步最大的合并结果与连续合并次数决定。', example: '例如：2 + 2 → 4。若同时合成 4 和 128，只播放一次 128 的合并音。', value: 128, duration: 440 },
  { kind: 'win', title: '胜利', glyph: '♬', tag: 'WIN / 4 NOTES', trigger: '棋盘首次出现 2048 或更大数字，随后显示胜利窗口时触发。', example: '先听到合并音，再听到四个上升音符。选择「继续合成」后不再触发；恢复尚未确认胜利的存档也会尝试播放。', value: 2048, duration: 880 }
];
let sequenceToken = 0;
let running = false;
let logCount = 0;
let statusToken = 0;
let audioUnavailable = false;
const activeCards = new Map();
const volume = () => Number($('#volume').value) / 100;
const combo = () => Number($('#combo').value);
const mergeValue = () => Number($('#merge-value').value) || 128;
const frequencyStorageKey = 'core2048.sound-lab.frequencies.v1';
const frequencyFields = {
  merge: [['impactStart', '低频冲击 · 起始'], ['impactEnd', '低频冲击 · 结束'], ['riseStart', '上滑主音 · 起始'], ['riseEnd', '上滑主音 · 结束'], ['shimmer', '高音尾音'], ['echo', '延迟泛音 · 64 起加入'], ['noiseCutoff', '高频噪声 · 截止']],
  tap: [['tapStart', '点击音 · 起始'], ['tapEnd', '点击音 · 结束']],
  move: [['moveStart', '移动音 · 起始'], ['moveEnd', '移动音 · 结束']],
  blocked: [['blockedStart', '受阻音 · 起始'], ['blockedEnd', '受阻音 · 结束']],
  win: [['win1', '胜利旋律 · 第 1 音'], ['win2', '胜利旋律 · 第 2 音'], ['win3', '胜利旋律 · 第 3 音'], ['win4', '胜利旋律 · 第 4 音']]
};
let frequencyOverrides = {};
let autoFrequencyTimer;
function validatedFrequencyOverrides(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const sanitized = soundFrequencies(mergeValue(), combo(), value);
  for (const key of Object.keys(sanitized)) if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = sanitized[key];
  return result;
}
try {
  const savedFrequencies = JSON.parse(localStorage.getItem(frequencyStorageKey));
  if (savedFrequencies?.version === 1) {
    frequencyOverrides = validatedFrequencyOverrides(savedFrequencies.frequencies);
    $('#frequency-save-status').textContent = '已载入上次保存的调音设置。';
  }
} catch { $('#frequency-save-status').textContent = '暂时无法读取已保存设置；你仍可以调音和复制参数。'; }
const mergeParts = [
  { id: 'impact', name: '低频冲击', delay: 0, duration: 170, description: '短促下坠的“咚”，提供碰撞重量。', wave: '正弦波' },
  { id: 'noise', name: '高频噪声', delay: 0, duration: 60, description: '很短的“咔／沙”，让碰撞开头更清脆。', wave: '随机噪声 · 高通滤波' },
  { id: 'rise', name: '上滑主音', delay: 0, duration: 130, description: '向上滑动的“啾”，是合并音的电子感主体。', wave: '三角波' },
  { id: 'shimmer', name: '高音尾音', delay: 20, duration: 200, description: '高八度的“叮”，在主音之后稍晚进入。', wave: '正弦波' },
  { id: 'echo', name: '延迟泛音', delay: 70, duration: 300, description: '最后进入的音程层，增加余韵；合并结果达到 64 才加入。', wave: '正弦波 · 64 起加入' }
];

$('#sound-cards').innerHTML = sounds.map((item, index) => `<article class="sound-card" data-kind="${item.kind}"><div class="card-top"><span class="card-code">0${index + 1} / EVENT</span><span class="sound-glyph" aria-hidden="true">${item.glyph}</span></div><h3>${item.title}</h3><span class="sound-tag">${item.tag}</span><p class="card-trigger">${item.trigger}</p><p class="card-example">${item.example}</p><button class="listen-button" data-play="${item.kind}" aria-label="试听${item.title}音效"><span>▶ 试听${item.title}音</span><span aria-hidden="true">↗</span></button></article>`).join('');
$('#merge-value').innerHTML = Array.from({ length: 13 }, (_, i) => 2 ** (i + 2)).map(value => `<option value="${value}" ${value === 128 ? 'selected' : ''}>${value}</option>`).join('');
$('#layer-rows').innerHTML = mergeParts.map((part, index) => `<article class="layer-row" data-layer-row="${part.id}"><div class="layer-info"><label><input type="checkbox" data-layer="${part.id}" checked><strong>${index + 1}. ${part.name}</strong></label><p>${part.description}</p><small>${part.wave} · <span data-frequency="${part.id}"></span></small></div><div class="layer-timing"><div class="layer-track" aria-hidden="true"><i style="--start:${part.delay / 4}%;--length:${part.duration / 4}%"></i></div><span>${part.delay} ms 开始 · ${part.duration} ms ${part.id === 'noise' ? '缓冲' : '衰减'}</span></div><button class="quiet-button" data-solo="${part.id}">▶ 独奏${part.name}</button></article>`).join('');

function addLog(message) {
  if (!logCount) $('#history').replaceChildren();
  const row = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const content = document.createElement('span');
  content.textContent = message;
  row.append(time, content);
  $('#history').prepend(row);
  logCount++;
  if ($('#history').children.length > 12) $('#history').lastElementChild.remove();
}

async function prepareAudio() {
  if (!(window.AudioContext || window.webkitAudioContext)) {
    audioUnavailable = true;
    $('#audio-status').textContent = '当前浏览器不支持 Web Audio，请换浏览器试听';
    return false;
  }
  unlockAudio();
  // resume() is asynchronous on the first gesture; allow it to finish before playing.
  await new Promise(resolve => setTimeout(resolve, 40));
  $('#audio-dot').classList.add('ready');
  return true;
}

function setStatus(text, duration = 950) {
  const token = ++statusToken;
  $('#audio-status').textContent = text;
  setTimeout(() => {
    if (token === statusToken && !running && !audioUnavailable) $('#audio-status').textContent = volume() ? '声音已启用 · 选择一个音效试听' : '音量为 0 · 当前试听静音';
  }, duration);
}

function play(kind, value = 4, chain = 1, original = false) {
  const item = sounds.find(item => item.kind === kind);
  sound(kind, value, chain, volume(), original ? {} : frequencyOverrides);
  const detail = kind === 'merge' ? ` · ${value / 2} + ${value / 2} → ${value} · ${chain} 连击` : '';
  const muted = volume() === 0 ? '（音量为 0，未发声）' : '';
  const custom = frequencyFields[kind].some(([key]) => key in frequencyOverrides);
  addLog(`${item.title}音${detail} · ${!original && custom ? '自定义频率' : '原始频率'} · 音量 ${Math.round(volume() * 100)}%${muted}`);
  setStatus(`${volume() ? '正在试听' : '静音试听'}：${item.title}${kind === 'merge' ? ` / ${value}` : ''}`, item.duration);
  const card = $(`[data-kind="${kind}"]`);
  clearTimeout(activeCards.get(kind));
  card.classList.add('playing');
  activeCards.set(kind, setTimeout(() => card.classList.remove('playing'), item.duration));
  if (kind === 'merge') {
    $('.merge-equation').classList.remove('burst');
    void $('.merge-equation').offsetWidth;
    $('.merge-equation').classList.add('burst');
  }
}

function stopSequence() {
  clearTimeout(autoFrequencyTimer);
  sequenceToken++;
  running = false;
  $('#sequence').disabled = false;
  $('#stop').disabled = true;
}

async function audition(kind, value = 4, chain = 1, original = false) {
  stopSequence();
  const token = sequenceToken;
  if (await prepareAudio() && token === sequenceToken && !document.hidden) play(kind, value, chain, original);
}

document.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.play;
  audition(kind, kind === 'merge' ? mergeValue() : sounds.find(item => item.kind === kind).value, kind === 'merge' ? combo() : 1);
}));
$('#play-merge').addEventListener('click', () => audition('merge', mergeValue(), combo()));
$('#play-settings').addEventListener('click', async () => {
  stopSequence();
  const token = sequenceToken;
  if (!await prepareAudio() || token !== sequenceToken || document.hidden) return;
  play('tap');
  play('merge', 128, combo());
  addLog('设置体验：点击音 + 128 合并音，复现同一次按钮操作。');
});
$('#sequence').addEventListener('click', async () => {
  stopSequence();
  const token = sequenceToken;
  running = true;
  $('#sequence').disabled = true;
  $('#stop').disabled = false;
  if (!await prepareAudio()) { stopSequence(); return; }
  for (const item of sounds) {
    if (token !== sequenceToken || document.hidden) return;
    play(item.kind, item.kind === 'merge' ? mergeValue() : item.value, item.kind === 'merge' ? combo() : 1);
    await new Promise(resolve => setTimeout(resolve, 1150));
  }
  if (token === sequenceToken) {
    stopSequence();
    setStatus('五种音效已全部试听');
  }
});
$('#stop').addEventListener('click', () => { stopSequence(); suspendAudio(); setStatus('试听已停止'); });
async function auditionLayers(ids, label) {
  stopSequence();
  const token = sequenceToken;
  if (!await prepareAudio() || token !== sequenceToken || document.hidden) return;
  mergeSound(mergeValue(), combo(), volume(), ids, frequencyOverrides);
  addLog(`拆解试听：${label} · 合并 ${mergeValue()} · ${combo()} 连击 · 音量 ${Math.round(volume() * 100)}%${volume() ? '' : '（静音）'}`);
  setStatus(`拆解试听：${label}`, 440);
  ids.forEach(id => {
    const row = $(`[data-layer-row="${id}"]`);
    clearTimeout(activeCards.get(id));
    row.classList.add('playing');
    activeCards.set(id, setTimeout(() => row.classList.remove('playing'), 440));
  });
}
document.querySelectorAll('[data-solo]').forEach(button => button.addEventListener('click', () => {
  const part = mergeParts.find(part => part.id === button.dataset.solo);
  auditionLayers([part.id], part.name);
}));
$('#play-impact-group').addEventListener('click', () => auditionLayers(['impact', 'noise'], '碰撞组：低频冲击 + 高频噪声'));
$('#play-tone-group').addEventListener('click', () => auditionLayers(mergeValue() >= 64 ? ['rise', 'shimmer', 'echo'] : ['rise', 'shimmer'], '音调组：上滑主音 + 高音尾音' + (mergeValue() >= 64 ? ' + 延迟泛音' : '')));
$('#play-layer-mix').addEventListener('click', () => {
  const ids = selectedLayers();
  if (ids.length) auditionLayers(ids, ids.map(id => mergeParts.find(part => part.id === id).name).join(' + '));
});
$('#play-full-merge').textContent = '▶ 对比游戏原声';
$('#play-full-merge').addEventListener('click', () => audition('merge', mergeValue(), combo(), true));
function selectedLayers() {
  return [...document.querySelectorAll('[data-layer]:checked')].filter(input => !input.disabled).map(input => input.dataset.layer);
}
function updateLayerMix() {
  $('#play-layer-mix').disabled = selectedLayers().length === 0;
  $('#layer-mix-status').textContent = selectedLayers().length ? `保留 ${selectedLayers().length} 个声部，使用上方的数字、连击和音量。` : '请至少勾选一个声部。';
}
document.querySelectorAll('[data-layer]').forEach(input => input.addEventListener('change', updateLayerMix));
function updateMerge() {
  $('#operand-a').textContent = $('#operand-b').textContent = mergeValue() / 2;
  $('#result-value').textContent = mergeValue();
  $('#combo-label').textContent = combo();
  $('#merge-detail').textContent = `${mergeValue()}：${mergeValue() >= 64 ? '加入延迟泛音，听感更丰富。' : '低频冲击、电子音调与短促噪声叠加。'}`;
  const f = soundFrequencies(mergeValue(), combo(), frequencyOverrides);
  const frequencies = { impact: `${f.impactStart} → ${f.impactEnd} Hz`, noise: `${f.noiseCutoff} Hz 以下被削弱`, rise: `${f.riseStart} → ${f.riseEnd} Hz`, shimmer: `${f.shimmer} Hz`, echo: `${f.echo} Hz` };
  mergeParts.forEach(part => $(`[data-frequency="${part.id}"]`).textContent = frequencies[part.id]);
  $('[data-layer="echo"]').disabled = $('[data-solo="echo"]').disabled = mergeValue() < 64;
  $('[data-layer-row="echo"]').classList.toggle('inactive-layer', mergeValue() < 64);
  $('#layer-summary').textContent = `当前：合并 ${mergeValue()} / ${combo()} 连击 / ${mergeValue() >= 64 ? '5' : '4'} 个声部。各声部在约 0.4 秒内交叠，并非分成两个完整音效轮流播放。`;
  updateLayerMix();
  updateFrequencyControls();
}
function updateFrequencyControls() {
  const kind = $('#frequency-kind').value;
  const defaults = soundFrequencies(mergeValue(), combo());
  const actual = soundFrequencies(mergeValue(), combo(), frequencyOverrides);
  $('#frequency-context').textContent = kind === 'merge' ? `合并 ${mergeValue()} / ${combo()} 连击${mergeValue() < 64 ? ' · 延迟泛音未启用' : ''}` : sounds.find(item => item.kind === kind).title + (kind === 'win' ? '音 · 4 个音符依次进入' : '音 · 起始频率 → 结束频率');
  for (const [key] of frequencyFields[kind]) {
    const row = $(`[data-frequency-control="${key}"]`);
    if (!row) continue;
    const range = row.querySelector('input[type="range"]');
    const number = row.querySelector('input[type="number"]');
    range.value = actual[key];
    if (document.activeElement !== number) number.value = actual[key];
    row.querySelector('.frequency-default').textContent = `游戏原值 ${defaults[key]} Hz · ${key in frequencyOverrides ? '自定义' : '跟随原值'}`;
  }
  $('#frequency-json').value = JSON.stringify({ version: 1, frequencies: frequencyOverrides, reference: { mergeValue: mergeValue(), combo: combo() } }, null, 2);
}
function renderFrequencyControls() {
  const fields = frequencyFields[$('#frequency-kind').value];
  $('#frequency-controls').innerHTML = fields.map(([key, name]) => `<div class="frequency-row" data-frequency-control="${key}"><div><label for="hz-${key}">${name}</label><small class="frequency-default"></small></div><input type="range" min="20" max="${key === 'noiseCutoff' ? 16000 : 8000}" step="0.5" data-hz="${key}" aria-label="${name}频率滑块"><div class="frequency-number"><input id="hz-${key}" type="number" min="20" max="${key === 'noiseCutoff' ? 16000 : 8000}" step="0.5" data-hz="${key}" aria-label="${name}频率"><span>Hz</span></div><button class="text-button" data-reset-hz="${key}" aria-label="重置${name}频率">重置</button></div>`).join('');
  updateFrequencyControls();
}
function auditionFrequencyKind(original = false) {
  const kind = $('#frequency-kind').value;
  audition(kind, kind === 'merge' ? mergeValue() : sounds.find(item => item.kind === kind).value, kind === 'merge' ? combo() : 1, original);
}
function changedFrequencies() {
  updateMerge();
  $('#frequency-save-status').textContent = '当前调整尚未保存。点「保存设置」后，刷新也能保留。';
}
$('#frequency-kind').addEventListener('change', () => { clearTimeout(autoFrequencyTimer); renderFrequencyControls(); });
$('#frequency-controls').addEventListener('input', event => {
  const input = event.target;
  if (!input.dataset.hz) return;
  const value = Number(input.value), max = Number(input.max);
  if (input.value.trim() === '' || !Number.isFinite(value) || value < 20 || value > max) {
    clearTimeout(autoFrequencyTimer);
    input.setAttribute('aria-invalid', 'true');
    return;
  }
  input.removeAttribute('aria-invalid');
  frequencyOverrides[input.dataset.hz] = value;
  changedFrequencies();
  if ($('#frequency-auto').checked) {
    unlockAudio();
    clearTimeout(autoFrequencyTimer);
    autoFrequencyTimer = setTimeout(() => auditionFrequencyKind(), 180);
  }
});
function normalizeFrequencyInput(event) {
  const input = event.target;
  if (!input.isConnected || !input.dataset.hz) return;
  if (input.dataset.hz && (input.value.trim() === '' || Number(input.value) < 20 || Number(input.value) > Number(input.max) || !Number.isFinite(Number(input.value)))) {
    input.value = soundFrequencies(mergeValue(), combo(), frequencyOverrides)[input.dataset.hz];
    input.removeAttribute('aria-invalid');
    $('#frequency-save-status').textContent = `频率范围为 20–${input.max} Hz，已保留上一次有效值。`;
  }
}
$('#frequency-controls').addEventListener('change', normalizeFrequencyInput);
$('#frequency-controls').addEventListener('focusout', normalizeFrequencyInput);
$('#frequency-controls').addEventListener('click', event => {
  const key = event.target.closest('[data-reset-hz]')?.dataset.resetHz;
  if (key) { clearTimeout(autoFrequencyTimer); delete frequencyOverrides[key]; changedFrequencies(); }
});
$('#play-tuned').addEventListener('click', () => auditionFrequencyKind());
$('#play-original').addEventListener('click', () => auditionFrequencyKind(true));
$('#frequency-auto').addEventListener('change', () => { if (!$('#frequency-auto').checked) clearTimeout(autoFrequencyTimer); });
$('#reset-frequency-kind').addEventListener('click', () => {
  clearTimeout(autoFrequencyTimer);
  frequencyFields[$('#frequency-kind').value].forEach(([key]) => delete frequencyOverrides[key]);
  changedFrequencies();
});
$('#reset-frequencies').addEventListener('click', () => { clearTimeout(autoFrequencyTimer); frequencyOverrides = {}; changedFrequencies(); });
$('#save-frequencies').addEventListener('click', () => {
  try {
    localStorage.setItem(frequencyStorageKey, JSON.stringify({ version: 1, frequencies: frequencyOverrides }));
    $('#frequency-save-status').textContent = '设置已保存到当前浏览器，刷新页面会自动载入。';
  } catch { $('#frequency-save-status').textContent = '当前浏览器无法保存，请用「查看 / 复制参数」保留你的设置。'; }
});
$('#load-frequencies').addEventListener('click', () => {
  try {
    const savedFrequencies = JSON.parse(localStorage.getItem(frequencyStorageKey));
    if (savedFrequencies?.version !== 1) { $('#frequency-save-status').textContent = '还没有保存过设置。'; return; }
    clearTimeout(autoFrequencyTimer);
    frequencyOverrides = validatedFrequencyOverrides(savedFrequencies.frequencies);
    updateMerge();
    $('#frequency-save-status').textContent = '已恢复保存的设置。';
  } catch { $('#frequency-save-status').textContent = '暂时无法读取保存的设置。'; }
});
$('#export-frequencies').addEventListener('click', () => { updateFrequencyControls(); $('#frequency-export').hidden = !$('#frequency-export').hidden; });
$('#copy-frequencies').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#frequency-json').value); $('#frequency-save-status').textContent = '参数已复制，可以发给我继续调整。'; }
  catch { $('#frequency-json').select(); $('#frequency-save-status').textContent = '参数已选中，可按 Ctrl+C 或长按复制。'; }
});
$('#merge-value').addEventListener('change', updateMerge);
$('#combo').addEventListener('input', updateMerge);
$('#volume').addEventListener('input', () => {
  $('#volume-label').textContent = `${$('#volume').value}%`;
  if (volume() === 0) setStatus('音量为 0 · 当前试听静音');
});
$('#clear-log').addEventListener('click', () => { logCount = 0; $('#history').innerHTML = '<li class="empty-log">记录已清空，继续试听吧。</li>'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopSequence(); suspendAudio(); setStatus('已暂停 · 点击试听恢复'); } });
window.addEventListener('pagehide', () => { stopSequence(); suspendAudio(); });
renderFrequencyControls();
updateMerge();
