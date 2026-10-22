import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isAllowedUrl } from './allowlist';
import { parseGuide } from './parser';
import { USER_AGENT } from './discover';
import type { ParsedGuide, SourceData } from '../types';

type Opts = { dominios: string[]; cacheDir: string; fetchFn?: typeof fetch; lastmod?: string; auto?: boolean };
const cacheFile = (dir: string, url: string) => path.join(dir, createHash('sha1').update(url).digest('hex') + '.json');
const EMPTY: ParsedGuide = { title: '', maps: [], quests: [], expRows: [], tips: [] };

const counts = (g: ParsedGuide) =>
  ({ maps: g.maps.length, quests: g.quests.length, expRows: g.expRows.length, tips: g.tips.length });

// Cache é best-effort: falha de escrita não pode descartar um download bem-sucedido.
function writeCache(dir: string, file: string, data: SourceData) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  } catch { /* ignora */ }
}

// Cache ausente ou corrompido equivale a "sem cache".
export function readCache(cacheDir: string, url: string): SourceData | undefined {
  try { return JSON.parse(fs.readFileSync(cacheFile(cacheDir, url), 'utf8')); } catch { return undefined; }
}

export async function loadSource(url: string, o: Opts): Promise<SourceData> {
  if (!isAllowedUrl(url, o.dominios)) throw new Error('domínio não permitido');
  const dir = o.cacheDir;
  const file = cacheFile(dir, url);
  try {
    const r = await (o.fetchFn ?? fetch)(url, { redirect: 'follow', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    // Redirecionamento não pode levar o conteúdo para fora do allowlist.
    const finalUrl = r.url || url;
    if (!isAllowedUrl(finalUrl, o.dominios)) throw new Error('redirecionamento fora do allowlist');
    const g = parseGuide(await r.text(), url);
    const c = counts(g);
    const empty = !(c.maps || c.quests || c.expRows || c.tips);
    const data: SourceData = { ...g, source: { url, title: g.title || url, fetchedAt: Date.now(), status: empty ? 'vazio' : 'ok', counts: c, lastmod: o.lastmod, auto: o.auto } };
    writeCache(dir, file, data);
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const cached = readCache(dir, url);
    if (cached) return { ...cached, source: { ...cached.source, status: 'erro', error: msg } };
    return { ...EMPTY, source: { url, title: url, fetchedAt: 0, status: 'erro', error: msg, counts: counts(EMPTY), lastmod: o.lastmod, auto: o.auto } };
  }
}
