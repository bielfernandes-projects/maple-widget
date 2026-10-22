// Escolha pura da janela do jogo (sem Electron): preferida exata, senão heurística.
const EXCLUI = ['|', '—', ' - ', 'chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', 'terminal', 'visual studio', 'widget', 'overlay'];

export function escolherJanela(nomes: string[], preferido?: string): string | undefined {
  const lista = nomes.filter((n): n is string => typeof n === 'string' && n !== '');
  if (preferido && lista.includes(preferido)) return preferido;
  return lista
    .filter((n) => { const l = n.toLowerCase(); return l.startsWith('maplestory') && !EXCLUI.some((t) => l.includes(t)); })
    .sort((a, b) => a.length - b.length)[0];
}
