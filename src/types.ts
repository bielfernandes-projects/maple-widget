export type Img = { w: number; h: number; data: Uint8ClampedArray }; // RGBA
export type Region = { x: number; y: number; w: number; h: number }; // normalizado 0..1
export type Regions = { level: Region; exp: Region; cls: Region; map: Region };

export type Reading = {
  level?: number; expAbs?: number; expPct?: number;
  map?: string; cls?: string; t: number;
};
export type Estado = {
  level: number; classe?: string; expAbs: number; expPct: number;
  mapa?: string; expPorHora: number; upou: boolean; semLeitura: boolean;
};

export type Mob = { name: string; id?: string; iconUrl?: string };
export type GrindMap = {
  name: string; street: string; maxExpHr: number; mob: Mob; why: string;
  levelMin: number; levelMax: number; sourceUrl: string;
};
export type Quest = {
  id: string; name: string; npc: string; level: number; exp: number;
  reward: string; area?: string; iconUrl?: string; sourceUrl: string;
};
export type ExpRow = { level: number; toNext: number };
export type Tip = {
  kind: 'ap' | 'sp'; guide: string; title: string; text: string;
  levelMin?: number; levelMax?: number; sourceUrl: string;
};
export type ParsedGuide = {
  title: string; maps: GrindMap[]; quests: Quest[]; expRows: ExpRow[]; tips: Tip[];
};

export type Source = {
  url: string; title: string; fetchedAt: number;
  status: 'ok' | 'erro' | 'vazio'; error?: string;
  counts: { maps: number; quests: number; expRows: number; tips: number };
  lastmod?: string; auto?: boolean; parserVersion?: number;
};
export type SourceData = ParsedGuide & { source: Source };
export type Library = { maps: GrindMap[]; quests: Quest[]; expRows: ExpRow[]; tips: Tip[] };

// base do jogo (meowdb): monstros com onde aparecem + índices de mapas/NPCs/itens
export type Local = { mapaId: string; mapa: string; regiao: string; qtd: number; respawn?: string };
export type Monster = { id: string; name: string; level: number; exp: number; hp: number; iconUrl?: string; locais: Local[]; sourceUrl: string };
export type Entrada = { tipo: 'item' | 'npc' | 'mapa'; id: string; nome: string; info?: string; sourceUrl: string };
export type GameDb = { monstros: Monster[]; entradas: Entrada[] };

export type Limiares = { verde: number; amarelo: number };
export type Veredito = { cor: 'verde' | 'amarelo' | 'vermelho' | 'cinza'; pct: number | null; ref?: GrindMap };

export type Config = {
  gamePath: string;
  assistentePulado: boolean;
  janelaJogo: string; // '' = detectar automaticamente
  regions: Record<string, Regions>;
  escalas: Record<string, number>; // escala de captura por "{w}x{h}" do quadro bruto (ausente = 1)
  sources: string[];
  dominios: string[];
  limiares: Limiares;
  questsFeitas: string[];
  opacidade: number;
  janela: { x?: number; y?: number; expandido: boolean };
  autoSync: boolean; sitemapUrl: string;
  fontesFixas: string[];
};

export type SyncInfo = { auto: boolean; guias: number; ultima: number; offline: boolean; motivo?: 'offline' | 'sitemap' };

export type ViewModel = {
  estado: Estado | null;
  veredito: Veredito;
  mapas: GrindMap[]; // os 3 melhores do level (aba Agora)
  mapasFaixa: GrindMap[]; // todos os que cobrem o level
  mapasProximos: GrindMap[]; // começam até +3 levels acima
  espera: string; // texto do cabeçalho quando não há leitura
  quests: Quest[];
  dicas: Tip[];
  levelUp?: { de: number; para: number; dicas: Tip[]; novidades: { maps: GrindMap[]; quests: Quest[] } };
  fontes: Source[];
  avisos: string[];
  capturaPreta: boolean;
  precisaWizard: boolean;
  opacidade: number;
  expandido: boolean;
  sync: SyncInfo;
};
