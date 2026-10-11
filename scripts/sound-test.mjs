import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export async function buildSoundTestHTML() {
  const [html, css, feedback, test] = await Promise.all(['sound-test.html', 'src/sound-test.css', 'src/feedback.js', 'src/sound-test.js'].map(path => readFile(new URL(path, root), 'utf8')));
  const script = `${feedback.replace(/^export /gm, '')}\n${test.replace(/^import .*;\s*$/gm, '')}`;
  return html.replace('<link rel="stylesheet" href="./src/sound-test.css">', () => `<style>${css}</style>`).replace('<script type="module" src="./src/sound-test.js"></script>', () => `<script>"use strict";(() => {${script}\n})();</script>`);
}
export async function buildSoundTest() {
  await mkdir(new URL('dist/', root), { recursive: true });
  await writeFile(new URL('dist/sound-test.html', root), await buildSoundTestHTML());
  console.log('Built sound test: dist/sound-test.html');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildSoundTest();
