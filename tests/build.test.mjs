import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { buildHTML } from '../scripts/build.mjs';
test('offline bundle has executable inline JavaScript and no external runtime assets',async()=>{
  const html=await buildHTML();
  assert.doesNotMatch(html,/<script[^>]+src=/);
  assert.doesNotMatch(html,/<link[^>]+rel="stylesheet"/);
  assert.doesNotMatch(html,/import\.meta/);
  const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(js);assert.doesNotThrow(()=>new Script(js));
  assert.match(html,/\.\/icon\.svg/);
});
