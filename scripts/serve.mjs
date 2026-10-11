import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { buildHTML } from './build.mjs';
import { buildSoundTestHTML } from './sound-test.mjs';
const production=process.argv.includes('--production');
const root=new URL('../',import.meta.url);
const port=Number(process.env.PORT || 2048);
const mime={'.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.js':'text/javascript'};
createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-cache');
    if(pathname==='/' || pathname==='/index.html') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(production?await readFile(new URL('dist/index.html',root)):await buildHTML(true));
    } else if(pathname==='/sound-test.html') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(production?await readFile(new URL('dist/sound-test.html',root)):await buildSoundTestHTML());
    } else if(['/icon.svg','/manifest.webmanifest','/sw.js'].includes(pathname)) {
      const extension=pathname.slice(pathname.lastIndexOf('.'));
      res.setHeader('Content-Type',mime[extension]);res.end(await readFile(new URL((production?'dist':'public')+pathname,root)));
    } else {res.writeHead(404);res.end('Not found');}
  } catch(error) {console.error(error);res.writeHead(500);res.end('Build error');}
}).listen(port,'0.0.0.0',()=>console.log(`CORE 2048 ${production?'preview':'development'}: http://localhost:${port}`));
