import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isAllowedUrl } from '../src/sources/allowlist';
import { loadSource } from '../src/sources/load';
import { Store, DEFAULT_CONFIG } from '../src/store';

const D = ['meowdb.com', 'niadb.com'];
const html = fs.readFileSync(path.join(__dirname, 'fixtures/guides/exp-table-level-1-to-100.html'), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
const ok = (body: string) => (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
const fail = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
const URL1 = 'https://meowdb.com/msclassic/guides/exp-table-level-1-to-100';
const sha1File = (u: string) => createHash('sha1').update(u).digest('hex') + '.json';
const redirected = (body: string, finalUrl: string) => (async () => {
  const r = new Response(body, { status: 200 });
  Object.defineProperty(r, 'url', { value: finalUrl });
  return r;
}) as unknown as typeof fetch;

describe('allowlist', () => {
  it('aceita domínio e subdomínio, rejeita o resto', () => {
    expect(isAllowedUrl(URL1, D)).toBe(true);
    expect(isAllowedUrl('https://www.niadb.com/x', D)).toBe(true);
    expect(isAllowedUrl('https://evil.com/meowdb.com', D)).toBe(false);
    expect(isAllowedUrl('https://meowdb.com.evil.com/', D)).toBe(false);
    expect(isAllowedUrl('file:///c:/x', D)).toBe(false);
    expect(isAllowedUrl('lixo', D)).toBe(false);
  });
});

describe('loadSource', () => {
  it('baixa, parseia e cacheia', async () => {
    const dir = tmp();
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok(html) });
    expect(d.source.status).toBe('ok');
    expect(d.source.counts.expRows).toBeGreaterThanOrEqual(99);
    expect(fs.readdirSync(dir).length).toBe(1);
  });
  it('offline usa cache e marca erro', async () => {
    const dir = tmp();
    await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok(html) });
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: fail });
    expect(d.source.status).toBe('erro');
    expect(d.expRows.length).toBeGreaterThanOrEqual(99);
  });
  it('offline sem cache: erro e vazio', async () => {
    const d = await loadSource(URL1, { dominios: D, cacheDir: tmp(), fetchFn: fail });
    expect(d.source.status).toBe('erro');
    expect(d.expRows).toEqual([]);
  });
  it('página sem nada reconhecido vira vazio', async () => {
    const d = await loadSource(URL1, { dominios: D, cacheDir: tmp(), fetchFn: ok('<main><p>oi</p></main>') });
    expect(d.source.status).toBe('vazio');
  });
  it('rejeita domínio fora do allowlist sem chamar a rede', async () => {
    await expect(loadSource('https://evil.com/x', { dominios: D, cacheDir: tmp(), fetchFn: fail })).rejects.toThrow(/domínio/);
  });
});

describe('Store', () => {
  it('retorna default e persiste', () => {
    const dir = tmp();
    const s = new Store(dir);
    expect(s.load()).toEqual(DEFAULT_CONFIG);
    s.save({ ...DEFAULT_CONFIG, gamePath: 'X' });
    expect(new Store(dir).load().gamePath).toBe('X');
  });
  it('janela parcial é mesclada com o default', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ janela: { x: 5 } }));
    expect(new Store(dir).load().janela).toEqual({ expandido: false, x: 5 });
  });
  it('config antiga sem janelaJogo ganha o padrão', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ gamePath: 'Z' }));
    const c = new Store(dir).load();
    expect(c.janelaJogo).toBe('');
    expect(c.gamePath).toBe('Z');
  });
  it('tipos errados de janelaJogo/assistentePulado voltam ao padrão', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ janelaJogo: 5, assistentePulado: 'sim' }));
    const c = new Store(dir).load();
    expect(c.janelaJogo).toBe('');
    expect(c.assistentePulado).toBe(false);
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ janelaJogo: 'X', assistentePulado: true }));
    expect(new Store(dir).load()).toMatchObject({ janelaJogo: 'X', assistentePulado: true });
  });
  it('config que não é objeto volta ao default', () => {
    for (const txt of ['null', '[1,2]']) {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'config.json'), txt);
      expect(new Store(dir).load()).toEqual(DEFAULT_CONFIG);
    }
  });
  it('save não deixa arquivo .tmp', () => {
    const dir = tmp();
    new Store(dir).save({ ...DEFAULT_CONFIG, gamePath: 'Y' });
    expect(fs.readdirSync(dir)).toEqual(['config.json']);
  });
});

describe('redirect, cache corrompido e falha de escrita', () => {
  it('redirecionamento para fora do allowlist vira erro e não grava cache', async () => {
    const dir = tmp();
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: redirected(html, 'https://evil.com/x') });
    expect(d.source.status).toBe('erro');
    expect(d.source.error).toMatch(/redirecionamento/);
    expect(d.expRows).toEqual([]);
    expect(fs.existsSync(path.join(dir, sha1File(URL1)))).toBe(false);
  });
  it('redirecionamento para fora do allowlist usa o cache válido com status erro', async () => {
    const dir = tmp();
    await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok(html) });
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: redirected(html, 'https://evil.com/x') });
    expect(d.source.status).toBe('erro');
    expect(d.source.error).toMatch(/redirecionamento/);
    expect(d.expRows.length).toBeGreaterThanOrEqual(99);
  });
  it('cache corrompido não lança e vira erro vazio', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, sha1File(URL1)), 'not json');
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: fail });
    expect(d.source.status).toBe('erro');
    expect(d.expRows).toEqual([]);
  });
  it('cacheDir sob um arquivo não descarta download bem-sucedido', async () => {
    const blocker = path.join(tmp(), 'arquivo');
    fs.writeFileSync(blocker, 'x');
    const d = await loadSource(URL1, { dominios: D, cacheDir: path.join(blocker, 'cache'), fetchFn: ok(html) });
    expect(d.source.status).toBe('ok');
    expect(d.expRows.length).toBeGreaterThanOrEqual(99);
  });
});

describe('Store escalas', () => {
  it('padrão {} e descarta chaves/valores inválidos', () => {
    const dir = tmp();
    expect(new Store(dir).load().escalas).toEqual({});
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ escalas: { '1366x768': 0.75, '1920x1080': 1, 'abc': 1, '800x600': 9, '10x10': 'x', '5x5': 0.1 } }));
    expect(new Store(dir).load().escalas).toEqual({ '1366x768': 0.75, '1920x1080': 1 });
    for (const e of [null, [1], 'x', 5]) {
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ escalas: e }));
      expect(new Store(dir).load().escalas).toEqual({});
    }
  });
});

describe('Store escalas: chaves perigosas', () => {
  it('descarta __proto__ e constructor', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), '{"escalas":{"__proto__":1,"constructor":1,"800x600":0.8}}');
    const e = new Store(dir).load().escalas;
    expect(Object.keys(e)).toEqual(['800x600']);
    expect(Object.getPrototypeOf(e)).toBe(Object.prototype);
  });
});

describe('200 sem dados reconhecidos não destrói o cache bom', () => {
  it('com cache bom: devolve o cache com status erro e não regrava', async () => {
    const dir = tmp();
    await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok(html) });
    const f = path.join(dir, sha1File(URL1)), antes = fs.readFileSync(f, 'utf8');
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok('<html><body>Just a moment...</body></html>') });
    expect(d.source.status).toBe('erro');
    expect(d.source.error).toBe('página sem dados reconhecidos');
    expect(d.expRows.length).toBeGreaterThanOrEqual(99);
    expect(fs.readFileSync(f, 'utf8')).toBe(antes);
  });
  it('com cache também vazio: segue vazio', async () => {
    const dir = tmp();
    await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok('<main><p>oi</p></main>') });
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok('<main><p>oi</p></main>') });
    expect(d.source.status).toBe('vazio');
  });
});

import { manterSeVazio } from '../src/sources/sync';
describe('manterSeVazio', () => {
  const um = [{ source: { url: 'a' } }] as never[];
  it('lista nova vazia com antiga cheia: mantém a antiga', () => { expect(manterSeVazio([], um)).toBe(um); });
  it('lista nova com dados (ou as duas vazias): usa a nova', () => {
    const novo = [{ source: { url: 'b' } }] as never[];
    expect(manterSeVazio(novo, um)).toBe(novo);
    const vazio: never[] = [];
    expect(manterSeVazio(vazio, [])).toBe(vazio);
  });
});

describe('Store: padrões de sincronização não ficam presos no config', () => {
  it('salvar com os padrões não grava sitemapUrl/fontesFixas/dominios; carregar volta aos padrões', () => {
    const dir = tmp(), s = new Store(dir);
    s.save(structuredClone(DEFAULT_CONFIG));
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    expect(['sitemapUrl', 'fontesFixas', 'dominios'].filter((k) => k in j)).toEqual([]);
    const c = s.load();
    expect([c.sitemapUrl, c.fontesFixas, c.dominios]).toEqual([DEFAULT_CONFIG.sitemapUrl, DEFAULT_CONFIG.fontesFixas, DEFAULT_CONFIG.dominios]);
  });
  it('config antigo com os padrões gravados carrega os padrões atuais', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ sitemapUrl: DEFAULT_CONFIG.sitemapUrl, fontesFixas: DEFAULT_CONFIG.fontesFixas, dominios: DEFAULT_CONFIG.dominios }));
    const c = new Store(dir).load();
    expect(c.sitemapUrl).toBe(DEFAULT_CONFIG.sitemapUrl);
    expect(c.fontesFixas).toEqual(DEFAULT_CONFIG.fontesFixas);
  });
  it('valor personalizado é mantido ao salvar e carregar', () => {
    const dir = tmp(), s = new Store(dir);
    s.save({ ...structuredClone(DEFAULT_CONFIG), sitemapUrl: 'https://niadb.com/sitemap.xml', dominios: ['niadb.com'] });
    const c = s.load();
    expect(c.sitemapUrl).toBe('https://niadb.com/sitemap.xml');
    expect(c.dominios).toEqual(['niadb.com']);
    expect(c.fontesFixas).toEqual(DEFAULT_CONFIG.fontesFixas);
  });
});
