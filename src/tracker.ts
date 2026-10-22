import type { Estado, Reading } from './types';

const JANELA_MS = 10 * 60_000;
const SPAN_MIN_MS = 30_000;
const CONFIRMA_QUEDA = 3; // queda de EXP real (morte) só é aceita se repetida

export function createTracker(expToNext: (level: number) => number | undefined) {
  let last: { level: number; expAbs: number; expPct: number } | null = null;
  let est: Estado | null = null;
  let total = 0;
  let queda = 0;
  let samples: { t: number; total: number }[] = [];

  const descarta = () => (est ? (est = { ...est, semLeitura: true, upou: false }) : null);

  return {
    push(r: Reading): Estado | null {
      if (r.level === undefined || r.expAbs === undefined) return descarta();
      const cur = { level: r.level, expAbs: r.expAbs, expPct: r.expPct ?? last?.expPct ?? 0 };
      let upou = false;
      if (!last) {
        last = cur;
      } else if (cur.level === last.level) {
        if (cur.expAbs >= last.expAbs) { total += cur.expAbs - last.expAbs; queda = 0; last = cur; }
        else if (++queda < CONFIRMA_QUEDA) return descarta();
        else { queda = 0; last = cur; }
      } else if (cur.level === last.level + 1) {
        const falta = expToNext(last.level);
        if (falta !== undefined) total += Math.max(0, falta - last.expAbs) + cur.expAbs;
        upou = true; queda = 0; last = cur;
      } else {
        return descarta();
      }
      samples.push({ t: r.t, total });
      samples = samples.filter((s) => r.t - s.t <= JANELA_MS);
      const first = samples[0];
      const span = r.t - first.t;
      const expPorHora = span >= SPAN_MIN_MS ? (total - first.total) / (span / 3_600_000) : 0;
      return (est = {
        level: last.level, expAbs: last.expAbs, expPct: last.expPct,
        classe: r.cls ?? est?.classe, mapa: r.map ?? est?.mapa,
        expPorHora, upou, semLeitura: false,
      });
    },
  };
}
