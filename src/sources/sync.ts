import fs from 'node:fs';
import path from 'node:path';
import { discoverGuides, type GuideRef } from './discover';
import { loadSource, readCache } from './load';
import type { SourceData } from '../types';

const MANUAL_TTL_MS = 6 * 3_600_000;
const CONCURRENCIA = 3;

export type SyncOpts = { sitemapUrl: string; dominios: string[]; cacheDir: string; manual: string[]; fixas?: string[]; fetchFn?: typeof fetch };
export type SyncResult = { data: SourceData[]; descobertos: number; atualizados: number; offline: boolean };

// Roda a cada 30 min no main: nunca pode rejeitar.
export async function syncAuto(o: SyncOpts): Promise<SyncResult> {
  try { return await run(o); } catch { return { data: [], descobertos: 0, atualizados: 0, offline: true }; }
}

async function run(o: SyncOpts): Promise<SyncResult> {
  try { fs.mkdirSync(o.cacheDir, { recursive: true }); } catch { /* ignora */ }
  const indexFile = path.join(o.cacheDir, 'auto-index.json');
  let refs: GuideRef[];
  let offline = false;
  try {
    refs = await discoverGuides(o);
    try { fs.writeFileSync(indexFile, JSON.stringify(refs)); } catch { /* índice é best-effort */ }
  } catch {
    offline = true;
    try {
      const j = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      refs = Array.isArray(j)
        ? j.filter((e): e is GuideRef => !!e && typeof e === 'object' && typeof e.url === 'string' && typeof e.lastmod === 'string')
        : [];
    } catch { refs = []; }
  }
  const limpa = (l: unknown) => (Array.isArray(l) ? l : []).filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  const manual = limpa(o.manual);
  const fixas = limpa(o.fixas);
  const porUrl = new Map(refs.map((r) => [r.url, r]));
  const urls = [...new Set([...refs.map((r) => r.url), ...fixas, ...manual])];
  const data: SourceData[] = [];
  let atualizados = 0;
  let i = 0;

  const worker = async () => {
    for (;;) {
      if (i >= urls.length) return;
      const url = urls[i++];
      try {
        const ref = porUrl.get(url);
        const auto = !!ref || fixas.includes(url);
        const cached = readCache(o.cacheDir, url);
        const velho = !!cached && (ref
          ? cached.source.lastmod !== ref.lastmod || (!ref.lastmod && Date.now() - cached.source.fetchedAt > MANUAL_TTL_MS)
          : Date.now() - cached.source.fetchedAt > MANUAL_TTL_MS);
        const precisa = !offline && (!cached || cached.source.status === 'erro' || velho);
        if (!precisa) {
          if (cached) data.push({ ...cached, source: { ...cached.source, auto } });
          continue;
        }
        const d = await loadSource(url, { dominios: o.dominios, cacheDir: o.cacheDir, fetchFn: o.fetchFn, lastmod: ref?.lastmod, auto });
        data.push(d);
        if (d.source.status !== 'erro') atualizados++;
      } catch {
        // domínio recusado ou falha isolada: ignora só esta fonte
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCIA }, worker));
  data.sort((a, b) => a.source.url.localeCompare(b.source.url));
  return { data, descobertos: refs.length, atualizados, offline };
}
