import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSave, readSave, writeSave } from '../src/storage.js';
const before={board:[2,2,...Array(14).fill(0)],score:0,turns:0,elapsed:0,won:false,continued:false};
const payload={game:{board:[4,2,...Array(14).fill(0)],score:4,turns:1,elapsed:3,won:false,continued:false,undo:before},stats:{best:4},settings:{sound:false,volume:30}};
const text=JSON.stringify(payload);
function memory(initial=null){let value=initial;return {getItem:()=>value,setItem:(_key,next)=>value=next};}
test('legacy saves retain the current game and discard removed undo snapshots',()=>{
  const restored=parseSave(text);assert.equal('undo' in restored.game,false);assert.equal(restored.game.score,4);
  assert.deepEqual(restored.game.board,payload.game.board);
  assert.equal(parseSave('invalid'),null);assert.equal(parseSave(JSON.stringify({...payload,game:{...payload.game,score:-1}})),null);
  assert.equal('undo' in parseSave(JSON.stringify({...payload,game:{...payload.game,undo:{...before,turns:2}}})).game,false);
});
test('native Preferences takes priority and a corrupt native save falls back to web storage',()=>{
  const nativeText=JSON.stringify({...payload,game:{...payload.game,score:8}});
  assert.equal(readSave({getSave:()=>nativeText},memory(text)).game.score,8);
  assert.equal(readSave({getSave:()=>'{broken'},memory(text)).game.score,4);
  assert.equal(readSave({getSave:()=>{throw new Error('unavailable');}},memory(text)).game.score,4);
});
test('save writes the native store and web backup',()=>{
  let received;const store=memory();writeSave(payload,{saveGame:value=>{received=value;return true;}},store);
  assert.equal(received,text);assert.equal(store.getItem(),text);
});
test('either storage backend can fail without losing the working backend',()=>{
  const store=memory();writeSave(payload,{saveGame:()=>{throw new Error('no preferences');}},store);assert.equal(store.getItem(),text);
  assert.doesNotThrow(()=>writeSave(payload,{saveGame:()=>true},{setItem:()=>{throw new Error('quota');}}));
  assert.throws(()=>writeSave(payload,{saveGame:()=>false},{setItem:()=>{throw new Error('quota');}}),/No save storage/);
});
test('corrupt options cannot hide tiles, inject UI fields, or bypass the win state',()=>{
  const corrupt={...payload,game:{...payload.game,won:true,continued:true},settings:{sound:'false',volume:Infinity},stats:{best:NaN,unexpected:123}};
  const restored=parseSave(JSON.stringify(corrupt));assert.deepEqual(restored.settings,{});assert.deepEqual(restored.stats,{});assert.equal(restored.game.won,false);assert.equal(restored.game.continued,false);
  assert.equal(parseSave(JSON.stringify({...payload,settings:{volume:200}})).settings.volume,100);
});
