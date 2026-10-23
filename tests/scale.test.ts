import { describe, expect, it } from 'vitest';
import { escalasCandidatas, resizeImg } from '../src/capture/scale';
import type { Img } from '../src/types';

const mk = (w: number, h: number, f: (x: number, y: number) => [number, number, number]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = f(x, y); const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { w, h, data };
};
const px = (im: Img, x: number, y: number) => Array.from(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4));

describe('resizeImg', () => {
  it('escala 1 mantém dimensões e conteúdo', () => {
    const a = mk(3, 2, (x, y) => [x * 50, y * 70, 9]);
    const b = resizeImg(a, 1);
    expect([b.w, b.h]).toEqual([3, 2]);
    expect(Array.from(b.data)).toEqual(Array.from(a.data));
  });
  it('0.5 em 4x4 devolve 2x2 com a média de cada bloco', () => {
    const a = mk(4, 4, (x, y) => [x * 10 + y * 40, 0, (x + y) % 2 ? 200 : 0]);
    const b = resizeImg(a, 0.5);
    expect([b.w, b.h]).toEqual([2, 2]);
    // bloco (0,0): r = 0,10,40,50 → 25 ; b = 0,200,200,0 → 100
    expect(px(b, 0, 0)).toEqual([25, 0, 100, 255]);
    expect(px(b, 1, 0)).toEqual([45, 0, 100, 255]);
    expect(px(b, 0, 1)).toEqual([105, 0, 100, 255]);
    expect(px(b, 1, 1)).toEqual([125, 0, 100, 255]);
  });
  it('2 em 2x2 devolve 4x4 bilinear com cantos preservados', () => {
    const a = mk(2, 2, (x, y) => [x ? 200 : 0, y ? 100 : 0, 50]);
    const b = resizeImg(a, 2);
    expect([b.w, b.h]).toEqual([4, 4]);
    expect(px(b, 0, 0)).toEqual(px(a, 0, 0));
    expect(px(b, 3, 0)).toEqual(px(a, 1, 0));
    expect(px(b, 0, 3)).toEqual(px(a, 0, 1));
    expect(px(b, 3, 3)).toEqual(px(a, 1, 1));
    const r1 = px(b, 1, 0)[0], r2 = px(b, 2, 0)[0];
    expect(r1).toBeGreaterThan(0); expect(r1).toBeLessThan(200);
    expect(r2).toBeGreaterThan(r1); expect(r2).toBeLessThan(200);
  });
  it('cor constante é preservada em qualquer escala', () => {
    const a = mk(7, 5, () => [12, 34, 56]);
    for (const s of [0.25, 0.5, 0.6667, 0.8, 1.25, 1.5, 4]) {
      const b = resizeImg(a, s);
      for (let i = 0; i < b.w * b.h; i++) expect(px(b, i % b.w, Math.floor(i / b.w))).toEqual([12, 34, 56, 255]);
    }
  });
  it('escala inválida devolve cópia do mesmo tamanho', () => {
    const a = mk(3, 3, (x, y) => [x, y, 0]);
    for (const s of [NaN, 0, 10, Infinity, -1]) {
      const b = resizeImg(a, s);
      expect([b.w, b.h]).toEqual([3, 3]);
      expect(Array.from(b.data)).toEqual(Array.from(a.data));
      expect(b.data).not.toBe(a.data);
    }
  });
  it('escalasCandidatas contém 1 e só valores 0.25–4', () => {
    expect(escalasCandidatas).toContain(1);
    for (const s of escalasCandidatas) { expect(s).toBeGreaterThanOrEqual(0.25); expect(s).toBeLessThanOrEqual(4); }
  });
});
