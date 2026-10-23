import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { parseMonster, parseIndice, parseSitemapMonstros, syncDb } from '../src/sources/gamedb';
import { buscar } from '../src/search';
import { validConsulta } from '../src/main/validate';
import type { GameDb, Monster } from '../src/types';

// HTML sintético com a mesma estrutura das páginas do meowdb (nada copiado do site)
const LOCAIS = [
  ['000000042', 'Snail Hunting Ground III', 'Maple Road', 21], ['000000050', 'A Split Road', 'Maple Road', 17], ['000000060', 'Snail Garden', 'Rainbow Street', 19],
] as const;
const monstroHtml = (nome: string, lv: number, exp: number, hp: number) => `<html><head><title>${nome} - MapleStory Classic | NiaMeowDB</title>
<meta property="og:image" content="https://og.meowdb.com/og?title=${encodeURIComponent(nome)}&subtitle=HP+${hp}+%C2%B7+EXP+${exp}&eyebrow=NiaMeowDB+%C2%B7+Monster+%C2%B7+Lv+${lv}"/></head>
<body><h1>${nome}</h1><table><thead><tr><th>Map</th><th>Count↓</th><th>Share↓</th><th>Types↓</th><th>Mob Rate</th><th>Respawn</th></tr></thead><tbody>
${LOCAIS.map(([id, m, r, q]) => `<tr><td><a href="/msclassic/maps/${id}">${m}</a><span>${r}</span></td><td>${q}</td><td>${q}/60 35%</td><td>3</td><td>1.0x</td><td>~7.5s</td></tr>`).join('')}
</tbody></table></body></html>`;
const lista = (tipo: string, itens: [string, string, string?][]) => '<ul>' + itens.map(([id, nome, info]) => `<li><a href="/msclassic/${tipo}/${id}">${nome}${info ? `<span> (${info})</span>` : ''}</a></li>`).join('') + '</ul>';
const IDX = {
  maps: lista('maps', [['000000010', 'Mushroom Town', 'town'], ['000000042', 'Snail Hunting Ground III'], ['000000050', 'A Split Road']]),
  npcs: lista('npcs', [['402', 'Alex', 'Kerning City'], ['1111', 'Alcaster', 'El Nath Market']]),
  itens: lista('item-db', [['1157', 'Blue Jean Shorts'], ['1156', 'Blue-Striped Boxers'], ['5', 'Snail Shell']]),
};
const fx = (n: string) => ({ 'monsters-3.html': monstroHtml('Blue Snail', 2, 4, 51), 'maps-all.html': IDX.maps, 'npcs-all.html': IDX.npcs, 'item-db-all.html': IDX.itens } as Record<string, string>)[n];
const URL1 = 'https://meowdb.com/msclassic/monsters/3';

describe('parseMonster', () => {
  it('lê nome, nível, EXP, HP e os mapas (Blue Snail)', () => {
    const m = parseMonster(fx('monsters-3.html'), URL1)!;
    expect(m.name).toBe('Blue Snail');
    expect([m.level, m.exp, m.hp]).toEqual([2, 4, 51]);
    expect(m.locais.length).toBe(3);
    expect(m.locais[0]).toMatchObject({ mapaId: '000000042', mapa: 'Snail Hunting Ground III', regiao: 'Maple Road', qtd: 21 });
    expect(m.iconUrl).toBe('https://meowdb.com/msclassic/monsters/sprites/mob_3.png');
  });
  it('página 404 ou sem nome vira null', () => {
    expect(parseMonster('<title>Page not found | NiaMeowDB</title><h1>x</h1>', URL1)).toBeNull();
    expect(parseMonster('<html></html>', URL1)).toBeNull();
  });
});

describe('parseMonster: drops', () => {
  const html = (linhas: string) => `<html><head><title>Green Mushroom | NiaMeowDB</title></head><body><h1>Green Mushroom</h1>
    <section><h2>OSMLIB Reference Drop Rates</h2><table><tr><th scope="col">Item</th><th scope="col">OSMLib rate</th></tr>${linhas}</table></section></body></html>`;
  const row = (id: string, ico: string, nome: string, taxa: string) => `<tr><td><a href="/msclassic/item-db/${id}"><img src="/msclassic/api/assets/icons/${ico}" alt=""><span>${nome}</span></a></td><td><a href="https://osmlib.com/?search=1" target="_blank">${taxa}</a><span>About 1 in 2</span></td></tr>`;
  it('lê item, ícone e taxa da tabela OSMLib', () => {
    const m = parseMonster(html(row('506', '4031068', 'Animal Fossil', '50%') + row('417', '4010000', 'Silver Ore', '0.3%')), 'https://meowdb.com/msclassic/monsters/13')!;
    expect(m.drops).toEqual([
      { itemId: '506', nome: 'Animal Fossil', taxa: '50%', pct: 50, iconUrl: 'https://meowdb.com/msclassic/api/assets/icons/4031068' },
      { itemId: '417', nome: 'Silver Ore', taxa: '0.3%', pct: 0.3, iconUrl: 'https://meowdb.com/msclassic/api/assets/icons/4010000' },
    ]);
  });
  it('sem a tabela, ou com linhas quebradas, não derruba o monstro', () => {
    expect(parseMonster('<html><title>x</title><h1>Slime</h1></html>', 'https://meowdb.com/msclassic/monsters/7')!.drops).toEqual([]);
    expect(parseMonster(html('<tr><td>sem link</td><td>?</td></tr>'), 'https://meowdb.com/msclassic/monsters/13')!.drops).toEqual([]);
  });
});

describe('parseIndice', () => {
  it('mapas, NPCs e itens', () => {
    const mapas = parseIndice(fx('maps-all.html'), 'mapa');
    expect(mapas.length).toBe(3);
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

const mon = (id: string, name: string, level: number, locais: Monster['locais'], drops: Monster['drops'] = []): Monster =>
  ({ id, name, level, exp: 4, hp: 51, iconUrl: `https://meowdb.com/msclassic/monsters/sprites/mob_${id}.png`, locais, drops, sourceUrl: `https://meowdb.com/msclassic/monsters/${id}` });
const drop = (itemId: string, nome: string, taxa: string): Monster['drops'][number] => ({ itemId, nome, taxa, pct: parseFloat(taxa), iconUrl: 'https://meowdb.com/msclassic/api/assets/icons/' + itemId });
const DB: GameDb = {
  monstros: [
    mon('3', 'Blue Snail', 2, [{ mapaId: '42', mapa: 'Snail Hunting Ground III', regiao: 'Maple Road', qtd: 21 }, { mapaId: '50', mapa: 'Split Road', regiao: 'Maple Road', qtd: 3 }],
      [drop('7', 'Snail Shell', '0.3%'), drop('8', 'Red Potion', '2%')]),
    mon('2', 'Snail', 1, [{ mapaId: '42', mapa: 'Snail Hunting Ground III', regiao: 'Maple Road', qtd: 10 }], [drop('7', 'Snail Shell', '40%')]),
    mon('9', 'Cogumelo Zombi', 20, []),
  ],
  entradas: [
    { tipo: 'mapa', id: '42', nome: 'Snail Hunting Ground III', info: undefined, sourceUrl: 'https://meowdb.com/msclassic/maps/42' },
    { tipo: 'npc', id: '1', nome: 'Alcaster', info: 'El Nath Market', sourceUrl: 'https://meowdb.com/msclassic/npcs/1' },
    { tipo: 'item', id: '7', nome: 'Snail Shell', sourceUrl: 'https://meowdb.com/msclassic/item-db/7' },
    { tipo: 'item', id: '99', nome: 'Raro Sem Drop', sourceUrl: 'https://meowdb.com/msclassic/item-db/99' },
  ],
};
const quests = [{ id: 'q', name: 'Ajudar Alcaster', npc: 'Alcaster', level: 30, exp: 900, reward: '', sourceUrl: 'u' }];
const sec = (r: { secoes: { titulo: string }[] }, prefixo: string) => (r.secoes as any[]).find((x) => x.titulo.startsWith(prefixo));

describe('buscar', () => {
  it('exato vence prefixo, e empate de prefixo segue monstro, mapa, NPC, item', () => {
    expect(buscar(DB, [], [], 'snail').map((r) => r.titulo)).toEqual(['Snail', 'Snail Hunting Ground III', 'Snail Shell', 'Blue Snail']);
  });
  it('ignora acento e maiúsculas', () => {
    expect(buscar(DB, [], [], 'cogumelo zombi')[0].titulo).toBe('Cogumelo Zombi');
    expect(buscar(DB, [], [], 'COGUMÉLO')[0].titulo).toBe('Cogumelo Zombi');
  });
  it('monstro: seção de mapas (do mais povoado) e seção de drops (da maior taxa) com ícone', () => {
    const r = buscar(DB, [], [], 'blue snail')[0];
    expect(r.tipo).toBe('monstro');
    expect(r.sub).toBe('Lv 2 · 4 EXP · 51 HP');
    const mapas = sec(r, 'Aparece em');
    expect(mapas.titulo).toBe('Aparece em (2)');
    expect(mapas.linhas[0]).toEqual({ nome: 'Snail Hunting Ground III', info: 'Maple Road · 21x' });
    expect(mapas.linhas[1].nome).toBe('Split Road');
    const drops = sec(r, 'Drops');
    expect(drops.titulo).toBe('Drops (2)');
    expect(drops.linhas.map((l: any) => [l.nome, l.info])).toEqual([['Red Potion', '2%'], ['Snail Shell', '0.3%']]);
    expect(drops.linhas[0].iconUrl).toContain('/icons/8');
    expect(drops.nota).toMatch(/OSMLib/);
  });
  it('monstro sem drops conhecidos não ganha seção de drops', () => {
    expect(sec(buscar(DB, [], [], 'cogumelo')[0], 'Drops')).toBeUndefined();
  });
  it('item: lista os monstros que dropam, da maior taxa, com ícone do mob e o ícone do item', () => {
    const r = buscar(DB, [], [], 'snail shell').find((x) => x.tipo === 'item')!;
    expect(r.iconUrl).toContain('/icons/7');
    const q = sec(r, 'Dropado por');
    expect(q.titulo).toBe('Dropado por (2)');
    expect(q.linhas.map((l: any) => [l.nome, l.info])).toEqual([['Snail', 'Lv 1 · 40%'], ['Blue Snail', 'Lv 2 · 0.3%']]);
    expect(q.linhas[0].iconUrl).toContain('mob_2');
  });
  it('item sem dados de drop: sem seção, só o link', () => {
    expect(buscar(DB, [], [], 'raro sem drop')[0]).toMatchObject({ tipo: 'item', secoes: [], url: 'https://meowdb.com/msclassic/item-db/99' });
  });
  it('mapa lista os monstros dele (inversão) e o EXP/h do guia', () => {
    const g = [{ name: 'Snail Hunting Ground III', street: '', maxExpHr: 12345, mob: { name: 'Blue Snail' }, why: '', levelMin: 1, levelMax: 10, sourceUrl: 'u' }];
    const r = buscar(DB, [], g, 'hunting ground').find((x) => x.tipo === 'mapa')!;
    expect(sec(r, 'Guia').linhas[0].info).toContain('12.345');
    expect(sec(r, 'Monstros').linhas.map((l: any) => [l.nome, l.info])).toEqual([['Blue Snail', 'Lv 2 · 21x'], ['Snail', 'Lv 1 · 10x']]);
  });
  it('NPC lista as quests dele', () => {
    expect(sec(buscar(DB, quests, [], 'alcaster')[0], 'Quests').linhas).toEqual([{ nome: 'Ajudar Alcaster', info: 'Lv 30 · 900 EXP' }]);
  });
  it('acha quests pelo nome e devolve todas as linhas (sem truncar)', () => {
    const r = buscar(DB, quests, [], 'ajudar')[0];
    expect(r).toMatchObject({ tipo: 'quest', sub: 'Lv 30 · 900 EXP' });
    expect(sec(r, 'Detalhes').linhas[0]).toEqual({ nome: 'NPC', info: 'Alcaster' });
    const muitos: GameDb = { monstros: [mon('1', 'Slime', 5, Array.from({ length: 30 }, (_, i) => ({ mapaId: String(i), mapa: 'M' + i, regiao: '', qtd: 30 - i })))], entradas: [] };
    expect(sec(buscar(muitos, [], [], 'slime')[0], 'Aparece em').linhas).toHaveLength(30);
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
    expect(a.entradas.length).toBe(8);
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
