import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { buildHTML } from './build.mjs';
const assets = new URL('../android/assets/', import.meta.url);
await mkdir(assets, { recursive: true });
const html = (await buildHTML()).replace(/\s*<link[^>]*rel="manifest"[^>]*>/, '');
await writeFile(new URL('index.html', assets), html);
await copyFile(new URL('../public/icon.svg', import.meta.url), new URL('icon.svg', assets));
console.log('Android offline assets synchronized.');
