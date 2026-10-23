import type { ExpRow, GrindMap, Limiares, Quest, Tip, Veredito } from './types';

export function makeExpToNext(rows: ExpRow[]) {
  const m = new Map(rows.map((r) => [r.level, r.toNext]));
  return (level: number) => m.get(level);
}

export function mapasParaLevel(maps: GrindMap[], level: number, n = 3): GrindMap[] {
  return maps
    .filter((m) => m.levelMin <= level && level <= m.levelMax)
    .sort((a, b) => b.maxExpHr - a.maxExpHr)
    .slice(0, n);
}

// mesma lista de mapas repetida em guias diferentes: fica a de maior EXP/h
const unicos = (ms: GrindMap[]) => {
  const m = new Map<string, GrindMap>();
  for (const x of ms) { const k = JSON.stringify([x.name, x.street]); const c = m.get(k); if (!c || x.maxExpHr > c.maxExpHr) m.set(k, x); }
  return [...m.values()];
};
// todos os mapas cuja faixa cobre o level (do melhor EXP/h para o pior)
export function mapasNaFaixa(maps: GrindMap[], level: number): GrindMap[] {
  return unicos(maps.filter((m) => m.levelMin <= level && level <= m.levelMax)).sort((a, b) => b.maxExpHr - a.maxExpHr);
}
// mapas que começam logo acima do level (até +margem), fora os que já estão na faixa atual
export function mapasProximos(maps: GrindMap[], level: number, margem = 3): GrindMap[] {
  const ja = new Set(mapasNaFaixa(maps, level).map((m) => JSON.stringify([m.name, m.street])));
  return unicos(maps.filter((m) => m.levelMin > level && m.levelMin <= level + margem))
    .filter((m) => !ja.has(JSON.stringify([m.name, m.street])))
    .sort((a, b) => a.levelMin - b.levelMin || b.maxExpHr - a.maxExpHr);
}

const JANELA_QUEST = 5;
export function questsParaLevel(quests: Quest[], level: number, feitas: Set<string>, n = 8): Quest[] {
  // variantes (mesmo nome+npc, tiers de EXP): mostra só a de maior EXP ainda não feita
  const melhor = new Map<string, Quest>();
  for (const q of quests) {
    if (feitas.has(q.id) || q.level > level || q.level < level - JANELA_QUEST) continue;
    const k = JSON.stringify([q.name, q.npc]);
    const cur = melhor.get(k);
    if (!cur || q.exp > cur.exp) melhor.set(k, q);
  }
  return [...melhor.values()].sort((a, b) => b.exp - a.exp).slice(0, n);
}

export function dicasPara(tips: Tip[], level: number, classe?: string): Tip[] {
  const c = classe?.trim().toLowerCase() || undefined; // classe vem de OCR: vazia ou só espaços = sem filtro
  // relevância: 0 faixa+linhagem, 1 faixa, 2 linhagem, 3 genérico (sort é estável: empates mantêm a ordem)
  const relevancia = (t: Tip) => {
    const citaClasse = c !== undefined && citaLinhagem(`${t.guide} ${t.title}`, c);
    if (t.levelMin !== undefined) return citaClasse ? 0 : 1;
    return citaClasse ? 2 : 3;
  };
  return tips
    .filter((t) => {
      const faixa = (t.levelMin === undefined || level >= t.levelMin) && (t.levelMax === undefined || level <= t.levelMax);
      return faixa && (!c || classeCompativel(`${t.guide} ${t.title}`, c)); // sem classe lida, não filtra por classe
    })
    .sort((a, b) => relevancia(a) - relevancia(b));
}
// Guia que cita a linhagem da classe lida passa; guia que não cita nenhuma classe conhecida (genérico) também passa.
// Linhagem: classe da HUD (normalizada: minúsculas, só letras) -> palavras-chave dos guias. Classe base casa só com o guia base;
// 2º job casa com o próprio guia e o da base. "Wizard" sem ramo (OCR perdeu "F/P"/"I/L") casa com os dois ramos.
// ponytail: tabela escrita à mão (jobs da HUD x títulos dos guias do meowdb); completar se aparecerem jobs novos (3º job etc.).
const MAGO = ['magician', 'mage'], ARQ = ['bowman', 'archer'];
const LINHAGEM: Record<string, string[]> = {
  warrior: ['warrior'], swordman: ['warrior'], swordsman: ['warrior'],
  fighter: ['fighter', 'warrior'], spearman: ['spearman', 'warrior'], page: ['page', 'warrior'],
  magician: MAGO, mage: MAGO, wizard: ['fpwizard', 'ilwizard', ...MAGO],
  fpwizard: ['fpwizard', ...MAGO], ilwizard: ['ilwizard', ...MAGO], cleric: ['cleric', ...MAGO],
  archer: ARQ, bowman: ARQ, hunter: ['hunter', ...ARQ], crossbowman: ['crossbowman', ...ARQ],
  thief: ['thief', 'rogue'], rogue: ['thief', 'rogue'], assassin: ['assassin', 'thief', 'rogue'], bandit: ['bandit', 'thief', 'rogue'],
};
// a chave mais longa contida na classe lida ("fpwizard" antes de "wizard", "crossbowman" antes de "bowman")
const CHAVES = Object.keys(LINHAGEM).sort((x, y) => y.length - x.length);
const CONHECIDAS = [...new Set(Object.values(LINHAGEM).flat())];
const escapa = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cita = (texto: string, k: string) => new RegExp(`\\b${escapa(k)}\\b`).test(texto);
// texto do guia: "F/P Wizard", "Fire/Poison Mage", "I/L Wizard" etc. viram uma palavra só
const normGuia = (g: string) => g.toLowerCase()
  .replace(/\b(?:f\s*\/\s*p|fire\s*\/?\s*poison)\s*(?:wizard|mage|magician)\b/g, ' fpwizard ')
  .replace(/\b(?:i\s*\/\s*l|ice\s*\/?\s*lightning)\s*(?:wizard|mage|magician)\b/g, ' ilwizard ');
function linhagem(classe: string): string[] {
  const n = classe.toLowerCase().replace(/[^a-z]/g, '');
  if (Object.hasOwn(LINHAGEM, n)) return LINHAGEM[n];
  const k = n.length >= 4 ? CHAVES.find((c) => n.includes(c)) : undefined;
  return k ? LINHAGEM[k] : n ? [n] : [];
}
function citaLinhagem(guia: string, classe: string): boolean {
  const g = normGuia(guia);
  return linhagem(classe).some((k) => cita(g, k));
}
function classeCompativel(guia: string, classe: string): boolean {
  if (citaLinhagem(guia, classe)) return true;
  const g = normGuia(guia);
  return !CONHECIDAS.some((k) => cita(g, k));
}

export function novidadesNoLevel(maps: GrindMap[], quests: Quest[], level: number) {
  return { maps: maps.filter((m) => m.levelMin === level), quests: quests.filter((q) => q.level === level) };
}

export function veredito(expPorHora: number, best: GrindMap | undefined, lim: Limiares): Veredito {
  if (!best || best.maxExpHr <= 0 || expPorHora <= 0) return { cor: 'cinza', pct: null, ref: best };
  const pct = expPorHora / best.maxExpHr;
  return { cor: pct >= lim.verde ? 'verde' : pct >= lim.amarelo ? 'amarelo' : 'vermelho', pct, ref: best };
}
