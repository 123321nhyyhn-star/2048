import { copyFile, mkdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const target = new URL('harmony/entry/src/main/resources/rawfile/', root);
await mkdir(target, { recursive: true });
for (const file of ['index.html', 'icon.svg', 'manifest.webmanifest']) await copyFile(new URL(`dist/${file}`, root), new URL(file, target));
const html = await readFile(new URL('index.html', target), 'utf8');
if (/<script[^>]+src=/.test(html) || /<link[^>]+rel="stylesheet"/.test(html)) throw new Error('Harmony build must include all JavaScript and CSS inline.');
console.log('HarmonyOS offline resources synced.');
