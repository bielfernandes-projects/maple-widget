import { describe, it, expect } from 'vitest';
import { crop, binarize, isBlack, bgraToImg } from '../src/capture/image';
import type { Img } from '../src/types';

const solid = (w: number, h: number, rgb: [number, number, number]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { w, h, data };
};

describe('image', () => {
  it('crop usa região normalizada', () => {
    const c = crop(solid(100, 50, [1, 2, 3]), { x: 0.5, y: 0.5, w: 0.2, h: 0.4 });
    expect([c.w, c.h]).toEqual([20, 20]);
  });
  it('isBlack detecta captura preta', () => {
    expect(isBlack(solid(40, 40, [0, 0, 0]))).toBe(true);
    expect(isBlack(solid(40, 40, [90, 90, 90]))).toBe(false);
  });
  it('binarize gera texto preto em fundo branco, ampliado e com borda', () => {
    const b = binarize(solid(4, 4, [255, 255, 255]), (r) => r > 200, 2);
    expect([b.w, b.h]).toEqual([4 * 2 + 16, 4 * 2 + 16]);
    expect(b.data[0]).toBe(255); // borda branca
    const mid = ((b.h / 2) * b.w + b.w / 2) * 4;
    expect(b.data[mid]).toBe(0); // miolo = primeiro plano = preto
  });
  it('bgraToImg troca B e R', () => {
    const i = bgraToImg(Buffer.from([10, 20, 30, 255]), 1, 1);
    expect([...i.data]).toEqual([30, 20, 10, 255]);
  });
});

import { montarImg } from '../src/capture/image';
describe('montarImg', () => {
  const rec = (x: number, y: number, w: number, h: number, v: number) => ({ x, y, w, h, data: new Uint8ClampedArray(w * h * 4).fill(v) });
  it('tamanho do quadro, recortes nas posições e resto zerado', () => {
    const m = montarImg(6, 4, [rec(1, 1, 2, 2, 9), rec(5, 0, 1, 1, 7)]);
    expect([m.w, m.h, m.data.length]).toEqual([6, 4, 96]);
    const px = (x: number, y: number) => m.data[(y * 6 + x) * 4];
    expect([px(1, 1), px(2, 1), px(1, 2), px(2, 2), px(5, 0)]).toEqual([9, 9, 9, 9, 7]);
    expect([px(0, 0), px(3, 1), px(1, 3), px(4, 0), px(5, 1)]).toEqual([0, 0, 0, 0, 0]);
    expect(m.data.reduce((a, b) => a + b, 0)).toBe(16 * 9 + 4 * 7);
  });
  it('sem recortes: tudo zerado', () => { expect(montarImg(2, 2, []).data.every((b) => b === 0)).toBe(true); });
  it('rejeita recorte fora dos limites ou com dados do tamanho errado', () => {
    expect(() => montarImg(6, 4, [rec(5, 0, 2, 1, 1)])).toThrow();
    expect(() => montarImg(6, 4, [rec(0, 3, 1, 2, 1)])).toThrow();
    expect(() => montarImg(6, 4, [rec(-1, 0, 1, 1, 1)])).toThrow();
    expect(() => montarImg(6, 4, [{ ...rec(0, 0, 2, 2, 1), data: new Uint8ClampedArray(4) }])).toThrow();
  });
});
