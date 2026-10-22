import type { Config, Regions, ViewModel } from '../types';
export interface Api {
  onVM(cb: (vm: ViewModel) => void): void;
  addSource(url: string): Promise<{ ok: boolean; erro?: string }>;
  removeSource(url: string): Promise<void>;
  refreshSources(): Promise<void>;
  syncNow(): Promise<void>;
  setAutoSync(on: boolean): Promise<void>;
  toggleQuest(id: string): Promise<void>;
  setExpanded(b: boolean): Promise<void>;
  setOpacity(n: number): Promise<void>;
  pickGameFolder(): Promise<string | null>;
  getShot(): Promise<{ dataUrl: string; w: number; h: number } | null>;
  saveCalibration(key: string, regions: Regions, gamePath: string): Promise<void>;
  getConfig(): Promise<Config>;
}
declare global { interface Window { api: Api } }
