const HOSTS = ['meowdb.com', 'niadb.com'];
export function safeIconUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return undefined;
    const ok = HOSTS.some((d) => url.hostname === d || url.hostname.endsWith('.' + d));
    return ok ? url.href : undefined;
  } catch { return undefined; }
}
