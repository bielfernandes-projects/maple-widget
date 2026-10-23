import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LeitorComCache, fnv1a } from '../src/capture/cached-reader';
import { HudReader, DEFAULT_REGIONS, type Campo } from '../src/capture/hud';
import { decodeJpeg } from '../src/capture/image';
import type { Img, Reading, Regions } from '../src/types';

const R: Regions = {
  level: { x: 0, y: 0, w: 0.25, h: 0.5 }, cls: { x: 0.25, y: 0, w: 0.25, h: 0.5 },
  exp: { x: 0.5, y: 0, w: 0.25, h: 0.5 }, map: { x: 0, y: 0.5, w: 1, h: 0.5 },
};
const img = (w = 40, h = 20): Img => ({ w, h, data: new Uint8ClampedArray(w * h * 4).fill(100) });
const setPx = (i: Img, x: number, y: number, v: number) => { i.data[(y * i.w + x) * 4] = v; };

// leitor falso: conta pedidos por campo e devolve `valores`
function falso(valores: Omit<Reading, 't'> = { level: 10, cls: 'Mage', map: 'Henesys', expAbs: 5, expPct: 1.5 }) {
  const n: Record<Campo, number> = { level: 0, cls: 0, map: 0, exp: 0 };
  const leitor = {
    valores,
    async lerCampos(_i: Img, _r: Regions, campos: ReadonlySet<Campo>) {
      const out: Omit<Reading, 't'> = {};
      for (const c of campos) {
        n[c]++;
        if (c === 'exp') { out.expAbs = leitor.valores.expAbs; out.expPct = leitor.valores.expPct; } else (out as Record<string, unknown>)[c] = leitor.valores[c];
      }
      return out;
    },
  };
  return { leitor, n };
}
const relogio = () => { const c = { t: 0, now: () => c.t }; return c; };

describe('fnv1a', () => {
  it('vetor conhecido e sensível a um byte', () => {
    expect(fnv1a(new Uint8ClampedArray([]))).toBe(0x811c9dc5);
    expect(fnv1a(new TextEncoder().encode('a') as unknown as Uint8ClampedArray)).toBe(0xe40c292c);
    expect(fnv1a(new Uint8ClampedArray([1, 2, 3]))).not.toBe(fnv1a(new Uint8ClampedArray([1, 2, 4])));
  });
});

describe('LeitorComCache', () => {
  it('mesma entrada duas vezes ⇒ uma leitura pesada; exp lido sempre', async () => {
    const { leitor, n } = falso(), c = new LeitorComCache(leitor, relogio().now);
    const a = await c.read(img(), R), b = await c.read(img(), R);
    expect(a).toEqual(b);
    expect(a).toEqual({ level: 10, cls: 'Mage', map: 'Henesys', expAbs: 5, expPct: 1.5 });
    expect(n).toEqual({ level: 1, cls: 1, map: 1, exp: 2 });
  });
  it('um pixel alterado no recorte do level ⇒ relê só o level', async () => {
    const { leitor, n } = falso(), c = new LeitorComCache(leitor, relogio().now);
    await c.read(img(), R);
    const i = img(); setPx(i, 9, 9, 7); // dentro de level (x<10, y<10)
    leitor.valores = { ...leitor.valores, level: 11 };
    expect((await c.read(i, R)).level).toBe(11);
    expect(n).toEqual({ level: 2, cls: 1, map: 1, exp: 2 });
  });
  it('pixel fora de todos os recortes pesados não relê nada', async () => {
    const { leitor, n } = falso(), c = new LeitorComCache(leitor, relogio().now);
    await c.read(img(), R);
    const i = img(); setPx(i, 25, 5, 7); // dentro de exp
    await c.read(i, R);
    expect(n).toEqual({ level: 1, cls: 1, map: 1, exp: 2 });
  });
  it('resultado undefined ⇒ relê no tick seguinte; dois undefined seguidos nos mesmos pixels ⇒ espera mudança ou renovação', async () => {
    const { leitor, n } = falso({ cls: 'Mage', map: 'Henesys' }), k = relogio(), c = new LeitorComCache(leitor, k.now);
    await c.read(img(), R);
    await c.read(img(), R);
    expect(n.level).toBe(2);
    await c.read(img(), R);
    expect(n.level).toBe(2);
    const i = img(); setPx(i, 0, 0, 1);
    await c.read(i, R);
    expect(n.level).toBe(3);
    k.t = 30_000;
    await c.read(i, R);
    expect(n.level).toBe(4);
  });
  it('undefined seguido de valor volta ao cache normal', async () => {
    const { leitor, n } = falso({ cls: 'Mage', map: 'Henesys' }), c = new LeitorComCache(leitor, relogio().now);
    await c.read(img(), R);
    leitor.valores = { ...leitor.valores, level: 3 };
    expect((await c.read(img(), R)).level).toBe(3);
    expect((await c.read(img(), R)).level).toBe(3);
    expect(n.level).toBe(2);
  });
  it('renovação de segurança após 30 s (relógio injetado)', async () => {
    const { leitor, n } = falso(), k = relogio(), c = new LeitorComCache(leitor, k.now);
    await c.read(img(), R);
    k.t = 29_999; await c.read(img(), R);
    expect(n.level).toBe(1);
    k.t = 30_000; await c.read(img(), R);
    expect(n).toEqual({ level: 2, cls: 2, map: 2, exp: 3 });
    k.t = 59_999; await c.read(img(), R);
    expect(n.level).toBe(2);
  });
  it('campos independentes: mudar cls não relê level nem map', async () => {
    const { leitor, n } = falso(), c = new LeitorComCache(leitor, relogio().now);
    await c.read(img(), R);
    const i = img(); setPx(i, 12, 3, 9); // cls: 10<=x<20, y<10
    await c.read(i, R);
    expect(n).toEqual({ level: 1, cls: 2, map: 1, exp: 2 });
  });
  it('regiões diferentes (ou outro tamanho de quadro) não compartilham cache', async () => {
    const { leitor, n } = falso(), c = new LeitorComCache(leitor, relogio().now);
    await c.read(img(), R);
    await c.read(img(), { ...R, level: { x: 0.5, y: 0.5, w: 0.25, h: 0.5 } }); // mesmos pixels (cor sólida), região outra
    expect(n.level).toBe(2);
    await c.read(img(80, 40), { ...R, level: { x: 0.5, y: 0.5, w: 0.25, h: 0.5 } });
    expect(n).toEqual({ level: 3, cls: 2, map: 2, exp: 3 });
  });
});

// integração: o HudReader real nas 12 screenshots, cada uma lida duas vezes pelo cache = leitura direta
describe('LeitorComCache com HudReader real', () => {
  const dir = path.join(__dirname, 'fixtures/screens');
  const files = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')));
  let reader: HudReader;
  beforeAll(async () => { reader = await HudReader.create(path.join(__dirname, '../out/tessdata')); });
  afterAll(async () => { await reader.close(); });
  it('resultados idênticos aos diretos', async () => {
    const c = new LeitorComCache(reader);
    for (const f of files) {
      const im = decodeJpeg(fs.readFileSync(path.join(dir, f)));
      const direto = await reader.read(im, DEFAULT_REGIONS);
      expect(await c.read(im, DEFAULT_REGIONS), f).toEqual(direto);
      expect(await c.read(im, DEFAULT_REGIONS), f).toEqual(direto);
    }
  }, 300_000);
});

import { quadroValeParaRegioes, regioesDoQuadro } from '../src/capture/hud';
describe('regioesDoQuadro / quadroValeParaRegioes', () => {
  const nova = { ...DEFAULT_REGIONS, level: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } };
  it('usa a calibração da chave WxH, senão as padrão', () => {
    expect(regioesDoQuadro({ '800x600': nova }, 800, 600)).toBe(nova);
    expect(regioesDoQuadro({ '800x600': nova }, 1920, 1080)).toBe(DEFAULT_REGIONS);
  });
  it('quadro montado com regiões antigas deixa de valer depois de salvar uma calibração', () => {
    const montado = JSON.stringify(DEFAULT_REGIONS);
    expect(quadroValeParaRegioes(montado, {}, 800, 600)).toBe(true);
    expect(quadroValeParaRegioes(montado, { '800x600': nova }, 800, 600)).toBe(false);
    expect(quadroValeParaRegioes(JSON.stringify(nova), { '800x600': nova }, 800, 600)).toBe(true);
  });
});
