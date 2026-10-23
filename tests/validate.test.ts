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

import { validEscala, validFrame } from '../src/main/validate';
describe('validEscala', () => {
  it('aceita 0.25–4', () => { for (const n of [0.25, 0.5, 1, 1.5, 4]) expect(validEscala(n)).toBe(true); });
  it('rejeita fora da faixa e não-número', () => {
    for (const x of [0, 0.24, 4.01, NaN, Infinity, -1, '1', null, undefined, {}]) expect(validEscala(x)).toBe(false);
  });
});

describe('validFrame', () => {
  it('aceita 2x2 com buffer de 16 bytes', () => { expect(validFrame({ w: 2, h: 2, buffer: new ArrayBuffer(16) })).toBe(true); });
  it('rejeita w/h não inteiros, 0, >8192', () => {
    for (const [w, h] of [[1.5, 2], [2, 0], [0, 2], [8193, 1], [-2, -2], [NaN, 2]]) expect(validFrame({ w, h, buffer: new ArrayBuffer(Math.max(0, w * h * 4) | 0) })).toBe(false);
  });
  it('rejeita buffer de tamanho errado ou que não é ArrayBuffer', () => {
    expect(validFrame({ w: 2, h: 2, buffer: new ArrayBuffer(15) })).toBe(false);
    expect(validFrame({ w: 2, h: 2, buffer: new Uint8Array(16) })).toBe(false);
    expect(validFrame({ w: 2, h: 2, buffer: Array(16).fill(0) })).toBe(false);
  });
  it('rejeita null e objetos sem campos', () => {
    for (const x of [null, undefined, {}, { w: 2, h: 2 }, 'x', 5]) expect(validFrame(x)).toBe(false);
  });
});

describe('validFrame área', () => {
  const f = (w: number, h: number) => ({ w, h, buffer: new ArrayBuffer(w * h * 4) });
  it('aceita 3840x2160', () => { expect(validFrame(f(3840, 2160))).toBe(true); });
  it('rejeita área > 4096x4096', () => {
    expect(validFrame(f(8192, 8192))).toBe(false);
    expect(validFrame(f(5000, 4000))).toBe(false);
  });
});

import { validRecortes } from '../src/main/validate';
describe('validRecortes', () => {
  const c = (x: number, y: number, w: number, h: number, bytes = w * h * 4) => ({ x, y, w, h, buffer: new ArrayBuffer(bytes) });
  const m = (recortes: unknown, extra: Record<string, unknown> = {}) => ({ w: 100, h: 50, versao: 1, recortes, ...extra });
  it('aceita até 4 recortes dentro do quadro (e lista vazia)', () => {
    expect(validRecortes(m([c(0, 0, 10, 5), c(90, 45, 10, 5), c(1, 1, 1, 1), c(50, 20, 3, 3)]))).toBe(true);
    expect(validRecortes(m([]))).toBe(true);
  });
  it('rejeita mais de 4', () => { expect(validRecortes(m([c(0, 0, 1, 1), c(0, 0, 1, 1), c(0, 0, 1, 1), c(0, 0, 1, 1), c(0, 0, 1, 1)]))).toBe(false); });
  it('rejeita dimensões não inteiras/zero/negativas e posição inválida', () => {
    for (const r of [c(0, 0, 1.5, 2, 12), c(0, 0, 0, 2, 0), c(0, 0, -1, 2, 0), c(-1, 0, 1, 1), c(0.5, 0, 1, 1), c(NaN, 0, 1, 1)]) expect(validRecortes(m([r]))).toBe(false);
  });
  it('rejeita buffer com tamanho errado ou que não é ArrayBuffer', () => {
    expect(validRecortes(m([c(0, 0, 2, 2, 15)]))).toBe(false);
    expect(validRecortes(m([{ x: 0, y: 0, w: 1, h: 1, buffer: new Uint8Array(4) }]))).toBe(false);
  });
  it('rejeita recorte fora do quadro', () => {
    expect(validRecortes(m([c(95, 0, 6, 1)]))).toBe(false);
    expect(validRecortes(m([c(0, 49, 1, 2)]))).toBe(false);
  });
  it('rejeita área total maior que o quadro', () => {
    expect(validRecortes(m([c(0, 0, 100, 50), c(0, 0, 1, 1)]))).toBe(false);
    expect(validRecortes(m([c(0, 0, 100, 50)]))).toBe(true);
  });
  it('rejeita quadro inválido, versão inválida e formatos errados', () => {
    for (const x of [null, 1, 'x', {}, m('a'), m({}), m([null]), m([], { w: 0 }), m([], { w: 5000, h: 5000 }), m([], { versao: -1 }), m([], { versao: 1.5 }), m([], { versao: '1' })]) expect(validRecortes(x)).toBe(false);
  });
});

import { validAddUrl, validQuestId, posicaoVisivel } from '../src/main/validate';
describe('validAddUrl / validQuestId', () => {
  const D = ['meowdb.com', 'niadb.com'];
  it('src:add exige https, domínio permitido e ≤ 500', () => {
    expect(validAddUrl('https://meowdb.com/msclassic/guides/x', D)).toBe(true);
    expect(validAddUrl('http://meowdb.com/msclassic/guides/x', D)).toBe(false);
    expect(validAddUrl('https://evil.com/x', D)).toBe(false);
    expect(validAddUrl('https://meowdb.com/' + 'a'.repeat(482), D)).toBe(false);
    expect(validAddUrl('https://meowdb.com/' + 'a'.repeat(481), D)).toBe(true);
    for (const x of [null, 1, {}, []]) expect(validAddUrl(x, D)).toBe(false);
  });
  it('quest:toggle: string de 1 a 200', () => {
    expect(validQuestId('q-1')).toBe(true);
    expect(validQuestId('a'.repeat(200))).toBe(true);
    for (const x of ['', 'a'.repeat(201), null, 1, {}]) expect(validQuestId(x)).toBe(false);
  });
});

describe('posicaoVisivel', () => {
  const tam = { w: 340, h: 64 };
  const prim = { x: 0, y: 0, width: 1920, height: 1040 }, seg = { x: 1920, y: 0, width: 1366, height: 728 };
  it('mantém posição visível (inclusive no 2º monitor) e posição ausente', () => {
    expect(posicaoVisivel({ x: 100, y: 100 }, tam, [prim, seg], prim)).toEqual({ x: 100, y: 100 });
    expect(posicaoVisivel({ x: 2000, y: 50 }, tam, [prim, seg], prim)).toEqual({ x: 2000, y: 50 });
    expect(posicaoVisivel({ x: -300, y: 10 }, tam, [prim], prim)).toEqual({ x: -300, y: 10 }); // 40 px ainda à vista
    expect(posicaoVisivel({}, tam, [prim], prim)).toEqual({});
  });
  it('fora de todas as áreas (monitor desconectado) ou com menos de 40 px à vista: canto superior direito do principal', () => {
    const canto = { x: 1920 - 340 - 16, y: 16 };
    expect(posicaoVisivel({ x: 2000, y: 50 }, tam, [prim], prim)).toEqual(canto);
    expect(posicaoVisivel({ x: -301, y: 10 }, tam, [prim], prim)).toEqual(canto);
    expect(posicaoVisivel({ x: 100, y: 1040 - 39 }, tam, [prim], prim)).toEqual(canto);
    expect(posicaoVisivel({ x: NaN, y: 0 }, tam, [prim], prim)).toEqual(canto);
  });
});
