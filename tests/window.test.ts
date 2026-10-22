import { describe, expect, it } from 'vitest';
import { escolherJanela } from '../src/capture/window';

const NAVEGADOR = 'MapleStory Classic World Wiki & Database | NiaMeowDB - Google Chrome';
describe('escolherJanela', () => {
  it('não casa o terminal do widget', () => { expect(escolherJanela(['◑ Widget flutuante para MapleStory'])).toBeUndefined(); });
  it('casa MapleStory e MapleStory Classic World', () => {
    expect(escolherJanela(['MapleStory'])).toBe('MapleStory');
    expect(escolherJanela(['MapleStory Classic World'])).toBe('MapleStory Classic World');
  });
  it('não casa aba de navegador', () => { expect(escolherJanela([NAVEGADOR])).toBeUndefined(); });
  it('vence o título mais curto', () => { expect(escolherJanela(['MapleStory Classic World', 'MapleStory'])).toBe('MapleStory'); });
  it('preferido exato vence a heurística', () => { expect(escolherJanela(['MapleStory', NAVEGADOR], NAVEGADOR)).toBe(NAVEGADOR); });
  it('preferido ausente cai na heurística', () => { expect(escolherJanela(['MapleStory'], 'Outra')).toBe('MapleStory'); });
  it('lista vazia', () => { expect(escolherJanela([])).toBeUndefined(); });
  it('ignora não-string e vazios', () => {
    expect(escolherJanela([null, 42, '', undefined, 'MapleStory'] as any)).toBe('MapleStory');
    expect(escolherJanela([null, '', 7] as any, '')).toBeUndefined();
  });
  it('nunca escolhe o overlay', () => { expect(escolherJanela(['MW Overlay', 'MapleStory overlay'])).toBeUndefined(); });
});
