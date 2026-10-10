import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
export async function buildHTML(dev = false) {
  const [html, css, ...scripts] = await Promise.all(['index.html','src/style.css','src/engine.js','src/feedback.js','src/storage.js','src/main.js'].map(path => readFile(new URL(path,root),'utf8')));
  // The small game has only local named imports. Inline them for ArkWeb rawfile,
  // which must not depend on external module loading or a development server.
  const js = scripts.map(source => source.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'').replaceAll('import.meta.env.DEV',String(dev))).join('\n');
  return html.replace('</head>',`<style>${css}</style></head>`).replace('<script type="module" src="/src/main.js"></script>',`<script>"use strict";(()=>{${js}\n})();</script>`).replaceAll('href="/','href="./');
}
export async function build() {
  await mkdir(new URL('dist/',root),{recursive:true});
  await writeFile(new URL('dist/index.html',root),await buildHTML());
  for(const file of ['icon.svg','manifest.webmanifest','sw.js']) await copyFile(new URL(`public/${file}`,root),new URL(`dist/${file}`,root));
  console.log('Built offline game: dist/index.html (zero third-party runtime dependencies).');
}
if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await build();
