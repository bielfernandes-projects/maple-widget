import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HudReader, DEFAULT_REGIONS, expSamples, readExpDigits, type Templates } from '../src/capture/hud';
import { decodeJpeg, crop } from '../src/capture/image';
import type { Img } from '../src/types';
import { TEM } from './fixtures';

const dir = path.join(__dirname, 'fixtures/screens');
type Exp = { level?: number; expAbs?: number; expPct?: number; cls?: string; map?: string };
const expected: Record<string, Exp> = TEM.screens ? JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')) : {};
const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const load = (f: string) => decodeJpeg(fs.readFileSync(path.join(dir, f)));

// resample bilinear simples (amostragem no centro do pixel destino)
function resample(img: Img, w: number, h: number): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = Math.min(img.w - 1, Math.max(0, ((x + 0.5) * img.w) / w - 0.5)), fy = Math.min(img.h - 1, Math.max(0, ((y + 0.5) * img.h) / h - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(img.w - 1, x0 + 1), y1 = Math.min(img.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    for (let k = 0; k < 4; k++) {
      const p = (xx: number, yy: number) => img.data[(yy * img.w + xx) * 4 + k];
      data[(y * w + x) * 4 + k] = (p(x0, y0) * (1 - tx) + p(x1, y0) * tx) * (1 - ty) + (p(x0, y1) * (1 - tx) + p(x1, y1) * tx) * ty;
    }
  }
  return { w, h, data };
}

describe.skipIf(!TEM.screens)('templates de digitos do EXP: leave-one-out (fora da amostra)', () => {
  it('nunca devolve valor errado; acerta pelo menos o limite honesto', () => {
    const files = Object.keys(expected).filter((f) => expected[f].expAbs !== undefined && expected[f].expPct !== undefined);
    const crops = Object.fromEntries(files.map((f) => [f, crop(load(f), DEFAULT_REGIONS.exp)]));
    const samples = Object.fromEntries(files.map((f) => [f, expSamples(crops[f], expected[f].expAbs!, expected[f].expPct!) ?? []]));
    let abs = 0, pct = 0, wrong = 0;
    for (const f of files) {
      const T: Templates = {};
      for (const g of files) if (g !== f) samples[g].forEach(([d, bits], i) => { T[`${d}#${g}${i}`] = bits; });
      const r = readExpDigits(crops[f], T);
      if (r?.expAbs === expected[f].expAbs) abs++; else if (r) wrong++;
      if (r?.expPct === expected[f].expPct) pct++; else if (r) wrong++;
    }
    // limite honesto MEDIDO: LOO nao e 100% (abs 9/12, pct 9/12, 0 errados); o gating troca os erros por undefined. Nao afrouxar: se cair, e regressao.
    console.log(`LOO: abs ${abs}/${files.length}, pct ${pct}/${files.length}, errados ${wrong}`);
    expect(wrong).toBe(0);
    expect(abs).toBeGreaterThanOrEqual(ABS_MIN);
    expect(pct).toBeGreaterThanOrEqual(PCT_MIN);
  });
});

describe.skipIf(!TEM.screens)('reader em copia reamostrada (outra resolucao): correto ou undefined, nunca errado', () => {
  let reader: HudReader;
  beforeAll(async () => { reader = await HudReader.create(path.join(__dirname, '../out/tessdata')); });
  afterAll(async () => { await reader.close(); });
  const cases: [string, number, number][] = [['Maple_A_261021_220733.jpg', 1280, 720], ['Maple_A_261021_212621.jpg', 1280, 720], ['Maple_A_261021_192706.jpg', 1920, 1080]];
  for (const [f, w, h] of cases) {
    it(`${f} -> ${w}x${h}`, async () => {
      const e = expected[f];
      const got = await reader.read(resample(load(f), w, h), DEFAULT_REGIONS);
      console.log(f, `${w}x${h}`, JSON.stringify(got));
      if (got.level !== undefined) expect(got.level).toBe(e.level);
      if (got.expAbs !== undefined) expect(got.expAbs).toBe(e.expAbs);
      if (got.expPct !== undefined) expect(got.expPct).toBe(e.expPct);
      if (got.cls !== undefined) expect(norm(got.cls)).toBe(norm(e.cls));
      if (got.map !== undefined) expect(norm(got.map)).toBe(norm(e.map));
    });
  }
  it('imagem degenerada nao rejeita', async () => {
    const got = await reader.read({ w: 1, h: 1, data: new Uint8ClampedArray(4) }, DEFAULT_REGIONS);
    expect(got.level ?? got.expAbs ?? got.map).toBeUndefined();
  });
});
const ABS_MIN = 9, PCT_MIN = 9;
