// Browser test fixtures use their own localhost port and cannot replace a player's save.
import { createServer } from 'node:http';
import { buildHTML } from './build.mjs';
const cases={
  win:[1024,1024,4,8,...Array(12).fill(0)],
  lose:[2,4,2,4,4,2,4,2,2,4,2,4,0,8,16,32],
  lifecycle:[2,2,4,8,...Array(12).fill(0)]
};
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const name=url.pathname.slice(1)||'lifecycle',board=cases[name];
  if(!board) {res.writeHead(404);res.end('Unknown QA fixture');return;}
  const payload={game:{board,score:0,turns:0,elapsed:0,won:false,continued:false,undo:null},stats:{best:0,bestTile:2,games:0,totalMerges:0,bestCombo:0},settings:{sound:true,haptics:true,effects:true,volume:30}};
  const controls=`<div style="position:fixed;z-index:50;right:5px;top:5px;background:#f6ffd9;border:1px solid #b8ca81;font:10px monospace;padding:4px"><span>QA / ${name}</span> <button id="qa-pause">模拟后台</button><button id="qa-resume">模拟前台</button><button id="qa-back">模拟返回</button><span id="qa-status">ACTIVE</span><span id="qa-impact"></span></div>`;
  const seed=`<script>
    if(${url.searchParams.has('reset')} || !localStorage.getItem('qa.fixture.${name}')) {
      localStorage.setItem('core2048.v1',${JSON.stringify(JSON.stringify(payload))});
      localStorage.setItem('qa.native.save.${name}',${JSON.stringify(JSON.stringify(payload))});
      localStorage.setItem('qa.fixture.${name}','1');
    }
    Math.random=()=>0;
    window.CoreNative={
      getSave(){return localStorage.getItem('qa.native.save.${name}')||'';},
      saveGame(value){localStorage.setItem('qa.native.save.${name}',value);return true;},
      impact(kind){document.getElementById('qa-impact').textContent=' HAPTIC '+kind;}
    };
    document.getElementById('qa-pause').onclick=()=>{document.dispatchEvent(new Event('core:pause'));document.getElementById('qa-status').textContent='PAUSED';};
    document.getElementById('qa-resume').onclick=()=>{document.dispatchEvent(new Event('core:resume'));document.getElementById('qa-status').textContent='ACTIVE';};
    document.getElementById('qa-back').onclick=()=>document.dispatchEvent(new Event('core:back'));
    document.addEventListener('keydown',event=>{if(event.key==='F8'){event.preventDefault();document.dispatchEvent(new Event('core:back'));}});
  </script>`;
  const html=(await buildHTML(true)).replace('<div id="app"></div>',controls+seed+'<div id="app"></div>');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(html);
}).listen(2050,'127.0.0.1',()=>console.log('Isolated QA fixtures: http://127.0.0.1:2050/win?reset=1 | /lose?reset=1 | /lifecycle?reset=1'));
