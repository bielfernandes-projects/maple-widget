import { build } from 'esbuild';
import fs from 'node:fs';

fs.mkdirSync('dist', { recursive: true });
const common = { bundle: true, sourcemap: true, logLevel: 'info' };
await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs',
  external: ['electron', 'tesseract.js', 'cheerio', 'pngjs', 'jpeg-js'] });
await build({ ...common, entryPoints: ['src/main/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] });
await build({ ...common, entryPoints: ['src/main/capturer-preload.ts'], outfile: 'dist/capturer-preload.js', platform: 'node', format: 'cjs', external: ['electron'] });
await build({ ...common, entryPoints: ['src/capture/capturer.ts'], outfile: 'dist/capturer.js', platform: 'browser', format: 'iife' });
await build({ ...common, entryPoints: ['src/renderer/renderer.ts'], outfile: 'dist/renderer.js', platform: 'browser', format: 'iife' });
fs.copyFileSync('src/renderer/index.html', 'dist/index.html');
fs.copyFileSync('src/renderer/styles.css', 'dist/styles.css');
fs.copyFileSync('src/capture/capturer.html', 'dist/capturer.html');
