import { describe, it, expect } from 'vitest';
import { safeIconUrl } from '../src/renderer/safe-url';

describe('safeIconUrl', () => {
  it('aceita https meowdb/niadb', () => {
    expect(safeIconUrl('https://meowdb.com/a.png')).toBe('https://meowdb.com/a.png');
    expect(safeIconUrl('https://www.niadb.com/x/y.png')).toBe('https://www.niadb.com/x/y.png');
  });
  it('rejeita o resto', () => {
    for (const u of ['http://meowdb.com/a.png', 'data:image/png;base64,AA', 'javascript:alert(1)', 'https://evil.com/a.png',
      'https://meowdb.com.evil.com/a.png', 'https://evil.com/meowdb.com', 'https://evilmeowdb.com/a.png', 'nao é url', '', undefined])
      expect(safeIconUrl(u as any)).toBeUndefined();
  });
});
