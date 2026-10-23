import { describe, it, expect } from 'vitest';
import { acharMapa, indiceDeMapas } from '../src/capture/mapname';

const idx = indiceDeMapas(['Corner', 'Snail Hunting Ground III', 'Snail Hunting Ground II', 'Henesys', 'Mushroom Town', 'Ab']);

describe('acharMapa', () => {
  it('corrige erros típicos de OCR (rn -> m) e numeral romano (II lido como ll)', () => {
    expect(acharMapa('Comer', idx)).toBe('Corner');
    expect(acharMapa('Snail Hunting Ground lll', idx)).toBe('Snail Hunting Ground III');
    expect(acharMapa('Snail Hunting Ground ll', idx)).toBe('Snail Hunting Ground II');
  });
  it('texto com região + mapa em linhas separadas', () => {
    expect(acharMapa('Maple Road\nHenesys', idx)).toBe('Henesys');
  });
  it('lixo ou texto sem parecido não vira nome de mapa; sem índice ou sem texto, undefined', () => {
    expect(acharMapa('qwxzv kjh', idx)).toBeUndefined();
    expect(acharMapa('Henesys', [])).toBeUndefined();
    expect(acharMapa(undefined, idx)).toBeUndefined();
  });
  it('nomes muito curtos ficam fora do índice (evita falso positivo)', () => {
    expect(acharMapa('Ab', idx)).toBeUndefined();
  });
});
