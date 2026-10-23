import { describe, expect, it } from 'vitest';
import { validFolderPath, validGamePathShape, validJanelaJogo, validRegions, validResKey } from '../src/main/validate';

const r = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
const ok = () => ({ level: { ...r }, exp: { ...r }, cls: { ...r }, map: { ...r } });

describe('validResKey', () => {
  it('aceita WxH', () => { expect(validResKey('1920x1080')).toBe(true); });
  it.each(['', '1920', 'x1080', '1920x', '1920x1080 ', '1e3x5', '-1x5', '__proto__', 'constructor'])('rejeita %j', (k) => { expect(validResKey(k)).toBe(false); });
  it('rejeita nao-string', () => { expect(validResKey(1920 as any)).toBe(false); expect(validResKey(null as any)).toBe(false); });
});

describe('validRegions', () => {
  it('aceita validas e limites 0 e 1', () => {
    expect(validRegions(ok())).toBe(true);
    expect(validRegions({ ...ok(), map: { x: 0, y: 0, w: 1, h: 1 } })).toBe(true);
  });
  it('rejeita NaN, Infinity, fora de 0..1', () => {
    for (const v of [NaN, Infinity, -0.1, 1.01]) expect(validRegions({ ...ok(), exp: { ...r, w: v } })).toBe(false);
  });
  it('rejeita tipos errados', () => {
    for (const x of [null, undefined, 1, 'a', [], { ...ok(), exp: { ...r, x: '0.1' } }, { ...ok(), exp: null }]) expect(validRegions(x)).toBe(false);
  });
  it('rejeita chave faltando ou extra', () => {
    const { map, ...sem } = ok();
    expect(validRegions(sem)).toBe(false);
    expect(validRegions({ ...ok(), extra: r })).toBe(false);
    expect(validRegions({ ...ok(), exp: { ...r, z: 0.5 } })).toBe(false);
    const { h, ...semH } = r;
    expect(validRegions({ ...ok(), exp: semH })).toBe(false);
  });
  it('rejeita __proto__ como chave propria', () => {
    expect(validRegions(JSON.parse('{"__proto__":{"x":0,"y":0,"w":1,"h":1},"level":{"x":0,"y":0,"w":1,"h":1},"exp":{"x":0,"y":0,"w":1,"h":1},"cls":{"x":0,"y":0,"w":1,"h":1}}'))).toBe(false);
    expect(validRegions(JSON.parse('{"level":{"__proto__":1,"x":0,"y":0,"w":1,"h":1},"exp":{"x":0,"y":0,"w":1,"h":1},"cls":{"x":0,"y":0,"w":1,"h":1},"map":{"x":0,"y":0,"w":1,"h":1}}'))).toBe(false);
  });
});

describe('validGamePathShape', () => {
  it('aceita vazio e caminho normal', () => {
    expect(validGamePathShape('')).toBe(true);
    expect(validGamePathShape('C:\Nexon\Library\maplestorycw')).toBe(true);
    expect(validGamePathShape('a'.repeat(500))).toBe(true);
  });
  it('rejeita nao-string e longo demais', () => {
    for (const x of [null, undefined, 1, {}, []]) expect(validGamePathShape(x)).toBe(false);
    expect(validGamePathShape('a'.repeat(501))).toBe(false);
  });
});

import { validOpenUrl } from '../src/main/validate';
describe('validOpenUrl', () => {
  const D = ['meowdb.com', 'niadb.com'];
  it('aceita https permitido', () => {
    expect(validOpenUrl('https://meowdb.com/msclassic/guides/x', D)).toBe(true);
    expect(validOpenUrl('https://www.niadb.com/a', D)).toBe(true);
  });
  it.each(['http://meowdb.com/x', 'https://evil.com/x', 'javascript:alert(1)', 'https://meowdb.com.evil.com/x', 'https://meowdb.com@evil.com/x', 'https://evil.com/?https://meowdb.com', 'file:///c:/x', ''])('rejeita %j', (u) => {
    expect(validOpenUrl(u, D)).toBe(false);
  });
  it('rejeita nao-string', () => { for (const x of [null, undefined, 1, {}, ['https://meowdb.com/']]) expect(validOpenUrl(x, D)).toBe(false); });
});

describe('validJanelaJogo', () => {
  it('aceita string até 200 (inclusive vazia)', () => {
    expect(validJanelaJogo('')).toBe(true);
    expect(validJanelaJogo('MapleStory')).toBe(true);
    expect(validJanelaJogo('a'.repeat(200))).toBe(true);
  });
  it('rejeita >200 e não-string', () => {
    expect(validJanelaJogo('a'.repeat(201))).toBe(false);
    for (const x of [null, undefined, 1, {}, []]) expect(validJanelaJogo(x)).toBe(false);
  });
});

describe('validFolderPath', () => {
  it('aceita caminho absoluto do Windows', () => {
    expect(validFolderPath(String.raw`C:\Nexon\Library\maplestorycw`)).toBe(true);
    expect(validFolderPath(String.raw`d:\Jogos`)).toBe(true);
  });
  it.each([
    '', String.raw`\host\share`, String.raw`relativo\x`, 'C:Nexon', String.raw`C:\a\..\b`, String.raw`C:\..`, '/etc',
  ])('rejeita %j', (p) => { expect(validFolderPath(p)).toBe(false); });
  it('rejeita >500 e não-string', () => {
    expect(validFolderPath('C:/' + 'a'.repeat(500))).toBe(false);
    for (const x of [null, undefined, 1, {}]) expect(validFolderPath(x)).toBe(false);
  });
});
