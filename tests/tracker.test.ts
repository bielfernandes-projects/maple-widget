import { describe, it, expect } from 'vitest';
import { createTracker } from '../src/tracker';

const R = (t: number, level: number, expAbs: number, extra = {}) => ({ t, level, expAbs, expPct: 1, ...extra });

describe('tracker', () => {
  it('null até a primeira leitura válida', () => {
    const tr = createTracker(() => 1000);
    expect(tr.push({ t: 0 })).toBeNull();
  });
  it('calcula EXP/h (100 exp em 60 s = 6000/h)', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 0));
    expect(tr.push(R(60_000, 5, 100))!.expPorHora).toBeCloseTo(6000);
  });
  it('level up soma o resto do level anterior', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 900));
    const e = tr.push(R(60_000, 6, 50))!;
    expect(e.upou).toBe(true);
    expect(e.level).toBe(6);
    expect(e.expPorHora).toBeCloseTo(9000); // 100 + 50 em 1 min
    expect(tr.push(R(61_000, 6, 60))!.upou).toBe(false);
  });
  it('descarta salto de level implausível', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 0));
    const e = tr.push(R(1000, 8, 0))!;
    expect(e.level).toBe(5);
    expect(e.semLeitura).toBe(true);
  });
  it('descarta queda de EXP, mas aceita após 3 leituras seguidas (morte)', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 500));
    expect(tr.push(R(1000, 5, 100))!.expAbs).toBe(500);
    expect(tr.push(R(2000, 5, 100))!.expAbs).toBe(500);
    expect(tr.push(R(3000, 5, 100))!.expAbs).toBe(100);
  });
  it('leitura sem level/exp mantém último estado marcado como semLeitura', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 10));
    const e = tr.push({ t: 1000 })!;
    expect(e.level).toBe(5);
    expect(e.semLeitura).toBe(true);
  });
});
