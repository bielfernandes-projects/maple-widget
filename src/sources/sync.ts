import fs from 'node:fs';
import path from 'node:path';
import { discoverGuides, type GuideRef } from './discover';
import { loadSource, readCache } from './load';
import type { SourceData } from '../types';

const MANUAL_TTL_MS = 6 * 3_600_000;
const CONCURRENCIA = 3;

export type SyncOpts = { sitemapUrl: string; dominios: string[]; cacheDir: string; manual: string[]; fetchFn?: typeof fetch };
export type SyncResult = { data: SourceData[]; descobertos: number; atualizados: number; offline: boolean };

export async function syncAuto(o: SyncOpts): Promise<SyncResult> {
  fs.mkdirSync(o.cacheDir, { recursive: true });
  const indexFile = path.join(o.cacheDir, 'auto-index.json');
  let refs: GuideRef[];
  let offline = false;
  try {
    refs = await discoverGuides(o);
    fs.writeFileSync(indexFile, JSON.stringify(refs));
  } catch {
    offline = true;
    refs = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
  }
  const porUrl = new Map(refs.map((r) => [r.url, r]));
  const urls = [...new Set([...refs.map((r) => r.url), ...o.manual])];
  const data: SourceData[] = [];
  let atualizados = 0;
  let i = 0;

  const worker = async () => {
    for (;;) {
      const url = urls[i++];
      if (!url) return;
      try {
        const ref = porUrl.get(url);
        const cached = readCache(o.cacheDir, url);
        const velho = !!cached && (ref
          ? cached.source.lastmod !== ref.lastmod
          : Date.now() - cached.source.fetchedAt > MANUAL_TTL_MS);
        const precisa = !offline && (!cached || cached.source.status === 'erro' || velho);
        if (!precisa) {
          if (cached) data.push({ ...cached, source: { ...cached.source, auto: !!ref } });
          continue;
        }
        data.push(await loadSource(url, { dominios: o.dominios, cacheDir: o.cacheDir, fetchFn: o.fetchFn, lastmod: ref?.lastmod, auto: !!ref }));
        atualizados++;
      } catch {
        // domínio recusado ou falha isolada: ignora só esta fonte
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCIA }, worker));
  data.sort((a, b) => a.source.url.localeCompare(b.source.url));
  return { data, descobertos: refs.length, atualizados, offline };
}
