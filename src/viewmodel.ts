import { dicasPara, mapasNaFaixa, mapasParaLevel, mapasProximos, novidadesNoLevel, questsParaLevel, veredito } from './advisor';
import type { Estado, Library, Limiares, Source, SyncInfo, ViewModel } from './types';

export type VMInput = {
  estado: Estado | null; lib: Library; fontes: Source[]; feitas: Set<string>; lim: Limiares;
  capturaPreta: boolean; jogoNaoEncontrado: boolean; hudIlegivel?: boolean; precisaWizard: boolean;
  opacidade: number; expandido: boolean; sync: SyncInfo; avisosExtras?: string[];
};

export function buildViewModel(i: VMInput): ViewModel {
  const { estado: e, lib } = i;
  const mapas = e ? mapasParaLevel(lib.maps, e.level) : [];
  const avisos: string[] = [];
  if (!i.fontes.length) avisos.push('Nenhuma fonte carregada. Verifique a conexão ou ligue a sincronização na aba Fontes.');
  if (i.sync.offline) avisos.push(i.sync.motivo === 'sitemap'
    ? 'O sitemap do site mudou (sem guias reconhecidos); usando guias em cache.'
    : 'Sem conexão com o site: usando guias em cache.');
  if (i.capturaPreta) avisos.push('Captura preta: o jogo parece estar em tela cheia exclusiva. Use o modo janela/borderless ou mova o widget para o 2º monitor.');
  if (i.jogoNaoEncontrado) avisos.push('Janela do jogo não encontrada. O MapleStory minimiza ao perder o foco: restaure a janela (clique nele na barra de tarefas) e, no assistente, confira a janela escolhida.');
  if (i.hudIlegivel && !i.jogoNaoEncontrado && !i.capturaPreta) avisos.push('O jogo está sendo capturado, mas não consegui ler level/EXP. Deixe o personagem na tela de jogo (HUD visível) e recalibre em Fontes → Recalibrar HUD.');
  if (e?.semLeitura) avisos.push('Sem leitura da HUD agora (mantendo último valor).');
  const comErro = i.fontes.filter((f) => f.status === 'erro').length;
  if (comErro) avisos.push(comErro === 1 ? '1 fonte com erro (usando cache)' : `${comErro} fontes com erro (usando cache)`);

  if (i.avisosExtras) avisos.push(...i.avisosExtras);

  const dicas = e ? dicasPara(lib.tips, e.level, e.classe) : [];
  return {
    estado: e,
    veredito: e ? veredito(e.expPorHora, mapas[0], i.lim) : { cor: 'cinza', pct: null },
    mapas,
    mapasFaixa: e ? mapasNaFaixa(lib.maps, e.level) : [],
    mapasProximos: e ? mapasProximos(lib.maps, e.level) : [],
    espera: i.capturaPreta ? 'Captura preta' : i.jogoNaoEncontrado ? 'Jogo não encontrado' : i.hudIlegivel ? 'HUD não lida' : 'Aguardando jogo…',
    quests: e ? questsParaLevel(lib.quests, e.level, i.feitas) : [],
    dicas,
    levelUp: e?.upou
      ? { de: e.level - 1, para: e.level, dicas, novidades: novidadesNoLevel(lib.maps, lib.quests, e.level) }
      : undefined,
    fontes: i.fontes, avisos, capturaPreta: i.capturaPreta, sync: i.sync,
    precisaWizard: i.precisaWizard, opacidade: i.opacidade, expandido: i.expandido,
  };
}
