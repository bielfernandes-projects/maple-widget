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

let vm: ViewModel | null = null;
let tab: 'agora' | 'quests' | 'mapas' | 'fontes' = 'agora';
let cardUntil = 0;
let wizard = false;
const app = document.getElementById('app')!;

window.api.onVM((v) => {
  vm = v;
  if (v.levelUp) { cardUntil = Date.now() + 15000; if (!v.expandido) { v.expandido = true; void window.api.setExpanded(true); } }
  if (v.precisaWizard && !wizard) { wizard = true; startWizard(() => { wizard = false; }); return; }
  if (!wizard) render();
});

function render() {
  if (!vm || document.activeElement instanceof HTMLInputElement) return; // não atrapalha digitação
  const e = vm.estado;
  const head = h('div', { class: 'head drag' },
    h('span', { class: 'lv' }, e ? `Lv ${e.level}${e.classe ? ' ' + e.classe : ''}` : 'Aguardando jogo…'),
    h('div', { class: 'bar' }, (() => { const i = h('i', null); i.style.width = `${Math.min(100, e?.expPct ?? 0)}%`; return i; })()),
    h('span', { class: 'rate' }, e ? `${(e.expPct).toFixed(2)}% · ${fmt(e.expPorHora)}/h` : ''),
    h('span', { class: `dot ${vm.veredito.cor}`, title: vm.veredito.pct === null ? 'sem dados' : `${Math.round(vm.veredito.pct * 100)}% do ideal` }),
    h('button', { class: 'nodrag', onclick: () => { vm!.expandido = !vm!.expandido; void window.api.setExpanded(vm!.expandido); render(); } }, vm.expandido ? '▴' : '▾'),
  );
  const kids: Node[] = [head];
  if (vm.expandido) {
    if (Date.now() < cardUntil && vm.levelUp) kids.push(levelCard(vm));
    kids.push(h('div', { class: 'tabs nodrag' }, ...(['agora', 'quests', 'mapas', 'fontes'] as const).map((t) =>
      h('button', { class: t === tab ? 'on' : '', onclick: () => { tab = t; render(); } }, t[0].toUpperCase() + t.slice(1)))));
    kids.push(h('div', { class: 'body nodrag' }, ...vm.avisos.map((a) => h('div', { class: 'warn' }, a)), ...tabBody(vm)));
    kids.push(footer(vm));
  }
  app.replaceChildren(...kids);
}

function levelCard(v: ViewModel) {
  const u = v.levelUp!;
  const dica = u.dicas[0];
  return h('div', { class: 'card nodrag', onclick: () => { cardUntil = 0; render(); } },
    h('h4', null, `Level up! Lv ${u.de} → ${u.para}`),
    dica ? h('p', null, dica.text) : h('p', null, 'Sem dica de AP/SP nas fontes configuradas.'),
    dica ? h('div', { class: 'm' }, `Fonte: ${dica.title}`) : null,
    u.novidades.maps.length || u.novidades.quests.length
      ? h('div', { class: 'm' }, `Novo neste level: ${u.novidades.maps.length} mapa(s), ${u.novidades.quests.length} quest(s)`) : null);
}

function mapRow(m: GrindMap) {
  return h('div', { class: 'row' }, icon(m.mob.iconUrl),
    h('div', { class: 't' }, h('b', null, m.name), h('span', { class: 'm' }, `${m.mob.name} · ${fmt(m.maxExpHr)}/h`)));
}
function questRow(q: Quest) {
  return h('div', { class: 'row' }, icon(q.iconUrl),
    h('div', { class: 't' }, h('b', null, q.name), h('span', { class: 'm' }, `${q.npc}${q.area ? ' · ' + q.area : ''} · Lv ${q.level} · ${q.exp} EXP${q.reward ? ' · ' + q.reward : ''}`)),
    h('button', { onclick: () => void window.api.toggleQuest(q.id) }, '✓'));
}
const empty = (t: string) => h('div', { class: 'empty' }, t);

function tabBody(v: ViewModel): Kid[] {
  if (tab === 'agora') {
    const best = v.mapas[0];
    return [
      h('div', { class: 'row' }, h('div', { class: 't' },
        h('b', null, v.estado?.mapa ?? 'Mapa desconhecido'),
        h('span', { class: 'm' }, best && v.veredito.pct !== null
          ? `${Math.round(v.veredito.pct * 100)}% do ideal (${fmt(best.maxExpHr)}/h em ${best.name})`
          : 'Sem comparação disponível'))),
      h('b', null, 'Melhores mapas para seu level'),
      ...(v.mapas.length ? v.mapas.map(mapRow) : [empty('Nenhum mapa para este level nas fontes.')]),
    ];
  }
  if (tab === 'quests') return v.quests.length ? v.quests.map(questRow) : [empty('Nenhuma quest para este level nas fontes.')];
  if (tab === 'mapas') return v.mapas.length ? v.mapas.map((m) => h('div', null, mapRow(m), h('div', { class: 'm' }, m.why))) : [empty('Nenhum mapa para este level nas fontes.')];
  return fontesTab(v);
}

function fontesTab(v: ViewModel): Kid[] {
  const input = h('input', { type: 'text', placeholder: 'Link extra (opcional) e Enter' });
  const auto = h('div', { class: 'row' },
    h('div', { class: 't' }, h('b', null, 'Sincronização automática (meowdb)'),
      h('span', { class: 'm' }, v.sync.auto
        ? `${v.sync.guias} guias · ${v.sync.ultima ? 'sincronizado às ' + new Date(v.sync.ultima).toLocaleTimeString('pt-BR') : 'aguardando'}${v.sync.offline ? ' · offline (cache)' : ''}`
        : 'desligada')),
    h('button', { onclick: () => void window.api.setAutoSync(!v.sync.auto) }, v.sync.auto ? 'Desligar' : 'Ligar'),
    h('button', { title: 'Sincronizar agora', onclick: () => void window.api.syncNow() }, '⟳'));
  const msg = h('div', { class: 'm' });
  input.addEventListener('keydown', async (ev) => {
    if ((ev as KeyboardEvent).key !== 'Enter' || !input.value.trim()) return;
    const r = await window.api.addSource(input.value.trim());
    msg.textContent = r.ok ? 'Adicionada.' : (r.erro ?? 'Erro.');
    if (r.ok) input.value = '';
    input.blur(); render();
  });
  return [
    auto, input, msg,
    ...v.fontes.filter((f) => !f.auto).map((f) => h('div', { class: 'row' }, h('div', { class: 't' }, h('b', null, f.title),
      h('span', { class: 'm' }, `${f.status} · ${f.counts.maps} mapas, ${f.counts.quests} quests, ${f.counts.tips} dicas`)),
      h('button', { onclick: () => void window.api.removeSource(f.url) }, '✕'))),
    v.fontes.some((f) => !f.auto) ? h('button', { onclick: () => void window.api.refreshSources() }, 'Atualizar links extras') : null,
    h('button', { onclick: () => { wizard = true; startWizard(() => { wizard = false; render(); }); } }, 'Recalibrar HUD'),
  ];
}

function footer(v: ViewModel) {
  const r = h('input', { type: 'range', min: '0.3', max: '1', step: '0.05', value: String(v.opacidade), class: 'nodrag' });
  r.addEventListener('input', () => void window.api.setOpacity(Number(r.value)));
  return h('div', { class: 'foot nodrag' }, 'Opacidade', r, h('span', null, 'Ctrl+Alt+M ocultar · Ctrl+Alt+C click-through'));
}
