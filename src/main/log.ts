import fs from 'node:fs';
import { format } from 'node:util';

// userData\log.txt: o build portable não mostra stdout, então o console é espelhado num arquivo. Nada aqui pode lançar.
const MAX_INICIO = 1_000_000, MANTER = 200_000;

// no início: > 1 MB recomeça do zero; > 200 KB fica só com o final (a partir de uma linha inteira)
export function prepararLog(file: string) {
  try {
    const n = fs.statSync(file).size;
    if (n > MAX_INICIO) fs.writeFileSync(file, '');
    else if (n > MANTER) {
      const buf = fs.readFileSync(file).subarray(n - MANTER);
      const nl = buf.indexOf(10);
      fs.writeFileSync(file, nl >= 0 ? buf.subarray(nl + 1) : buf);
    }
  } catch { /* sem arquivo ou sem permissão: segue */ }
}

type Cons = { log: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
// cada chamada vai para o console original e vira uma linha "ISO [nível] mensagem" no arquivo
export function espelharConsole(file: string, c: Cons = console) {
  for (const nivel of ['log', 'warn', 'error'] as const) {
    const orig = c[nivel].bind(c);
    c[nivel] = (...a: unknown[]) => {
      orig(...a);
      try { fs.appendFileSync(file, `${new Date().toISOString()} [${nivel}] ${format(...a)}\n`); } catch { /* ignora */ }
    };
  }
}
