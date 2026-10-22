import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSitemap } from '../src/sources/discover';
import { syncAuto } from '../src/sources/sync';
import { Store } from '../src/store';

const SITEMAP = 'https://meowdb.com/msclassic/sitemap.xml';
const D = ['meowdb.com'];
const SM = (a: string, b: string) => `<?xml version="1.0"?><urlset>
<url><loc>https://meowdb.com/msclassic/guides</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
<url><loc>https://meowdb.com/msclassic/guides/g-a</loc><lastmod>${a}</lastmod></url>
<url><loc>https://meowdb.com/msclassic/guides/g-b</loc><lastmod>${b}</lastmod></url>
<url><loc>https://meowdb.com/msclassic/monsters/123</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
</urlset>`;
const GUIDE = '<main><h1>G</h1><table><tr><th>Level</th><th>EXP to next</th></tr><tr><td>1</td><td>15</td></tr></table></main>';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-sync-'));

function net(state: { a: string; b: string; offline?: boolean }) {
  const calls: string[] = [];
  const f = (async (u: string) => {
    calls.push(u);
    if (state.offline) throw new Error('offline');
    return new Response(u === SITEMAP ? SM(state.a, state.b) : GUIDE);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const run = (dir: string, f: typeof fetch, manual: string[] = []) =>
  syncAuto({ sitemapUrl: SITEMAP, dominios: D, cacheDir: dir, manual, fetchFn: f });

describe('parseSitemap', () => {
  it('só guias, sem o índice nem outras entidades, preservando lastmod', () => {
    expect(parseSitemap(SM('x', 'y'))).toEqual([
      { url: 'https://meowdb.com/msclassic/guides/g-a', lastmod: 'x' },
      { url: 'https://meowdb.com/msclassic/guides/g-b', lastmod: 'y' },
    ]);
  });
});

describe('syncAuto', () => {
  it('primeira sync: sitemap + todos os guias, marcados como automáticos', async () => {
    const n = net({ a: '1', b: '1' });
    const r = await run(tmp(), n.f);
    expect(r.data.length).toBe(2);
    expect(r.data.every((d) => d.source.auto)).toBe(true);
    expect(r.descobertos).toBe(2);
    expect(r.atualizados).toBe(2);
    expect(r.offline).toBe(false);
    expect(n.calls.length).toBe(3);
  });
  it('segunda sync sem mudanças só baixa o sitemap', async () => {
    const dir = tmp(); const n = net({ a: '1', b: '1' });
    await run(dir, n.f);
    const r = await run(dir, n.f);
    expect(n.calls.length).toBe(4);
    expect(r.atualizados).toBe(0);
    expect(r.data.length).toBe(2);
  });
  it('guia com lastmod novo é rebaixado; os outros não', async () => {
    const dir = tmp(); const state = { a: '1', b: '1' }; const n = net(state);
    await run(dir, n.f);
    state.b = '2';
    const r = await run(dir, n.f);
    expect(r.atualizados).toBe(1);
    expect(n.calls.length).toBe(3 + 2); // sitemap + 1 guia
  });
  it('guia novo no site entra na próxima sync', async () => {
    const dir = tmp(); const state = { a: '1', b: '1' };
    await run(dir, net(state).f);
    const f = (async (u: string) => new Response(u === SITEMAP
      ? SM('1', '1').replace('</urlset>', '<url><loc>https://meowdb.com/msclassic/guides/g-c</loc><lastmod>3</lastmod></url></urlset>')
      : GUIDE)) as unknown as typeof fetch;
    const r = await run(dir, f);
    expect(r.data.map((d) => d.source.url).sort()).toEqual([
      'https://meowdb.com/msclassic/guides/g-a', 'https://meowdb.com/msclassic/guides/g-b', 'https://meowdb.com/msclassic/guides/g-c']);
  });
  it('offline usa o cache e sinaliza', async () => {
    const dir = tmp(); const state = { a: '1', b: '1', offline: false };
    await run(dir, net(state).f);
    state.offline = true;
    const r = await run(dir, net(state).f);
    expect(r.offline).toBe(true);
    expect(r.data.length).toBe(2);
  });
  it('fonte manual fora do sitemap entra sem flag auto; domínio proibido é ignorado', async () => {
    const r = await run(tmp(), net({ a: '1', b: '1' }).f,
      ['https://meowdb.com/msclassic/guides/g-extra', 'https://evil.com/x']);
    const extra = r.data.find((d) => d.source.url.endsWith('g-extra'))!;
    expect(extra.source.auto).toBe(false);
    expect(r.data.some((d) => d.source.url.includes('evil.com'))).toBe(false);
    expect(r.data.length).toBe(3);
  });
});

describe('Store', () => {
  it('config antigo sem autoSync/sitemapUrl carrega com os padrões', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ gamePath: 'x', sources: ['u'] }));
    const c = new Store(dir).load();
    expect(c.gamePath).toBe('x');
    expect(c.autoSync).toBe(true);
    expect(c.sitemapUrl).toBe('https://meowdb.com/msclassic/sitemap.xml');
  });
});
