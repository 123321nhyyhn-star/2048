import { validBoard } from './engine.js';

const SAVE_KEY = 'core2048.v1';
const isCount = value => Number.isSafeInteger(value) && value >= 0;
function snapshot(data) {
  if (!data || !validBoard(data.board) || !['score','turns','elapsed'].every(key=>isCount(data[key]))) return null;
  const won = data.board.some(value=>value >= 2048);
  return { board: [...data.board], score: data.score, turns: data.turns, elapsed: data.elapsed, won, continued: won && data.continued === true };
}
export function parseSave(text) {
  try {
    if (typeof text !== 'string' || text.length > 32768) return null;
    const data = JSON.parse(text), game = snapshot(data?.game);
    if (!game) return null;
    const stats = {};
    for (const key of ['best','bestTile','games','totalMerges','bestCombo']) if (isCount(data.stats?.[key])) stats[key] = data.stats[key];
    const settings = {};
    for (const key of ['sound','haptics','effects']) if (typeof data.settings?.[key] === 'boolean') settings[key] = data.settings[key];
    if (Number.isFinite(data.settings?.volume)) settings.volume = Math.max(0,Math.min(100,data.settings.volume));
    return { game, stats, settings };
  } catch { return null; }
}
function webStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function readSave(native = globalThis.window?.CoreNative, store = webStorage()) {
  try { const saved = parseSave(native?.getSave?.()); if (saved) return saved; } catch {}
  try { return parseSave(store?.getItem(SAVE_KEY)); } catch { return null; }
}
export function writeSave(payload, native = globalThis.window?.CoreNative, store = webStorage()) {
  const serialized = JSON.stringify(payload);
  if (serialized.length > 32768) throw new Error('Save exceeds the supported size');
  let written = false;
  try { written = native?.saveGame?.(serialized) === true; } catch {}
  try { if (store) { store.setItem(SAVE_KEY, serialized); written = true; } } catch {}
  if (!written) throw new Error('No save storage is available');
}
