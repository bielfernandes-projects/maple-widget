import fs from 'node:fs';
import path from 'node:path';

// arquivos nossos na pasta antiga `cache\` (que no Windows é a mesma `Cache\` do Chromium): sha1(url).json e o índice da sincronização
const NOSSO = /^(?:[0-9a-f]{40}|auto-index)\.json$/;
export const ficheirosParaMigrar = (nomes: unknown[]): string[] => nomes.filter((n): n is string => typeof n === 'string' && NOSSO.test(n));

// cópia única (melhor esforço) de `velho` para `novo` quando `novo` ainda não existe; nunca lança nem altera `velho`. Retorna quantos copiou.
export function migrarCacheGuias(velho: string, novo: string): number {
  try {
    if (fs.existsSync(novo) || !fs.existsSync(velho)) return 0;
    const nomes = ficheirosParaMigrar(fs.readdirSync(velho)).filter((n) => fs.statSync(path.join(velho, n)).isFile());
    if (!nomes.length) return 0;
    fs.mkdirSync(novo, { recursive: true });
    let n = 0;
    for (const f of nomes) { try { fs.copyFileSync(path.join(velho, f), path.join(novo, f), fs.constants.COPYFILE_EXCL); n++; } catch { /* segue */ } }
    return n;
  } catch { return 0; }
}
