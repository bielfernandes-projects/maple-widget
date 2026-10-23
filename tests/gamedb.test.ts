import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseMonster, parseIndice, parseSitemapMonstros, syncDb } from '../src/sources/gamedb';
import { buscar } from '../src/search';
import { validConsulta } from '../src/main/validate';
import type { GameDb, Monster } from '../src/types';

const fx = (n: string) => fs.readFileSync(path.join(__dirname, 'fixtures', 'db', n), 'utf8');
const URL1 = 'https://meowdb.com/msclassic/monsters/3';

describe('parseMonster', () => {
  it('lê nome, nível, EXP, HP e os mapas (Blue Snail)', () => {
    const m = parseMonster(fx('monsters-3.html'), URL1)!;
    expect(m.name).toBe('Blue Snail');
    expect([m.level, m.exp, m.hp]).toEqual([2, 4, 51]);
    expect(m.locais.length).toBe(41);
    expect(m.locais[0]).toMatchObject({ mapaId: '000000042', mapa: 'Snail Hunting Ground III', regiao: 'Maple Road', qtd: 21 });
    expect(m.iconUrl).toBe('https://meowdb.com/msclassic/monsters/sprites/mob_3.png');
  });
  it('página 404 ou sem nome vira null', () => {
    expect(parseMonster('<title>Page not found | NiaMeowDB</title><h1>x</h1>', URL1)).toBeNull();
    expect(parseMonster('<html></html>', URL1)).toBeNull();
  });
});

describe('parseIndice', () => {
  it('mapas, NPCs e itens', () => {
    const mapas = parseIndice(fx('maps-all.html'), 'mapa');
    expect(mapas.length).toBe(40);
    expect(mapas.find((e) => e.nome === 'Mushroom Town')?.info).toBe('town');
    const npcs = parseIndice(fx('npcs-all.html'), 'npc');
    expect(npcs.find((e) => e.nome === 'Alcaster')?.info).toBe("El Nath Market");
    const itens = parseIndice(fx('item-db-all.html'), 'item');
    expect(itens[0]).toMatchObject({ tipo: 'item', sourceUrl: expect.stringMatching(/^https:\/\/meowdb\.com\/msclassic\/item-db\/\d+$/) });
  });
  it('tipo não confunde links de outros tipos', () => {
    expect(parseIndice(fx('maps-all.html'), 'npc')).toEqual([]);
  });
});

describe('parseSitemapMonstros', () => {
  it('só /monsters/<id> e guarda lastmod', () => {
    const xml = '<urlset><url><loc>https://meowdb.com/msclassic/monsters/7</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://meowdb.com/msclassic/guides/x</loc></url><url><loc>https://meowdb.com/msclassic/es/monsters/7</loc></url></urlset>';
    expect(parseSitemapMonstros(xml)).toEqual([{ url: 'https://meowdb.com/msclassic/monsters/7', lastmod: '2026-01-01' }]);
  });
});

describe('validConsulta', () => {
  it('1 a 100 caracteres, string, não só espaços', () => {
    expect(validConsulta('snail')).toBe(true);
    expect([validConsulta(''), validConsulta('   '), validConsulta('x'.repeat(101)), validConsulta(5), validConsulta(null)]).toEqual([false, false, false, false, false]);
  });
});

const mon = (id: string, name: string, level: number, locais: Monster['locais']): Monster =>
  ({ id, name, level, exp: 4, hp: 51, locais, sourceUrl: `https://meowdb.com/msclassic/monsters/${id}` });
const DB: GameDb = {
  monstros: [
    mon('3', 'Blue Snail', 2, [{ mapaId: '42', mapa: 'Snail Hunting Ground III', regiao: 'Maple Road', qtd: 21 }, { mapaId: '50', mapa: 'Split Road', regiao: 'Maple Road', qtd: 3 }]),
    mon('2', 'Snail', 1, [{ mapaId: '42', mapa: 'Snail Hunting Ground III', regiao: 'Maple Road', qtd: 10 }]),
    mon('9', 'Cogumelo Zombi', 20, []),
  ],
  entradas: [
    { tipo: 'mapa', id: '42', nome: 'Snail Hunting Ground III', info: undefined, sourceUrl: 'https://meowdb.com/msclassic/maps/42' },
    { tipo: 'npc', id: '1', nome: 'Alcaster', info: 'El Nath Market', sourceUrl: 'https://meowdb.com/msclassic/npcs/1' },
    { tipo: 'item', id: '5', nome: 'Snail Shell', sourceUrl: 'https://meowdb.com/msclassic/item-db/5' },
  ],
};
const quests = [{ id: 'q', name: 'Ajudar Alcaster', npc: 'Alcaster', level: 30, exp: 900, reward: '', sourceUrl: 'u' }];

describe('buscar', () => {
  it('exato vence prefixo, e empate de prefixo segue monstro, mapa, NPC, item', () => {
    expect(buscar(DB, [], [], 'snail').map((r) => r.titulo)).toEqual(['Snail', 'Snail Hunting Ground III', 'Snail Shell', 'Blue Snail']);
  });
  it('ignora acento e maiúsculas', () => {
    expect(buscar(DB, [], [], 'cogumelo zombi')[0].titulo).toBe('Cogumelo Zombi');
    expect(buscar(DB, [], [], 'COGUMÉLO')[0].titulo).toBe('Cogumelo Zombi');
  });
  it('monstro lista os mapas onde aparece, do mais povoado', () => {
    const r = buscar(DB, [], [], 'blue snail')[0];
    expect(r.tipo).toBe('monstro');
    expect(r.sub).toBe('Lv 2 · 4 EXP · 51 HP');
    expect(r.linhas[0]).toContain('Snail Hunting Ground III (Maple Road) · 21x');
    expect(r.linhas[1]).toContain('Split Road');
  });
  it('mapa lista os monstros dele (inversão) e o EXP/h do guia', () => {
    const g = [{ name: 'Snail Hunting Ground III', street: '', maxExpHr: 12345, mob: { name: 'Blue Snail' }, why: '', levelMin: 1, levelMax: 10, sourceUrl: 'u' }];
    const r = buscar(DB, [], g, 'hunting ground').find((x) => x.tipo === 'mapa')!;
    expect(r.linhas[0]).toContain('12.345');
    expect(r.linhas.slice(1)).toEqual(['Blue Snail (Lv 2) · 21x', 'Snail (Lv 1) · 10x']);
  });
  it('NPC lista as quests dele; item só aponta o link', () => {
    expect(buscar(DB, quests, [], 'alcaster')[0].linhas).toEqual(['Ajudar Alcaster · Lv 30 · 900 EXP']);
    expect(buscar(DB, [], [], 'shell')[0]).toMatchObject({ tipo: 'item', linhas: [], url: 'https://meowdb.com/msclassic/item-db/5' });
  });
  it('consulta vazia ou sem acerto, e respeita o limite', () => {
    expect(buscar(DB, [], [], '  ')).toEqual([]);
    expect(buscar(DB, [], [], 'zzzz')).toEqual([]);
    expect(buscar(DB, [], [], 'snail', 2)).toHaveLength(2);
  });
});

describe('syncDb', () => {
  const dominios = ['meowdb.com'];
  const mkFetch = (calls: string[], ok = true) => (async (u: string | URL | Request) => {
    const url = String(u); calls.push(url);
    if (!ok) throw new Error('offline');
    const body = url.endsWith('sitemap.xml') ? '<urlset><url><loc>https://meowdb.com/msclassic/monsters/3</loc><lastmod>L1</lastmod></url></urlset>'
      : url.includes('/monsters/') ? fx('monsters-3.html') : url.includes('maps') ? fx('maps-all.html') : url.includes('npcs') ? fx('npcs-all.html') : fx('item-db-all.html');
    return { ok: true, url, text: async () => body } as Response;
  }) as typeof fetch;
  const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gdb-')), 'gamedb.json');

  it('baixa tudo; a segunda rodada não baixa de novo (lastmod igual e índices em TTL)', async () => {
    const file = tmp(), c1: string[] = [], c2: string[] = [];
    const base = { sitemapUrl: 'https://meowdb.com/msclassic/sitemap.xml', dominios, file };
    const a = await syncDb({ ...base, fetchFn: mkFetch(c1) });
    expect(a.offline).toBe(false);
    expect(a.monstros.map((m) => m.name)).toEqual(['Blue Snail']);
    expect(a.entradas.length).toBe(120);
    expect(c1.length).toBe(5); // sitemap + 1 monstro + 3 índices
    const b = await syncDb({ ...base, fetchFn: mkFetch(c2) });
    expect(c2).toEqual([base.sitemapUrl]); // só o sitemap
    expect(b.monstros.length).toBe(1);
  });
  it('sem rede devolve o cache e marca offline; nunca lança', async () => {
    const file = tmp();
    const base = { sitemapUrl: 'https://meowdb.com/msclassic/sitemap.xml', dominios, file };
    await syncDb({ ...base, fetchFn: mkFetch([]) });
    const off = await syncDb({ ...base, fetchFn: mkFetch([], false) });
    expect(off.offline).toBe(true);
    expect(off.monstros.length).toBe(1);
  });
  it('domínio fora do allowlist não é baixado', async () => {
    const r = await syncDb({ sitemapUrl: 'https://evil.example/sitemap.xml', dominios, file: tmp(), fetchFn: mkFetch([]) });
    expect(r.offline).toBe(true);
  });
});
