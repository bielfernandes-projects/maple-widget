import fs from 'node:fs';
import path from 'node:path';
import { decodeJpeg, crop } from '../src/capture/image';
import { DEFAULT_REGIONS, expSamples, type Templates } from '../src/capture/hud';

// Gera src/capture/digit-templates.json a partir dos screenshots rotulados (expAbs/expPct em expected.json).
// uso: npx tsx scripts/make-templates.ts
const dir = 'tests/fixtures/screens';
const expected: Record<string, { expAbs?: number; expPct?: number }> = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
const out: Templates = {};
const count: Record<string, number> = {};
const add = (digit: string, bits: number[][]) => { out[`${digit}#${count[digit] = (count[digit] ?? 0) + 1}`] = bits; };
for (const [file, e] of Object.entries(expected)) {
  if (e.expAbs === undefined || e.expPct === undefined) continue;
  const samples = expSamples(crop(decodeJpeg(fs.readFileSync(path.join(dir, file))), DEFAULT_REGIONS.exp), e.expAbs, e.expPct);
  if (!samples) { console.error(`PULADO ${file}`); continue; }
  for (const [d, bits] of samples) add(d, bits);
}
fs.writeFileSync('src/capture/digit-templates.json', JSON.stringify(out));
console.log('digitos:', Object.keys(count).sort().map((d) => `${d}x${count[d]}`).join(' '));
