import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isAllowedUrl } from '../src/sources/allowlist';
import { loadSource } from '../src/sources/load';
import { Store, DEFAULT_CONFIG } from '../src/store';

const D = ['meowdb.com', 'niadb.com'];
const html = fs.readFileSync(path.join(__dirname, 'fixtures/guides/exp-table-level-1-to-100.html'), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
const ok = (body: string) => (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
const fail = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
const URL1 = 'https://meowdb.com/msclassic/guides/exp-table-level-1-to-100';

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
});
