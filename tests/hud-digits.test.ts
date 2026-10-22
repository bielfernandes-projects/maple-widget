import { describe, it, expect } from 'vitest';
import { matchDigits, glyphBits, type Templates } from '../src/capture/hud';
import type { Img } from '../src/types';

// desenha glifos (matrizes 0/1) como pixels brancos sobre fundo preto, com 1 coluna vazia entre eles
function draw(glyphs: string[][], scale = 1): Img {
  const gh = glyphs[0].length, gw = glyphs[0][0].length;
  const w = (glyphs.length * (gw + 1) + 1) * scale, h = (gh + 2) * scale;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  glyphs.forEach((g, k) => g.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '1') return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const o = (((y + 1) * scale + dy) * w + (1 + k * (gw + 1) + x) * scale + dx) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255;
    }
  })));
  return { w, h, data };
}
const ONE = ['010', '110', '010', '010', '010', '010', '111'];
const SEVEN = ['111', '001', '001', '010', '010', '100', '100'];

describe('matchDigits', () => {
  // um template por digito E por escala (a distancia maxima de Hamming rejeita glifos que nao parecem com nenhum template)
  const T: Templates = { '1': glyphBits(draw([ONE])), '7': glyphBits(draw([SEVEN])), '1#3': glyphBits(draw([ONE], 3)), '7#3': glyphBits(draw([SEVEN], 3)) };
  it('lê glifos sintéticos em escala 1 e 3', () => {
    expect(matchDigits(draw([SEVEN, ONE, ONE]), T)).toBe(711);
    expect(matchDigits(draw([ONE, SEVEN], 3), T)).toBe(17);
  });
  it('glifo diferente de todos os templates -> undefined (gating)', () => {
    const BLOB = ['111', '111', '111', '111', '111', '111', '111'];
    expect(matchDigits(draw([BLOB]), T)).toBeUndefined();
  });
  it('sem glifos ou sem templates -> undefined', () => {
    expect(matchDigits(draw([ONE]), {})).toBeUndefined();
    expect(matchDigits({ w: 4, h: 4, data: new Uint8ClampedArray(64) }, T)).toBeUndefined();
  });
});
