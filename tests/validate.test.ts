import { describe, expect, it } from 'vitest';
import { validRegions, validResKey } from '../src/main/validate';

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
