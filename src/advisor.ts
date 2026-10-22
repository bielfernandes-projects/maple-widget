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

const JANELA_QUEST = 5;
export function questsParaLevel(quests: Quest[], level: number, feitas: Set<string>, n = 8): Quest[] {
  return quests
    .filter((q) => !feitas.has(q.id) && q.level <= level && q.level >= level - JANELA_QUEST)
    .sort((a, b) => b.exp - a.exp)
    .slice(0, n);
}

export function dicasPara(tips: Tip[], level: number, classe?: string): Tip[] {
  const c = classe?.toLowerCase();
  return tips.filter((t) => {
    const faixa = (t.levelMin === undefined || level >= t.levelMin) && (t.levelMax === undefined || level <= t.levelMax);
    return faixa && (!c || classeCompativel(`${t.guide} ${t.title}`, c)); // sem classe lida, não filtra por classe
  });
}
// Guia que cita a linhagem da classe lida passa; guia que não cita nenhuma classe conhecida (genérico) também passa.
// ponytail: tabela de linhagem escrita à mão (nomes de job da HUD x títulos dos guias); completar se aparecerem jobs não mapeados.
const CLASSES = ['warrior', 'magician', 'bowman', 'thief', 'archer', 'fighter', 'spearman', 'page', 'wizard', 'cleric', 'hunter', 'crossbowman', 'assassin', 'bandit', 'mage'];
const LINHAGEM: Record<string, string[]> = {
  archer: ['archer', 'bowman'], bowman: ['bowman', 'archer'], hunter: ['hunter', 'bowman'], crossbowman: ['crossbowman', 'bowman'],
  fighter: ['fighter', 'warrior'], spearman: ['spearman', 'warrior'], page: ['page', 'warrior'],
  assassin: ['assassin', 'thief'], bandit: ['bandit', 'thief'], cleric: ['cleric', 'magician'],
};
const cita = (texto: string, k: string) => new RegExp(`\\b${k}\\b`).test(texto);
function classeCompativel(guia: string, classe: string): boolean {
  const g = guia.toLowerCase();
  if ((LINHAGEM[classe] ?? [classe]).some((k) => cita(g, k))) return true;
  return !CLASSES.some((k) => cita(g, k));
}

export function novidadesNoLevel(maps: GrindMap[], quests: Quest[], level: number) {
  return { maps: maps.filter((m) => m.levelMin === level), quests: quests.filter((q) => q.level === level) };
}

export function veredito(expPorHora: number, best: GrindMap | undefined, lim: Limiares): Veredito {
  if (!best || best.maxExpHr <= 0 || expPorHora <= 0) return { cor: 'cinza', pct: null, ref: best };
  const pct = expPorHora / best.maxExpHr;
  return { cor: pct >= lim.verde ? 'verde' : pct >= lim.amarelo ? 'amarelo' : 'vermelho', pct, ref: best };
}
