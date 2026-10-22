import type { GrindMap, Quest, Tip, ViewModel } from '../types';
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
let tab: 'agora' | 'quests' | 'mapas' | 'fontes' = 'agora';
let cardData: NonNullable<ViewModel['levelUp']> | null = null;
let cardUntil = 0;
let cardTimer: number | undefined;
let wizardActive = false;
let wizardDone = false;
let dragging = false; // slider sendo arrastado: reconstruir o DOM mataria o arrasto
let lastKey = '';
const app = document.getElementById('app')!;

function runWizard() {
  wizardActive = true;
  try { startWizard(() => { wizardActive = false; wizardDone = true; lastKey = ''; render(); }); }
  catch (e) { console.error('wizard', e); wizardActive = false; wizardDone = true; }
}

window.api.onVM((v) => {
  vm = v;
  if (v.levelUp) {
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
  if (ae instanceof HTMLInputElement && ae.type === 'text' && ae.value !== '') return; // usuário digitando
  const showCard = !!cardData && Date.now() < cardUntil;
  const key = JSON.stringify([vm, tab, showCard ? cardData : null]);
  if (key === lastKey) return;
  lastKey = key;
  const scroll = app.querySelector('.body')?.scrollTop ?? 0;
  const e = vm.estado;
  const head = h('div', { class: 'head drag' },
    h('span', { class: 'lv' }, e ? `Lv ${e.level}${e.classe ? ' ' + e.classe : ''}` : 'Aguardando jogo…'),
    h('div', { class: 'bar' }, (() => { const i = h('i', null); i.style.width = `${Math.min(100, e?.expPct ?? 0)}%`; return i; })()),
    h('span', { class: 'rate' }, e ? `${(e.expPct).toFixed(2)}% · ${fmt(e.expPorHora)}/h` : ''),
    h('span', { class: `dot ${vm.veredito.cor}`, title: vm.veredito.pct === null ? 'sem dados' : `${Math.round(vm.veredito.pct * 100)}% do ideal. ${TETO}` }),
    h('button', { class: 'nodrag', 'aria-label': vm.expandido ? 'Recolher' : 'Expandir', title: vm.expandido ? 'Recolher' : 'Expandir',
      onclick: () => { vm!.expandido = !vm!.expandido; void window.api.setExpanded(vm!.expandido); render(); } }, vm.expandido ? '▴' : '▾'),
  );
  const kids: Node[] = [head];
  if (vm.expandido) {
    if (showCard) kids.push(levelCard(cardData!));
    kids.push(h('div', { class: 'tabs nodrag', role: 'tablist' }, ...(['agora', 'quests', 'mapas', 'fontes'] as const).map((t) =>
      h('button', { class: t === tab ? 'on' : '', role: 'tab', 'aria-selected': String(t === tab), onclick: () => { tab = t; render(); } }, t[0].toUpperCase() + t.slice(1)))));
    kids.push(h('div', { class: 'body nodrag' }, ...vm.avisos.map((a) => h('div', { class: 'warn' }, a)), ...tabBody(vm)));
    kids.push(footer(vm));
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
  return h('div', { class: 'card nodrag', onclick: () => { cardUntil = 0; cardData = null; lastKey = ''; render(); } },
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
  if (tab === 'mapas') return v.mapas.length ? v.mapas.map((m) => h('div', null, mapRow(m), h('div', { class: 'm' }, m.why))) : [v.fontes.length ? empty('Nenhum mapa para este level nas fontes.') : emptyAdd('Nenhuma fonte carregada.')];
  return fontesTab(v);
}

function fontesTab(v: ViewModel): Kid[] {
  const input = h('input', { type: 'text', placeholder: 'Link extra (opcional) e Enter' });
  const msg = h('div', { class: 'm' });
  const add = async () => {
    const url = input.value.trim();
    if (!url) return;
    try {
      const r = await window.api.addSource(url);
      msg.textContent = r.ok ? 'Adicionada.' : (r.erro ?? 'Erro.');
      if (r.ok) input.value = '';
    } catch (e) { msg.textContent = e instanceof Error ? e.message : 'Erro ao adicionar.'; }
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
    auto, h('div', { class: 'row' }, input, h('button', { onclick: () => void add() }, 'Adicionar')), msg,
    ...v.fontes.filter((f) => !f.auto).map((f) => h('div', { class: 'row' }, h('div', { class: 't' }, h('b', null, f.title),
      h('span', { class: 'm' }, `${f.status} · ${f.counts.maps} mapas, ${f.counts.quests} quests, ${f.counts.tips} dicas · ${f.fetchedAt ? new Date(f.fetchedAt).toLocaleString('pt-BR') : 'nunca'}`)),
      h('button', { title: 'Remover fonte', 'aria-label': 'Remover fonte', onclick: () => void window.api.removeSource(f.url) }, '✕'))),
    v.fontes.some((f) => !f.auto) ? h('button', { onclick: () => void window.api.refreshSources() }, 'Atualizar links extras') : null,
    h('button', { onclick: () => { wizardDone = false; runWizard(); } }, 'Recalibrar HUD'),
  ];
}

function footer(v: ViewModel) {
  const r = h('input', { type: 'range', min: '0.3', max: '1', step: '0.05', value: String(v.opacidade), class: 'nodrag' });
  r.addEventListener('pointerdown', () => { dragging = true; });
  const fim = () => { dragging = false; };
  r.addEventListener('pointerup', fim); r.addEventListener('pointercancel', fim);
  r.addEventListener('input', () => void window.api.setOpacity(Number(r.value)));
  r.addEventListener('change', () => { dragging = false; r.blur(); });
  return h('div', { class: 'foot nodrag' }, h('label', { class: 'opac' }, 'Opacidade ', r),
    h('span', { class: 'keys' }, 'Ctrl+Alt+M oculta · Ctrl+Alt+C click-through'));
}
