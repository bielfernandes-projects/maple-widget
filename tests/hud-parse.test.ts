import { describe, it, expect } from 'vitest';
import { parseLevel, parseExp, parseMap, parseClass } from '../src/capture/hud';

describe('parsers da HUD', () => {
  it('parseLevel', () => {
    expect(parseLevel(' 13\n')).toBe(13);
    expect(parseLevel('1 3')).toBe(13);
    expect(parseLevel('')).toBeUndefined();
    expect(parseLevel('999')).toBeUndefined();
  });
  it('parseExp', () => {
    expect(parseExp('EXP. 1 [0.02%]')).toEqual({ expAbs: 1, expPct: 0.02 });
    expect(parseExp('EXP 1,234 [12.5%]')).toEqual({ expAbs: 1234, expPct: 12.5 });
    expect(parseExp('lixo')).toBeUndefined();
  });
  it('parseMap pega a última linha útil', () => {
    expect(parseMap('Victoria Road\nPerion Street Corner\n')).toBe('Perion Street Corner');
    expect(parseMap('\n')).toBeUndefined();
  });
  it('parseClass pega a primeira linha só com letras', () => {
    expect(parseClass('Archer\nzBingulim')).toBe('Archer');
    expect(parseClass('12')).toBeUndefined();
  });
});
