import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isAllowedUrl } from './allowlist';
import { parseGuide } from './parser';
import type { ParsedGuide, SourceData } from '../types';

type Opts = { dominios: string[]; cacheDir: string; fetchFn?: typeof fetch };
const EMPTY: ParsedGuide = { title: '', maps: [], quests: [], expRows: [], tips: [] };

const counts = (g: ParsedGuide) =>
  ({ maps: g.maps.length, quests: g.quests.length, expRows: g.expRows.length, tips: g.tips.length });

export async function loadSource(url: string, o: Opts): Promise<SourceData> {
  if (!isAllowedUrl(url, o.dominios)) throw new Error('domínio não permitido');
  fs.mkdirSync(o.cacheDir, { recursive: true });
  const file = path.join(o.cacheDir, createHash('sha1').update(url).digest('hex') + '.json');
  try {
    const r = await (o.fetchFn ?? fetch)(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const g = parseGuide(await r.text(), url);
    const c = counts(g);
    const empty = !(c.maps || c.quests || c.expRows || c.tips);
    const data: SourceData = { ...g, source: { url, title: g.title || url, fetchedAt: Date.now(), status: empty ? 'vazio' : 'ok', counts: c } };
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (fs.existsSync(file)) {
      const cached: SourceData = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ...cached, source: { ...cached.source, status: 'erro', error: msg } };
    }
    return { ...EMPTY, source: { url, title: url, fetchedAt: 0, status: 'erro', error: msg, counts: counts(EMPTY) } };
  }
}
