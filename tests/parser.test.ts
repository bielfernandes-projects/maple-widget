import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGuide } from '../src/sources/parser';

const load = (s: string) => fs.readFileSync(path.join(__dirname, 'fixtures/guides', s + '.html'), 'utf8');
const base = 'https://meowdb.com/msclassic/guides/';

describe('parseGuide', () => {
  it('grind maps', () => {
    const g = parseGuide(load('best-grind-maps-every-level'), base + 'best-grind-maps-every-level');
    expect(g.maps.length).toBeGreaterThan(10);
    expect(g.maps[0]).toMatchObject({ name: 'L Forest I', maxExpHr: 333525 });
    const line1 = g.maps.find((m) => m.name === 'Line 1 <Area 1>')!;
    expect([line1.levelMin, line1.levelMax]).toEqual([11, 15]);
    expect(line1.maxExpHr).toBe(640000);
    expect(line1.mob.name).toBe('Bubbling');
  });
  it('exp table', () => {
    const g = parseGuide(load('exp-table-level-1-to-100'), base + 'exp-table-level-1-to-100');
    expect(g.expRows.length).toBeGreaterThanOrEqual(99);
    expect(g.expRows[0]).toEqual({ level: 1, toNext: 15 });
  });
  it('quests e dicas de AP no beginner guide', () => {
    const g = parseGuide(load('beginners-guide-first-steps-in-maple-world'), base + 'beginners-guide-first-steps-in-maple-world');
    const sera = g.quests.find((q) => q.name === "Sera's Mirror")!;
    expect(sera).toMatchObject({ id: '1000', npc: 'Heena', level: 1, exp: 2 });
    const ap = g.tips.find((t) => /ability points/i.test(t.title))!;
    expect(ap.kind).toBe('ap');
    expect(ap.guide).toMatch(/Beginner/);
    expect(ap.text.length).toBeGreaterThan(20);
  });
  it('HTML sem tabelas reconhecidas retorna tudo vazio', () => {
    const g = parseGuide('<main><h1>x</h1><p>oi</p></main>', 'https://meowdb.com/a');
    expect([g.maps.length, g.quests.length, g.expRows.length, g.tips.length]).toEqual([0, 0, 0, 0]);
  });
});
