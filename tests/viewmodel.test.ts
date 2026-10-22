import { describe, it, expect } from 'vitest';
import { buildViewModel } from '../src/viewmodel';
import type { Estado, Library } from '../src/types';

const lib: Library = {
  maps: [{ name: 'Line 1', street: 's', maxExpHr: 1000, mob: { name: 'm' }, why: '', levelMin: 11, levelMax: 15, sourceUrl: 'u' },
         { name: 'Novo', street: 's', maxExpHr: 2000, mob: { name: 'm' }, why: '', levelMin: 14, levelMax: 18, sourceUrl: 'u' }],
  quests: [{ id: '1', name: 'q', npc: '', level: 14, exp: 5, reward: '', sourceUrl: 'u' }],
  expRows: [], tips: [{ kind: 'ap', guide: 'G', title: 'AP', text: 't', sourceUrl: 'u' }],
};
const est = (o: Partial<Estado> = {}): Estado =>
  ({ level: 13, expAbs: 1, expPct: 1, expPorHora: 800, upou: false, semLeitura: false, ...o });
const base = { lib, fontes: [], feitas: new Set<string>(), lim: { verde: 0.7, amarelo: 0.4 },
  capturaPreta: false, jogoNaoEncontrado: false, precisaWizard: false, opacidade: 1, expandido: false,
  sync: { auto: true, guias: 34, ultima: 0, offline: false } };

describe('buildViewModel', () => {
  it('monta mapas, quests, dicas e veredito para o level', () => {
    const vm = buildViewModel({ ...base, estado: est() });
    expect(vm.mapas.map((m) => m.name)).toEqual(['Line 1']);
    expect(vm.veredito.cor).toBe('verde'); // 800 / 1000 = 0.8 >= 0.7
  });
  it('levelUp traz novidades do novo level', () => {
    const vm = buildViewModel({ ...base, estado: est({ level: 14, upou: true }) });
    expect(vm.levelUp).toMatchObject({ de: 13, para: 14 });
    expect(vm.levelUp!.novidades.maps.map((m) => m.name)).toEqual(['Novo']);
    expect(vm.levelUp!.novidades.quests.map((q) => q.id)).toEqual(['1']);
  });
  it('avisa quando a sincronização está offline', () => {
    const vm = buildViewModel({ ...base, estado: est(), sync: { auto: true, guias: 3, ultima: 1, offline: true } });
    expect(vm.avisos.join('|')).toMatch(/cache/i);
    expect(vm.sync.guias).toBe(3);
  });
  it('avisos: sem fontes, captura preta, jogo não encontrado', () => {
    const a = buildViewModel({ ...base, estado: null, capturaPreta: true, jogoNaoEncontrado: true }).avisos.join('|');
    expect(a).toMatch(/fonte/i);
    expect(a).toMatch(/tela cheia/i);
    expect(a).toMatch(/jogo/i);
  });
});
