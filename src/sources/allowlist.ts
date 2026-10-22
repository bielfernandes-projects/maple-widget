export function isAllowedUrl(url: string, dominios: string[]): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  return dominios.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
}
