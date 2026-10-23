import type { Config, Regions, ViewModel } from '../types';
export interface Api {
  onVM(cb: (vm: ViewModel) => void): void;
  addSource(url: string): Promise<{ ok: boolean; erro?: string }>;
  removeSource(url: string): Promise<void>;
  refreshSources(): Promise<void>;
  openSource(url: string): Promise<void>;
  syncNow(): Promise<void>;
  setAutoSync(on: boolean): Promise<void>;
  toggleQuest(id: string): Promise<void>;
  setExpanded(b: boolean): Promise<void>;
  setCalibSize(): Promise<void>;
  setSize(w: number, h: number): Promise<void>;
  apoiar(como: 'kofi' | 'pix'): Promise<void>;
  search(q: string): Promise<{ resultados: import('../search').Resultado[]; monstros: number; sincronizando: boolean }>;
  onBuscar(cb: () => void): void;
  setOpacity(n: number): Promise<void>;
  pickGameFolder(): Promise<string | null>;
  getShot(janelaJogo?: string, gamePath?: string): Promise<{ dataUrl: string; w: number; h: number; fuente: 'vivo' | 'arquivo'; nativa: boolean } | null>;
  listWindows(): Promise<string[]>;
  saveCalibration(key: string, regions: Regions | null, gamePath: string, janelaJogo?: string): Promise<{ ok: boolean; erro?: string }>;
  checkFolder(path: string): Promise<boolean>;
  skipWizard(): Promise<void>;
  getConfig(): Promise<Config>;
  autoEscala(): Promise<{ ok: boolean; escala?: number; pontos?: number; erro?: string }>;
  quit(): Promise<void>;
}
declare global { interface Window { api: Api } }
