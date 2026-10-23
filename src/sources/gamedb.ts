import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { isAllowedUrl } from './allowlist';
import { USER_AGENT } from './discover';
import type { Entrada, GameDb, Local, Monster } from '../types';

// Base do jogo: ~200 páginas de monstro (incremental por lastmod) + 3 índices (mapas, NPCs, itens; 1 requisição cada).
// "Dropped By" dos itens carrega no cliente do meowdb, então itens ficam só como índice (nome + link).
export const DB_VERSION = 1;
const BASE = 'https://meowdb.com';
const CONCORRENCIA = 3;
const INDICE_TTL_MS = 24 * 3_600_000, SEM_LASTMOD_TTL_MS = 7 * 24 * 3_600_000;
type Tipo = Entrada['tipo'];
const INDICES: [Tipo, string, RegExp][] = [
  ['mapa', '/msclassic/maps/all', /^\/msclassic\/maps\/(\d+)$/],
  ['npc', '/msclassic/npcs/all', /^\/msclassic\/npcs\/(\d+)$/],
  ['item', '/msclassic/item-db/all', /^\/msclassic\/item-db\/(\d+)$/],
];

const num = (s: string | null | undefined) => { const n = Number((s ?? '').replace(/[,.\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const limpa = (s: string) => s.replace(/\s+/g, ' ').trim();

export function parseMonster(html: string, url: string): Monster | null {
  const $ = cheerio.load(html);
  const name = limpa($('h1').first().text());
  const id = url.match(/\/monsters\/(\d+)$/)?.[1];
  if (!name || !id || /not found/i.test($('title').text())) return null;
  let level = 0, exp = 0, hp = 0;
  try {
    const og = new URL($('meta[property="og:image"]').attr('content') ?? '').searchParams;
    level = num(og.get('eyebrow')?.match(/Lv\s+(\d+)/)?.[1]);
    hp = num(og.get('subtitle')?.match(/HP\s+([\d,.]+)/)?.[1]);
    exp = num(og.get('subtitle')?.match(/EXP\s+([\d,.]+)/)?.[1]);
  } catch { /* sem og:image: campos ficam 0 */ }
  const locais: Local[] = [];
  const t = $('table').filter((_, e) => /Respawn/.test($(e).text())).first();
  t.find('tbody tr').each((_, r) => {
    const td = $(r).find('td');
    const a = td.first().find('a').first();
    const mapaId = a.attr('href')?.match(/\/maps\/(\d+)/)?.[1];
    if (!mapaId) return;
    locais.push({ mapaId, mapa: limpa(a.text()), regiao: limpa(td.first().find('span').first().text()), qtd: num(td.eq(1).text()), respawn: limpa(td.last().text()) || undefined });
  });
  return { id, name, level, exp, hp, iconUrl: `${BASE}/msclassic/monsters/sprites/mob_${id}.png`, locais, sourceUrl: url };
}

export function parseIndice(html: string, tipo: Tipo): Entrada[] {
  const re = INDICES.find((i) => i[0] === tipo)![2];
  const $ = cheerio.load(html);
  const out = new Map<string, Entrada>();
  $('a').each((_, e) => {
    const href = $(e).attr('href') ?? '';
    const id = href.match(re)?.[1];
    if (!id || out.has(id)) return;
    const info = limpa($(e).find('span').first().text()).replace(/^\(|\)$/g, '').trim() || undefined;
    const nome = limpa($(e).clone().children('span').remove().end().text());
    if (nome) out.set(id, { tipo, id, nome, info, sourceUrl: BASE + href });
  });
  return [...out.values()];
}

export function parseSitemapMonstros(xml: string): { url: string; lastmod: string }[] {
  const out: { url: string; lastmod: string }[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>\s*(.*?)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    let u: URL;
    try { u = new URL(loc); } catch { continue; }
    if (/^\/msclassic\/monsters\/\d+$/.test(u.pathname)) out.push({ url: u.origin + u.pathname, lastmod: m[1].match(/<lastmod>\s*(.*?)\s*<\/lastmod>/)?.[1] ?? '' });
  }
  return out;
}

type Cache = { v: number; mons: Record<string, { lastmod: string; at: number; m: Monster | null }>; idx: Partial<Record<Tipo, { at: number; e: Entrada[] }>> };
const vazio = (): Cache => ({ v: DB_VERSION, mons: {}, idx: {} });
function lerCache(file: string): Cache {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return j && j.v === DB_VERSION && j.mons && typeof j.mons === 'object' && j.idx && typeof j.idx === 'object' ? j : vazio();
  } catch { return vazio(); }
}
function gravar(file: string, c: Cache) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(c)); fs.renameSync(file + '.tmp', file); } catch { /* cache é best-effort */ }
}
const paraDb = (c: Cache): GameDb => ({
  monstros: Object.values(c.mons).map((x) => x.m).filter((m): m is Monster => !!m),
  entradas: Object.values(c.idx).flatMap((x) => x?.e ?? []),
});

export type DbOpts = { sitemapUrl: string; dominios: string[]; file: string; fetchFn?: typeof fetch; agora?: () => number };

// Roda em segundo plano: nunca rejeita; sem rede devolve o que já estava em cache.
export async function syncDb(o: DbOpts): Promise<GameDb & { offline: boolean }> {
  const cache = lerCache(o.file);
  try { return { ...(await run(o, cache)), offline: false }; } catch { return { ...paraDb(cache), offline: true }; }
}

async function texto(url: string, o: DbOpts, ms: number): Promise<string> {
  if (!isAllowedUrl(url, o.dominios)) throw new Error('domínio não permitido');
  const r = await (o.fetchFn ?? fetch)(url, { redirect: 'follow', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!isAllowedUrl(r.url || url, o.dominios)) throw new Error('redirecionamento fora do allowlist');
  return r.text();
}

async function run(o: DbOpts, cache: Cache): Promise<GameDb> {
  const agora = (o.agora ?? Date.now)();
  const refs = parseSitemapMonstros(await texto(o.sitemapUrl, o, 15000)).filter((r) => isAllowedUrl(r.url, o.dominios));
  const fila = refs.filter((r) => {
    const c = cache.mons[r.url];
    return !c || (r.lastmod ? c.lastmod !== r.lastmod : agora - c.at > SEM_LASTMOD_TTL_MS);
  });
  let i = 0, desdeGravacao = 0;
  const worker = async () => {
    for (;;) {
      const r = fila[i++];
      if (!r) return;
      try {
        cache.mons[r.url] = { lastmod: r.lastmod, at: agora, m: parseMonster(await texto(r.url, o, 20000), r.url) };
        if (++desdeGravacao >= 25) { desdeGravacao = 0; gravar(o.file, cache); } // progresso sobrevive a um fechamento no meio
      } catch { /* falha isolada: tenta no próximo ciclo */ }
    }
  };
  await Promise.all(Array.from({ length: CONCORRENCIA }, worker));
  for (const [tipo, p] of INDICES) {
    const c = cache.idx[tipo];
    if (c && agora - c.at < INDICE_TTL_MS) continue;
    try {
      const e = parseIndice(await texto(BASE + p, o, 60000), tipo);
      if (e.length) cache.idx[tipo] = { at: agora, e }; // página sem nada reconhecível não troca um índice bom
    } catch { /* mantém o índice anterior */ }
  }
  gravar(o.file, cache);
  return paraDb(cache);
}
