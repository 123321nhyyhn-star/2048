import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = (await readFile(new URL('../src/feedback.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
function audioHarness() {
  const played = [];
  const frequencyEvents = [], filters = [];
  const gainNodes = [], compressors = [], destination = { kind: 'speaker' };
  const parameter = (events = []) => ({ setValueAtTime(value, time) { events.push({ type: 'set', value, time }); }, exponentialRampToValueAtTime(value, time) { events.push({ type: 'ramp', value, time }); }, linearRampToValueAtTime() {} });
  class Audio {
    state = 'running';
    currentTime = 10;
    sampleRate = 48000;
    destination = destination;
    createOscillator() {
      const events = [];
      frequencyEvents.push(events);
      const node = { frequency: parameter(events), connect() {}, stop() {}, start(time) { played.push({ kind: 'tone', type: node.type, time }); } };
      return node;
    }
    createGain() { const node = { gain: parameter(), connections: [], connect(target) { this.connections.push(target); } }; gainNodes.push(node); return node; }
    createDynamicsCompressor() {
      const node = { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connections: [], connect(target) { this.connections.push(target); } };
      compressors.push(node);
      return node;
    }
    createBiquadFilter() { const filter = { frequency: {}, connect() {} }; filters.push(filter); return filter; }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { connect() {}, start() { played.push({ kind: 'noise' }); } }; }
  }
  const scope = { window: { AudioContext: Audio } };
  runInNewContext(source, scope);
  scope.unlockAudio();
  return { ...scope, played, frequencyEvents, filters, gainNodes, compressors, destination };
}

test('all effects and merge solos share the boosted output and peak compressor', () => {
  const audio = audioHarness();
  audio.unlockAudio();
  assert.equal(audio.gainNodes.length, 1, 'unlocking again must reuse the master bus');
  assert.equal(audio.compressors.length, 1);
  const master = audio.gainNodes[0], compressor = audio.compressors[0];
  assert.equal(master.gain.value, 2);
  assert.equal(master.connections[0], compressor);
  assert.equal(compressor.connections[0], audio.destination);
  assert.ok(compressor.threshold.value < 0);
  assert.ok(compressor.ratio.value > 1);
  for (const kind of ['tap', 'move', 'blocked', 'win', 'merge']) audio.sound(kind, 128, 1, 0.65);
  audio.mergeSound(128, 1, 0.65, ['noise']);
  audio.mergeSound(128, 1, 0.65, ['impact']);
  assert.ok(audio.gainNodes.length > 10);
  for (const gain of audio.gainNodes.slice(1)) assert.equal(gain.connections[0], master, 'no effect may bypass the master bus');
});

test('normal game merge and complete decomposition play the same voices', () => {
  for (const value of [4, 32, 64, 128, 2048]) {
    const game = audioHarness(), lab = audioHarness();
    game.sound('merge', value, 3, 0.55);
    lab.mergeSound(value, 3, 0.55);
    assert.deepEqual(game.played, lab.played);
    assert.deepEqual(game.frequencyEvents, lab.frequencyEvents);
    assert.deepEqual(game.frequencyEvents.slice(0, 2).map(events => events.map(event => event.value)), [[315, 4052], [20, 680]]);
    assert.equal(game.filters[0].frequency.value, 8657);
    assert.equal(game.played.filter(voice => voice.kind === 'noise').length, 1);
    assert.equal(game.played.filter(voice => voice.kind === 'tone').length, value >= 64 ? 4 : 3);
  }
});

test('custom merge frequencies reach the oscillator sweeps and noise filter', () => {
  const audio = audioHarness();
  audio.mergeSound(128, 1, 0.55, undefined, { impactStart: 180, impactEnd: 60, riseStart: 440, riseEnd: 880, shimmer: 1320, echo: 660, noiseCutoff: 3600 });
  assert.deepEqual(audio.frequencyEvents.map(events => events.map(event => event.value)), [[180, 60], [440, 880], [1320, 1320], [660, 660]]);
  assert.equal(audio.filters[0].frequency.value, 3600);
  const solo = audioHarness();
  solo.mergeSound(128, 1, 0.55, ['rise'], { riseStart: 440, riseEnd: 880 });
  assert.deepEqual(solo.frequencyEvents[0].map(event => event.value), [440, 880]);
});

test('custom frequencies apply to clicks, moves, blocked moves and each victory note', () => {
  for (const [kind, keys] of [['tap', ['tapStart', 'tapEnd']], ['move', ['moveStart', 'moveEnd']], ['blocked', ['blockedStart', 'blockedEnd']]]) {
    const audio = audioHarness();
    audio.sound(kind, 4, 1, 0.55, { [keys[0]]: 400, [keys[1]]: 200 });
    assert.deepEqual(audio.frequencyEvents[0].map(event => event.value), [400, 200]);
  }
  const win = audioHarness();
  win.sound('win', 2048, 1, 0.55, { win1: 440, win2: 550, win3: 660, win4: 880 });
  assert.deepEqual(win.frequencyEvents.map(events => events[0].value), [440, 550, 660, 880]);
});

test('invalid custom frequencies fall back and valid values are bounded', () => {
  const audio = audioHarness();
  const original = audio.soundFrequencies(128, 1);
  assert.equal(original.riseStart, 20);
  assert.equal(original.riseEnd, 680);
  const actual = audio.soundFrequencies(128, 1, { impactStart: NaN, riseStart: Infinity, echo: '440', impactEnd: 0, shimmer: 90000, noiseCutoff: 999999 });
  assert.equal(actual.impactStart, original.impactStart);
  assert.equal(actual.riseStart, original.riseStart);
  assert.equal(actual.echo, original.echo);
  assert.equal(actual.impactEnd, 20);
  assert.equal(actual.shimmer, 8000);
  assert.equal(actual.noiseCutoff, 16000);
});

test('solo and group selection omit all unselected voices', () => {
  const noise = audioHarness();
  noise.mergeSound(128, 1, 0.55, ['noise']);
  assert.deepEqual(noise.played, [{ kind: 'noise' }]);
  const impact = audioHarness();
  impact.mergeSound(128, 1, 0.55, ['impact']);
  assert.deepEqual(impact.played, [{ kind: 'tone', type: 'sine', time: 10 }]);
  const tones = audioHarness();
  tones.mergeSound(128, 1, 0.55, ['rise', 'shimmer', 'echo']);
  assert.equal(tones.played.length, 3);
  assert.ok(tones.played.every(voice => voice.kind === 'tone'));
});

test('conditional layer, empty selection, and zero volume stay silent', () => {
  for (const [value, volume, layers] of [[32, 0.55, ['echo']], [128, 0.55, []], [128, 0, ['impact', 'noise']]]) {
    const audio = audioHarness();
    audio.mergeSound(value, 1, volume, layers);
    assert.equal(audio.played.length, 0);
  }
});
