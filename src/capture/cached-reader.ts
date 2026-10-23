import { crop } from './image';
import type { Campo, HudReader } from './hud';
import type { Img, Reading, Regions } from '../types';

// FNV-1a 32 bits sobre todos os bytes (RGBA) do recorte
export function fnv1a(d: Uint8ClampedArray | Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 0x01000193);
  return h >>> 0;
}

const PESADOS = ['level', 'cls', 'map'] as const; // OCR com votação (~0,4 s); exp (template matching) é lido sempre
type Pesado = (typeof PESADOS)[number];
type Entrada = { chave: string; hash: number; valor: Reading[Pesado]; t: number; vazios: number };
export const RENOVAR_MS = 30_000;

// Mesma API do HudReader.read; relê level/cls/map só quando o recorte muda, a cada 30 s, ou uma vez depois de um undefined.
// O OCR é determinístico: um segundo undefined seguido com os mesmos pixels daria o mesmo resultado, então espera mudança/renovação.
export class LeitorComCache {
  private cache = new Map<Pesado, Entrada>();
  constructor(private leitor: Pick<HudReader, 'lerCampos'>, private now: () => number = Date.now) {}

  async read(img: Img, r: Regions): Promise<Omit<Reading, 't'>> {
    const t = this.now(), pedir = new Set<Campo>(['exp']), novos = new Map<Pesado, { chave: string; hash: number }>();
    for (const c of PESADOS) {
      const g = r[c], chave = `${img.w}x${img.h}|${g.x},${g.y},${g.w},${g.h}`, hash = fnv1a(crop(img, g).data);
      const e = this.cache.get(c);
      const valido = e && e.chave === chave && e.hash === hash && t - e.t < RENOVAR_MS && (e.valor !== undefined || e.vazios >= 2);
      if (!valido) { pedir.add(c); novos.set(c, { chave, hash }); }
    }
    const lido = await this.leitor.lerCampos(img, r, pedir);
    for (const [c, k] of novos) {
      const e = this.cache.get(c), valor = lido[c];
      // vazios: undefined seguidos nos mesmos pixels (o 1º relê no próximo tick; o 2º para até mudar)
      const vazios = valor !== undefined ? 0 : e && e.valor === undefined && e.chave === k.chave && e.hash === k.hash ? e.vazios + 1 : 1;
      this.cache.set(c, { ...k, valor, t, vazios });
    }
    const v = (c: Pesado) => this.cache.get(c)!.valor;
    return { level: v('level') as number | undefined, expAbs: lido.expAbs, expPct: lido.expPct, cls: v('cls') as string | undefined, map: v('map') as string | undefined };
  }
}
