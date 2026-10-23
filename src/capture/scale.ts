import type { Img } from '../types';

export const escalasCandidatas: number[] = [1, 0.8, 0.75, 0.6667, 0.5, 1.25, 1.5];

type Taps = { i: number[]; wt: number[] }[];

// pesos 1D: média de área ao reduzir, bilinear (cantos alinhados) ao ampliar
function taps(n: number, m: number): Taps {
  const out: Taps = [];
  for (let o = 0; o < m; o++) {
    const t = { i: [] as number[], wt: [] as number[] };
    if (m < n) {
      const a = (o * n) / m, b = ((o + 1) * n) / m;
      for (let s = Math.floor(a); s < Math.min(n, Math.ceil(b)); s++) {
        const c = Math.min(b, s + 1) - Math.max(a, s);
        if (c > 0) { t.i.push(s); t.wt.push(c / (b - a)); }
      }
    } else {
      const p = m === 1 ? 0 : (o * (n - 1)) / (m - 1);
      const s = Math.min(n - 1, Math.floor(p)), f = p - s;
      t.i.push(s); t.wt.push(1 - f);
      if (f > 0) { t.i.push(s + 1); t.wt.push(f); }
    }
    out.push(t);
  }
  return out;
}

export function resizeImg(img: Img, scale: number): Img {
  const W = Math.max(1, Math.round(img.w * scale)), H = Math.max(1, Math.round(img.h * scale));
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 4 || (W === img.w && H === img.h)) {
    return { w: img.w, h: img.h, data: new Uint8ClampedArray(img.data) };
  }
  const tx = taps(img.w, W), ty = taps(img.h, H);
  // passo horizontal (img.h × W) e depois vertical (H × W)
  const mid = new Float32Array(img.h * W * 4);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < W; x++) {
    const { i, wt } = tx[x], d = (y * W + x) * 4;
    for (let k = 0; k < i.length; k++) {
      const s = (y * img.w + i[k]) * 4;
      for (let c = 0; c < 4; c++) mid[d + c] += img.data[s + c] * wt[k];
    }
  }
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const { i, wt } = ty[y];
    for (let x = 0; x < W; x++) {
      const d = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let k = 0; k < i.length; k++) v += mid[(i[k] * W + x) * 4 + c] * wt[k];
        data[d + c] = Math.round(v);
      }
    }
  }
  return { w: W, h: H, data };
}

// Margem (px do quadro bruto) de cada recorte enviado pela capturadora. O quadro esparso montado no main passa pelo
// resizeImg; o pixel de borda de um recorte reescalado lê até ~1/escala px brutos além da região (média de área) ou 1 px
// (bilinear). 6 px cobrem toda escala válida (0,25–4): ver o teste de equivalência em tests/scale.test.ts.
export const MARGEM_RECORTE = 6;
// retângulo inteiro (px) que cobre a região normalizada `r` num quadro w×h, com `margem` px de folga, preso ao quadro
export function retanguloComMargem(w: number, h: number, r: { x: number; y: number; w: number; h: number }, margem: number) {
  const x0 = Math.max(0, Math.floor(r.x * w) - margem), y0 = Math.max(0, Math.floor(r.y * h) - margem);
  const x1 = Math.min(w, Math.ceil((r.x + r.w) * w) + margem), y1 = Math.min(h, Math.ceil((r.y + r.h) * h) + margem);
  return { x: Math.min(x0, w - 1), y: Math.min(y0, h - 1), w: Math.max(1, x1 - Math.min(x0, w - 1)), h: Math.max(1, y1 - Math.min(y0, h - 1)) };
}
