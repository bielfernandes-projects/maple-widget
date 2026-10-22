import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseSitemap } from '../src/sources/discover';
import { syncAuto } from '../src/sources/sync';
import { loadSource, readCache } from '../src/sources/load';
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
const run = (dir: string, f: typeof fetch, manual: string[] = [], fixas?: string[]) =>
  syncAuto({ sitemapUrl: SITEMAP, dominios: D, cacheDir: dir, manual, fixas, fetchFn: f });

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

describe('syncAuto robustez', () => {
  const idx = (dir: string) => path.join(dir, 'auto-index.json');
  const SMF = '<?xml version="1.0"?><urlset><url><loc>https://meowdb.com/msclassic/guides/g-a</loc><lastmod>1</lastmod></url></urlset>';
  const off = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  const fixed = (body: string) => (async (u: string) => new Response(u === SITEMAP ? body : GUIDE)) as unknown as typeof fetch;

  it('(a) offline + índice corrompido não lança', async () => {
    const dir = tmp(); fs.writeFileSync(idx(dir), 'not json');
    const r = await run(dir, off);
    expect(r.offline).toBe(true);
    expect(r.data).toEqual([]);
  });
  it('(b) índice com formato inválido usa só entradas válidas', async () => {
    for (const bad of ['{}', 'null', '[null, 1, {"url":5}]']) {
      const dir = tmp(); fs.writeFileSync(idx(dir), bad);
      const r = await run(dir, off);
      expect(r.offline).toBe(true);
      expect(r.data).toEqual([]);
    }
  });
  it('(c) sitemap inválido (HTML/vazio) mantém cache e índice', async () => {
    for (const body of ['<html><body>oops</body></html>', '']) {
      const dir = tmp(); await run(dir, net({ a: '1', b: '1' }).f);
      const antes = fs.readFileSync(idx(dir), 'utf8');
      const r = await run(dir, fixed(body));
      expect(r.offline).toBe(true);
      expect(r.data.length).toBe(2);
      expect(fs.readFileSync(idx(dir), 'utf8')).toBe(antes);
    }
  });
  it('(d) manual com string vazia na frente processa as válidas', async () => {
    const n = net({ a: '1', b: '1' });
    const r = await run(tmp(), n.f, ['', 'https://meowdb.com/msclassic/guides/g-x', 'https://meowdb.com/msclassic/guides/g-y']);
    expect(r.data.length).toBe(4);
    expect(n.calls.length).toBe(5);
  });
  it('(e) falha ao gravar o índice não vira offline', async () => {
    const dir = tmp(); fs.mkdirSync(idx(dir));
    const r = await run(dir, net({ a: '1', b: '1' }).f);
    expect(r.offline).toBe(false);
    expect(r.data.length).toBe(2);
  });
  it('(f) sem lastmod: não rebaixa até passar 6h', async () => {
    const dir = tmp();
    const calls: string[] = [];
    const f = (async (u: string) => { calls.push(u); return new Response(u === SITEMAP
      ? SMF.replace('<lastmod>1</lastmod>', '') : GUIDE); }) as unknown as typeof fetch;
    await run(dir, f);
    expect(calls.length).toBe(2);
    await run(dir, f);
    expect(calls.length).toBe(3);
    const file = path.join(dir, createHash('sha1').update('https://meowdb.com/msclassic/guides/g-a').digest('hex') + '.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    d.source.fetchedAt = Date.now() - 7 * 3_600_000;
    fs.writeFileSync(file, JSON.stringify(d));
    await run(dir, f);
    expect(calls.length).toBe(5);
  });
  it('(g) atualizados exclui cargas que falham', async () => {
    const f = (async (u: string) => {
      if (u.endsWith('g-b')) throw new Error('boom');
      return new Response(u === SITEMAP ? SM('1', '1') : GUIDE);
    }) as unknown as typeof fetch;
    const r = await run(tmp(), f);
    expect(r.atualizados).toBe(1);
  });
  it('(h) manual que não é array não lança', async () => {
    const r = await syncAuto({ sitemapUrl: SITEMAP, dominios: D, cacheDir: tmp(), manual: undefined as any, fetchFn: net({ a: '1', b: '1' }).f });
    expect(r.data.length).toBe(2);
  });
});

describe('cache com formato inválido', () => {
  const U = 'https://meowdb.com/msclassic/guides/g-a';
  const cf = (dir: string, u: string) => path.join(dir, createHash('sha1').update(u).digest('hex') + '.json');
  const off = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

  it('(i) cache {} offline: não lança e guia ausente', async () => {
    const dir = tmp(); fs.writeFileSync(cf(dir, U), '{}');
    const r = await run(dir, off, [U]);
    expect(r.offline).toBe(true);
    expect(r.data.some((d) => d.source.url === U)).toBe(false);
  });
  it('(ii) cache {} online: baixa de novo', async () => {
    const dir = tmp(); fs.writeFileSync(cf(dir, U), '{}');
    const r = await run(dir, net({ a: '1', b: '1' }).f, [U]);
    expect(r.data.find((d) => d.source.url === U)?.source.status).toBe('ok');
  });
  it('(iii) readCache rejeita formatos inválidos e lê cache real', async () => {
    const dir = tmp();
    for (const bad of ['[]', '42', '{"source":{"url":5}}', '{"source":{"url":"u","status":"ok"}}']) {
      fs.writeFileSync(cf(dir, U), bad);
      expect(readCache(dir, U)).toBeUndefined();
    }
    await loadSource(U, { dominios: D, cacheDir: dir, fetchFn: net({ a: '1', b: '1' }).f });
    expect(readCache(dir, U)?.source.url).toBe(U);
  });
  it('(iv) rede de segurança: cacheDir inválido não rejeita', async () => {
    const r = await syncAuto({ sitemapUrl: SITEMAP, dominios: D, cacheDir: null as any, manual: [], fetchFn: net({ a: '1', b: '1' }).f });
    expect(r.data).toEqual([]);
    expect(r.offline).toBe(true);
  });
});

describe('syncAuto fontes fixas', () => {
  const FIX = 'https://meowdb.com/msclassic/quest-tracker/all';
  it('(a) fixa fora do sitemap: auto, não rebaixa, rebaixa após 6h', async () => {
    const dir = tmp(); const n = net({ a: '1', b: '1' });
    const r = await run(dir, n.f, [], [FIX]);
    expect(r.data.find((d) => d.source.url === FIX)?.source.auto).toBe(true);
    expect(n.calls.length).toBe(4);
    const r2 = await run(dir, n.f, [], [FIX]);
    expect(n.calls.length).toBe(5);
    expect(r2.data.find((d) => d.source.url === FIX)?.source.auto).toBe(true);
    const file = path.join(dir, createHash('sha1').update(FIX).digest('hex') + '.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    d.source.fetchedAt = Date.now() - 7 * 3_600_000;
    fs.writeFileSync(file, JSON.stringify(d));
    await run(dir, n.f, [], [FIX]);
    expect(n.calls.length).toBe(7);
  });
  it('(b) fixa que também está no sitemap não duplica', async () => {
    const g = 'https://meowdb.com/msclassic/guides/g-a';
    const r = await run(tmp(), net({ a: '1', b: '1' }).f, [], [g]);
    expect(r.data.filter((d) => d.source.url === g).length).toBe(1);
    expect(r.data.length).toBe(2);
  });
  it('(c) fixas inválidas são ignoradas', async () => {
    for (const bad of [undefined, 42, ['', 5, null]] as any[]) {
      const r = await run(tmp(), net({ a: '1', b: '1' }).f, [], bad);
      expect(r.data.length).toBe(2);
    }
  });
});

describe('PARSER_VERSION no cache', () => {
  const stale = (dir: string) => {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'auto-index.json')) {
      const p = path.join(dir, f); const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.source.parserVersion = 1; fs.writeFileSync(p, JSON.stringify(j));
    }
  };
  it('cache de parser antigo é rebaixado uma vez online', async () => {
    const dir = tmp(); const n = net({ a: '1', b: '1' });
    await run(dir, n.f); stale(dir);
    const r1 = await run(dir, n.f);
    expect(r1.atualizados).toBe(2);
    expect(n.calls.length).toBe(3 + 1 + 2);
    const r2 = await run(dir, n.f);
    expect(r2.atualizados).toBe(0);
    expect(n.calls.length).toBe(3 + 1 + 2 + 1);
  });
  it('offline serve o cache antigo sem rebaixar', async () => {
    const dir = tmp(); await run(dir, net({ a: '1', b: '1' }).f); stale(dir);
    const off = net({ a: '1', b: '1', offline: true });
    const r = await run(dir, off.f);
    expect(r.offline).toBe(true);
    expect(r.data.length).toBe(2);
    expect(off.calls).toEqual([SITEMAP]);
  });
  it('cache atual não é rebaixado', async () => {
    const dir = tmp(); const n = net({ a: '1', b: '1' });
    await run(dir, n.f);
    expect(readCache(dir, 'https://meowdb.com/msclassic/guides/g-a')?.source.parserVersion).toBe(3);
    await run(dir, n.f);
    expect(n.calls.length).toBe(4);
  });
});
