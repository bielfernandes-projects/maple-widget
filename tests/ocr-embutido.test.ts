import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import { HudReader } from '../src/capture/hud';

// O modelo de OCR vai junto com o app (resources/tessdata). Com langPath local o tesseract.js lê SÓ do disco:
// se ele tentasse a rede como alternativa, a pasta vazia abaixo daria certo (baixando) em vez de falhar.
const EMB = path.join(__dirname, '../resources/tessdata');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-ocr-'));

describe('OCR com o modelo embutido (sem rede)', () => {
  it('o arquivo embutido existe e tem a licença ao lado', () => {
    expect(fs.statSync(path.join(EMB, 'eng.traineddata')).size).toBe(5_199_098);
    expect(fs.existsSync(path.join(EMB, 'LICENSE-Apache-2.0.txt'))).toBe(true);
  });
  it('carrega do langPath local e grava o cache no userData', async () => {
    const cache = tmp();
    const r = await HudReader.create(cache, undefined, EMB);
    await r.close();
    expect(fs.statSync(path.join(cache, 'eng.traineddata')).size).toBe(5_199_098);
  }, 60_000);
  it('langPath local sem o arquivo falha lendo o disco (não cai para download)', async () => {
    const vazio = tmp();
    const erro = await new Promise<string>((res) => {
      // mesmas opções do HudReader.create; o tesseract.js reporta a falha de carga pelo errorHandler
      void createWorker('eng', 1, { cachePath: tmp(), langPath: vazio, gzip: false, errorHandler: (e: unknown) => res(String(e)) })
        .then((w) => { void w.terminate(); res('carregou'); }, (e) => res(String(e)));
    });
    expect(erro).toContain('ENOENT');
    expect(erro).toContain(path.join(vazio, 'eng.traineddata'));
  }, 60_000);
});
