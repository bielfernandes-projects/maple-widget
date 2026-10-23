import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ficheirosParaMigrar, migrarCacheGuias } from '../src/sources/migrar';

const SHA = 'a'.repeat(40);
describe('ficheirosParaMigrar', () => {
  it('aceita sha1.json e auto-index.json', () => {
    expect(ficheirosParaMigrar([`${SHA}.json`, 'auto-index.json', '05901b89956eeed56649f83f217843b4063caf4b.json'])).toEqual([`${SHA}.json`, 'auto-index.json', '05901b89956eeed56649f83f217843b4063caf4b.json']);
  });
  it('rejeita pastas/arquivos do Chromium, temporários, separadores e não-strings', () => {
    const ruins = ['Cache_Data', 'No_Vary_Search', 'index', 'data_0', 'f_000001', `${SHA}.json.tmp`, `${SHA}.tmp`, `${'A'.repeat(40)}.json`, `${'a'.repeat(39)}.json`,
      `x/${SHA}.json`, `x\${SHA}.json`, '../auto-index.json', 'auto-index.json.bak', '', null, 1, {}, undefined];
    expect(ficheirosParaMigrar(ruins as unknown[])).toEqual([]);
  });
});

describe('migrarCacheGuias', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-mig-'));
  it('copia só os .json nossos para a pasta nova e não mexe na antiga', () => {
    const d = tmp(), velho = path.join(d, 'cache'), novo = path.join(d, 'guias');
    fs.mkdirSync(path.join(velho, 'Cache_Data'), { recursive: true });
    fs.writeFileSync(path.join(velho, 'auto-index.json'), '{"a":1}');
    fs.writeFileSync(path.join(velho, `${SHA}.json`), '{"b":2}');
    fs.writeFileSync(path.join(velho, 'index'), 'x');
    expect(migrarCacheGuias(velho, novo)).toBe(2);
    expect(fs.readdirSync(novo).sort()).toEqual([`${SHA}.json`, 'auto-index.json'].sort());
    expect(fs.readFileSync(path.join(novo, 'auto-index.json'), 'utf8')).toBe('{"a":1}');
    expect(fs.readdirSync(velho).sort()).toEqual(['Cache_Data', `${SHA}.json`, 'auto-index.json', 'index'].sort());
  });
  it('não faz nada se a pasta nova já existe, se a antiga não existe ou não tem nada nosso', () => {
    const d = tmp(), velho = path.join(d, 'cache'), novo = path.join(d, 'guias');
    expect(migrarCacheGuias(velho, novo)).toBe(0);
    expect(fs.existsSync(novo)).toBe(false);
    fs.mkdirSync(velho); fs.writeFileSync(path.join(velho, 'index'), 'x');
    expect(migrarCacheGuias(velho, novo)).toBe(0);
    expect(fs.existsSync(novo)).toBe(false);
    fs.writeFileSync(path.join(velho, 'auto-index.json'), '{}');
    fs.mkdirSync(novo);
    expect(migrarCacheGuias(velho, novo)).toBe(0);
    expect(fs.readdirSync(novo)).toEqual([]);
  });
  it('pasta (não arquivo) com nome válido é ignorada', () => {
    const d = tmp(), velho = path.join(d, 'cache'), novo = path.join(d, 'guias');
    fs.mkdirSync(path.join(velho, 'auto-index.json'), { recursive: true });
    expect(migrarCacheGuias(velho, novo)).toBe(0);
  });
});
