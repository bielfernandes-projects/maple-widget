import type { GameDb, GrindMap, Quest } from './types';

export type Resultado = {
  tipo: 'monstro' | 'mapa' | 'npc' | 'item';
  titulo: string; sub: string; iconUrl?: string; linhas: string[]; url: string;
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ORDEM = { monstro: 0, mapa: 1, npc: 2, item: 3 } as const;
const LINHAS_MAX = 8;

// 0 = não casa; maior = melhor (exato > prefixo > prefixo de palavra > contém > todas as palavras)
function pontos(nome: string, q: string, tokens: string[]): number {
  const n = norm(nome);
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(' ' + q)) return 60;
  if (n.includes(q)) return 40;
  return tokens.length > 1 && tokens.every((t) => n.includes(t)) ? 30 : 0;
}
const mais = (xs: string[]) => (xs.length > LINHAS_MAX ? [...xs.slice(0, LINHAS_MAX), `… e mais ${xs.length - LINHAS_MAX}`] : xs);
const fmt = (n: number) => n.toLocaleString('pt-BR');

export function buscar(db: GameDb, quests: Quest[], maps: GrindMap[], consulta: string, limite = 20): Resultado[] {
  const q = norm(consulta);
  if (!q) return [];
  const tokens = q.split(' ');
  const achados: { r: Resultado; p: number }[] = [];
  const add = (nome: string, r: Resultado) => { const p = pontos(nome, q, tokens); if (p) achados.push({ r, p }); };

  // mapa -> monstros (inversão dos locais de cada monstro)
  const porMapa = new Map<string, { nome: string; level: number; qtd: number }[]>();
  for (const m of db.monstros) for (const l of m.locais) {
    const xs = porMapa.get(l.mapaId) ?? [];
    xs.push({ nome: m.name, level: m.level, qtd: l.qtd });
    porMapa.set(l.mapaId, xs);
  }

  for (const m of db.monstros) {
    const locais = [...m.locais].sort((a, b) => b.qtd - a.qtd).map((l) => `${l.mapa}${l.regiao ? ` (${l.regiao})` : ''} · ${l.qtd}x${l.respawn ? ` · ${l.respawn}` : ''}`);
    add(m.name, {
      tipo: 'monstro', titulo: m.name, iconUrl: m.iconUrl, url: m.sourceUrl,
      sub: `Lv ${m.level} · ${fmt(m.exp)} EXP · ${fmt(m.hp)} HP`,
      linhas: locais.length ? mais(locais) : ['Sem mapas listados.'],
    });
  }
  for (const e of db.entradas) {
    if (e.tipo === 'mapa') {
      const mobs = (porMapa.get(e.id) ?? []).sort((a, b) => b.qtd - a.qtd).map((x) => `${x.nome} (Lv ${x.level}) · ${x.qtd}x`);
      const g = maps.find((x) => norm(x.name) === norm(e.nome));
      const linhas = [...(g ? [`EXP/h máx. do guia: ${fmt(g.maxExpHr)} (${g.mob.name})`] : []), ...mais(mobs)];
      add(e.nome, { tipo: 'mapa', titulo: e.nome, sub: e.info ?? 'Mapa', linhas: linhas.length ? linhas : ['Sem monstros listados.'], url: e.sourceUrl });
    } else if (e.tipo === 'npc') {
      const qs = quests.filter((x) => norm(x.npc) === norm(e.nome)).map((x) => `${x.name} · Lv ${x.level} · ${fmt(x.exp)} EXP`);
      add(e.nome, { tipo: 'npc', titulo: e.nome, sub: e.info ? `NPC · ${e.info}` : 'NPC', linhas: qs.length ? mais(qs) : [], url: e.sourceUrl });
    } else {
      add(e.nome, { tipo: 'item', titulo: e.nome, sub: 'Item', linhas: [], url: e.sourceUrl });
    }
  }
  return achados
    .sort((a, b) => b.p - a.p || ORDEM[a.r.tipo] - ORDEM[b.r.tipo] || a.r.titulo.length - b.r.titulo.length)
    .slice(0, limite).map((x) => x.r);
}
