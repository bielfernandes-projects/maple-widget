import type { Region, Regions } from '../types';
import { escolherJanela } from '../capture/window';

const ORDEM: { key: keyof Regions; nome: string }[] = [
  { key: 'level', nome: 'o número do LEVEL (ao lado de "LV.")' },
  { key: 'cls', nome: 'o nome da CLASSE (ex.: Archer) e o nick' },
  { key: 'exp', nome: 'o texto da EXP (ex.: EXP 1 [0.02%])' },
  { key: 'map', nome: 'o nome do MAPA no minimapa (região + mapa)' },
];
const TOTAL = 4;

// só textContent: nada vindo do main/jogo vira HTML
const el = <K extends keyof HTMLElementTagNameMap>(t: K, c?: string, txt?: string) => {
  const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e;
};

export function startWizard(onDone: () => void) {
  const app = document.getElementById('app')!;
  let gamePath = '';
  let janela = ''; // '' = detectar automaticamente
  let shotKey = '', regs: Regions | null = null;
  void window.api.setExpanded(true);

  const show = (...kids: Node[]) => app.replaceChildren(el('div', 'head drag', 'Configuração inicial'), ...kids);
  const body = (...kids: Node[]) => { const b = el('div', 'body nodrag'); b.append(...kids); return b; };
  const btn = (txt: string, fn: () => void) => { const b = el('button', undefined, txt); b.onclick = fn; return b; };
  // pular deixa o app utilizável; tudo pode ser refeito em Fontes > Recalibrar HUD
  const concluir = async (salvar = true) => {
    if (salvar) await window.api.saveCalibration(shotKey, regs, gamePath, janela); // regs null: só pasta e janela
    void window.api.setExpanded(false); onDone();
  };

  const passo1 = async () => {
    const cfg = await window.api.getConfig();
    gamePath = cfg?.gamePath || 'C:\\Nexon\\Library\\maplestorycw';
    janela = cfg?.janelaJogo ?? '';
    const pasta = el('div', 'm', gamePath);
    show(body(el('h4', undefined, `Passo 1/${TOTAL} · Pasta do jogo`), pasta,
      btn('Escolher pasta do jogo', async () => { const p = await window.api.pickGameFolder(); if (p) { gamePath = p; pasta.textContent = p; } }),
      btn('Próximo: janela do jogo', () => void passo2()),
      btn('Pular configuração', () => void concluir(false))));
  };

  const passo2 = async () => {
    const nomes = await window.api.listWindows();
    let sel = janela && nomes.includes(janela) ? janela : (escolherJanela(nomes) ?? '');
    const lista = el('div', 'wlist');
    const marcar = () => { for (const b of lista.querySelectorAll('button')) b.classList.toggle('on', (b as HTMLButtonElement).dataset.n === sel); };
    const item = (rotulo: string, valor: string) => {
      const b = el('button', undefined, rotulo); b.dataset.n = valor; b.onclick = () => { sel = valor; marcar(); }; return b;
    };
    lista.append(item('Detectar automaticamente', ''), ...nomes.map((n) => item(n, n)));
    marcar();
    show(body(el('h4', undefined, `Passo 2/${TOTAL} · Janela do jogo`),
      el('div', 'm', nomes.length ? 'Escolha a janela do MapleStory (ou detecte automaticamente).' : 'Nenhuma janela encontrada. Abra o jogo ou use a detecção automática.'),
      lista,
      btn('Próximo: calibrar HUD', () => { janela = sel; void passo3(); }),
      btn('Voltar', () => void passo1())));
  };

  const passo3 = async () => {
    const msg = el('div', 'm', 'Capturando…');
    const caixa = body(el('h4', undefined, `Passo 3/${TOTAL} · Calibrar HUD`), msg);
    show(caixa);
    const shot = await window.api.getShot(janela, gamePath);
    if (!shot) {
      msg.textContent = 'Não consegui obter uma imagem do jogo. Abra o jogo (modo janela/borderless) ou tire um screenshot no jogo e tente de novo.';
      caixa.append(btn('Tentar de novo', () => void passo3()), btn('Voltar', () => void passo2()), btn('Pular calibração', () => void passo4()));
      return;
    }
    const info = el('div', 'm');
    const cv = el('canvas');
    const ctx = cv.getContext('2d')!;
    const img = new Image();
    const feitas: Partial<Regions> = {};
    let i = 0;
    let drag: { x: number; y: number } | null = null;
    let cur: Region | null = null;
    cv.style.width = '316px'; cv.style.border = '1px solid #2c3040'; cv.style.cursor = 'crosshair';
    const say = () => (info.textContent = `Passo 3/${TOTAL} · Arraste um retângulo sobre ${ORDEM[i].nome}.`);
    const paint = () => {
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
      for (const r of [...Object.values(feitas), cur]) if (r) ctx.strokeRect(r.x * cv.width, r.y * cv.height, r.w * cv.width, r.h * cv.height);
    };
    const pos = (e: MouseEvent) => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
    cv.onmousedown = (e) => { drag = pos(e); };
    cv.onmousemove = (e) => {
      if (!drag) return; const p = pos(e);
      cur = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) }; paint();
    };
    cv.onmouseup = () => {
      drag = null;
      if (!cur || cur.w < 0.003 || cur.h < 0.003) { cur = null; return; }
      feitas[ORDEM[i].key] = cur; cur = null; i++; paint();
      if (i < ORDEM.length) say();
      else { shotKey = `${shot.w}x${shot.h}`; regs = feitas as Regions; passo4(); }
    };
    img.onerror = () => { info.textContent = 'Não foi possível exibir a imagem.'; };
    img.onload = () => { cv.width = shot.w; cv.height = shot.h; paint(); say(); };
    img.src = shot.dataUrl;
    show(body(info, cv, btn('Voltar', () => void passo2()), btn('Pular calibração', () => passo4())));
  };

  const passo4 = () => {
    const msg = el('div', 'm');
    show(body(el('h4', undefined, `Passo 4/${TOTAL} · Guias`),
      el('div', 'm', 'Todos os guias do MapleStory Classic no meowdb entram automaticamente e se mantêm atualizados. Links extras podem ser colados depois, na aba Fontes.'),
      btn('Sincronizar agora', async () => { msg.textContent = 'Sincronizando…'; await window.api.syncNow(); msg.textContent = 'Guias sincronizados.'; }),
      msg,
      btn('Concluir', () => void concluir())));
  };

  void passo1();
}
