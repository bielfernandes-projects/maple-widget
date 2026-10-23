import { describe, it, expect } from 'vitest';
import { aparaFaixas, digitBitsSemBorda } from '../src/capture/hud';
import type { Img } from '../src/types';

// imagem w×h preta com retângulos brancos
const img = (w: number, h: number, brancos: [number, number, number, number][]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  for (const [x0, y0, x1, y1] of brancos) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([255, 255, 255, 255], (y * w + x) * 4);
  return { w, h, data };
};

describe('aparaFaixas', () => {
  it('tira as faixas claras do topo e da base (borda e preenchimento da barra de EXP)', () => {
    const r = aparaFaixas(img(20, 12, [[0, 0, 20, 2], [0, 10, 20, 12], [5, 5, 7, 8]]));
    expect(r.h).toBe(8); // sobram as linhas 2..9, com o glifo dentro
    expect(r.data.length).toBe(20 * 8 * 4);
  });
  it('sem faixas devolve a mesma imagem', () => {
    const a = img(20, 8, [[5, 2, 7, 6]]);
    expect(aparaFaixas(a)).toBe(a);
  });
  it('imagem toda clara não vira vazia (mantém o original)', () => {
    const a = img(10, 6, [[0, 0, 10, 6]]);
    expect(aparaFaixas(a).h).toBeGreaterThan(0);
  });
});

describe('digitBitsSemBorda', () => {
  it('ignora o glifo cortado colado na borda esquerda, mas não tira dígito quando há só um glifo', () => {
    expect(digitBitsSemBorda(img(30, 12, [[0, 2, 3, 10], [8, 2, 12, 10], [16, 2, 20, 10]]))).toHaveLength(2);
    expect(digitBitsSemBorda(img(30, 12, [[0, 2, 3, 10]]))).toHaveLength(1);
  });
});
