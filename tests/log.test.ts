import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { espelharConsole, prepararLog } from '../src/main/log';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mw-log-')), 'log.txt');

describe('prepararLog', () => {
  it('> 1 MB recomeça do zero', () => {
    const f = tmp(); fs.writeFileSync(f, 'x'.repeat(1_100_000));
    prepararLog(f);
    expect(fs.statSync(f).size).toBe(0);
  });
  it('entre 200 KB e 1 MB fica só com o final (a partir de uma linha inteira)', () => {
    const f = tmp(); const linhas = Array.from({ length: 30_000 }, (_, i) => `linha ${i}`).join('\n') + '\n';
    fs.writeFileSync(f, linhas);
    prepararLog(f);
    const s = fs.readFileSync(f, 'utf8');
    expect(s.length).toBeLessThanOrEqual(200_000);
    expect(s.endsWith('linha 29999\n')).toBe(true);
    expect(s.startsWith('linha ')).toBe(true);
  });
  it('pequeno ou ausente fica como está; nunca lança', () => {
    const f = tmp(); fs.writeFileSync(f, 'oi\n');
    prepararLog(f);
    expect(fs.readFileSync(f, 'utf8')).toBe('oi\n');
    expect(() => prepararLog(path.join(f, 'nao', 'existe.txt'))).not.toThrow();
  });
});

describe('espelharConsole', () => {
  it('chama o original e acrescenta linha com data e nível', () => {
    const f = tmp(), saidas: string[] = [];
    const c = { log: (...a: unknown[]) => saidas.push('L ' + a.join(' ')), warn: (...a: unknown[]) => saidas.push('W ' + a.join(' ')), error: (...a: unknown[]) => saidas.push('E ' + a.join(' ')) };
    espelharConsole(f, c);
    c.log('[app] dev', 1); c.warn('aviso'); c.error('falha', new Error('x'));
    expect(saidas).toEqual(['L [app] dev 1', 'W aviso', 'E falha Error: x']);
    const s = fs.readFileSync(f, 'utf8').trim().split('\n');
    expect(s[0]).toMatch(/^\d{4}-\d\d-\d\dT\S+ \[log\] \[app\] dev 1$/);
    expect(s[1]).toMatch(/\[warn\] aviso$/);
    expect(s[2]).toMatch(/\[error\] falha Error: x/);
  });
  it('arquivo impossível não quebra o console', () => {
    const nada = (..._a: unknown[]) => {}; const c = { log: nada, warn: nada, error: nada };
    espelharConsole(path.join(tmp(), 'sub', 'dir', 'log.txt'), c);
    expect(() => c.log('x')).not.toThrow();
  });
});
