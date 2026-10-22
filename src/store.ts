import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  gamePath: '',
  regions: {},
  sources: [],
  dominios: ['meowdb.com', 'niadb.com'],
  limiares: { verde: 0.7, amarelo: 0.4 },
  questsFeitas: [],
  opacidade: 0.92,
  janela: { expandido: false },
};

export class Store {
  private file: string;
  constructor(dir: string) { fs.mkdirSync(dir, { recursive: true }); this.file = path.join(dir, 'config.json'); }
  load(): Config {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; }
    catch { return structuredClone(DEFAULT_CONFIG); }
  }
  save(c: Config) { fs.writeFileSync(this.file, JSON.stringify(c, null, 2)); }
}
