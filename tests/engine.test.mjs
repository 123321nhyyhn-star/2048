import test from 'node:test';
import assert from 'node:assert/strict';
import { move, canMove, addTile, newBoard, validBoard } from '../src/engine.js';
const row = values => [...values, ...Array(12).fill(0)];
test('a tile merges only once per move', () => {
  const result = move(row([2,2,4,0]), 'left');
  assert.deepEqual(result.board.slice(0,4), [4,4,0,0]); assert.equal(result.score,4);
  assert.deepEqual(move(row([2,2,2,2]),'left').board.slice(0,4), [4,4,0,0]);
  assert.deepEqual(move(row([4,4,4,4]),'right').board.slice(0,4), [0,0,8,8]);
});
test('gaps compress and merges accumulate score', () => {
  const result=move(row([2,0,2,4]),'left'); assert.deepEqual(result.board.slice(0,4),[4,4,0,0]); assert.equal(result.score,4);
  const double=move(row([4,4,8,8]),'left'); assert.equal(double.score,24); assert.equal(double.merges.length,2);
});
test('vertical directions respect column order', () => {
  const board=[2,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0];
  assert.deepEqual(move(board,'up').board,[4,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0]);
  assert.deepEqual(move(board,'down').board,[0,0,0,0,0,0,0,0,4,0,0,0,8,0,0,0]);
});
test('blocked movement neither mutates the board nor scores', () => {
  const board=row([2,4,8,16]), copy=[...board], result=move(board,'left');
  assert.equal(result.changed,false);assert.equal(result.score,0);assert.deepEqual(board,copy);
});
test('game over requires both a full board and no adjacent match', () => {
  const full=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];assert.equal(canMove(full),false);
  assert.equal(canMove([...full.slice(0,15),0]),true);
  const horizontal=[...full];horizontal[1]=2;assert.equal(canMove(horizontal),true);
  const vertical=[...full];vertical[4]=2;assert.equal(canMove(vertical),true);
});
test('tile spawn uses empty space only and has the 90/10 distribution', () => {
  const board=Array(16).fill(8);board[7]=0;
  assert.equal(addTile(board,()=>0).board[7],2);assert.equal(addTile(board,()=>0.95).board[7],4);
  assert.equal(board[7],0);assert.equal(addTile(Array(16).fill(8)).index,-1);
  assert.equal(newBoard(()=>0).filter(Boolean).length,2);
});
test('board validation rejects corrupt saves', () => {
  assert.equal(validBoard(row([2,4,8,16])),true);
  for(const value of [3,-2,1,NaN,Infinity,'2']) assert.equal(validBoard(row([value,0,0,0])),false);
  assert.equal(validBoard([2]),false);
});
test('movement conserves mass, validates outputs and does not mutate inputs over 1000 boards', () => {
  let seed=43;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let n=0;n<1000;n++) {
    const board=Array.from({length:16},()=>random()<0.3?0:2**(1+Math.floor(random()*7))),copy=[...board];
    for(const dir of ['up','down','left','right']) {
      const result=move(board,dir);assert.equal(validBoard(result.board),true);
      assert.equal(board.reduce((a,b)=>a+b,0),result.board.reduce((a,b)=>a+b,0));
      assert.equal(result.score,result.merges.reduce((sum,m)=>sum+m.value,0));
      assert.equal(result.changed,board.some((v,i)=>v!==result.board[i]));
      assert.deepEqual(board,copy);
    }
  }
});
