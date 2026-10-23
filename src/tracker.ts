import { makeExpToNext } from './advisor';
import type { Estado, ExpRow, Reading } from './types';

const JANELA_MS = 10 * 60_000;
const SPAN_MIN_MS = 30_000;
const CONFIRMA_LEVEL = 2; // mudança de level e ganho grande exigem 2 leituras seguidas
const CONFIRMA_QUEDA = 3; // queda de EXP real (morte) só é aceita se repetida
const GANHO_MAX_FRAC = 0.25; // ganho acima de 25% do level é suspeito (misread de OCR)

type Snap = { level: number; expAbs: number; expPct: number };

export function createTracker(expToNext: (level: number) => number | undefined) {
  let last: Snap | null = null;
  let est: Estado | null = null;
  let total = 0;
  let cand: { level: number; expAbs: number; n: number } | null = null;
  let samples: { t: number; total: number }[] = [];

  const descarta = () => (est ? (est = { ...est, semLeitura: true, upou: false }) : null);

  const emite = (r: Reading, s: Snap, upou: boolean): Estado => {
    samples.push({ t: r.t, total });
    samples = samples.filter((x) => r.t - x.t <= JANELA_MS);
    const first = samples[0];
    const span = r.t - first.t;
    const expPorHora = span >= SPAN_MIN_MS ? (total - first.total) / (span / 3_600_000) : 0;
    return (est = {
      level: s.level, expAbs: s.expAbs, expPct: s.expPct,
      classe: r.cls ?? est?.classe, mapa: r.map ?? est?.mapa,
      expPorHora, upou, semLeitura: false,
    });
  };

  return {
    push(r: Reading): Estado | null {
      if (r.level === undefined || r.expAbs === undefined) return descarta();
      // ponytail: sem expPct e sem leitura anterior, guarda 0 (primeira leitura apenas)
      const cur: Snap = { level: r.level, expAbs: r.expAbs, expPct: r.expPct ?? last?.expPct ?? 0 };
      if (!last) {
        last = cur;
        return emite(r, cur, false);
      }

      const falta = expToNext(last.level);
      const ganho = cur.expAbs - last.expAbs;
      const mudouLevel = cur.level !== last.level;
      const queda = !mudouLevel && ganho < 0;
      const ganhoGrande = !mudouLevel && falta !== undefined && ganho > GANHO_MAX_FRAC * falta;

      if (!mudouLevel && !queda && !ganhoGrande) {
        cand = null;
        total += ganho;
        last = cur;
        return emite(r, cur, false);
      }

      // leitura suspeita: não aplica ainda, acumula confirmação
      if (cand && cur.level === cand.level && cur.expAbs >= cand.expAbs) {
        cand.n++;
        cand.expAbs = cur.expAbs;
      } else {
        cand = { level: cur.level, expAbs: cur.expAbs, n: 1 };
      }
      const exigido = (mudouLevel || ganhoGrande) ? CONFIRMA_LEVEL : CONFIRMA_QUEDA;
      if (cand.n < exigido) return descarta();

      const c = cand;
      cand = null;
      const conf: Snap = { level: c.level, expAbs: c.expAbs, expPct: cur.expPct };
      if (mudouLevel) {
        const subiu = c.level === last.level + 1;
        if (subiu && falta !== undefined) total += Math.max(0, falta - last.expAbs) + c.expAbs;
        last = conf;
        return emite(r, conf, subiu);
      }
      if (ganhoGrande) total += c.expAbs - last.expAbs;
      last = conf;
      return emite(r, conf, false);
    },
  };
}

// Um tracker para a vida toda do processo: trocar a biblioteca (sync) só troca a tabela de EXP, sem zerar amostras/total.
export function createTrackerComTabela(rows: ExpRow[] = []) {
  let expToNext = makeExpToNext(rows);
  const t = createTracker((lv) => expToNext(lv));
  return { push: t.push, setTabela(r: ExpRow[]) { expToNext = makeExpToNext(r); } };
}
