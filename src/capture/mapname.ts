// Nome do mapa lido por OCR em resolução não validada erra de forma sistemática ("Corner" -> "Comer"):
// em vez de confiar no texto, casa com a lista de mapas conhecidos (meowdb) e devolve o nome certo.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/l/g, 'i'); // l=i: numeral romano sai como l
function dist(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export type Indice = { nome: string; k: string }[];
export const indiceDeMapas = (nomes: string[]): Indice => [...new Set(nomes)].map((nome) => ({ nome, k: norm(nome) })).filter((x) => x.k.length >= 3);

// texto do OCR (pode ter várias linhas: região + mapa) -> nome conhecido mais parecido, ou undefined
export function acharMapa(texto: string | undefined, idx: Indice, maxFrac = 0.34): string | undefined {
  if (!texto || !idx.length) return undefined;
  const linhas = texto.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const cands = [...new Set([texto, ...linhas])].map(norm).filter((c) => c.length >= 3);
  let best: { nome: string; f: number } | undefined, empate = false;
  for (const c of cands) for (const x of idx) {
    const d = dist(c, x.k), f = d / Math.max(c.length, x.k.length);
    if (f > maxFrac) continue;
    if (!best || f < best.f) { best = { nome: x.nome, f }; empate = false; }
    else if (f === best.f && x.nome !== best.nome) empate = true; // dois nomes igualmente parecidos: não chuta
  }
  return best && !empate ? best.nome : undefined;
}
