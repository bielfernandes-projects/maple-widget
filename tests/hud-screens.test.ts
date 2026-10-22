import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HudReader, DEFAULT_REGIONS } from '../src/capture/hud';
import { decodeJpeg } from '../src/capture/image';

// ATENCAO (honestidade): este teste e EM AMOSTRA. Regioes, limiares, parametros de votacao (level/mapa) e os templates de digitos do EXP
// (src/capture/digit-templates.json, gerados dos mesmos 12 arquivos) foram calibrados nestes screenshots. Ele prova que o spike funciona
// nesta amostra; a generalizacao do EXP e medida em hud-robust.test.ts (leave-one-out) e a real e a checagem ao vivo (Task 10).
const dir = path.join(__dirname, 'fixtures/screens');
const expected: Record<string, { level?: number; expAbs?: number; expPct?: number; cls?: string; map?: string }> =
  JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

let reader: HudReader;
beforeAll(async () => { reader = await HudReader.create(path.join(__dirname, '../out/tessdata')); });
afterAll(async () => { await reader.close(); });

describe('HudReader nos screenshots reais (em amostra)', () => {
  for (const [file, exp] of Object.entries(expected)) {
    it(file, async () => {
      const got = await reader.read(decodeJpeg(fs.readFileSync(path.join(dir, file))), DEFAULT_REGIONS);
      if (exp.level !== undefined) expect(got.level).toBe(exp.level);
      if (exp.expAbs !== undefined) expect(got.expAbs).toBe(exp.expAbs);
      if (exp.expPct !== undefined) expect(got.expPct).toBe(exp.expPct);
      if (exp.cls !== undefined) expect(norm(got.cls)).toBe(norm(exp.cls));
      if (exp.map !== undefined) expect(norm(got.map)).toBe(norm(exp.map));
    });
  }
});
