let context;
let noise;
export function unlockAudio() {
  try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; context ||= new Audio(); if (context.state === 'suspended') context.resume().catch(() => {}); } catch { /* Unsupported audio gracefully falls back. */ }
}
export function suspendAudio() {
  try { if (context?.state === 'running') context.suspend().catch(()=>{}); } catch { /* The next gesture resumes audio. */ }
}
function tone(freq, type, start, duration, volume, endFreq = freq) {
  const osc = context.createOscillator(), gain = context.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
  gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + 0.006); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain); gain.connect(context.destination); osc.start(start); osc.stop(start + duration + 0.02);
}
export function sound(kind, value = 4, combo = 1, volume = 0.55) {
  if (!context || context.state !== 'running' || volume <= 0) return;
  const now = context.currentTime;
  if (kind === 'tap') return tone(760, 'sine', now, 0.045, volume * 0.12, 520);
  if (kind === 'move') return tone(220, 'sine', now, 0.075, volume * 0.12, 90);
  if (kind === 'blocked') return tone(110, 'triangle', now, 0.07, volume * 0.14, 65);
  if (kind === 'win') { [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 'sine', now + i * 0.11, 0.5, volume * 0.2)); return; }
  const level = Math.log2(value), base = 260 + level * 65 + Math.min(combo, 6) * 15;
  tone(110 + level * 5, 'sine', now, 0.17, volume * 0.42, 45);
  tone(base, 'triangle', now, 0.13, volume * 0.2, base * 1.5);
  tone(base * 2, 'sine', now + 0.02, 0.2, volume * 0.13);
  if (value >= 64) tone(base * 1.5, 'sine', now + 0.07, 0.3, volume * 0.12);
  noise ||= (() => { const buffer = context.createBuffer(1, context.sampleRate * 0.06, context.sampleRate); const data = buffer.getChannelData(0); for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; return buffer; })();
  const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
  source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = 2400;
  gain.gain.setValueAtTime(volume * 0.07, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start();
}
export function haptic(kind = 'light') {
  try { if (window.CoreNative?.impact) window.CoreNative.impact(kind); else navigator.vibrate?.(kind === 'heavy' ? [24, 25, 18] : kind === 'medium' ? 18 : 8); } catch { /* Devices without a vibrator can still play. */ }
}
