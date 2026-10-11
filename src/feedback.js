let context;
let noise;
export function unlockAudio() {
  try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; context ||= new Audio(); if (context.state === 'suspended') context.resume().catch(() => {}); } catch {}
}
export function suspendAudio() {
  try { if (context?.state === 'running') context.suspend().catch(()=>{}); } catch {  }
}
function tone(freq, type, start, duration, volume, endFreq = freq) {
  const osc = context.createOscillator(), gain = context.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
  gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + 0.006); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain); gain.connect(context.destination); osc.start(start); osc.stop(start + duration + 0.02);
}
export function soundFrequencies(value = 4, combo = 1, overrides = {}) {
  const level = Math.log2(value), base = 260 + level * 65 + Math.min(combo, 6) * 15;
  const frequencies = {
    impactStart: 315, impactEnd: 4052,
    riseStart: 20, riseEnd: 680, shimmer: base * 2, echo: base * 1.5, noiseCutoff: 8657,
    tapStart: 760, tapEnd: 520, moveStart: 220, moveEnd: 90, blockedStart: 110, blockedEnd: 65,
    win1: 523, win2: 659, win3: 784, win4: 1046
  };
  for (const key of Object.keys(frequencies)) {
    if (typeof overrides?.[key] === 'number' && Number.isFinite(overrides[key])) frequencies[key] = Math.max(20, Math.min(key === 'noiseCutoff' ? 16000 : 8000, overrides[key]));
  }
  return frequencies;
}
export function sound(kind, value = 4, combo = 1, volume = 0.55, frequencyOverrides = {}) {
  if (!context || context.state !== 'running' || volume <= 0) return;
  const now = context.currentTime;
  const f = soundFrequencies(value, combo, frequencyOverrides);
  if (kind === 'tap') return tone(f.tapStart, 'sine', now, 0.045, volume * 0.12, f.tapEnd);
  if (kind === 'move') return tone(f.moveStart, 'sine', now, 0.075, volume * 0.12, f.moveEnd);
  if (kind === 'blocked') return tone(f.blockedStart, 'triangle', now, 0.07, volume * 0.14, f.blockedEnd);
  if (kind === 'win') { [f.win1, f.win2, f.win3, f.win4].forEach((freq, i) => tone(freq, 'sine', now + i * 0.11, 0.5, volume * 0.2)); return; }
  return mergeSound(value, combo, volume, undefined, frequencyOverrides);
}
export function mergeSound(value = 4, combo = 1, volume = 0.55, layers = ['impact', 'rise', 'shimmer', 'echo', 'noise'], frequencyOverrides = {}) {
  if (!context || context.state !== 'running' || volume <= 0) return;
  const now = context.currentTime;
  const f = soundFrequencies(value, combo, frequencyOverrides);
  if (layers.includes('impact')) tone(f.impactStart, 'sine', now, 0.17, volume * 0.42, f.impactEnd);
  if (layers.includes('rise')) tone(f.riseStart, 'triangle', now, 0.13, volume * 0.2, f.riseEnd);
  if (layers.includes('shimmer')) tone(f.shimmer, 'sine', now + 0.02, 0.2, volume * 0.13);
  if (value >= 64 && layers.includes('echo')) tone(f.echo, 'sine', now + 0.07, 0.3, volume * 0.12);
  if (!layers.includes('noise')) return;
  noise ||= (() => { const buffer = context.createBuffer(1, context.sampleRate * 0.06, context.sampleRate); const data = buffer.getChannelData(0); for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; return buffer; })();
  const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
  source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = f.noiseCutoff;
  gain.gain.setValueAtTime(volume * 0.07, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start();
}
export function haptic(kind = 'light') {
  try { if (window.CoreNative?.impact) window.CoreNative.impact(kind); else navigator.vibrate?.(kind === 'heavy' ? [24, 25, 18] : kind === 'medium' ? 18 : 8); } catch {  }
}
