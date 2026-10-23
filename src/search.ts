import type { GameDb, GrindMap, Quest } from './types';

// Cada resultado traz seções com linhas compactas (ícone + nome + valor à direita): a interface desenha como tabelinha.
export type Linha = { nome: string; info?: string; iconUrl?: string };
export type Secao = { titulo: string; nota?: string; linhas: Linha[] };
export type Resultado = {
  tipo: 'monstro' | 'mapa' | 'quest' | 'npc' | 'item';
  titulo: string; sub: string; iconUrl?: string; secoes: Secao[]; url: string;
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ORDEM = { monstro: 0, mapa: 1, quest: 2, npc: 3, item: 4 } as const;
const NOTA_DROP = 'Taxas de referência (OSMLib); podem não ser as do Classic.';

// 0 = não casa; maior = melhor (exato > prefixo > prefixo de palavra > contém > todas as palavras)
function pontos(nome: string, q: string, tokens: string[]): number {
  const n = norm(nome);
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(' ' + q)) return 60;
  if (n.includes(q)) return 40;
  return tokens.length > 1 && tokens.every((t) => n.includes(t)) ? 30 : 0;
}
const fmt = (n: number) => n.toLocaleString('pt-BR');

export function buscar(db: GameDb, quests: Quest[], maps: GrindMap[], consulta: string, limite = 20): Resultado[] {
  const q = norm(consulta);
  if (!q) return [];
  const tokens = q.split(' ');
  const achados: { r: Resultado; p: number }[] = [];
  const add = (nome: string, r: Resultado) => { const p = pontos(nome, q, tokens); if (p) achados.push({ r, p }); };

  // inversões: mapa -> monstros e item -> monstros que dropam
  type M = GameDb['monstros'][number];
  const porMapa = new Map<string, { m: M; qtd: number }[]>();
  const porItem = new Map<string, { m: M; pct: number; taxa: string }[]>();
  const iconeItem = new Map<string, string>();
  for (const m of db.monstros) {
    for (const l of m.locais) { const xs = porMapa.get(l.mapaId) ?? []; xs.push({ m, qtd: l.qtd }); porMapa.set(l.mapaId, xs); }
    for (const d of m.drops ?? []) {
      const xs = porItem.get(d.itemId) ?? []; xs.push({ m, pct: d.pct, taxa: d.taxa }); porItem.set(d.itemId, xs);
      if (d.iconUrl && !iconeItem.has(d.itemId)) iconeItem.set(d.itemId, d.iconUrl);
    }
  }

  for (const m of db.monstros) {
    const secoes: Secao[] = [];
    const locais = [...m.locais].sort((a, b) => b.qtd - a.qtd);
    secoes.push({ titulo: `Aparece em (${locais.length})`, linhas: locais.map((l) => ({ nome: l.mapa, info: `${l.regiao ? l.regiao + ' · ' : ''}${l.qtd}x` })) });
    const drops = [...(m.drops ?? [])].sort((a, b) => b.pct - a.pct);
    if (drops.length) secoes.push({ titulo: `Drops (${drops.length})`, nota: NOTA_DROP, linhas: drops.map((d) => ({ nome: d.nome, info: d.taxa, iconUrl: d.iconUrl })) });
    add(m.name, { tipo: 'monstro', titulo: m.name, iconUrl: m.iconUrl, url: m.sourceUrl, sub: `Lv ${m.level} · ${fmt(m.exp)} EXP · ${fmt(m.hp)} HP`, secoes });
  }
  for (const x of quests) {
    add(x.name, { tipo: 'quest', titulo: x.name, iconUrl: x.iconUrl, url: x.sourceUrl, sub: `Lv ${x.level} · ${fmt(x.exp)} EXP`,
      secoes: [{ titulo: 'Detalhes', linhas: [{ nome: 'NPC', info: `${x.npc}${x.area ? ` (${x.area})` : ''}` }, ...(x.reward ? [{ nome: 'Recompensa', info: x.reward }] : [])] }] });
  }
  for (const e of db.entradas) {
    if (e.tipo === 'mapa') {
      const mobs = (porMapa.get(e.id) ?? []).sort((a, b) => b.qtd - a.qtd);
      const g = maps.find((x) => norm(x.name) === norm(e.nome));
      const secoes: Secao[] = [];
      if (g) secoes.push({ titulo: 'Guia', linhas: [{ nome: 'EXP/h máx.', info: `${fmt(g.maxExpHr)} (${g.mob.name})` }] });
      secoes.push({ titulo: `Monstros (${mobs.length})`, linhas: mobs.map((x) => ({ nome: x.m.name, info: `Lv ${x.m.level} · ${x.qtd}x`, iconUrl: x.m.iconUrl })) });
      add(e.nome, { tipo: 'mapa', titulo: e.nome, sub: e.info ?? '', secoes, url: e.sourceUrl });
    } else if (e.tipo === 'npc') {
      const qs = quests.filter((x) => norm(x.npc) === norm(e.nome));
      add(e.nome, { tipo: 'npc', titulo: e.nome, sub: e.info ?? '', url: e.sourceUrl,
        secoes: qs.length ? [{ titulo: `Quests (${qs.length})`, linhas: qs.map((x) => ({ nome: x.name, info: `Lv ${x.level} · ${fmt(x.exp)} EXP` })) }] : [] });
    } else {
      const quem = (porItem.get(e.id) ?? []).sort((a, b) => b.pct - a.pct);
      add(e.nome, { tipo: 'item', titulo: e.nome, sub: '', url: e.sourceUrl, iconUrl: iconeItem.get(e.id),
        secoes: quem.length ? [{ titulo: `Dropado por (${quem.length})`, nota: NOTA_DROP, linhas: quem.map((x) => ({ nome: x.m.name, info: `Lv ${x.m.level} · ${x.taxa}`, iconUrl: x.m.iconUrl })) }] : [] });
    }
  }
  return achados
    .sort((a, b) => b.p - a.p || ORDEM[a.r.tipo] - ORDEM[b.r.tipo] || a.r.titulo.length - b.r.titulo.length)
    .slice(0, limite).map((x) => x.r);
}
