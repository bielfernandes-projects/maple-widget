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
  autoSync: true,
  sitemapUrl: 'https://meowdb.com/msclassic/sitemap.xml',
};

export class Store {
  private file: string;
  constructor(dir: string) { fs.mkdirSync(dir, { recursive: true }); this.file = path.join(dir, 'config.json'); }
  load(): Config {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return structuredClone(DEFAULT_CONFIG);
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        janela: { ...DEFAULT_CONFIG.janela, ...saved.janela },
        limiares: { ...DEFAULT_CONFIG.limiares, ...saved.limiares },
      };
    } catch { return structuredClone(DEFAULT_CONFIG); }
  }
  save(c: Config) {
    // escrita atômica: grava em .tmp e renomeia
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(c, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
