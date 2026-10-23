import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { Img, Region } from '../types';

export function decodeJpeg(buf: Buffer): Img {
  const r = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { w: r.width, h: r.height, data: new Uint8ClampedArray(r.data) };
}

export function bgraToImg(bgra: Buffer, w: number, h: number): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h * 4; i += 4) {
    data[i] = bgra[i + 2]; data[i + 1] = bgra[i + 1]; data[i + 2] = bgra[i]; data[i + 3] = 255;
  }
  return { w, h, data };
}

export function crop(img: Img, r: Region): Img {
  const x0 = Math.max(0, Math.round(r.x * img.w));
  const y0 = Math.max(0, Math.round(r.y * img.h));
  const w = Math.max(1, Math.min(img.w - x0, Math.round(r.w * img.w)));
  const h = Math.max(1, Math.min(img.h - y0, Math.round(r.h * img.h)));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const s = ((y0 + y) * img.w + x0) * 4;
    data.set(img.data.subarray(s, s + w * 4), y * w * 4);
  }
  return { w, h, data };
}

const PAD = 8;
export function binarize(img: Img, fg: (r: number, g: number, b: number) => boolean, scale = 4): Img {
  const w = img.w * scale + PAD * 2, h = img.h * scale + PAD * 2;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const s = (y * img.w + x) * 4;
    if (!fg(img.data[s], img.data[s + 1], img.data[s + 2])) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const d = ((PAD + y * scale + dy) * w + PAD + x * scale + dx) * 4;
      data[d] = data[d + 1] = data[d + 2] = 0;
    }
  }
  return { w, h, data };
}

export function toPngBuffer(img: Img): Buffer {
  const png = new PNG({ width: img.w, height: img.h });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png);
}

// ponytail: amostra a cada 7 px; jogo com tela preta real (<2 de média) é tratado como captura inválida
export function isBlack(img: Img): boolean {
  let sum = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 28) { sum += img.data[i] + img.data[i + 1] + img.data[i + 2]; n += 3; }
  return n > 0 && sum / n < 2;
}

export type Recorte = { x: number; y: number; w: number; h: number; data: Uint8ClampedArray };
// quadro w×h zerado com cada recorte copiado na sua posição (o HudReader só lê dentro das regiões)
export function montarImg(w: number, h: number, recortes: Recorte[]): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const r of recortes) {
    if (r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > w || r.y + r.h > h || r.data.length !== r.w * r.h * 4) throw new RangeError('recorte fora do quadro');
    for (let y = 0; y < r.h; y++) data.set(r.data.subarray(y * r.w * 4, (y + 1) * r.w * 4), ((r.y + y) * w + r.x) * 4);
  }
  return { w, h, data };
}
