import type { Regions } from '../types';
import { isAllowedUrl } from '../sources/allowlist';

const REGION_KEYS = ['level', 'exp', 'cls', 'map'];
const RECT_KEYS = ['x', 'y', 'w', 'h'];
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
// chaves próprias exatamente iguais a `keys` (rejeita extras, faltando e __proto__ como chave própria)
const exactKeys = (o: Record<string, unknown>, keys: string[]) => {
  const own = Object.getOwnPropertyNames(o);
  return own.length === keys.length && keys.every((k) => Object.hasOwn(o, k));
};

export const validResKey = (s: unknown): boolean => typeof s === 'string' && /^\d+x\d+$/.test(s);

export function validRegions(x: unknown): x is Regions {
  if (!isObj(x) || !exactKeys(x, REGION_KEYS)) return false;
  return REGION_KEYS.every((k) => {
    const r = x[k];
    return isObj(r) && exactKeys(r, RECT_KEYS) && RECT_KEYS.every((p) => typeof r[p] === 'number' && Number.isFinite(r[p]) && (r[p] as number) >= 0 && (r[p] as number) <= 1);
  });
}

// só o formato (string, <= 500); a checagem de diretório existente fica no main
export const validGamePathShape = (s: unknown): s is string => typeof s === 'string' && s.length <= 500;

// caminho absoluto local do Windows (sem UNC, sem segmentos ..); a existência é checada no main
export const validFolderPath = (s: unknown): s is string =>
  typeof s === 'string' && s.length <= 500 && /^[A-Za-z]:[\\/]/.test(s) && !s.split(/[\\/]/).includes('..');

export const validJanelaJogo = (s: unknown): s is string => typeof s === 'string' && s.length <= 200;

// open:source — só https em domínio permitido (isAllowedUrl aceita http, aqui não)
export const validOpenUrl = (url: unknown, dominios: string[]): url is string =>
  typeof url === 'string' && url.startsWith('https://') && isAllowedUrl(url, dominios);

export const validEscala = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0.25 && n <= 4;

const dimOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 8192;
// quadro RGBA vindo da janela capturadora (renderer: não confiável)
export function validFrame(msg: unknown): msg is { w: number; h: number; buffer: ArrayBuffer } {
  if (!isObj(msg) || !dimOk(msg.w) || !dimOk(msg.h) || msg.w * msg.h > 16_777_216) return false; // área ≤ 4096×4096
  return msg.buffer instanceof ArrayBuffer && msg.buffer.byteLength === msg.w * msg.h * 4;
}

const MAX_RECORTES = 4;
const intOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
export type MsgRecortes = { w: number; h: number; versao: number; recortes: { x: number; y: number; w: number; h: number; buffer: ArrayBuffer }[] };
// recortes da HUD vindos da capturadora: ≤ 4, inteiros, dentro do quadro, buffer exato, área total ≤ a do quadro
export function validRecortes(msg: unknown): msg is MsgRecortes {
  if (!isObj(msg) || !dimOk(msg.w) || !dimOk(msg.h) || msg.w * msg.h > 16_777_216 || !intOk(msg.versao)) return false;
  const { w, h, recortes } = msg as { w: number; h: number; recortes: unknown };
  if (!Array.isArray(recortes) || recortes.length > MAX_RECORTES) return false;
  let area = 0;
  for (const r of recortes) {
    if (!isObj(r) || !intOk(r.x) || !intOk(r.y) || !dimOk(r.w) || !dimOk(r.h)) return false;
    if (r.x + r.w > w || r.y + r.h > h) return false;
    if (!(r.buffer instanceof ArrayBuffer) || r.buffer.byteLength !== r.w * r.h * 4) return false;
    area += r.w * r.h;
  }
  return area <= w * h;
}
