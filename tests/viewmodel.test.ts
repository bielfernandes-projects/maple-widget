import { describe, it, expect } from 'vitest';
import { buildViewModel } from '../src/viewmodel';
import type { Estado, Library, Source } from '../src/types';

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
    expect(a).toMatch(/janela do jogo/i);
  });
  it('avisa quando a HUD está sem leitura', () => {
    const vm = buildViewModel({ ...base, estado: est({ semLeitura: true }) });
    expect(vm.avisos.join('|')).toMatch(/sem leitura/i);
  });
  it('agrega erros de fonte em uma linha (singular)', () => {
    const vm = buildViewModel({ ...base, estado: est(), fontes: [F('A', 'erro')] });
    const linhas = vm.avisos.filter((a) => /com erro/.test(a));
    expect(linhas).toEqual(['1 fonte com erro (usando cache)']);
  });
  it('agrega erros de fonte em uma linha (plural)', () => {
    const vm = buildViewModel({ ...base, estado: est(), fontes: [F('A', 'erro'), F('B', 'erro'), F('C', 'erro'), F('D', 'ok')] });
    const linhas = vm.avisos.filter((a) => /com erro/.test(a));
    expect(linhas).toEqual(['3 fontes com erro (usando cache)']);
  });
  it('estado null: veredito cinza e listas vazias', () => {
    const vm = buildViewModel({ ...base, estado: null });
    expect(vm.veredito.cor).toBe('cinza');
    expect(vm.mapas).toEqual([]);
    expect(vm.quests).toEqual([]);
    expect(vm.dicas).toEqual([]);
    expect(vm.levelUp).toBeUndefined();
  });
  it('biblioteca vazia com estado real: listas vazias sem lançar', () => {
    const vazia: Library = { maps: [], quests: [], expRows: [], tips: [] };
    const vm = buildViewModel({ ...base, lib: vazia, estado: est() });
    expect(vm.mapas).toEqual([]);
    expect(vm.quests).toEqual([]);
    expect(vm.dicas).toEqual([]);
    expect(vm.veredito.cor).toBe('cinza');
  });
  it('repassa precisaWizard, opacidade e expandido', () => {
    const vm = buildViewModel({ ...base, estado: est(), precisaWizard: true, opacidade: 0.5, expandido: true });
    expect(vm).toMatchObject({ precisaWizard: true, opacidade: 0.5, expandido: true });
  });
  it('saída sobrevive a structuredClone e não expõe o Set de feitas', () => {
    const vm = buildViewModel({ ...base, estado: est({ level: 14, upou: true }), feitas: new Set(['1']) });
    expect(() => structuredClone(vm)).not.toThrow();
    expect(vm).not.toHaveProperty('feitas');
    expect(Object.values(vm).some((v) => v instanceof Set)).toBe(false);
  });
  it('levelUp: dica de linhagem + faixa vem antes da genérica', () => {
    const lib2: Library = {
      ...lib,
      tips: [
        { kind: 'ap', guide: 'Beginner Guide', title: 'Ability Points', text: 'g', sourceUrl: 'u' },
        { kind: 'ap', guide: 'Bowman Build Guide', title: 'Ability Points', text: 'c', levelMin: 11, levelMax: 15, sourceUrl: 'u' },
      ],
    };
    const vm = buildViewModel({ ...base, lib: lib2, estado: est({ level: 14, upou: true, classe: 'Archer' }) });
    expect(vm.levelUp!.dicas[0].guide).toBe('Bowman Build Guide');
  });
});

function F(title: string, status: 'ok' | 'erro'): Source {
  return { url: 'u', title, fetchedAt: 0, status, counts: { maps: 0, quests: 0, expRows: 0, tips: 0 } };
}
