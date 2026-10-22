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

// open:source — só https em domínio permitido (isAllowedUrl aceita http, aqui não)
export const validOpenUrl = (url: unknown, dominios: string[]): url is string =>
  typeof url === 'string' && url.startsWith('https://') && isAllowedUrl(url, dominios);
