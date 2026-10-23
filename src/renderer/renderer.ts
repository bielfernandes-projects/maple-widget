import type { GrindMap, Quest, Tip, ViewModel } from '../types';
import type { Resultado } from '../search';
import { startWizard } from './wizard';
import { safeIconUrl } from './safe-url';

type Kid = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> | null, ...kids: Kid[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids) if (c) el.append(c as Node | string); // strings viram nós de texto: nunca HTML
  return el;
}
const icon = (url?: string) => {
  const i = h('img', { referrerpolicy: 'no-referrer', alt: '' });
  const safe = safeIconUrl(url);
  if (safe) i.src = safe; else i.style.visibility = 'hidden';
  i.addEventListener('error', () => (i.style.visibility = 'hidden'));
  return i;
};
const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.round(n)));

const TETO = 'Referência: EXP/h máximo do guia (um teto, não uma média).';
let vm: ViewModel | null = null;
let tab: 'agora' | 'quests' | 'mapas' | 'buscar' | 'fontes' = 'agora';
let buscaQ = '';
let buscaRes: Resultado[] = [];
let buscaMsg = '';
let cardData: NonNullable<ViewModel['levelUp']> | null = null;
let cardUntil = 0;
let cardTimer: number | undefined;
let wizardActive = false;
let wizardDone = false;
let fontesMsg = '';
let dragging = false; // slider sendo arrastado: reconstruir o DOM mataria o arrasto
let lastKey = '';
const app = document.getElementById('app')!;

function runWizard() {
  wizardActive = true;
  try { startWizard(() => { wizardActive = false; wizardDone = true; lastKey = ''; render(); }); }
  catch (e) { console.error('wizard', e); wizardActive = false; wizardDone = true; lastKey = ''; }
}

// o mesmo level up (de/para) chega em vários vm seguidos: só arma o cartão uma vez por 60 s, e nunca de novo se foi dispensado
let ultimoLevelUp: { de: number; para: number; quando: number; dispensado: boolean } | null = null;
const LEVELUP_DEDUPE_MS = 60_000;
window.api.onVM((v) => {
  vm = v;
  const u = ultimoLevelUp, repetido = !!v.levelUp && !!u && u.de === v.levelUp.de && u.para === v.levelUp.para
    && (u.dispensado || Date.now() - u.quando < LEVELUP_DEDUPE_MS);
  if (v.levelUp && !repetido) {
    ultimoLevelUp = { de: v.levelUp.de, para: v.levelUp.para, quando: Date.now(), dispensado: false };
    cardData = v.levelUp; cardUntil = Date.now() + 15000;
    clearTimeout(cardTimer); cardTimer = window.setTimeout(() => { lastKey = ''; render(); }, 15000 + 50);
    if (!v.expandido) { v.expandido = true; void window.api.setExpanded(true); }
  }
  if (v.precisaWizard && !wizardActive && !wizardDone) runWizard();
  if (!wizardActive) render();
});

function render() {
  if (!vm || wizardActive || dragging) return;
  const ae = document.activeElement;
  if (ae instanceof HTMLInputElement && ae.type === 'text' && (ae.value !== '' || ae.classList.contains('busca'))) return; // usuário digitando
  const showCard = !!cardData && Date.now() < cardUntil;
  const key = JSON.stringify([vm, tab, showCard ? cardData : null]);
  if (key === lastKey) return;
  lastKey = key;
  const scroll = app.querySelector('.body')?.scrollTop ?? 0;
  const e = vm.estado;
  const head = h('div', { class: 'head drag' },
    h('span', { class: 'lv' }, e ? `Lv ${e.level}${e.classe ? ' ' + e.classe : ''}` : vm.espera),
    h('div', { class: 'bar' }, (() => { const i = h('i', null); i.style.width = `${Math.min(100, e?.expPct ?? 0)}%`; return i; })()),
    h('span', { class: 'rate' }, e ? `${(e.expPct).toFixed(2)}% · ${fmt(e.expPorHora)}/h` : ''),
    h('span', { class: `dot ${vm.veredito.cor}`, title: vm.veredito.pct === null ? 'sem dados' : `${Math.round(vm.veredito.pct * 100)}% do ideal. ${TETO}` }),
    h('button', { class: 'nodrag', 'aria-label': vm.expandido ? 'Recolher' : 'Expandir', title: vm.expandido ? 'Recolher' : 'Expandir',
      onclick: () => { vm!.expandido = !vm!.expandido; void window.api.setExpanded(vm!.expandido); render(); } }, vm.expandido ? '▴' : '▾'),
    h('button', { class: 'nodrag sair', 'aria-label': 'Sair', title: 'Sair do Maple Widget', onclick: () => void window.api.quit() }, '✕'),
  );
  const kids: Node[] = [head];
  if (vm.expandido) {
    if (showCard) kids.push(levelCard(cardData!));
    kids.push(h('div', { class: 'tabs nodrag', role: 'tablist' }, ...(['agora', 'quests', 'mapas', 'buscar', 'fontes'] as const).map((t) =>
      h('button', { class: t === tab ? 'on' : '', role: 'tab', 'aria-selected': String(t === tab), onclick: () => { tab = t; fontesMsg = ''; render(); } }, t === 'fontes' ? 'Config.' : t[0].toUpperCase() + t.slice(1)))));
    kids.push(h('div', { class: 'body nodrag' }, ...vm.avisos.map((a) => h('div', { class: 'warn' }, a)), ...tabBody(vm)));
  }
  app.replaceChildren(...kids);
  const body = app.querySelector('.body');
  if (body) body.scrollTop = scroll;
}

function tipBlock(t: Tip, label: string) {
  return h('div', null,
    h('p', null, `${label}: ${t.text}`),
    h('div', { class: 'm' }, `Fonte: ${t.guide}`),
    h('button', { 'aria-label': 'Abrir guia', onclick: (ev: Event) => { ev.stopPropagation(); void window.api.openSource(t.sourceUrl); } }, 'Abrir guia ↗'));
}
function levelCard(u: NonNullable<ViewModel['levelUp']>) {
  const sp = u.dicas.find((d) => d.kind === 'sp'), ap = u.dicas.find((d) => d.kind === 'ap');
  const nomes = (xs: { name: string }[]) => xs.slice(0, 3).map((x) => x.name).join(', ');
  const { maps, quests } = u.novidades;
  return h('div', { class: 'card nodrag', onclick: () => { cardUntil = 0; cardData = null; if (ultimoLevelUp) ultimoLevelUp.dispensado = true; lastKey = ''; render(); } },
    h('h4', null, `Level up! Lv ${u.de} → ${u.para}`),
    sp ? tipBlock(sp, 'SP') : null,
    ap ? tipBlock(ap, 'AP') : null,
    !sp && !ap ? h('p', null, 'Sem dica de AP/SP nas fontes configuradas.') : null,
    maps.length ? h('div', { class: 'm' }, `Mapas novos: ${nomes(maps)}${maps.length > 3 ? '…' : ''}`) : null,
    quests.length ? h('div', { class: 'm' }, `Quests novas: ${nomes(quests)}${quests.length > 3 ? '…' : ''}`) : null);
}

function mapRow(m: GrindMap) {
  return h('div', { class: 'row' }, icon(m.mob.iconUrl),
    h('div', { class: 't' }, h('b', null, m.name), h('span', { class: 'm' }, `${m.mob.name} · ${fmt(m.maxExpHr)}/h`)));
}
function questRow(q: Quest) {
  return h('div', { class: 'row' }, icon(q.iconUrl),
    h('div', { class: 't' }, h('b', null, q.name), h('span', { class: 'm' }, `${q.npc}${q.area ? ' · ' + q.area : ''} · Lv ${q.level} · ${q.exp} EXP${q.reward ? ' · ' + q.reward : ''}`)),
    h('button', { title: 'Marcar como feita', 'aria-label': 'Marcar como feita', onclick: () => void window.api.toggleQuest(q.id) }, '✓'));
}
const empty = (t: string) => h('div', { class: 'empty' }, t);
const emptyAdd = (t: string) => h('div', { class: 'empty' }, t, h('br', null),
  h('button', { onclick: () => { tab = 'fontes'; render(); } }, 'Adicionar fonte'));

function tabBody(v: ViewModel): Kid[] {
  if (tab === 'agora') {
    const best = v.mapas[0];
    return [
      h('div', { class: 'row' }, h('div', { class: 't' },
        h('b', null, v.estado?.mapa ?? 'Mapa desconhecido'),
        h('div', { class: 'm' }, best && v.veredito.pct !== null
          ? `${Math.round(v.veredito.pct * 100)}% do ideal (${fmt(best.maxExpHr)}/h em ${best.name})`
          : 'Sem comparação disponível'),
        h('div', { class: 'm' }, TETO))),
      h('b', null, 'Melhores mapas para seu level'),
      ...(v.mapas.length ? v.mapas.map(mapRow) : [v.fontes.length ? empty('Nenhum mapa para este level nas fontes.') : emptyAdd('Nenhuma fonte carregada.')]),
    ];
  }
  if (tab === 'quests') return v.quests.length ? v.quests.map(questRow) : [v.fontes.length ? empty('Nenhuma quest para este level nas fontes.') : emptyAdd('Nenhuma fonte carregada.')];
  if (tab === 'mapas') {
    if (!v.mapasFaixa.length && !v.mapasProximos.length) return [v.fontes.length ? empty('Nenhum mapa para este level nas fontes.') : emptyAdd('Nenhuma fonte carregada.')];
    const lin = (m: GrindMap) => h('div', null, mapRow(m), h('div', { class: 'm faixa' }, `Lv ${m.levelMin}–${m.levelMax}${m.why ? ' · ' + m.why : ''}`));
    return [
      h('b', null, `No seu level (${v.mapasFaixa.length})`),
      ...(v.mapasFaixa.length ? v.mapasFaixa.map(lin) : [empty('Nenhum mapa cobre este level.')]),
      ...(v.mapasProximos.length ? [h('b', { class: 'sec' }, `Em breve (até Lv +3) · ${v.mapasProximos.length}`), ...v.mapasProximos.map(lin)] : []),
    ];
  }
  if (tab === 'buscar') return buscaTab();
  return fontesTab(v);
}

const TIPOS = { monstro: 'Monstro', mapa: 'Mapa', quest: 'Quest', npc: 'NPC', item: 'Item' } as const;
const abertos = new Set<string>(), verTudo = new Set<string>(); // sobrevivem ao render() (o vm chega a cada 2 s)
const PREVIA = 6;
function resRow(r: Resultado) {
  const k = r.tipo + '|' + r.url;
  const det = h('div', { class: 'det' });
  const pinta = () => {
    const kids: Kid[] = [];
    for (const sec of r.secoes) {
      const sk = k + '|' + sec.titulo, todos = verTudo.has(sk), ls = todos ? sec.linhas : sec.linhas.slice(0, PREVIA);
      kids.push(h('div', { class: 'sec-t' }, sec.titulo), sec.nota ? h('div', { class: 'nota' }, sec.nota) : null,
        h('div', { class: 'tab' }, ...ls.map((l) => h('div', { class: 'tr' }, icon(l.iconUrl), h('span', { class: 'tn', title: l.nome }, l.nome), h('span', { class: 'ti' }, l.info ?? '')))),
        sec.linhas.length > PREVIA ? h('button', { class: 'mais', onclick: (ev: Event) => { ev.stopPropagation(); if (todos) verTudo.delete(sk); else verTudo.add(sk); pinta(); } },
          todos ? 'Ver menos ▴' : `Ver mais (+${sec.linhas.length - PREVIA}) ▾`) : null);
    }
    if (!r.secoes.length) kids.push(h('div', { class: 'm' }, 'Sem detalhes aqui; veja no meowdb.'));
    kids.push(h('button', { onclick: (ev: Event) => { ev.stopPropagation(); void window.api.openSource(r.url); } }, 'Abrir no meowdb ↗'));
    det.replaceChildren(...kids.filter((x): x is Node => !!x));
  };
  pinta();
  det.hidden = !abertos.has(k);
  const row = h('div', { class: 'row res', onclick: () => { if (abertos.has(k)) abertos.delete(k); else abertos.add(k); det.hidden = !abertos.has(k); } }, icon(r.iconUrl),
    h('div', { class: 't' }, h('b', null, r.titulo), h('span', { class: 'm' }, [TIPOS[r.tipo], r.sub].filter(Boolean).join(' · '))));
  return h('div', null, row, det);
}
function buscaTab(): Kid[] {
  const input = h('input', { type: 'text', class: 'busca', placeholder: 'Buscar mob, mapa, quest, NPC ou item…', maxlength: '100', value: buscaQ });
  const status = h('div', { class: 'm' }, buscaMsg);
  const lista = h('div', null);
  const pinta = () => lista.replaceChildren(...(buscaRes.length ? buscaRes.map(resRow) : [empty(buscaQ.trim() ? 'Nada encontrado.' : 'Digite um nome para buscar.')]));
  const consulta = async () => {
    const q = input.value;
    const r = await window.api.search(q);
    if (q !== input.value) return; // chegou depois de outra digitação
    buscaRes = r.resultados;
    buscaMsg = r.monstros ? '' : (r.sincronizando ? 'Baixando a base do jogo (primeira vez, pode levar alguns minutos)…' : 'Base do jogo ainda não carregada (precisa de internet na primeira vez).');
    status.textContent = buscaMsg; pinta();
  };
  let timer: number | undefined;
  input.addEventListener('input', () => { buscaQ = input.value; clearTimeout(timer); timer = window.setTimeout(() => void consulta(), 150); });
  pinta(); void consulta();
  return [input, status, lista];
}

function fontesTab(v: ViewModel): Kid[] {
  const input = h('input', { type: 'text', placeholder: 'Link extra (opcional) e Enter' });
  const msg = h('div', { class: 'm' }, fontesMsg);
  const add = async () => {
    const url = input.value.trim();
    if (!url) return;
    fontesMsg = '';
    try {
      const r = await window.api.addSource(url);
      fontesMsg = r.ok ? 'Adicionada.' : (r.erro ?? 'Erro ao adicionar a fonte.');
    } catch { fontesMsg = 'Erro ao adicionar a fonte.'; }
    input.blur(); lastKey = ''; render();
  };
  input.addEventListener('keydown', (ev) => { if ((ev as KeyboardEvent).key === 'Enter') void add(); });
  const auto = h('div', { class: 'row' },
    h('div', { class: 't' }, h('b', null, 'Sincronização automática (meowdb)'),
      h('span', { class: 'm' }, v.sync.auto
        ? `${v.sync.guias} guias · ${v.sync.ultima ? 'sincronizado às ' + new Date(v.sync.ultima).toLocaleTimeString('pt-BR') : 'aguardando'}${v.sync.offline ? ' · offline (cache)' : ''}`
        : 'desligada')),
    h('button', { onclick: () => void window.api.setAutoSync(!v.sync.auto) }, v.sync.auto ? 'Desligar' : 'Ligar'),
    h('button', { title: 'Sincronizar agora', 'aria-label': 'Sincronizar agora', onclick: () => void window.api.syncNow() }, '⟳'));
  return [
    ajustes(v), auto, h('div', { class: 'row' }, input, h('button', { onclick: () => void add() }, 'Adicionar')), msg,
    ...v.fontes.filter((f) => !f.auto).map((f) => h('div', { class: 'row' }, h('div', { class: 't' }, h('b', null, f.title),
      h('span', { class: 'm' }, `${f.status} · ${f.counts.maps} mapas, ${f.counts.quests} quests, ${f.counts.tips} dicas · ${f.fetchedAt ? new Date(f.fetchedAt).toLocaleString('pt-BR') : 'nunca'}`)),
      h('button', { title: 'Remover fonte', 'aria-label': 'Remover fonte', onclick: () => void window.api.removeSource(f.url) }, '✕'))),
    v.fontes.some((f) => !f.auto) ? h('button', { onclick: () => void window.api.refreshSources() }, 'Atualizar links extras') : null,
    h('button', { onclick: () => { wizardDone = false; runWizard(); } }, 'Recalibrar HUD'),
    h('div', { class: 'row apoio' }, h('div', { class: 't' }, h('b', null, 'Apoiar o projeto ♥'), h('span', { class: 'm' }, 'Gostou? Ajude com uma doação (opcional).')),
      h('button', { title: 'Abrir o Ko-fi (cartão, PayPal)', onclick: () => void window.api.apoiar('kofi') }, 'Ko-fi'),
      h('button', { title: 'Copiar a chave Pix', onclick: () => { void window.api.apoiar('pix'); fontesMsg = 'Chave Pix copiada.'; lastKey = ''; render(); } }, 'Pix')),
  ];
}

function ajustes(v: ViewModel) {
  const r = h('input', { type: 'range', min: '0.3', max: '1', step: '0.05', value: String(v.opacidade), class: 'nodrag' });
  r.addEventListener('pointerdown', () => { dragging = true; });
  const fim = () => { dragging = false; };
  r.addEventListener('pointerup', fim); r.addEventListener('pointercancel', fim);
  r.addEventListener('input', () => void window.api.setOpacity(Number(r.value)));
  r.addEventListener('change', () => { dragging = false; r.blur(); });
  return h('div', { class: 'ajustes' }, h('label', { class: 'opac' }, 'Opacidade ', r),
    h('div', { class: 'm keys' }, 'Atalhos: Ctrl+Alt+F busca · Ctrl+Alt+M oculta · Ctrl+Alt+C click-through · Ctrl+Alt+Q sai'));
}

// canto de redimensionar: arrasta e pede o novo tamanho ao main
{
  const g = document.getElementById('grip')!;
  let ini: { x: number; y: number; w: number; h: number } | null = null;
  g.addEventListener('pointerdown', (e) => { g.setPointerCapture(e.pointerId); ini = { x: e.screenX, y: e.screenY, w: window.outerWidth, h: window.outerHeight }; });
  g.addEventListener('pointermove', (e) => { if (ini) void window.api.setSize(ini.w + e.screenX - ini.x, ini.h + e.screenY - ini.y); });
  g.addEventListener('pointerup', () => { ini = null; });
}

// Ctrl+Alt+F: abre a aba Buscar com o campo em foco
window.api.onBuscar(() => {
  tab = 'buscar'; if (vm) vm.expandido = true; lastKey = ''; render();
  document.querySelector<HTMLInputElement>('input.busca')?.focus();
});
