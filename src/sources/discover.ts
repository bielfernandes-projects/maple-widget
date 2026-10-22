import { isAllowedUrl } from './allowlist';

export type GuideRef = { url: string; lastmod: string };
export const USER_AGENT = 'maple-widget/0.1 (ferramenta pessoal; sincroniza guias do MapleStory Classic)';

export function parseSitemap(xml: string): GuideRef[] {
  const out: GuideRef[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>\s*(.*?)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    let u: URL;
    try { u = new URL(loc); } catch { continue; }
    if (!/^\/msclassic\/guides\/[^/]+$/.test(u.pathname)) continue;
    out.push({ url: u.origin + u.pathname, lastmod: m[1].match(/<lastmod>\s*(.*?)\s*<\/lastmod>/)?.[1] ?? '' });
  }
  return out;
}

export async function discoverGuides(o: { sitemapUrl: string; dominios: string[]; fetchFn?: typeof fetch }): Promise<GuideRef[]> {
  if (!isAllowedUrl(o.sitemapUrl, o.dominios)) throw new Error('domínio não permitido');
  const r = await (o.fetchFn ?? fetch)(o.sitemapUrl, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml = await r.text();
  if (!xml.includes('<urlset')) throw new Error('sitemap inválido');
  const refs = parseSitemap(xml).filter((g) => isAllowedUrl(g.url, o.dominios));
  if (!refs.length) throw new Error('sitemap inválido');
  return refs;
}
