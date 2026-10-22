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
