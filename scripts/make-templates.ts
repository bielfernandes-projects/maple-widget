import fs from 'node:fs';
import path from 'node:path';
import { decodeJpeg, crop } from '../src/capture/image';
import { DEFAULT_REGIONS, afterBracket, bracketCol, cols, digitBits, pctBits, type Templates } from '../src/capture/hud';

// Gera src/capture/digit-templates.json a partir dos screenshots rotulados (expAbs/expPct em expected.json).
// uso: npx tsx scripts/make-templates.ts
const dir = 'tests/fixtures/screens';
const expected: Record<string, { expAbs?: number; expPct?: number }> = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
const out: Templates = {};
const count: Record<string, number> = {};
const add = (digit: string, bits: number[][]) => { out[`${digit}#${count[digit] = (count[digit] ?? 0) + 1}`] = bits; };
for (const [file, e] of Object.entries(expected)) {
  if (e.expAbs === undefined || e.expPct === undefined) continue;
  const img = crop(decodeJpeg(fs.readFileSync(path.join(dir, file))), DEFAULT_REGIONS.exp);
  const b = bracketCol(img);
  const abs = digitBits(cols(img, 0, b - 2));
  const p = pctBits(cols(img, afterBracket(img, b), img.w));
  const [intS, fracS] = e.expPct.toFixed(2).split('.');
  const want = [...String(e.expAbs), ...intS, ...fracS];
  const got = [...abs, ...(p ? [...p.int, ...p.frac] : [])];
  if (!p || got.length !== want.length || p.int.length !== intS.length) { console.error(`PULADO ${file}: glifos=${got.length} esperado=${want.length}`); continue; }
  got.forEach((bits, i) => add(want[i], bits));
}
fs.writeFileSync('src/capture/digit-templates.json', JSON.stringify(out));
console.log('digitos:', Object.keys(count).sort().map((d) => `${d}x${count[d]}`).join(' '));
