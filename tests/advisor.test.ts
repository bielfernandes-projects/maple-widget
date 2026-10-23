import { describe, it, expect } from 'vitest';
import { mapasNaFaixa, mapasProximos, makeExpToNext, mapasParaLevel, questsParaLevel, dicasPara, novidadesNoLevel, veredito } from '../src/advisor';
import type { GrindMap, Quest, Tip } from '../src/types';

const M = (name: string, a: number, b: number, exp: number): GrindMap =>
  ({ name, street: '', maxExpHr: exp, mob: { name: 'x' }, why: '', levelMin: a, levelMax: b, sourceUrl: 'u' });
const Q = (id: string, level: number, exp: number): Quest =>
  ({ id, name: id, npc: '', level, exp, reward: '', sourceUrl: 'u' });
const T = (guide: string, title: string, a?: number, b?: number): Tip =>
  ({ kind: 'ap', guide, title, text: 't', levelMin: a, levelMax: b, sourceUrl: 'u' });
const LIM = { verde: 0.7, amarelo: 0.4 };

describe('advisor', () => {
  it('makeExpToNext', () => {
    const f = makeExpToNext([{ level: 1, toNext: 15 }, { level: 2, toNext: 34 }]);
    expect(f(2)).toBe(34);
    expect(f(9)).toBeUndefined();
  });
  it('mapasParaLevel filtra a faixa e ordena por EXP/h', () => {
    const r = mapasParaLevel([M('a', 11, 15, 100), M('b', 11, 15, 300), M('c', 16, 20, 999)], 13, 2);
    expect(r.map((m) => m.name)).toEqual(['b', 'a']);
  });
  it('questsParaLevel: janela de 5 níveis abaixo, sem feitas, por EXP desc', () => {
    const r = questsParaLevel([Q('a', 12, 50), Q('b', 13, 90), Q('c', 5, 999), Q('d', 14, 999), Q('e', 10, 10)], 13, new Set(['e']));
    expect(r.map((q) => q.id)).toEqual(['b', 'a']);
  });
  it('dicasPara filtra por faixa de level e pela linhagem de classe do guia', () => {
    const tips = [
      T('Bowman Build Guide', 'Ability Points', 1, 30),
      T('Warrior Build Guide', 'Ability Points'),
      T('Beginner Guide', 'Ability Points allocation'),
      T('Hunter Class Guide', 'Ability Points', 40, 70),
    ];
    // HUD diz "Archer": guias Bowman e genéricos passam; Warrior não; Hunter está fora da faixa
    expect(dicasPara(tips, 13, 'Archer').map((t) => t.guide)).toEqual(['Bowman Build Guide', 'Beginner Guide']);
    // sem classe lida não filtra por classe
    expect(dicasPara(tips, 13, undefined).map((t) => t.guide)).toEqual(['Bowman Build Guide', 'Warrior Build Guide', 'Beginner Guide']);
    expect(dicasPara(tips, 45, 'Hunter').map((t) => t.guide)).toEqual(['Hunter Class Guide', 'Beginner Guide']);
  });
  it('dicasPara nunca lança para classe lida (texto de OCR não confiável)', () => {
    const tips = [
      T('Bowman Build Guide', 'Ability Points', 1, 30),
      T('Beginner Guide', 'Ability Points allocation'),
    ];
    for (const classe of ['Archer(', '[Archer', '*', '\\', 'constructor', 'toString', '__proto__', '', '   ']) {
      expect(Array.isArray(dicasPara(tips, 13, classe))).toBe(true);
    }
  });
  it('dicasPara ignora espaços e caixa da classe lida', () => {
    const tips = [
      T('Bowman Build Guide', 'Ability Points', 1, 30),
      T('Warrior Build Guide', 'Ability Points'),
      T('Beginner Guide', 'Ability Points allocation'),
    ];
    const esperado = ['Bowman Build Guide', 'Beginner Guide'];
    expect(dicasPara(tips, 13, 'Archer').map((t) => t.guide)).toEqual(esperado);
    expect(dicasPara(tips, 13, ' Archer ').map((t) => t.guide)).toEqual(esperado);
    expect(dicasPara(tips, 13, 'ARCHER').map((t) => t.guide)).toEqual(esperado);
  });
  it('dicasPara ordena por relevância: faixa + linhagem, faixa, linhagem, genérico', () => {
    const genericoSemFaixa = T('Beginner Guide', 'Ability Points');
    const linhagemSemFaixa = T('Bowman Build Guide', 'Ability Points');
    const genericoComFaixa = T('Beginner Guide', 'Ability Points', 1, 30);
    const linhagemComFaixa = T('Bowman Build Guide', 'Ability Points', 1, 30);
    const r = dicasPara([genericoSemFaixa, linhagemSemFaixa, genericoComFaixa, linhagemComFaixa], 13, 'Archer');
    expect(r[0]).toBe(linhagemComFaixa);
    expect(r[1]).toBe(genericoComFaixa);
    expect(r[2]).toBe(linhagemSemFaixa);
    expect(r[3]).toBe(genericoSemFaixa);
  });
  it('dicasPara é estável: empates mantêm a ordem de entrada', () => {
    const a = T('Beginner Guide', 'first');
    const b = T('Bowman Build Guide', 'x');
    const c = T('Beginner Guide', 'second');
    const r = dicasPara([a, b, c], 13, 'Archer');
    expect(r.map((t) => t.title)).toEqual(['x', 'first', 'second']);
  });
  it('dicasPara sem classe lida: faixas primeiro, resto na ordem de entrada', () => {
    const tips = [T('Beginner Guide', 'g1'), T('Bowman Build Guide', 'g2', 1, 30), T('Warrior Build Guide', 'g3'), T('Hunter Class Guide', 'g4', 1, 30)];
    expect(dicasPara(tips, 13, undefined).map((t) => t.title)).toEqual(['g2', 'g4', 'g1', 'g3']);
  });
  it('dicasPara não muta o array de entrada', () => {
    const tips = [T('Beginner Guide', 'g1'), T('Bowman Build Guide', 'g2', 1, 30), T('Bowman Build Guide', 'g3')];
    const antes = [...tips];
    dicasPara(tips, 13, 'Archer');
    expect(tips).toEqual(antes);
    tips.forEach((t, i) => expect(t).toBe(antes[i]));
  });
  it('novidadesNoLevel: o que começa exatamente neste level', () => {
    const n = novidadesNoLevel([M('a', 14, 18, 1), M('b', 11, 15, 1)], [Q('x', 14, 1), Q('y', 13, 1)], 14);
    expect(n.maps.map((m) => m.name)).toEqual(['a']);
    expect(n.quests.map((q) => q.id)).toEqual(['x']);
  });
  it('veredito por faixa', () => {
    const best = M('b', 1, 99, 1000);
    expect(veredito(800, best, LIM).cor).toBe('verde');
    expect(veredito(500, best, LIM).cor).toBe('amarelo');
    expect(veredito(100, best, LIM).cor).toBe('vermelho');
    expect(veredito(0, best, LIM).cor).toBe('cinza');
    expect(veredito(500, undefined, LIM).cor).toBe('cinza');
  });
});

describe('questsParaLevel: variantes', () => {
  const V = (id: string, name: string, npc: string, exp: number): Quest => ({ id, name, npc, level: 10, exp, reward: '', sourceUrl: 'u' });
  const tiers = [V('t1', 'Donating', 'Henesys', 9060), V('t2', 'Donating', 'Henesys', 14200), V('t3', 'Donating', 'Henesys', 11400)];
  it('colapsa tiers no de maior EXP', () => {
    expect(questsParaLevel(tiers, 10, new Set()).map((q) => q.id)).toEqual(['t2']);
  });
  it('feita a de cima, surge a proxima', () => {
    expect(questsParaLevel(tiers, 10, new Set(['t2'])).map((q) => q.id)).toEqual(['t3']);
  });
  it('quests diferentes nao colapsam; empate mantem a primeira', () => {
    const r = questsParaLevel([V('a', 'A', 'n', 5), V('b', 'B', 'n', 7), V('c', 'A', 'n', 5)], 10, new Set());
    expect(r.map((q) => q.id)).toEqual(['b', 'a']);
  });
});

describe('linhagem de classe com títulos reais dos guias', () => {
  const G = (c: string) => `MapleStory Classic ${c} Build and Leveling Guide`;
  const guias = {
    warrior: G('Warrior'), bowman: G('Bowman'), magician: G('Magician'), thief: G('Thief'), fighter: G('Fighter'),
    spearman: G('Spearman'), page: G('Page'), il: G('I/L Wizard'), fp: G('F/P Wizard'), cleric: G('Cleric'),
    hunter: G('Hunter'), xbow: G('Crossbowman'), assassin: G('Assassin'), bandit: G('Bandit'),
  };
  const genericos = ["Beginner's Guide: MapleStory Classic World", 'MapleStory Classic World Glossary'];
  const tips = [...Object.values(guias), ...genericos].map((g) => T(g, 'Ability Points'));
  const passa = (classe: string) => dicasPara(tips, 30, classe).map((t) => t.guide);
  const casos: [string[], string[]][] = [
    [['Wizard'], [guias.magician, guias.fp, guias.il]],
    [['FP Wizard', 'F/P Wizard', 'F P Wizard'], [guias.fp, guias.magician]],
    [['I/L Wizard', 'IL Wizard'], [guias.il, guias.magician]],
    [['Cleric'], [guias.cleric, guias.magician]],
    [['Magician', 'Mage'], [guias.magician]],
    [['Archer', 'Bowman'], [guias.bowman]],
    [['Hunter'], [guias.hunter, guias.bowman]],
    [['Crossbowman', 'Crossbow man'], [guias.xbow, guias.bowman]],
    [['Warrior'], [guias.warrior]],
    [['Fighter'], [guias.fighter, guias.warrior]],
    [['Spearman'], [guias.spearman, guias.warrior]],
    [['Page'], [guias.page, guias.warrior]],
    [['Thief', 'Rogue'], [guias.thief]],
    [['Assassin'], [guias.assassin, guias.thief]],
    [['Bandit'], [guias.bandit, guias.thief]],
  ];
  for (const [classes, esperados] of casos) for (const c of classes) {
    it(`${c}: guias da linhagem + genéricos, sem outras famílias`, () => {
      expect(new Set(passa(c))).toEqual(new Set([...esperados, ...genericos]));
    });
  }
  it('Hunter não recebe dicas de Crossbowman e F/P não recebe de I/L', () => {
    expect(passa('Hunter')).not.toContain(guias.xbow);
    expect(passa('FP Wizard')).not.toContain(guias.il);
  });
  it('classe desconhecida: só genéricos; nunca lança', () => {
    expect(new Set(passa('Beginner'))).toEqual(new Set(genericos));
    for (const c of ['(', 'constructor', '__proto__', 'hasOwnProperty', 'a\\b']) expect(Array.isArray(passa(c))).toBe(true);
  });
});

describe('mapasNaFaixa / mapasProximos', () => {
  const maps = [M('A', 15, 20, 100), M('B', 15, 20, 300), M('C', 10, 20, 200), M('D', 15, 20, 50), M('E', 21, 25, 400), M('F', 19, 25, 90), M('G', 30, 40, 999)];
  it('lista TODOS os mapas que cobrem o level (faixa inclusiva nas duas pontas), do melhor EXP/h ao pior', () => {
    expect(mapasNaFaixa(maps, 18).map((m) => m.name)).toEqual(['B', 'C', 'A', 'D']);
    expect(mapasNaFaixa(maps, 15).map((m) => m.name)).toEqual(['B', 'C', 'A', 'D']);
    expect(mapasNaFaixa(maps, 20).map((m) => m.name)).toEqual(['B', 'C', 'A', 'F', 'D']);
    expect(mapasParaLevel(maps, 18)).toHaveLength(3); // o resumo da aba Agora continua com 3
  });
  it('próximos: começam até +3 acima e ainda não estão na faixa', () => {
    expect(mapasProximos(maps, 18).map((m) => m.name)).toEqual(['F', 'E']); // por início da faixa; G está longe
    expect(mapasProximos(maps, 18, 12).map((m) => m.name)).toEqual(['F', 'E', 'G']);
  });
  it('mesmo mapa em dois guias aparece uma vez, com o maior EXP/h', () => {
    const dup = [M('A', 15, 20, 100), { ...M('A', 15, 20, 250), sourceUrl: 'outro' }];
    expect(mapasNaFaixa(dup, 18).map((m) => m.maxExpHr)).toEqual([250]);
  });
});
