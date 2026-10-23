import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGuide } from '../src/sources/parser';
import { TEM } from './fixtures';

const load = (s: string) => fs.readFileSync(path.join(__dirname, 'fixtures/guides', s + '.html'), 'utf8');
const base = 'https://meowdb.com/msclassic/guides/';

describe('parseGuide', () => {
  it.skipIf(!TEM.guides)('grind maps', () => {
    const g = parseGuide(load('best-grind-maps-every-level'), base + 'best-grind-maps-every-level');
    expect(g.maps.length).toBeGreaterThan(10);
    expect(g.maps[0]).toMatchObject({ name: 'L Forest I', maxExpHr: 333525 });
    const line1 = g.maps.find((m) => m.name === 'Line 1 <Area 1>')!;
    expect([line1.levelMin, line1.levelMax]).toEqual([11, 15]);
    expect(line1.maxExpHr).toBe(640000);
    expect(line1.mob.name).toBe('Bubbling');
  });
  it.skipIf(!TEM.guides)('exp table', () => {
    const g = parseGuide(load('exp-table-level-1-to-100'), base + 'exp-table-level-1-to-100');
    expect(g.expRows.length).toBeGreaterThanOrEqual(99);
    expect(g.expRows[0]).toEqual({ level: 1, toNext: 15 });
  });
  it.skipIf(!TEM.guides)('quests e dicas de AP no beginner guide', () => {
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

  const u = 'https://meowdb.com/a';
  const gt = (rows: string) => '<main><table><tr><th>Map</th><th>Street</th><th>Mob</th><th>Max EXP/hr</th><th>Why</th></tr>' + rows + '</table></main>';
  const gr = (n: string, e: string) => '<tr><td>' + n + '</td><td>s</td><td>Bub</td><td>' + e + '</td><td>w</td></tr>';
  it('mapas so com faixa explicita no H2', () => {
    expect(parseGuide('<main><h2>Party and loot picks</h2>' + gt(gr('A', '100')) + '</main>', u).maps).toHaveLength(0);
    const m = parseGuide('<main><h2>Level 11-15</h2>' + gt(gr('A', '1,000')) + '</main>', u).maps;
    expect([m.length, m[0].levelMin, m[0].levelMax, m[0].maxExpHr]).toEqual([1, 11, 15, 1000]);
  });
  it('H2 "Levels N-M" gera tip sp com faixa', () => {
    const g = parseGuide('<main><h2>Levels 30-70: Fighter skill build and leveling</h2><p>Take Power Strike first.</p></main>', u);
    expect(g.tips[0]).toMatchObject({ kind: 'sp', levelMin: 30, levelMax: 70 });
  });
  it('H2 com "build" solto nao gera tip', () => {
    expect(parseGuide("<main><h2>Find Your Build's Best Training Map</h2><p>texto qualquer aqui</p></main>", u).tips).toHaveLength(0);
  });
  it('img malformada nao quebra', () => {
    const h = '<main><table><tr><th>Quest</th><th>Lv</th><th>EXP</th><th>From</th></tr><tr><td><img src="http://">Q</td><td>1</td><td>2</td><td>N</td></tr></table></main>';
    const q = parseGuide(h, u).quests;
    expect(q).toHaveLength(1);
    expect(q[0].iconUrl).toBeUndefined();
  });
  it('linhas vazias/zeradas sao ignoradas', () => {
    const g = parseGuide('<main><h2>Level 1-5</h2>' + gt(gr('', '5') + gr('B', '0') + gr('C', '7')) +
      '<table><tr><th>Quest</th><th>Lv</th><th>EXP</th></tr><tr><td></td><td>1</td><td>2</td></tr></table></main>', u);
    expect(g.maps.map((m) => m.name)).toEqual(['C']);
    expect(g.quests).toHaveLength(0);
  });
  it('exp duplicado por nivel aparece uma vez (primeiro vence)', () => {
    const r = (a: number, b: number) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>';
    const h = '<main><table><tr><th>Level</th><th>EXP to next</th></tr>' + r(1, 15) + r(2, 20) + '</table><table><tr><th>Level</th><th>EXP to next</th></tr>' + r(2, 99) + '</table></main>';
    expect(parseGuide(h, u).expRows).toEqual([{ level: 1, toNext: 15 }, { level: 2, toNext: 20 }]);
  });
  it('texto de tip truncado em 1500', () => {
    const h = '<main><h2>Skill points</h2>' + '<p>' + 'x'.repeat(1000) + '</p>'.repeat(1) + '<p>' + 'y'.repeat(1000) + '</p></main>';
    const x = parseGuide(h, u).tips[0].text;
    expect(x.length).toBeLessThanOrEqual(1501);
    expect(x.endsWith('…')).toBe(true);
  });
  it.skipIf(!TEM.guides)('fixtures: sem mapas 1-100 e exp unico', () => {
    const m = parseGuide(load('best-grind-maps-every-level'), base + 'x').maps;
    expect(m.some((x) => x.levelMin === 1 && x.levelMax === 100)).toBe(false);
    expect(m.length).toBe(32);
    const e = parseGuide(load('exp-table-level-1-to-100'), base + 'x').expRows;
    expect(new Set(e.map((x) => x.level)).size).toBe(e.length);
  });
});

describe('parseGuide — Quest Database', () => {
  const url = 'https://meowdb.com/msclassic/quest-tracker/all';
  const html = `<main><h1>Quest Database</h1><table>
    <tr><th>Start NPC</th><th>Quest</th><th>Level ↑</th><th>Area</th><th>Start NPC</th><th>EXP</th><th>Mesos</th><th>Rewards</th></tr>
    <tr><td></td><td>+ Bringing a Mirror to Heena</td><td>0</td><td>Maple Island</td><td>Sera</td><td>2</td><td>0</td><td>-</td></tr>
    <tr><td></td><td>+ Mai's Training</td><td>13</td><td>Henesys</td><td>Mai</td><td>1,200</td><td>500</td><td>20x Egg</td></tr>
    <tr><td></td><td>+ Mai's Training</td><td>13</td><td>Ellinia</td><td>Other Mai</td><td>7</td><td>0</td><td>-</td></tr>
  </table></main>`;

  it('lê quests da tabela do Quest Database', () => {
    const g = parseGuide(html, url);
    expect(g.quests.length).toBe(3);
    expect(g.quests[0]).toMatchObject({ name: 'Bringing a Mirror to Heena', level: 0, area: 'Maple Island', npc: 'Sera', exp: 2, reward: '' });
    expect(g.quests[1]).toMatchObject({ name: "Mai's Training", level: 13, area: 'Henesys', npc: 'Mai', exp: 1200, reward: '20x Egg' });
  });
  it('ids únicos mesmo sem link (nome + NPC)', () => {
    const ids = parseGuide(html, url).quests.map((q) => q.id);
    expect(new Set(ids).size).toBe(3);
  });
  it('a tabela de EXP por level continua sendo reconhecida como EXP, não como quests', () => {
    const g = parseGuide('<main><h1>t</h1><table><tr><th>Level</th><th>EXP to next</th></tr><tr><td>1</td><td>15</td></tr></table></main>', url);
    expect([g.quests.length, g.expRows.length]).toEqual([0, 1]);
  });
  it.skipIf(!TEM.guides)('fixture real reduzida: >= 35 quests com nome limpo, level e EXP numéricos', () => {
    const real = fs.readFileSync(path.join(__dirname, 'fixtures/guides/quest-database.html'), 'utf8');
    const g = parseGuide(real, url);
    expect(g.quests.length).toBeGreaterThanOrEqual(35);
    expect(g.quests.every((q) => q.name && !q.name.startsWith('+') && Number.isFinite(q.level) && Number.isFinite(q.exp))).toBe(true);
    expect(g.quests.some((q) => q.area)).toBe(true);
  });
});

describe('parseGuide — Quest Database: ids e recompensas', () => {
  const url = 'https://meowdb.com/msclassic/quest-tracker/all';
  const H = '<tr><th>Start NPC</th><th>Quest</th><th>Level ↑</th><th>Area</th><th>Start NPC</th><th>EXP</th><th>Mesos</th><th>Rewards</th></tr>';
  const wrap = (rows: string) => `<main><h1>Quest Database</h1><table>${H}${rows}</table></main>`;
  const row = (exp: number, ctl = '', reward = '-', quest = '+ Donating') =>
    `<tr><td>${ctl}</td><td>${quest}</td><td>12</td><td>Henesys</td><td>Mai</td><td>${exp}</td><td>0</td><td>${reward}</td></tr>`;

  it('(a) aria-controls dá ids distintos para mesmo nome/NPC', () => {
    const g = parseGuide(wrap(row(14200, '<button aria-controls="quest-80014"></button>') + row(11400, '<button aria-controls="quest-80015"></button>')), url);
    expect(g.quests.map((q) => q.id)).toEqual(['80014', '80015']);
  });
  it('(b) sem link nem aria-controls: fallback distinto por EXP', () => {
    const ids = parseGuide(wrap(row(14200) + row(11400)), url).quests.map((q) => q.id);
    expect(new Set(ids).size).toBe(2);
  });
  it('(c) link /quest-tracker/n vence aria-controls', () => {
    const g = parseGuide(wrap(row(1, '<a href="/msclassic/quest-tracker/1000">x</a><button aria-controls="quest-5"></button>')), url);
    expect(g.quests[0].id).toBe('1000');
  });
  it('(d) recompensa com vários <li> é unida com ", "', () => {
    const g = parseGuide(wrap(row(1, '', '<ul><li>A x1</li><li>B x2</li></ul>')), url);
    expect(g.quests[0].reward).toBe('A x1, B x2');
  });
  it('(e) Level | Quest | EXP | EXP to next não vira quests', () => {
    const g = parseGuide('<main><h1>t</h1><table><tr><th>Level</th><th>Quest</th><th>EXP</th><th>EXP to next</th></tr><tr><td>1</td><td>q</td><td>5</td><td>15</td></tr></table></main>', url);
    expect([g.quests.length, g.expRows.length]).toEqual([0, 1]);
  });
  it.skipIf(!TEM.guides)('(f) fixture real: ids únicos e numéricos', () => {
    const real = fs.readFileSync(path.join(__dirname, 'fixtures/guides/quest-database.html'), 'utf8');
    const ids = parseGuide(real, url).quests.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => /^\d+$/.test(i))).toBe(true);
  });
});

describe('mob icon em mapas de grind', () => {
  const html = `<html><body><h1>G</h1><h2>Levels 10-20</h2><table><tr><th>Map</th><th>Street</th><th>Dominant mob</th><th>Max EXP/hr</th><th>Why</th></tr>
    <tr><td><img src="/msclassic/monsters/sprites/mob_10.png"/><a href="/msclassic/maps/010003020">Pig Beach</a></td><td>Victoria</td><td>Ribbon Pig (lv10)</td><td>100,000</td><td>w</td></tr></table></body></html>`;
  it('pega a img da celula do mapa e o id do sprite', () => {
    const m = parseGuide(html, 'https://meowdb.com/msclassic/guides/g').maps[0];
    expect(m.mob.iconUrl).toBe('https://meowdb.com/msclassic/monsters/sprites/mob_10.png');
    expect(m.mob.id).toBe('10');
  });
  it.skipIf(!TEM.guides)('fixture real: todo mapa tem iconUrl', () => {
    const r = parseGuide(load('best-grind-maps-every-level'), 'https://meowdb.com/msclassic/guides/best-grind-maps-every-level');
    expect(r.maps.length).toBeGreaterThan(0);
    expect(r.maps.filter((m) => !m.mob.iconUrl)).toEqual([]);
  });
});
