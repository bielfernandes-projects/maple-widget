import { createWorker, PSM, type Worker } from 'tesseract.js';
import { crop, binarize, toPngBuffer } from './image';
import type { Img, Regions, Reading } from '../types';
import digitTemplates from './digit-templates.json';

// Normalizado a partir de 1920x1080 (HUD no rodapé, minimapa no topo-esquerdo); calibrado também em 1366x768.
const n = (x: number, y: number, w: number, h: number) =>
  ({ x: x / 1920, y: y / 1080, w: w / 1920, h: h / 1080 });
export const DEFAULT_REGIONS: Regions = {
  level: n(457, 1040, 46, 29),
  cls: n(511, 1034, 100, 20),
  exp: n(1052, 1034, 130, 20),
  map: n(67, 41, 290, 51),
};

export function parseLevel(t: string): number | undefined {
  const d = t.replace(/\D/g, '');
  const v = d ? parseInt(d, 10) : NaN;
  return v >= 1 && v <= 100 ? v : undefined;
}
export function parseExp(t: string): { expAbs: number; expPct: number } | undefined {
  const m = t.match(/(\d[\d,.\s]*?)\s*[\[(|]?\s*(\d+\.\d+)\s*%/);
  if (!m) return undefined;
  const expAbs = parseInt(m[1].replace(/\D/g, ''), 10);
  return Number.isNaN(expAbs) ? undefined : { expAbs, expPct: parseFloat(m[2]) };
}
export function parseMap(t: string): string | undefined {
  const lines = t.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  return lines.at(-1);
}
export function parseClass(t: string): string | undefined {
  const l = t.split('\n').map((s) => s.trim()).find((s) => s.length > 0)?.replace(/[^A-Za-z ]/g, '').trim();
  return l && l.length >= 3 ? l : undefined;
}

const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
const FG_LIGHT = (r: number, g: number, b: number) => lum(r, g, b) > 170;
// dígitos da HUD: brancos (b alto). Os colchetes do EXP são amarelo-esverdeados (b baixo) e a caixa do level é laranja.
const FG_DIGIT = (r: number, g: number, b: number) => b > 130 && g > 130;

// ---------- template matching de glifos (fonte bitmap fixa da HUD) ----------
export type Templates = Record<string, number[][]>; // chave "7" ou "7#2" (várias amostras) -> grade GH x GW de 0/1
const GW = 7, GH = 9;
type Box = { x0: number; x1: number; y0: number; y1: number }; // x1/y1 exclusivos

function bitsOf(img: Img, box: Box, fg: typeof FG_DIGIT): number[][] {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  return Array.from({ length: GH }, (_, gy) => Array.from({ length: GW }, (_, gx) => {
    const xa = box.x0 + Math.floor((gx * w) / GW), xb = box.x0 + Math.max(Math.floor((gx * w) / GW) + 1, Math.ceil(((gx + 1) * w) / GW));
    const ya = box.y0 + Math.floor((gy * h) / GH), yb = box.y0 + Math.max(Math.floor((gy * h) / GH) + 1, Math.ceil(((gy + 1) * h) / GH));
    let on = 0, cnt = 0;
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const i = (y * img.w + x) * 4; cnt++; if (fg(img.data[i], img.data[i + 1], img.data[i + 2])) on++;
    }
    return on * 2 >= cnt ? 1 : 0;
  }));
}
// glifos = corridas de colunas com pixel de primeiro plano, da esquerda p/ direita
export function glyphBoxes(img: Img, fg = FG_DIGIT): Box[] {
  const boxes: Box[] = [];
  let cur: Box | null = null;
  for (let x = 0; x <= img.w; x++) {
    let y0 = -1, y1 = -1;
    if (x < img.w) for (let y = 0; y < img.h; y++) {
      const i = (y * img.w + x) * 4;
      if (fg(img.data[i], img.data[i + 1], img.data[i + 2])) { if (y0 < 0) y0 = y; y1 = y + 1; }
    }
    if (y0 >= 0) cur = cur ? { x0: cur.x0, x1: x + 1, y0: Math.min(cur.y0, y0), y1: Math.max(cur.y1, y1) } : { x0: x, x1: x + 1, y0, y1 };
    else if (cur) { boxes.push(cur); cur = null; }
  }
  return boxes;
}
const tall = (bs: Box[]) => {
  const maxH = Math.max(0, ...bs.map((b) => b.y1 - b.y0));
  return (b: Box) => b.y1 - b.y0 >= maxH * 0.5;
};
// bitmap normalizado de todo o primeiro plano da imagem (um glifo) — usado para gerar templates
export function glyphBits(img: Img, fg = FG_DIGIT): number[][] {
  const bs = glyphBoxes(img, fg);
  if (!bs.length) return bitsOf(img, { x0: 0, x1: 1, y0: 0, y1: 1 }, fg);
  return bitsOf(img, { x0: bs[0].x0, x1: bs[bs.length - 1].x1, y0: Math.min(...bs.map((b) => b.y0)), y1: Math.max(...bs.map((b) => b.y1)) }, fg);
}
// ponytail: distância de Hamming bruta numa grade 7x9; fontes antialiasadas/escaladas por outro fator podem exigir mais amostras de template
export function matchGlyph(bits: number[][], templates: Templates): string | undefined {
  let best: string | undefined, bd = Infinity;
  for (const [k, t] of Object.entries(templates)) {
    let d = 0;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (bits[y][x] !== t[y][x]) d++;
    if (d < bd) { bd = d; best = k[0]; }
  }
  return best;
}
// glifos mais baixos que metade do maior (ponto decimal, ruído) não são dígitos
export function digitBits(img: Img, fg = FG_DIGIT): number[][][] {
  const bs = glyphBoxes(img, fg);
  return bs.filter(tall(bs)).map((b) => bitsOf(img, b, fg));
}
export function matchDigits(img: Img, templates: Templates, fg = FG_DIGIT): number | undefined {
  const bits = digitBits(img, fg);
  if (!bits.length) return undefined;
  const s = bits.map((b) => matchGlyph(b, templates));
  return s.includes(undefined) ? undefined : parseInt(s.join(''), 10);
}

// ---------- EXP: o "[" separa o absoluto do "pct%" ----------
// O "[" é a primeira coluna amarelo-esverdeada (g-b alto).
export function bracketCol(img: Img): number {
  for (let x = 0; x < img.w; x++) for (let y = 0; y < img.h; y++) {
    const i = (y * img.w + x) * 4;
    if (img.data[i + 1] - img.data[i + 2] > 35 && img.data[i + 1] > 110) return x;
  }
  return -1;
}
// primeira coluna vazia depois do "[" (pula as serifas brancas do colchete)
export function afterBracket(img: Img, b: number): number {
  let x = b;
  for (; x < img.w; x++) {
    let ink = false;
    for (let y = 0; y < img.h && !ink; y++) { const i = (y * img.w + x) * 4; ink = FG_DIGIT(img.data[i], img.data[i + 1], img.data[i + 2]) || img.data[i + 1] - img.data[i + 2] > 35 && img.data[i + 1] > 110; }
    if (!ink) break;
  }
  return Math.min(img.w - 1, x + 1);
}
export function cols(img: Img, x0: number, x1: number): Img {
  const w = Math.max(1, x1 - x0), data = new Uint8ClampedArray(w * img.h * 4);
  for (let y = 0; y < img.h; y++) data.set(img.data.subarray((y * img.w + x0) * 4, (y * img.w + x0 + w) * 4), y * w * 4);
  return { w, h: img.h, data };
}
// recorte do pct (depois do "["): dígitos inteiros antes do ponto e 2 decimais depois
export function pctBits(img: Img): { int: number[][][]; frac: number[][][] } | undefined {
  const bs = glyphBoxes(img), isTall = tall(bs);
  const dot = bs.findIndex((b) => !isTall(b));
  const int = bs.slice(0, dot), frac = bs.slice(dot + 1, dot + 3);
  if (dot < 1 || int.length > 2 || frac.length < 2) return undefined;
  const f = (b: Box) => bitsOf(img, b, FG_DIGIT);
  return { int: int.map(f), frac: frac.map(f) };
}
export function readExpDigits(img: Img, templates: Templates): { expAbs: number; expPct: number } | undefined {
  const b = bracketCol(img);
  if (b < 3) return undefined;
  const expAbs = matchDigits(cols(img, 0, b - 2), templates);
  const p = pctBits(cols(img, afterBracket(img, b), img.w));
  if (expAbs === undefined || !p) return undefined;
  const d = [...p.int, ...p.frac].map((g) => matchGlyph(g, templates));
  if (d.includes(undefined)) return undefined;
  const s = d.join('');
  return { expAbs, expPct: parseFloat(`${s.slice(0, p.int.length)}.${s.slice(p.int.length)}`) };
}

// ---------- OCR (tesseract) para level, classe e mapa ----------
// Upscale bilinear de um canal (2=azul: branco alto/laranja baixo; 0=vermelho: texto branco sobre painel azul; 3=luminância), invertido: texto escuro em fundo branco.
// ponytail: o nearest-neighbor do binarize deixa glifos de 7px ilegíveis; bilinear + votação resolve o level.
function lumAt(img: Img, x: number, y: number) {
  const i = (Math.min(img.h - 1, Math.max(0, y)) * img.w + Math.min(img.w - 1, Math.max(0, x))) * 4;
  return lum(img.data[i], img.data[i + 1], img.data[i + 2]);
}
function smooth(img: Img, ch: number, lo: number, hi: number, s: number): Img {
  const P = 8, w = img.w * s + 2 * P, h = img.h * s + 2 * P;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const B = (x: number, y: number) => ch === 3 ? lumAt(img, x, y) : img.data[(Math.min(img.h - 1, Math.max(0, y)) * img.w + Math.min(img.w - 1, Math.max(0, x))) * 4 + ch];
  for (let y = 0; y < img.h * s; y++) for (let x = 0; x < img.w * s; x++) {
    const fx = (x + 0.5) / s - 0.5, fy = (y + 0.5) / s - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (B(x0, y0) * (1 - tx) + B(x0 + 1, y0) * tx) * (1 - ty) + (B(x0, y0 + 1) * (1 - tx) + B(x0 + 1, y0 + 1) * tx) * ty;
    const g = 255 - Math.max(0, Math.min(255, ((v - lo) / (hi - lo)) * 255));
    const o = ((P + y) * w + P + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = g;
  }
  return { w, h, data };
}
const LEVEL_PRES: ((i: Img) => Img)[] = [4, 6].flatMap((s) => [[60, 200], [80, 200], [100, 220]].map(([lo, hi]) => (i: Img) => smooth(i, 2, lo, hi, s)));

// Painel do minimapa: a borda direita é uma coluna branca quase da altura toda; o que vem depois (cena, Quest Helper) é lixo.
function mapPanel(img: Img): Img {
  let end = img.w;
  for (let x = Math.floor(img.w * 0.2); x < img.w; x++) {
    let on = 0;
    for (let y = 0; y < img.h; y++) if (img.data[(y * img.w + x) * 4] > 200) on++;
    if (on > img.h * 0.6) { end = x; break; }
  }
  return cols(img, 0, end);
}
// [canal (0=R, 3=luminância), contraste lo, hi, altura final alvo em px]; nenhuma variante isolada passa de 9/11, a votação fecha.
const MAP_PRES: ((i: Img) => Img)[] = ([[0, 170, 230, 60], [3, 170, 230, 60], [3, 170, 230, 50], [3, 150, 230, 80], [0, 150, 230, 110],
  [0, 150, 210, 80], [0, 160, 255, 80], [0, 170, 230, 110], [3, 150, 230, 60], [3, 150, 230, 50], [3, 170, 230, 40], [3, 150, 230, 40]] as const)
  .map(([ch, lo, hi, t]) => (i: Img) => smooth(i, ch, lo, hi, Math.max(1, Math.round(t / i.h))));
// valor mais votado (empate: o primeiro visto)
function mode<T>(xs: (T | undefined)[]): T | undefined {
  const c = new Map<T, number>();
  for (const x of xs) if (x !== undefined) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
// numerais romanos ("Ground II") saem como l, | ou 1
const fixRoman = (s?: string) => s?.split(" ").map((w) => (/^[Il|1]+$/.test(w) ? "I".repeat(w.length) : w)).join(" ").replace(/[^A-Za-z0-9]+$/, "");

export class HudReader {
  private constructor(private w: Worker, private templates: Templates) {}
  static async create(cachePath?: string, templates: Templates = digitTemplates) {
    const w = await createWorker('eng', 1, cachePath ? { cachePath } : {});
    return new HudReader(w, templates);
  }
  private async run(img: Img, wl: string, psm: PSM) {
    await this.w.setParameters({ tessedit_char_whitelist: wl, tessedit_pageseg_mode: psm });
    const { data } = await this.w.recognize(toPngBuffer(img));
    return data.text;
  }
  // tesseract às vezes omite/erra o glifo; o valor mais votado entre várias pré-processadas é estável
  private async level(img: Img) {
    const vs: (number | undefined)[] = [];
    for (const pre of LEVEL_PRES) for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_CHAR]) vs.push(parseLevel(await this.run(pre(img), "0123456789", psm)));
    return mode(vs);
  }
  private async map(img: Img) {
    const panel = mapPanel(img), vs: (string | undefined)[] = [];
    for (const pre of MAP_PRES) vs.push(fixRoman(parseMap(await this.run(pre(panel), "", PSM.SINGLE_BLOCK))));
    return mode(vs);
  }
  async read(img: Img, r: Regions): Promise<Omit<Reading, 't'>> {
    const level = await this.level(crop(img, r.level));
    const exp = readExpDigits(crop(img, r.exp), this.templates);
    const cls = parseClass(await this.run(binarize(crop(img, r.cls), FG_LIGHT), '', PSM.SINGLE_BLOCK));
    const map = await this.map(crop(img, r.map));
    return { level, expAbs: exp?.expAbs, expPct: exp?.expPct, cls, map };
  }
  close() { return this.w.terminate().then(() => undefined); }
}
