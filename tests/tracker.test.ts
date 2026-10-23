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
  it('level up soma o resto do level anterior (exige 2 leituras do novo level)', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 900));
    const pend = tr.push(R(50_000, 6, 50))!; // 1ª leitura do level 6: pendente
    expect(pend.semLeitura).toBe(true);
    expect(pend.level).toBe(5);
    const e = tr.push(R(60_000, 6, 50))!; // confirmação
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

  // --- misreads de OCR ---
  it('misread isolado de level (13→14→13) não muda level, upou nem EXP/h', () => {
    const base = createTracker(() => 1000);
    base.push(R(0, 13, 0));
    const ref = base.push(R(60_000, 13, 100))!.expPorHora;
    expect(ref).toBeCloseTo(6000);

    const tr = createTracker(() => 1000);
    tr.push(R(0, 13, 0));
    const pend = tr.push(R(30_000, 14, 0))!;
    expect(pend.level).toBe(13);
    expect(pend.semLeitura).toBe(true);
    const e = tr.push(R(60_000, 13, 100))!;
    expect(e.level).toBe(13);
    expect(e.upou).toBe(false);
    expect(e.semLeitura).toBe(false);
    expect(e.expPorHora).toBeCloseTo(ref);
  });
  it('primeira leitura errada (level 9) é resincronizada após 2 leituras de level 13', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 9, 100));
    expect(tr.push(R(1_000, 13, 500))!.semLeitura).toBe(true);
    const e = tr.push(R(2_000, 13, 520))!;
    expect(e.level).toBe(13);
    expect(e.upou).toBe(false);
    expect(e.semLeitura).toBe(false);
    expect(e.expAbs).toBe(520);
    const f = tr.push(R(62_000, 13, 600))!;
    // janela ancorada na leitura de baseline (t=0, total 0): 80 EXP em 62 s
    expect(f.expPorHora).toBeCloseTo(80 / (62_000 / 3_600_000));
  });
  it('misread isolado de EXP alto não infla total nem EXP/h', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 13, 500));
    expect(tr.push(R(30_000, 13, 5_000))!.semLeitura).toBe(true);
    const e = tr.push(R(60_000, 13, 600))!;
    expect(e.expAbs).toBe(600);
    expect(e.expPorHora).toBeCloseTo(6000); // só os 100 reais em 60 s
  });
  it('ganho grande real visto 2 vezes seguidas é creditado uma vez', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 13, 500));
    expect(tr.push(R(30_000, 13, 1_000))!.semLeitura).toBe(true);
    const e = tr.push(R(60_000, 13, 1_010))!;
    expect(e.expAbs).toBe(1_010);
    expect(e.semLeitura).toBe(false);
    expect(e.expPorHora).toBeCloseTo(510 * 60); // 510 EXP em 60 s, uma vez
  });

  // --- janela e casos de borda ---
  it('amostras com mais de 10 min saem da janela do EXP/h', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 0));
    tr.push(R(60_000, 5, 100));
    const e = tr.push(R(660_000, 5, 200))!;
    expect(e.expPorHora).toBeCloseTo(600); // 100 EXP em 10 min
  });
  it('span menor que 30 s → EXP/h 0', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 0));
    expect(tr.push(R(10_000, 5, 100))!.expPorHora).toBe(0);
  });
  it('expToNext indefinido no level up não quebra e não soma EXP', () => {
    const tr = createTracker(() => undefined);
    tr.push(R(0, 5, 900));
    tr.push(R(50_000, 6, 50));
    const e = tr.push(R(60_000, 6, 50))!;
    expect(e.level).toBe(6);
    expect(e.upou).toBe(true);
    expect(e.expPorHora).toBe(0);
  });
});

import { createTrackerComTabela } from '../src/tracker';
describe('createTrackerComTabela (nova biblioteca não zera o tracker)', () => {
  it('trocar a tabela preserva as amostras e o level up usa a tabela NOVA', () => {
    const tr = createTrackerComTabela([{ level: 10, toNext: 1000 }]);
    tr.push(R(0, 10, 100));
    const a = tr.push(R(60_000, 10, 200))!;
    expect(a.expPorHora).toBeCloseTo(6000); // 100 em 1 min
    tr.setTabela([{ level: 10, toNext: 500 }]);
    expect(tr.push(R(90_000, 10, 250))!.expPorHora).toBeCloseTo(150 / (90_000 / 3_600_000)); // janela continua desde t=0
    tr.push(R(100_000, 11, 50));
    const e = tr.push(R(120_000, 11, 50))!;
    expect(e.upou).toBe(true);
    // 150 até aqui + (500 - 250) + 50 = 450 em 2 min; com a tabela antiga seria 150 + 750 + 50
    expect(e.expPorHora).toBeCloseTo(450 / (120_000 / 3_600_000));
  });
});
