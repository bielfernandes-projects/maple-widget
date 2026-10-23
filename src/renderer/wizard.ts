import type { Region, Regions } from '../types';
import { escolherJanela } from '../capture/window';

const ORDEM: { key: keyof Regions; nome: string }[] = [
  { key: 'level', nome: 'o número do LEVEL (ao lado de "LV.")' },
  { key: 'cls', nome: 'o nome da CLASSE (ex.: Archer) e o nick' },
  { key: 'exp', nome: 'o texto da EXP (ex.: EXP 1 [0.02%])' },
  { key: 'map', nome: 'o nome do MAPA no minimapa (região + mapa)' },
];
const TOTAL = 4;
const PASTA_PADRAO = 'C:\\Nexon\\Library\\maplestorycw';
const clamp = (n: number) => Math.min(1, Math.max(0, n));

// só textContent: nada vindo do main/jogo vira HTML
const el = <K extends keyof HTMLElementTagNameMap>(t: K, c?: string, txt?: string) => {
  const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e;
};

export function startWizard(onDone: () => void) {
  const app = document.getElementById('app')!;
  let gamePath = '';
  let janela = ''; // '' = detectar automaticamente
  let shotKey = '', regs: Regions | null = null;
  let busy = false, terminou = false, tok = 0;
  void window.api.setExpanded(true);

  // botões com `ok` só ficam ativos quando a condição vale (e nada está pendente)
  type Btn = HTMLButtonElement & { ok?: () => boolean };
  const atualizar = () => { for (const b of app.querySelectorAll('button')) (b as Btn).disabled = busy || ((b as Btn).ok ? !(b as Btn).ok!() : false); };
  const btn = (txt: string, fn: () => void | Promise<void>, ok?: () => boolean) => {
    const b = el('button', undefined, txt) as Btn; b.ok = ok;
    b.onclick = async () => {
      if (busy) return;
      busy = true; atualizar();
      try { await fn(); } catch (e) { console.error('wizard', e); } finally { busy = false; atualizar(); }
    };
    return b;
  };
  const show = (...kids: Node[]) => { app.replaceChildren(el('div', 'head drag', 'Configuração inicial'), ...kids); atualizar(); };
  const body = (...kids: Node[]) => { const b = el('div', 'body nodrag'); b.append(...kids); return b; };
  const fim = () => { if (terminou) return; terminou = true; void window.api.setExpanded(false); onDone(); };

  const passo1 = async () => {
    const t = ++tok;
    const cfg = await window.api.getConfig();
    if (t !== tok) return;
    gamePath = cfg?.gamePath || PASTA_PADRAO;
    janela = cfg?.janelaJogo ?? '';
    let pastaOk = false;
    const pasta = el('div', 'm', gamePath);
    const msg = el('div', 'm');
    const checar = async () => {
      const ok = await window.api.checkFolder(gamePath);
      if (t !== tok) return;
      pastaOk = ok; msg.textContent = ok ? '' : 'Pasta não encontrada. Escolha a pasta de instalação do jogo.'; atualizar();
    };
    show(body(el('h4', undefined, `Passo 1/${TOTAL} · Pasta do jogo`), pasta,
      btn('Escolher pasta do jogo', async () => { const p = await window.api.pickGameFolder(); if (p && t === tok) { gamePath = p; pasta.textContent = p; await checar(); } }),
      msg,
      btn('Próximo: janela do jogo', passo2, () => pastaOk),
      btn('Pular configuração', async () => { await window.api.skipWizard(); fim(); })));
    await checar();
  };

  const passo2 = async () => {
    void window.api.setExpanded(true);
    const t = ++tok;
    const nomes = await window.api.listWindows();
    if (t !== tok) return;
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
      el('div', 'm', 'Não vê o MapleStory na lista? Ele não aparece se estiver minimizado: restaure a janela do jogo e clique em Atualizar lista.'),
      btn('Atualizar lista', passo2),
      btn('Próximo: calibrar HUD', () => { janela = sel; return passo3(); }),
      btn('Voltar', passo1)));
  };

  // O jogo minimiza ao perder o foco: a imagem é tirada após uma contagem, com o jogo à frente.
  const passo3 = () => {
    void window.api.setExpanded(true);
    const t = ++tok;
    const msg = el('div', 'm');
    show(body(el('h4', undefined, `Passo 3/${TOTAL} · Calibrar HUD`),
      el('div', 'm', 'Deixe o MapleStory visível, na tela do personagem (restaure-o se estiver minimizado). Ao clicar em Capturar, você terá 5 s para clicar na janela do jogo; a imagem é tirada no fim da contagem.'),
      msg,
      btn('Capturar em 5 s', async () => {
        for (let i = 5; i > 0; i--) { msg.textContent = `Capturando em ${i}…`; await new Promise((r) => setTimeout(r, 1000)); if (t !== tok) return; }
        await calibrar();
      }),
      btn('Voltar', passo2), btn('Pular calibração', async () => passo4())));
  };

  const calibrar = async () => {
    void window.api.setCalibSize();
    const t = ++tok;
    const msg = el('div', 'm', 'Capturando…');
    const caixa = body(el('h4', undefined, `Passo 3/${TOTAL} · Calibrar HUD`), msg);
    show(caixa);
    const shot = await window.api.getShot(janela, gamePath);
    if (t !== tok) return;
    if (!shot) {
      msg.textContent = 'Não consegui obter uma imagem do jogo. Ele pode estar minimizado: deixe-o visível (modo janela/borderless) e tente de novo.';
      caixa.append(btn('Tentar de novo', passo3), btn('Voltar', passo2), btn('Pular calibração', async () => passo4()));
      atualizar();
      return;
    }
    const info = el('div', 'm');
    const cv = el('canvas');
    const ctx = cv.getContext('2d')!;
    const img = new Image();
    const feitas: Region[] = [];
    let drag: { x: number; y: number } | null = null;
    let cur: Region | null = null;
    cv.style.width = '100%'; cv.style.display = 'block'; cv.style.userSelect = 'none'; cv.style.border = '1px solid #2c3040'; cv.style.cursor = 'crosshair';
    const say = () => (info.textContent = `Passo 3/${TOTAL} · Arraste um retângulo sobre ${ORDEM[feitas.length].nome}.`);
    const paint = () => {
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
      for (const r of [...feitas, cur]) if (r) ctx.strokeRect(r.x * cv.width, r.y * cv.height, r.w * cv.width, r.h * cv.height);
    };
    const pos = (e: MouseEvent) => { const b = cv.getBoundingClientRect(); return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) }; };
    const move = (e: MouseEvent) => {
      if (!drag) return; const p = pos(e);
      cur = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) }; paint();
    };
    const soltar = (e: MouseEvent) => {
      if (drag) move(e);
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', soltar);
      document.removeEventListener('mouseleave', cancelar);
      drag = null;
      const r = cur; cur = null;
      if (!r || r.w < 0.003 || r.h < 0.003 || feitas.length >= ORDEM.length) { paint(); return; }
      feitas.push(r); paint();
      if (feitas.length < ORDEM.length) say();
      else {
        shotKey = `${shot.w}x${shot.h}`;
        regs = Object.fromEntries(ORDEM.map((o, k) => [o.key, feitas[k]])) as Regions;
        passo4();
      }
    };
    const cancelar = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', soltar);
      document.removeEventListener('mouseleave', cancelar);
      drag = null; cur = null; paint();
    };
    cv.onmousedown = (e) => {
      e.preventDefault(); // sem seleção de texto/arrasto nativo durante o retângulo
      drag = pos(e);
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', soltar);
      document.addEventListener('mouseleave', cancelar);
    };
    img.onerror = () => { info.textContent = 'Não foi possível exibir a imagem.'; };
    img.onload = () => { cv.width = shot.w; cv.height = shot.h; paint(); say(); };
    img.src = shot.dataUrl;
    const aviso = shot.fuente === 'arquivo'
      ? el('div', 'warn', `Calibração feita sem o jogo aberto: só vale se a janela capturada tiver exatamente ${shot.w}x${shot.h}. Recomendado recalibrar com o jogo aberto (aba Fontes → Recalibrar HUD).`)
      : null;
    const escMsg = el('div', 'm');
    // btn() já desabilita todos os botões enquanto a detecção roda
    const detectar = btn('Detectar escala', async () => {
      escMsg.textContent = 'Detectando escala…';
      const r = await window.api.autoEscala();
      escMsg.textContent = r?.ok ? `Escala ${r.escala} (pontuação ${r.pontos}/6).` : (r?.erro ?? 'Não foi possível detectar a escala.');
    });
    show(body(...(aviso ? [aviso] : []), info, cv,
      ...(shot.nativa && shot.fuente === 'vivo' ? [detectar, escMsg] : []),
      btn('Desfazer último retângulo', () => { feitas.pop(); paint(); say(); }),
      btn('Voltar', passo2), btn('Pular calibração', async () => passo4())));
  };

  const passo4 = () => {
    ++tok; void window.api.setExpanded(true);
    const msg = el('div', 'm');
    show(body(el('h4', undefined, `Passo 4/${TOTAL} · Guias`),
      el('div', 'm', 'Todos os guias do MapleStory Classic no meowdb entram automaticamente e se mantêm atualizados. Links extras podem ser colados depois, na aba Fontes.'),
      btn('Sincronizar agora', async () => { msg.textContent = 'Sincronizando…'; await window.api.syncNow(); msg.textContent = 'Guias sincronizados.'; }),
      msg,
      btn('Concluir', async () => {
        const r = await window.api.saveCalibration(shotKey, regs, gamePath, janela); // regs null: só pasta e janela
        if (!r?.ok) { msg.textContent = r?.erro ?? 'Não foi possível salvar a configuração.'; return; }
        fim();
      })));
  };

  void passo1();
}
