import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HudReader, DEFAULT_REGIONS } from '../src/capture/hud';
import { decodeJpeg } from '../src/capture/image';

const dir = path.join(__dirname, 'fixtures/screens');
const expected: Record<string, { level?: number; expAbs?: number; map?: string }> =
  JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

let reader: HudReader;
beforeAll(async () => { reader = await HudReader.create(path.join(__dirname, '../out/tessdata')); });
afterAll(async () => { await reader.close(); });

describe('HudReader nos screenshots reais', () => {
  for (const [file, exp] of Object.entries(expected)) {
    it(file, async () => {
      const got = await reader.read(decodeJpeg(fs.readFileSync(path.join(dir, file))), DEFAULT_REGIONS);
      if (exp.level !== undefined) expect(got.level).toBe(exp.level);
      if (exp.expAbs !== undefined) expect(got.expAbs).toBe(exp.expAbs);
      if (exp.map !== undefined) expect(norm(got.map)).toBe(norm(exp.map));
    });
  }
});
