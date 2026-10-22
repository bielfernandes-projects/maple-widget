# Maple Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widget Electron flutuante que lê a HUD do MapleStory Classic World por OCR, calcula EXP/h e level up, e recomenda mapas, quests e AP/SP a partir de guias do meowdb colados pelo usuário.

**Architecture:** Núcleo puro e testável (`tracker`, `advisor`, `parser`, `viewmodel`) + camada de captura/OCR sobre um tipo `Img` simples (RGBA) + shell Electron fino (main/preload/renderer vanilla TS). Main faz captura, OCR e download de fontes; renderer só desenha um `ViewModel`.

**Tech Stack:** Electron, TypeScript, esbuild (bundle), vitest, cheerio (parser HTML), tesseract.js (OCR), jpeg-js (decodificar screenshots nos testes), pngjs (codificar recortes para o OCR), tsx (scripts).

**Spec:** `docs/superpowers/specs/2026-10-22-maple-widget-design.md`

## Global Constraints

- Idioma de toda a UI e mensagens: PT-BR com acentuação correta.
- Sem injeção, sem leitura de memória do jogo; só captura de tela.
- Texto vindo de fontes é renderizado **só como texto** (`textContent`), nunca HTML.
- Só URLs `http(s)` cujo domínio esteja no allowlist (padrão `meowdb.com`, `niadb.com`).
- Janela: sem borda, transparente, always-on-top nível `screen-saver`.
- Pasta do jogo sugerida: `C:\Nexon\Library\maplestorycw`; screenshots em `appdata\Maple_A_*.jpg`.
- Regiões da HUD são **normalizadas (0..1)** e salvas por resolução `"{w}x{h}"`.
- Veredito: verde ≥ 0.70, amarelo ≥ 0.40, senão vermelho (configurável); cinza se sem dados.
- Guias: sincronização **automática** pelo sitemap `https://meowdb.com/msclassic/sitemap.xml` (guia = URL `/msclassic/guides/<slug>`); só baixa guia novo ou com `lastmod` diferente; no máximo 3 downloads simultâneos; sincroniza na abertura e a cada 30 min; `User-Agent` identificado; links colados à mão continuam suportados como extras.
- Desvios conscientes da spec (YAGNI): ícones são carregados direto da URL (cache HTTP do Chromium, sem cache próprio em disco); level up é detectado pela subida do level lido (sem região de banner).

## Estrutura de arquivos

```
package.json  tsconfig.json  vitest.config.ts  build.mjs  .gitignore
scripts/crop.ts                      # dump dos recortes da HUD para inspeção visual
scripts/fetch-fixtures.mjs           # baixa HTML dos guias para tests/fixtures
src/types.ts                         # todos os tipos compartilhados
src/capture/image.ts                 # Img: decode/crop/binarize/png/isBlack
src/capture/hud.ts                   # regiões padrão, parsers de texto, HudReader (OCR)
src/tracker.ts                       # Reading -> Estado (EXP/h, level up, descarte)
src/advisor.ts                       # puro: mapas, quests, dicas, veredito, expToNext
src/sources/parser.ts                # HTML do guia -> ParsedGuide
src/sources/allowlist.ts             # isAllowedUrl
src/sources/load.ts                  # download + cache + parse -> SourceData
src/sources/discover.ts              # sitemap -> lista de guias (GuideRef)
src/sources/sync.ts                  # sincronização automática incremental (por lastmod)
src/store.ts                         # config.json
src/viewmodel.ts                     # monta ViewModel (puro)
src/main/main.ts                     # janela, loop de captura, IPC, hotkeys
src/main/preload.ts                  # window.api
src/renderer/index.html  styles.css  renderer.ts  wizard.ts  api.d.ts
tests/*.test.ts  tests/fixtures/screens/*.jpg + expected.json  tests/fixtures/guides/*.html
```

---

### Task 1: Scaffold e tipos

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/types.ts`

**Interfaces:**
- Produces: todos os tipos de `src/types.ts` (usados por todas as tasks seguintes).

- [ ] **Step 1: Inicializar repo e dependências**

```bash
cd "C:/Users/Gabriel Fernandes/OneDrive - LEMA/Desktop/Pessoal/maple-widget"
git init
npm init -y
npm i cheerio tesseract.js pngjs jpeg-js
npm i -D electron typescript vitest esbuild tsx electron-builder @types/node @types/pngjs
```

- [ ] **Step 2: Escrever `package.json` (substituir campos), `tsconfig.json`, `vitest.config.ts`, `.gitignore`**

`package.json` (manter `dependencies`/`devDependencies` gerados pelo npm; ajustar o resto):
```json
{
  "name": "maple-widget",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "build": "node build.mjs",
    "start": "node build.mjs && electron .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "dist": "node build.mjs && electron-builder --win portable"
  },
  "build": {
    "appId": "dev.maplewidget",
    "productName": "Maple Widget",
    "files": ["dist/**", "package.json"],
    "asarUnpack": ["node_modules/tesseract.js-core/**"]
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "lib": ["ES2022", "DOM"], "types": ["node"], "noEmit": true
  },
  "include": ["src", "tests", "scripts"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 90000 } });
```

`.gitignore`:
```
node_modules
dist
out
release
```

- [ ] **Step 3: Escrever `src/types.ts`**

```ts
export type Img = { w: number; h: number; data: Uint8ClampedArray }; // RGBA
export type Region = { x: number; y: number; w: number; h: number }; // normalizado 0..1
export type Regions = { level: Region; exp: Region; cls: Region; map: Region };

export type Reading = {
  level?: number; expAbs?: number; expPct?: number;
  map?: string; cls?: string; t: number;
};
export type Estado = {
  level: number; classe?: string; expAbs: number; expPct: number;
  mapa?: string; expPorHora: number; upou: boolean; semLeitura: boolean;
};

export type Mob = { name: string; id?: string; iconUrl?: string };
export type GrindMap = {
  name: string; street: string; maxExpHr: number; mob: Mob; why: string;
  levelMin: number; levelMax: number; sourceUrl: string;
};
export type Quest = {
  id: string; name: string; npc: string; level: number; exp: number;
  reward: string; iconUrl?: string; sourceUrl: string;
};
export type ExpRow = { level: number; toNext: number };
export type Tip = {
  kind: 'ap' | 'sp'; title: string; text: string;
  levelMin?: number; levelMax?: number; sourceUrl: string;
};
export type ParsedGuide = {
  title: string; maps: GrindMap[]; quests: Quest[]; expRows: ExpRow[]; tips: Tip[];
};

export type Source = {
  url: string; title: string; fetchedAt: number;
  status: 'ok' | 'erro' | 'vazio'; error?: string;
  counts: { maps: number; quests: number; expRows: number; tips: number };
};
export type SourceData = ParsedGuide & { source: Source };
export type Library = { maps: GrindMap[]; quests: Quest[]; expRows: ExpRow[]; tips: Tip[] };

export type Limiares = { verde: number; amarelo: number };
export type Veredito = { cor: 'verde' | 'amarelo' | 'vermelho' | 'cinza'; pct: number | null; ref?: GrindMap };

export type Config = {
  gamePath: string;
  regions: Record<string, Regions>;
  sources: string[];
  dominios: string[];
  limiares: Limiares;
  questsFeitas: string[];
  opacidade: number;
  janela: { x?: number; y?: number; expandido: boolean };
};

export type ViewModel = {
  estado: Estado | null;
  veredito: Veredito;
  mapas: GrindMap[];
  quests: Quest[];
  dicas: Tip[];
  levelUp?: { de: number; para: number; dicas: Tip[]; novidades: { maps: GrindMap[]; quests: Quest[] } };
  fontes: Source[];
  avisos: string[];
  capturaPreta: boolean;
  precisaWizard: boolean;
  opacidade: number;
  expandido: boolean;
};
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sem erros.  
Run: `npx vitest run --passWithNoTests` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold electron+ts+vitest e tipos compartilhados"
```

---

### Task 2: Utilitários de imagem + dump de recortes

**Files:**
- Create: `src/capture/image.ts`, `scripts/crop.ts`, `tests/image.test.ts`

**Interfaces:**
- Consumes: `Img`, `Region` de `src/types.ts`.
- Produces:
  - `decodeJpeg(buf: Buffer): Img`
  - `bgraToImg(bgra: Buffer, w: number, h: number): Img`
  - `crop(img: Img, r: Region): Img`
  - `binarize(img: Img, fg: (r:number,g:number,b:number)=>boolean, scale?: number): Img` (texto preto em fundo branco, ampliado, com borda branca)
  - `toPngBuffer(img: Img): Buffer`
  - `isBlack(img: Img): boolean`

- [ ] **Step 1: Teste que falha**

`tests/image.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { crop, binarize, isBlack, bgraToImg } from '../src/capture/image';
import type { Img } from '../src/types';

const solid = (w: number, h: number, rgb: [number, number, number]): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { w, h, data };
};

describe('image', () => {
  it('crop usa região normalizada', () => {
    const c = crop(solid(100, 50, [1, 2, 3]), { x: 0.5, y: 0.5, w: 0.2, h: 0.4 });
    expect([c.w, c.h]).toEqual([20, 20]);
  });
  it('isBlack detecta captura preta', () => {
    expect(isBlack(solid(40, 40, [0, 0, 0]))).toBe(true);
    expect(isBlack(solid(40, 40, [90, 90, 90]))).toBe(false);
  });
  it('binarize gera texto preto em fundo branco, ampliado e com borda', () => {
    const b = binarize(solid(4, 4, [255, 255, 255]), (r) => r > 200, 2);
    expect([b.w, b.h]).toEqual([4 * 2 + 16, 4 * 2 + 16]);
    expect(b.data[0]).toBe(255); // borda branca
    const mid = ((b.h / 2) * b.w + b.w / 2) * 4;
    expect(b.data[mid]).toBe(0); // miolo = primeiro plano = preto
  });
  it('bgraToImg troca B e R', () => {
    const i = bgraToImg(Buffer.from([10, 20, 30, 255]), 1, 1);
    expect([...i.data]).toEqual([30, 20, 10, 255]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/image.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/capture/image.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/image.test.ts` → PASS (4 testes).

- [ ] **Step 5: Copiar screenshots de fixture**

```bash
mkdir -p tests/fixtures/screens
cp "C:/Nexon/Library/maplestorycw/appdata/"Maple_A_*.jpg tests/fixtures/screens/
ls tests/fixtures/screens | wc -l    # esperado: 12
```

- [ ] **Step 6: Escrever `scripts/crop.ts` (dump dos recortes para inspeção visual)**

Depende de `DEFAULT_REGIONS` da Task 3; criar aqui o arquivo e **executá-lo na Task 3**.

```ts
import fs from 'node:fs';
import path from 'node:path';
import { decodeJpeg, crop, toPngBuffer } from '../src/capture/image';
import { DEFAULT_REGIONS } from '../src/capture/hud';

// uso: npx tsx scripts/crop.ts tests/fixtures/screens/Maple_A_261021_220733.jpg
const file = process.argv[2];
const img = decodeJpeg(fs.readFileSync(file));
fs.mkdirSync('out', { recursive: true });
for (const [name, r] of Object.entries(DEFAULT_REGIONS)) {
  const out = path.join('out', `crop-${name}.png`);
  fs.writeFileSync(out, toPngBuffer(crop(img, r)));
  console.log(out);
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: utilitarios de imagem e fixtures de screenshots"
```

---

### Task 3: Leitura da HUD (parsers de texto + OCR) — SPIKE

Maior risco técnico. Os valores de região abaixo são estimativas a partir de um screenshot 1920x1080; **devem ser ajustados olhando os recortes**.

**Files:**
- Create: `src/capture/hud.ts`, `tests/hud-parse.test.ts`, `tests/hud-screens.test.ts`, `tests/fixtures/screens/expected.json`

**Interfaces:**
- Consumes: `Img`, `Regions`, `Reading` (types); `crop`, `binarize`, `toPngBuffer` (image.ts).
- Produces:
  - `DEFAULT_REGIONS: Regions`
  - `parseLevel(t: string): number | undefined`
  - `parseExp(t: string): { expAbs: number; expPct: number } | undefined`
  - `parseMap(t: string): string | undefined`
  - `parseClass(t: string): string | undefined`
  - `class HudReader { static create(cachePath?: string): Promise<HudReader>; read(img: Img, regions: Regions): Promise<Omit<Reading,'t'>>; close(): Promise<void> }`

- [ ] **Step 1: Teste dos parsers (falha)**

`tests/hud-parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseLevel, parseExp, parseMap, parseClass } from '../src/capture/hud';

describe('parsers da HUD', () => {
  it('parseLevel', () => {
    expect(parseLevel(' 13\n')).toBe(13);
    expect(parseLevel('1 3')).toBe(13);
    expect(parseLevel('')).toBeUndefined();
    expect(parseLevel('999')).toBeUndefined();
  });
  it('parseExp', () => {
    expect(parseExp('EXP. 1 [0.02%]')).toEqual({ expAbs: 1, expPct: 0.02 });
    expect(parseExp('EXP 1,234 [12.5%]')).toEqual({ expAbs: 1234, expPct: 12.5 });
    expect(parseExp('lixo')).toBeUndefined();
  });
  it('parseMap pega a última linha útil', () => {
    expect(parseMap('Victoria Road\nPerion Street Corner\n')).toBe('Perion Street Corner');
    expect(parseMap('\n')).toBeUndefined();
  });
  it('parseClass pega a primeira linha só com letras', () => {
    expect(parseClass('Archer\nzBingulim')).toBe('Archer');
    expect(parseClass('12')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/hud-parse.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/capture/hud.ts`**

```ts
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { crop, binarize, toPngBuffer } from './image';
import type { Img, Regions, Reading } from '../types';

// Estimativa normalizada a partir de 1920x1080 (HUD no rodapé, minimapa no topo-esquerdo).
// AJUSTAR olhando `npx tsx scripts/crop.ts <screenshot>` (ver Step 5).
const n = (x: number, y: number, w: number, h: number) =>
  ({ x: x / 1920, y: y / 1080, w: w / 1920, h: h / 1080 });
export const DEFAULT_REGIONS: Regions = {
  level: n(450, 1040, 55, 32),
  cls: n(512, 1034, 100, 22),
  exp: n(1010, 1034, 175, 22),
  map: n(70, 38, 245, 40),
};

export function parseLevel(t: string): number | undefined {
  const d = t.replace(/\D/g, '');
  const v = d ? parseInt(d, 10) : NaN;
  return v >= 1 && v <= 100 ? v : undefined;
}
export function parseExp(t: string): { expAbs: number; expPct: number } | undefined {
  const m = t.match(/(\d[\d,.\s]*?)\s*[\[(|]?\s*(\d+\.\d+)\s*%/);
  if (!m) return undefined;
  const expAbs = parseInt(m[1].replace(/\D/g, ''), 10);
  return Number.isNaN(expAbs) ? undefined : { expAbs, expPct: parseFloat(m[2]) };
}
export function parseMap(t: string): string | undefined {
  const lines = t.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  return lines.at(-1);
}
export function parseClass(t: string): string | undefined {
  const l = t.split('\n').map((s) => s.trim()).find((s) => s.length > 0)?.replace(/[^A-Za-z ]/g, '').trim();
  return l && l.length >= 3 ? l : undefined;
}

// Predicados de primeiro plano (texto claro em fundo escuro). `level` pode precisar de ajuste após ver o recorte.
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
const FG_LIGHT = (r: number, g: number, b: number) => lum(r, g, b) > 170;
const FG_LEVEL = (r: number, g: number, b: number) => lum(r, g, b) > 200 || (r > 200 && g > 90 && g < 210 && b < 110);

export class HudReader {
  private constructor(private w: Worker) {}
  static async create(cachePath?: string) {
    const w = await createWorker('eng', 1, cachePath ? { cachePath } : {});
    return new HudReader(w);
  }
  private async ocr(img: Img, fg: (r: number, g: number, b: number) => boolean, digits: boolean, single: boolean) {
    await this.w.setParameters({
      tessedit_char_whitelist: digits ? '0123456789' : '',
      tessedit_pageseg_mode: single ? PSM.SINGLE_LINE : PSM.SINGLE_BLOCK,
    });
    const { data } = await this.w.recognize(toPngBuffer(binarize(img, fg)));
    return data.text;
  }
  async read(img: Img, r: Regions): Promise<Omit<Reading, 't'>> {
    const [lv, ex, cl, mp] = [
      await this.ocr(crop(img, r.level), FG_LEVEL, true, true),
      await this.ocr(crop(img, r.exp), FG_LIGHT, false, true),
      await this.ocr(crop(img, r.cls), FG_LIGHT, false, false),
      await this.ocr(crop(img, r.map), FG_LIGHT, false, false),
    ];
    const exp = parseExp(ex);
    return { level: parseLevel(lv), expAbs: exp?.expAbs, expPct: exp?.expPct, cls: parseClass(cl), map: parseMap(mp) };
  }
  close() { return this.w.terminate().then(() => undefined); }
}
```

- [ ] **Step 4: Rodar parsers**

Run: `npx vitest run tests/hud-parse.test.ts` → PASS.

- [ ] **Step 5: Calibrar regiões olhando os recortes**

```bash
npx tsx scripts/crop.ts tests/fixtures/screens/Maple_A_261021_220733.jpg
```
Abrir `out/crop-level.png`, `crop-exp.png`, `crop-cls.png`, `crop-map.png` com a ferramenta Read (imagens). Cada recorte deve conter só o texto-alvo, com margem pequena. Ajustar os números em `DEFAULT_REGIONS` e repetir até ficarem corretos. No recorte do level, decidir se os dígitos são claros ou laranja e ajustar `FG_LEVEL` se necessário.

- [ ] **Step 6: Criar `tests/fixtures/screens/expected.json` olhando cada screenshot**

Abrir cada um dos 12 JPG com Read e anotar level, EXP absoluta e o nome do mapa visíveis. Formato (o primeiro já é conhecido):
```json
{
  "Maple_A_261021_220733.jpg": { "level": 13, "expAbs": 1, "map": "Perion Street Corner" }
}
```
Incluir os 12 arquivos. Se algum valor não estiver legível na imagem, omitir esse campo (o teste só confere campos presentes).

- [ ] **Step 7: Teste de integração com screenshots (falha até calibrar)**

`tests/hud-screens.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HudReader, DEFAULT_REGIONS } from '../src/capture/hud';
import { decodeJpeg } from '../src/capture/image';

const dir = path.join(__dirname, 'fixtures/screens');
const expected: Record<string, { level?: number; expAbs?: number; map?: string }> =
  JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

let reader: HudReader;
beforeAll(async () => { reader = await HudReader.create(path.join(__dirname, '../out/tessdata')); });
afterAll(async () => { await reader.close(); });

describe('HudReader nos screenshots reais', () => {
  for (const [file, exp] of Object.entries(expected)) {
    it(file, async () => {
      const got = await reader.read(decodeJpeg(fs.readFileSync(path.join(dir, file))), DEFAULT_REGIONS);
      if (exp.level !== undefined) expect(got.level).toBe(exp.level);
      if (exp.expAbs !== undefined) expect(got.expAbs).toBe(exp.expAbs);
      if (exp.map !== undefined) expect(norm(got.map)).toBe(norm(exp.map));
    });
  }
});
```

- [ ] **Step 8: Rodar e iterar até passar**

Run: `npx vitest run tests/hud-screens.test.ts`  
(Primeira execução baixa `eng.traineddata`; precisa de internet.) Iterar em `DEFAULT_REGIONS`, `FG_LIGHT`, `FG_LEVEL` e `scale` de `binarize` até os 12 passarem para level, EXP e mapa.

- [ ] **Step 9: Fallback se o level não chegar a 100% com tesseract**

Só se o Step 8 não fechar o level: trocar `parseLevel(await this.ocr(...))` por template matching. Implementar em `src/capture/hud.ts`:
```ts
// templates: dígito -> bitmap binário 0/1 recortado de tests/fixtures/screens (um por dígito presente nos screenshots)
export function matchDigits(img: Img, templates: Record<string, number[][]>): number | undefined { /* ver abaixo */ }
```
Procedimento: usar `binarize(crop(level), FG_LEVEL, 1)`, segmentar por colunas vazias em glifos, comparar cada glifo (reamostrado para a altura do template) por menor distância de Hamming com cada template; concatenar dígitos. Gerar os templates a partir dos screenshots rotulados em `expected.json` e salvar em `src/capture/digit-templates.json`. Escrever o teste do `matchDigits` com um glifo sintético antes de implementar (TDD). Se o spike falhar mesmo assim, **parar e relatar** ao usuário antes de seguir.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: leitura da HUD por OCR validada nos screenshots reais"
```

---

### Task 4: Tracker (EXP/h, level up, descarte)

**Files:**
- Create: `src/tracker.ts`, `tests/tracker.test.ts`

**Interfaces:**
- Consumes: `Reading`, `Estado`.
- Produces: `createTracker(expToNext: (level: number) => number | undefined): { push(r: Reading): Estado | null }`

- [ ] **Step 1: Testes que falham**

`tests/tracker.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createTracker } from '../src/tracker';

const R = (t: number, level: number, expAbs: number, extra = {}) => ({ t, level, expAbs, expPct: 1, ...extra });

describe('tracker', () => {
  it('null até a primeira leitura válida', () => {
    const tr = createTracker(() => 1000);
    expect(tr.push({ t: 0 })).toBeNull();
  });
  it('calcula EXP/h (100 exp em 60 s = 6000/h)', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 0));
    expect(tr.push(R(60_000, 5, 100))!.expPorHora).toBeCloseTo(6000);
  });
  it('level up soma o resto do level anterior', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 900));
    const e = tr.push(R(60_000, 6, 50))!;
    expect(e.upou).toBe(true);
    expect(e.level).toBe(6);
    expect(e.expPorHora).toBeCloseTo(9000); // 100 + 50 em 1 min
    expect(tr.push(R(61_000, 6, 60))!.upou).toBe(false);
  });
  it('descarta salto de level implausível', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 0));
    const e = tr.push(R(1000, 8, 0))!;
    expect(e.level).toBe(5);
    expect(e.semLeitura).toBe(true);
  });
  it('descarta queda de EXP, mas aceita após 3 leituras seguidas (morte)', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 500));
    expect(tr.push(R(1000, 5, 100))!.expAbs).toBe(500);
    expect(tr.push(R(2000, 5, 100))!.expAbs).toBe(500);
    expect(tr.push(R(3000, 5, 100))!.expAbs).toBe(100);
  });
  it('leitura sem level/exp mantém último estado marcado como semLeitura', () => {
    const tr = createTracker(() => 1000);
    tr.push(R(0, 5, 10));
    const e = tr.push({ t: 1000 })!;
    expect(e.level).toBe(5);
    expect(e.semLeitura).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/tracker.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/tracker.ts`**

```ts
import type { Estado, Reading } from './types';

const JANELA_MS = 10 * 60_000;
const SPAN_MIN_MS = 30_000;
const CONFIRMA_QUEDA = 3; // queda de EXP real (morte) só é aceita se repetida

export function createTracker(expToNext: (level: number) => number | undefined) {
  let last: { level: number; expAbs: number; expPct: number } | null = null;
  let est: Estado | null = null;
  let total = 0;
  let queda = 0;
  let samples: { t: number; total: number }[] = [];

  const descarta = () => (est ? (est = { ...est, semLeitura: true, upou: false }) : null);

  return {
    push(r: Reading): Estado | null {
      if (r.level === undefined || r.expAbs === undefined) return descarta();
      const cur = { level: r.level, expAbs: r.expAbs, expPct: r.expPct ?? last?.expPct ?? 0 };
      let upou = false;
      if (!last) {
        last = cur;
      } else if (cur.level === last.level) {
        if (cur.expAbs >= last.expAbs) { total += cur.expAbs - last.expAbs; queda = 0; last = cur; }
        else if (++queda < CONFIRMA_QUEDA) return descarta();
        else { queda = 0; last = cur; }
      } else if (cur.level === last.level + 1) {
        const falta = expToNext(last.level);
        if (falta !== undefined) total += Math.max(0, falta - last.expAbs) + cur.expAbs;
        upou = true; queda = 0; last = cur;
      } else {
        return descarta();
      }
      samples.push({ t: r.t, total });
      samples = samples.filter((s) => r.t - s.t <= JANELA_MS);
      const first = samples[0];
      const span = r.t - first.t;
      const expPorHora = span >= SPAN_MIN_MS ? (total - first.total) / (span / 3_600_000) : 0;
      return (est = {
        level: last.level, expAbs: last.expAbs, expPct: last.expPct,
        classe: r.cls ?? est?.classe, mapa: r.map ?? est?.mapa,
        expPorHora, upou, semLeitura: false,
      });
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/tracker.test.ts` → PASS (6).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: tracker com EXP/h, level up e descarte de leituras ruins"
```

---

### Task 5: Advisor (funções puras)

**Files:**
- Create: `src/advisor.ts`, `tests/advisor.test.ts`
- Modify: `src/types.ts` (o tipo `Tip` ganha `guide: string`, o título do guia de origem; as dicas passam a ser filtradas pela classe do guia)

**Interfaces:**
- Consumes: `GrindMap`, `Quest`, `Tip`, `ExpRow`, `Limiares`, `Veredito`.
- Produces:
  - `makeExpToNext(rows: ExpRow[]): (level: number) => number | undefined`
  - `mapasParaLevel(maps: GrindMap[], level: number, n?: number): GrindMap[]`
  - `questsParaLevel(quests: Quest[], level: number, feitas: Set<string>, n?: number): Quest[]`
  - `dicasPara(tips: Tip[], level: number, classe?: string): Tip[]`
  - `novidadesNoLevel(maps: GrindMap[], quests: Quest[], level: number): { maps: GrindMap[]; quests: Quest[] }`
  - `veredito(expPorHora: number, best: GrindMap | undefined, lim: Limiares): Veredito`

- [ ] **Step 1: Testes que falham**

`tests/advisor.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeExpToNext, mapasParaLevel, questsParaLevel, dicasPara, novidadesNoLevel, veredito } from '../src/advisor';
import type { GrindMap, Quest, Tip } from '../src/types';

const M = (name: string, a: number, b: number, exp: number): GrindMap =>
  ({ name, street: '', maxExpHr: exp, mob: { name: 'x' }, why: '', levelMin: a, levelMax: b, sourceUrl: 'u' });
const Q = (id: string, level: number, exp: number): Quest =>
  ({ id, name: id, npc: '', level, exp, reward: '', sourceUrl: 'u' });
const T = (guide: string, title: string, a?: number, b?: number): Tip =>
  ({ kind: 'ap', guide, title, text: 't', levelMin: a, levelMax: b, sourceUrl: 'u' });
const LIM = { verde: 0.7, amarelo: 0.4 };

describe('advisor', () => {
  it('makeExpToNext', () => {
    const f = makeExpToNext([{ level: 1, toNext: 15 }, { level: 2, toNext: 34 }]);
    expect(f(2)).toBe(34);
    expect(f(9)).toBeUndefined();
  });
  it('mapasParaLevel filtra a faixa e ordena por EXP/h', () => {
    const r = mapasParaLevel([M('a', 11, 15, 100), M('b', 11, 15, 300), M('c', 16, 20, 999)], 13, 2);
    expect(r.map((m) => m.name)).toEqual(['b', 'a']);
  });
  it('questsParaLevel: janela de 5 níveis abaixo, sem feitas, por EXP desc', () => {
    const r = questsParaLevel([Q('a', 12, 50), Q('b', 13, 90), Q('c', 5, 999), Q('d', 14, 999), Q('e', 10, 10)], 13, new Set(['e']));
    expect(r.map((q) => q.id)).toEqual(['b', 'a']);
  });
  it('dicasPara filtra por faixa de level e pela linhagem de classe do guia', () => {
    const tips = [
      T('Bowman Build Guide', 'Ability Points', 1, 30),
      T('Warrior Build Guide', 'Ability Points'),
      T('Beginner Guide', 'Ability Points allocation'),
      T('Hunter Class Guide', 'Ability Points', 40, 70),
    ];
    // HUD diz "Archer": guias Bowman e genéricos passam; Warrior não; Hunter está fora da faixa
    expect(dicasPara(tips, 13, 'Archer').map((t) => t.guide)).toEqual(['Bowman Build Guide', 'Beginner Guide']);
    // sem classe lida não filtra por classe
    expect(dicasPara(tips, 13, undefined).map((t) => t.guide)).toEqual(['Bowman Build Guide', 'Warrior Build Guide', 'Beginner Guide']);
    expect(dicasPara(tips, 45, 'Hunter').map((t) => t.guide)).toEqual(['Beginner Guide', 'Hunter Class Guide']);
  });
  it('novidadesNoLevel: o que começa exatamente neste level', () => {
    const n = novidadesNoLevel([M('a', 14, 18, 1), M('b', 11, 15, 1)], [Q('x', 14, 1), Q('y', 13, 1)], 14);
    expect(n.maps.map((m) => m.name)).toEqual(['a']);
    expect(n.quests.map((q) => q.id)).toEqual(['x']);
  });
  it('veredito por faixa', () => {
    const best = M('b', 1, 99, 1000);
    expect(veredito(800, best, LIM).cor).toBe('verde');
    expect(veredito(500, best, LIM).cor).toBe('amarelo');
    expect(veredito(100, best, LIM).cor).toBe('vermelho');
    expect(veredito(0, best, LIM).cor).toBe('cinza');
    expect(veredito(500, undefined, LIM).cor).toBe('cinza');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/advisor.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/advisor.ts`**

```ts
import type { ExpRow, GrindMap, Limiares, Quest, Tip, Veredito } from './types';

export function makeExpToNext(rows: ExpRow[]) {
  const m = new Map(rows.map((r) => [r.level, r.toNext]));
  return (level: number) => m.get(level);
}

export function mapasParaLevel(maps: GrindMap[], level: number, n = 3): GrindMap[] {
  return maps
    .filter((m) => m.levelMin <= level && level <= m.levelMax)
    .sort((a, b) => b.maxExpHr - a.maxExpHr)
    .slice(0, n);
}

const JANELA_QUEST = 5;
export function questsParaLevel(quests: Quest[], level: number, feitas: Set<string>, n = 8): Quest[] {
  return quests
    .filter((q) => !feitas.has(q.id) && q.level <= level && q.level >= level - JANELA_QUEST)
    .sort((a, b) => b.exp - a.exp)
    .slice(0, n);
}

export function dicasPara(tips: Tip[], level: number, classe?: string): Tip[] {
  const c = classe?.toLowerCase();
  return tips.filter((t) => {
    const faixa = (t.levelMin === undefined || level >= t.levelMin) && (t.levelMax === undefined || level <= t.levelMax);
    return faixa && (!c || classeCompativel(`${t.guide} ${t.title}`, c)); // sem classe lida, não filtra por classe
  });
}
// Guia que cita a linhagem da classe lida passa; guia que não cita nenhuma classe conhecida (genérico) também passa.
// ponytail: tabela de linhagem escrita à mão (nomes de job da HUD x títulos dos guias); completar se aparecerem jobs não mapeados.
const CLASSES = ['warrior', 'magician', 'bowman', 'thief', 'archer', 'fighter', 'spearman', 'page', 'wizard', 'cleric', 'hunter', 'crossbowman', 'assassin', 'bandit', 'mage'];
const LINHAGEM: Record<string, string[]> = {
  archer: ['archer', 'bowman'], bowman: ['bowman', 'archer'], hunter: ['hunter', 'bowman'], crossbowman: ['crossbowman', 'bowman'],
  fighter: ['fighter', 'warrior'], spearman: ['spearman', 'warrior'], page: ['page', 'warrior'],
  assassin: ['assassin', 'thief'], bandit: ['bandit', 'thief'], cleric: ['cleric', 'magician'],
};
const cita = (texto: string, k: string) => new RegExp(`\\b${k}\\b`).test(texto);
function classeCompativel(guia: string, classe: string): boolean {
  const g = guia.toLowerCase();
  if ((LINHAGEM[classe] ?? [classe]).some((k) => cita(g, k))) return true;
  return !CLASSES.some((k) => cita(g, k));
}

export function novidadesNoLevel(maps: GrindMap[], quests: Quest[], level: number) {
  return { maps: maps.filter((m) => m.levelMin === level), quests: quests.filter((q) => q.level === level) };
}

export function veredito(expPorHora: number, best: GrindMap | undefined, lim: Limiares): Veredito {
  if (!best || best.maxExpHr <= 0 || expPorHora <= 0) return { cor: 'cinza', pct: null, ref: best };
  const pct = expPorHora / best.maxExpHr;
  return { cor: pct >= lim.verde ? 'verde' : pct >= lim.amarelo ? 'amarelo' : 'vermelho', pct, ref: best };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/advisor.test.ts` → PASS (6).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: advisor puro (mapas, quests, dicas, veredito)"
```

---

### Task 6: Parser de guias + fixtures

**Files:**
- Create: `scripts/fetch-fixtures.mjs`, `src/sources/parser.ts`, `tests/parser.test.ts`, `tests/fixtures/guides/*.html`

**Interfaces:**
- Consumes: `ParsedGuide`, `GrindMap`, `Quest`, `ExpRow`, `Tip`.
- Produces: `parseGuide(html: string, url: string): ParsedGuide`

- [ ] **Step 1: Baixar fixtures**

`scripts/fetch-fixtures.mjs`:
```js
import fs from 'node:fs';
const base = 'https://meowdb.com/msclassic/guides/';
const slugs = ['best-grind-maps-every-level', 'exp-table-level-1-to-100', 'beginners-guide-first-steps-in-maple-world'];
fs.mkdirSync('tests/fixtures/guides', { recursive: true });
for (const s of slugs) {
  const r = await fetch(base + s, { headers: { 'user-agent': 'Mozilla/5.0 maple-widget-fixtures' } });
  if (!r.ok) throw new Error(`${s}: HTTP ${r.status}`);
  fs.writeFileSync(`tests/fixtures/guides/${s}.html`, await r.text());
  console.log('ok', s);
}
```
Run: `node scripts/fetch-fixtures.mjs` → 3 arquivos. (Se der 403, salvar o HTML pela extensão do Chrome via `fetch` na página e gravar manualmente.)

- [ ] **Step 2: Testes que falham**

`tests/parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGuide } from '../src/sources/parser';

const load = (s: string) => fs.readFileSync(path.join(__dirname, 'fixtures/guides', s + '.html'), 'utf8');
const base = 'https://meowdb.com/msclassic/guides/';

describe('parseGuide', () => {
  it('grind maps', () => {
    const g = parseGuide(load('best-grind-maps-every-level'), base + 'best-grind-maps-every-level');
    expect(g.maps.length).toBeGreaterThan(10);
    expect(g.maps[0]).toMatchObject({ name: 'L Forest I', maxExpHr: 333525 });
    const line1 = g.maps.find((m) => m.name === 'Line 1 <Area 1>')!;
    expect([line1.levelMin, line1.levelMax]).toEqual([11, 15]);
    expect(line1.maxExpHr).toBe(640000);
    expect(line1.mob.name).toBe('Bubbling');
  });
  it('exp table', () => {
    const g = parseGuide(load('exp-table-level-1-to-100'), base + 'exp-table-level-1-to-100');
    expect(g.expRows.length).toBeGreaterThanOrEqual(99);
    expect(g.expRows[0]).toEqual({ level: 1, toNext: 15 });
  });
  it('quests e dicas de AP no beginner guide', () => {
    const g = parseGuide(load('beginners-guide-first-steps-in-maple-world'), base + 'beginners-guide-first-steps-in-maple-world');
    const sera = g.quests.find((q) => q.name === "Sera's Mirror")!;
    expect(sera).toMatchObject({ id: '1000', npc: 'Heena', level: 1, exp: 2 });
    const ap = g.tips.find((t) => /ability points/i.test(t.title))!;
    expect(ap.kind).toBe('ap');
    expect(ap.guide).toMatch(/Beginner/);
    expect(ap.text.length).toBeGreaterThan(20);
  });
  it('HTML sem tabelas reconhecidas retorna tudo vazio', () => {
    const g = parseGuide('<main><h1>x</h1><p>oi</p></main>', 'https://meowdb.com/a');
    expect([g.maps.length, g.quests.length, g.expRows.length, g.tips.length]).toEqual([0, 0, 0, 0]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/parser.test.ts` → FAIL.

- [ ] **Step 4: Implementar `src/sources/parser.ts`**

```ts
import * as cheerio from 'cheerio';
import type { ParsedGuide } from '../types';

const TIP_RE = /ability points|skill points|\bAP\b|\bSP\b|\bbuild\b/i;
const num = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
const faixa = (s: string): [number, number] => {
  const m = s.match(/level\s*(\d+)\s*[-–]\s*(\d+)/i);
  return m ? [+m[1], +m[2]] : [1, 100];
};

export function parseGuide(html: string, url: string): ParsedGuide {
  const $ = cheerio.load(html);
  const abs = (s?: string) => (s ? new URL(s, url).toString() : undefined);
  const origin = new URL(url).origin;
  const out: ParsedGuide = {
    title: $('h1').first().text().trim() || $('title').text().trim(),
    maps: [], quests: [], expRows: [], tips: [],
  };
  const root = $('main').length ? $('main').first() : $('body');

  let h2 = '';
  let range: [number, number] = [1, 100];
  let tip: { title: string; lines: string[]; range?: [number, number] } | null = null;
  const flushTip = () => {
    if (tip && tip.lines.length) {
      out.tips.push({
        kind: /skill points|\bSP\b/i.test(tip.title) ? 'sp' : 'ap',
        guide: out.title, title: tip.title, text: tip.lines.join('\n'),
        levelMin: tip.range?.[0], levelMax: tip.range?.[1], sourceUrl: url,
      });
    }
    tip = null;
  };

  root.find('h2, table, p, li').each((_, el) => {
    const node = $(el);
    const tag = (node.prop('tagName') as string).toLowerCase();
    if (tag === 'h2') {
      flushTip();
      h2 = node.text().trim();
      range = faixa(h2);
      if (TIP_RE.test(h2)) tip = { title: h2, lines: [], range: /level\s*\d+/i.test(h2) ? range : undefined };
      return;
    }
    if (tag === 'table') { parseTable(node); return; }
    if (!tip || node.closest('table').length) return;
    if (tag === 'li' && node.find('p').length) return; // evita duplicar texto de <li><p>
    const t = node.text().trim();
    if (t) tip.lines.push(t);
  });
  flushTip();
  return out;

  function parseTable(table: cheerio.Cheerio<any>) {
    const rows = table.find('tr').toArray();
    if (rows.length < 2) return;
    const heads = $(rows[0]).children('th,td').toArray().map((c) => $(c).text().trim().toLowerCase());
    const col = (f: (h: string) => boolean) => heads.findIndex(f);
    const iMap = col((h) => h === 'map'), iExpHr = col((h) => h.startsWith('max exp'));
    const iQuest = col((h) => h === 'quest'), iLv = col((h) => h === 'lv'), iExp = col((h) => h === 'exp');
    const iLevel = col((h) => h === 'level'), iNext = col((h) => h === 'exp to next');

    for (const tr of rows.slice(1)) {
      const row = $(tr);
      const cells = row.children('th,td').toArray().map((c) => $(c));
      const txt = (i: number) => (i >= 0 ? (cells[i]?.text().trim() ?? '') : '');

      if (iMap >= 0 && iExpHr >= 0) {
        const iMob = col((h) => h.includes('mob'));
        const mobCell = cells[iMob];
        const mobId = row.find('a[href]').toArray().map((a) => $(a).attr('href') ?? '')
          .map((h) => h.match(/\/(?:monsters?|mobs?)(?:-db)?\/(\d+)/)?.[1]).find(Boolean);
        const img = abs(mobCell?.find('img').attr('src'));
        out.maps.push({
          name: txt(iMap), street: txt(col((h) => h === 'street')), maxExpHr: num(txt(iExpHr)),
          mob: {
            name: txt(iMob).replace(/\s*\(.*?\)\s*$/, ''), id: mobId,
            iconUrl: img ?? (mobId ? `${origin}/msclassic/monsters/anim/${mobId.padStart(7, '0')}.stand.webp` : undefined),
          },
          why: txt(col((h) => h === 'why')), levelMin: range[0], levelMax: range[1], sourceUrl: url,
        });
      } else if (iQuest >= 0 && iLv >= 0 && iExp >= 0) {
        const id = row.find('a[href]').toArray().map((a) => $(a).attr('href') ?? '')
          .map((h) => h.match(/quest-tracker\/(\d+)/)?.[1]).find(Boolean);
        const reward = txt(col((h) => h === 'reward'));
        out.quests.push({
          id: id ?? txt(iQuest), name: txt(iQuest), npc: txt(col((h) => h === 'from')),
          level: num(txt(iLv)), exp: num(txt(iExp)), reward: reward === '-' ? '' : reward,
          iconUrl: abs(row.find('img').first().attr('src')), sourceUrl: url,
        });
      } else if (iLevel >= 0 && iNext >= 0) {
        const level = num(txt(iLevel)), toNext = num(txt(iNext));
        if (level > 0 && toNext > 0) out.expRows.push({ level, toNext });
      }
    }
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/parser.test.ts`  
Expected: PASS. Se uma asserção de valor falhar por diferença real no HTML (ex.: faixa do H2 ou nome da coluna), **inspecione o fixture** e corrija o parser (não a asserção), exceto se o fixture provar que a asserção estava errada.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: parser de guias do meowdb (mapas, quests, exp table, dicas)"
```

---

### Task 7: Allowlist, carga de fontes com cache e config

**Files:**
- Create: `src/sources/allowlist.ts`, `src/sources/load.ts`, `src/store.ts`, `tests/sources.test.ts`

**Interfaces:**
- Consumes: `parseGuide`, `SourceData`, `Source`, `Config`.
- Produces:
  - `isAllowedUrl(url: string, dominios: string[]): boolean`
  - `loadSource(url: string, o: { dominios: string[]; cacheDir: string; fetchFn?: typeof fetch }): Promise<SourceData>`
  - `class Store { constructor(dir: string); load(): Config; save(c: Config): void }` e `DEFAULT_CONFIG: Config`

- [ ] **Step 1: Testes que falham**

`tests/sources.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isAllowedUrl } from '../src/sources/allowlist';
import { loadSource } from '../src/sources/load';
import { Store, DEFAULT_CONFIG } from '../src/store';

const D = ['meowdb.com', 'niadb.com'];
const html = fs.readFileSync(path.join(__dirname, 'fixtures/guides/exp-table-level-1-to-100.html'), 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
const ok = (body: string) => (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
const fail = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
const URL1 = 'https://meowdb.com/msclassic/guides/exp-table-level-1-to-100';

describe('allowlist', () => {
  it('aceita domínio e subdomínio, rejeita o resto', () => {
    expect(isAllowedUrl(URL1, D)).toBe(true);
    expect(isAllowedUrl('https://www.niadb.com/x', D)).toBe(true);
    expect(isAllowedUrl('https://evil.com/meowdb.com', D)).toBe(false);
    expect(isAllowedUrl('https://meowdb.com.evil.com/', D)).toBe(false);
    expect(isAllowedUrl('file:///c:/x', D)).toBe(false);
    expect(isAllowedUrl('lixo', D)).toBe(false);
  });
});

describe('loadSource', () => {
  it('baixa, parseia e cacheia', async () => {
    const dir = tmp();
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok(html) });
    expect(d.source.status).toBe('ok');
    expect(d.source.counts.expRows).toBeGreaterThanOrEqual(99);
    expect(fs.readdirSync(dir).length).toBe(1);
  });
  it('offline usa cache e marca erro', async () => {
    const dir = tmp();
    await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: ok(html) });
    const d = await loadSource(URL1, { dominios: D, cacheDir: dir, fetchFn: fail });
    expect(d.source.status).toBe('erro');
    expect(d.expRows.length).toBeGreaterThanOrEqual(99);
  });
  it('offline sem cache: erro e vazio', async () => {
    const d = await loadSource(URL1, { dominios: D, cacheDir: tmp(), fetchFn: fail });
    expect(d.source.status).toBe('erro');
    expect(d.expRows).toEqual([]);
  });
  it('página sem nada reconhecido vira vazio', async () => {
    const d = await loadSource(URL1, { dominios: D, cacheDir: tmp(), fetchFn: ok('<main><p>oi</p></main>') });
    expect(d.source.status).toBe('vazio');
  });
  it('rejeita domínio fora do allowlist sem chamar a rede', async () => {
    await expect(loadSource('https://evil.com/x', { dominios: D, cacheDir: tmp(), fetchFn: fail })).rejects.toThrow(/domínio/);
  });
});

describe('Store', () => {
  it('retorna default e persiste', () => {
    const dir = tmp();
    const s = new Store(dir);
    expect(s.load()).toEqual(DEFAULT_CONFIG);
    s.save({ ...DEFAULT_CONFIG, gamePath: 'X' });
    expect(new Store(dir).load().gamePath).toBe('X');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/sources.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`src/sources/allowlist.ts`:
```ts
export function isAllowedUrl(url: string, dominios: string[]): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  return dominios.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
}
```

`src/sources/load.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isAllowedUrl } from './allowlist';
import { parseGuide } from './parser';
import type { ParsedGuide, SourceData } from '../types';

type Opts = { dominios: string[]; cacheDir: string; fetchFn?: typeof fetch };
const EMPTY: ParsedGuide = { title: '', maps: [], quests: [], expRows: [], tips: [] };

const counts = (g: ParsedGuide) =>
  ({ maps: g.maps.length, quests: g.quests.length, expRows: g.expRows.length, tips: g.tips.length });

export async function loadSource(url: string, o: Opts): Promise<SourceData> {
  if (!isAllowedUrl(url, o.dominios)) throw new Error('domínio não permitido');
  fs.mkdirSync(o.cacheDir, { recursive: true });
  const file = path.join(o.cacheDir, createHash('sha1').update(url).digest('hex') + '.json');
  try {
    const r = await (o.fetchFn ?? fetch)(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const g = parseGuide(await r.text(), url);
    const c = counts(g);
    const empty = !(c.maps || c.quests || c.expRows || c.tips);
    const data: SourceData = { ...g, source: { url, title: g.title || url, fetchedAt: Date.now(), status: empty ? 'vazio' : 'ok', counts: c } };
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (fs.existsSync(file)) {
      const cached: SourceData = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ...cached, source: { ...cached.source, status: 'erro', error: msg } };
    }
    return { ...EMPTY, source: { url, title: url, fetchedAt: 0, status: 'erro', error: msg, counts: counts(EMPTY) } };
  }
}
```

`src/store.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  gamePath: '',
  regions: {},
  sources: [],
  dominios: ['meowdb.com', 'niadb.com'],
  limiares: { verde: 0.7, amarelo: 0.4 },
  questsFeitas: [],
  opacidade: 0.92,
  janela: { expandido: false },
};

export class Store {
  private file: string;
  constructor(dir: string) { fs.mkdirSync(dir, { recursive: true }); this.file = path.join(dir, 'config.json'); }
  load(): Config {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; }
    catch { return structuredClone(DEFAULT_CONFIG); }
  }
  save(c: Config) { fs.writeFileSync(this.file, JSON.stringify(c, null, 2)); }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/sources.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: allowlist, carga de fontes com cache e config persistida"
```

---

### Task 8: Descoberta e sincronização automática de guias

**Files:**
- Create: `src/sources/discover.ts`, `src/sources/sync.ts`, `tests/sync.test.ts`
- Modify: `src/types.ts` (`Source` ganha `lastmod?: string; auto?: boolean`; `Config` ganha `autoSync: boolean; sitemapUrl: string`), `src/store.ts` (defaults `autoSync: true`, `sitemapUrl: 'https://meowdb.com/msclassic/sitemap.xml'`), `src/sources/load.ts` (opções `lastmod`/`auto`, `User-Agent`, exporta `readCache`)

**Interfaces:**
- Consumes: `loadSource`, `isAllowedUrl`, `SourceData`, `Source` (Task 7).
- Produces:
  - `type GuideRef = { url: string; lastmod: string }`
  - `USER_AGENT: string`
  - `parseSitemap(xml: string): GuideRef[]` (só URLs `/msclassic/guides/<slug>`, sem a página de índice)
  - `discoverGuides(o: { sitemapUrl: string; dominios: string[]; fetchFn?: typeof fetch }): Promise<GuideRef[]>`
  - `readCache(cacheDir: string, url: string): SourceData | undefined`
  - `syncAuto(o: { sitemapUrl: string; dominios: string[]; cacheDir: string; manual: string[]; fetchFn?: typeof fetch }): Promise<{ data: SourceData[]; descobertos: number; atualizados: number; offline: boolean }>`

- [ ] **Step 1: Testes que falham**

`tests/sync.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSitemap } from '../src/sources/discover';
import { syncAuto } from '../src/sources/sync';

const SITEMAP = 'https://meowdb.com/msclassic/sitemap.xml';
const D = ['meowdb.com'];
const SM = (a: string, b: string) => `<?xml version="1.0"?><urlset>
<url><loc>https://meowdb.com/msclassic/guides</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
<url><loc>https://meowdb.com/msclassic/guides/g-a</loc><lastmod>${a}</lastmod></url>
<url><loc>https://meowdb.com/msclassic/guides/g-b</loc><lastmod>${b}</lastmod></url>
<url><loc>https://meowdb.com/msclassic/monsters/123</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
</urlset>`;
const GUIDE = '<main><h1>G</h1><table><tr><th>Level</th><th>EXP to next</th></tr><tr><td>1</td><td>15</td></tr></table></main>';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mw-sync-'));

function net(state: { a: string; b: string; offline?: boolean }) {
  const calls: string[] = [];
  const f = (async (u: string) => {
    calls.push(u);
    if (state.offline) throw new Error('offline');
    return new Response(u === SITEMAP ? SM(state.a, state.b) : GUIDE);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const run = (dir: string, f: typeof fetch, manual: string[] = []) =>
  syncAuto({ sitemapUrl: SITEMAP, dominios: D, cacheDir: dir, manual, fetchFn: f });

describe('parseSitemap', () => {
  it('só guias, sem o índice nem outras entidades, preservando lastmod', () => {
    expect(parseSitemap(SM('x', 'y'))).toEqual([
      { url: 'https://meowdb.com/msclassic/guides/g-a', lastmod: 'x' },
      { url: 'https://meowdb.com/msclassic/guides/g-b', lastmod: 'y' },
    ]);
  });
});

describe('syncAuto', () => {
  it('primeira sync: sitemap + todos os guias, marcados como automáticos', async () => {
    const n = net({ a: '1', b: '1' });
    const r = await run(tmp(), n.f);
    expect(r.data.length).toBe(2);
    expect(r.data.every((d) => d.source.auto)).toBe(true);
    expect(r.descobertos).toBe(2);
    expect(r.atualizados).toBe(2);
    expect(r.offline).toBe(false);
    expect(n.calls.length).toBe(3);
  });
  it('segunda sync sem mudanças só baixa o sitemap', async () => {
    const dir = tmp(); const n = net({ a: '1', b: '1' });
    await run(dir, n.f);
    const r = await run(dir, n.f);
    expect(n.calls.length).toBe(4);
    expect(r.atualizados).toBe(0);
    expect(r.data.length).toBe(2);
  });
  it('guia com lastmod novo é rebaixado; os outros não', async () => {
    const dir = tmp(); const state = { a: '1', b: '1' }; const n = net(state);
    await run(dir, n.f);
    state.b = '2';
    const r = await run(dir, n.f);
    expect(r.atualizados).toBe(1);
    expect(n.calls.length).toBe(3 + 2); // sitemap + 1 guia
  });
  it('guia novo no site entra na próxima sync', async () => {
    const dir = tmp(); const state = { a: '1', b: '1' };
    await run(dir, net(state).f);
    const f = (async (u: string) => new Response(u === SITEMAP
      ? SM('1', '1').replace('</urlset>', '<url><loc>https://meowdb.com/msclassic/guides/g-c</loc><lastmod>3</lastmod></url></urlset>')
      : GUIDE)) as unknown as typeof fetch;
    const r = await run(dir, f);
    expect(r.data.map((d) => d.source.url).sort()).toEqual([
      'https://meowdb.com/msclassic/guides/g-a', 'https://meowdb.com/msclassic/guides/g-b', 'https://meowdb.com/msclassic/guides/g-c']);
  });
  it('offline usa o cache e sinaliza', async () => {
    const dir = tmp(); const state = { a: '1', b: '1', offline: false };
    await run(dir, net(state).f);
    state.offline = true;
    const r = await run(dir, net(state).f);
    expect(r.offline).toBe(true);
    expect(r.data.length).toBe(2);
  });
  it('fonte manual fora do sitemap entra sem flag auto; domínio proibido é ignorado', async () => {
    const r = await run(tmp(), net({ a: '1', b: '1' }).f,
      ['https://meowdb.com/msclassic/guides/g-extra', 'https://evil.com/x']);
    const extra = r.data.find((d) => d.source.url.endsWith('g-extra'))!;
    expect(extra.source.auto).toBe(false);
    expect(r.data.some((d) => d.source.url.includes('evil.com'))).toBe(false);
    expect(r.data.length).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/sync.test.ts` → FAIL (módulos não existem).

- [ ] **Step 3: Atualizar tipos e config**

Em `src/types.ts`: no tipo `Source`, acrescentar `lastmod?: string; auto?: boolean;`; no tipo `Config`, acrescentar `autoSync: boolean; sitemapUrl: string;`.  
Em `src/store.ts`, em `DEFAULT_CONFIG`, acrescentar `autoSync: true,` e `sitemapUrl: 'https://meowdb.com/msclassic/sitemap.xml',`.

- [ ] **Step 4: Implementar `src/sources/discover.ts`**

```ts
import { isAllowedUrl } from './allowlist';

export type GuideRef = { url: string; lastmod: string };
export const USER_AGENT = 'maple-widget/0.1 (ferramenta pessoal; sincroniza guias do MapleStory Classic)';

export function parseSitemap(xml: string): GuideRef[] {
  const out: GuideRef[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>\s*(.*?)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    let u: URL;
    try { u = new URL(loc); } catch { continue; }
    if (!/^\/msclassic\/guides\/[^/]+$/.test(u.pathname)) continue;
    out.push({ url: u.origin + u.pathname, lastmod: m[1].match(/<lastmod>\s*(.*?)\s*<\/lastmod>/)?.[1] ?? '' });
  }
  return out;
}

export async function discoverGuides(o: { sitemapUrl: string; dominios: string[]; fetchFn?: typeof fetch }): Promise<GuideRef[]> {
  if (!isAllowedUrl(o.sitemapUrl, o.dominios)) throw new Error('domínio não permitido');
  const r = await (o.fetchFn ?? fetch)(o.sitemapUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseSitemap(await r.text()).filter((g) => isAllowedUrl(g.url, o.dominios));
}
```

- [ ] **Step 5: Ajustar `src/sources/load.ts` (MODIFICAR a versão atual; não reescrever do zero)**

A versão atual (Task 7, já com as correções de segurança/robustez: checagem de `r.url` contra o allowlist após o fetch, leitura de cache à prova de JSON corrompido, escrita de cache que nunca derruba um download bem-sucedido, escrita atômica tmp+rename) deve ser **preservada**. Mudanças a aplicar:
- `Opts` ganha `lastmod?: string; auto?: boolean`.
- Exportar `readCache(cacheDir: string, url: string): SourceData | undefined` (a mesma leitura segura já usada no caminho de erro, com `try/catch` em volta de `JSON.parse`), e usá-la no `catch` de `loadSource`.
- Acrescentar o header `'user-agent': USER_AGENT` (importado de `./discover`) na chamada `fetch`, mantendo `redirect: 'follow'` e a checagem `isAllowedUrl(r.url || url, ...)` existente.
- Gravar `lastmod: o.lastmod, auto: o.auto` em `source` no caminho de sucesso e no caminho de erro sem cache.
- Nenhuma outra mudança de comportamento; os testes de `tests/sources.test.ts` (incluindo os de redirecionamento, cache corrompido e falha de escrita adicionados na Task 7) devem continuar passando.

- [ ] **Step 6: Implementar `src/sources/sync.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { discoverGuides, type GuideRef } from './discover';
import { loadSource, readCache } from './load';
import type { SourceData } from '../types';

const MANUAL_TTL_MS = 6 * 3_600_000;
const CONCURRENCIA = 3;

export type SyncOpts = { sitemapUrl: string; dominios: string[]; cacheDir: string; manual: string[]; fetchFn?: typeof fetch };
export type SyncResult = { data: SourceData[]; descobertos: number; atualizados: number; offline: boolean };

export async function syncAuto(o: SyncOpts): Promise<SyncResult> {
  fs.mkdirSync(o.cacheDir, { recursive: true });
  const indexFile = path.join(o.cacheDir, 'auto-index.json');
  let refs: GuideRef[];
  let offline = false;
  try {
    refs = await discoverGuides(o);
    fs.writeFileSync(indexFile, JSON.stringify(refs));
  } catch {
    offline = true;
    refs = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
  }
  const porUrl = new Map(refs.map((r) => [r.url, r]));
  const urls = [...new Set([...refs.map((r) => r.url), ...o.manual])];
  const data: SourceData[] = [];
  let atualizados = 0;
  let i = 0;

  const worker = async () => {
    for (;;) {
      const url = urls[i++];
      if (!url) return;
      try {
        const ref = porUrl.get(url);
        const cached = readCache(o.cacheDir, url);
        const velho = !!cached && (ref
          ? cached.source.lastmod !== ref.lastmod
          : Date.now() - cached.source.fetchedAt > MANUAL_TTL_MS);
        const precisa = !offline && (!cached || cached.source.status === 'erro' || velho);
        if (!precisa) {
          if (cached) data.push({ ...cached, source: { ...cached.source, auto: !!ref } });
          continue;
        }
        data.push(await loadSource(url, { dominios: o.dominios, cacheDir: o.cacheDir, fetchFn: o.fetchFn, lastmod: ref?.lastmod, auto: !!ref }));
        atualizados++;
      } catch {
        // domínio recusado ou falha isolada: ignora só esta fonte
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCIA }, worker));
  data.sort((a, b) => a.source.url.localeCompare(b.source.url));
  return { data, descobertos: refs.length, atualizados, offline };
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run tests/sync.test.ts tests/sources.test.ts` → PASS (a suíte da Task 7 continua verde com o `load.ts` novo).  
Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: descoberta e sincronização automática de guias via sitemap"
```

---

### Task 9: ViewModel (puro)

**Files:**
- Create: `src/viewmodel.ts`, `tests/viewmodel.test.ts`
- Modify: `src/types.ts` — acrescentar `export type SyncInfo = { auto: boolean; guias: number; ultima: number; offline: boolean };` e o campo `sync: SyncInfo;` em `ViewModel`

**Interfaces:**
- Consumes: `Estado`, `Library`, `Source`, `Limiares`, `ViewModel`, e todo o `advisor`.
- Produces: `buildViewModel(i: VMInput): ViewModel` com
  `VMInput = { estado: Estado | null; lib: Library; fontes: Source[]; feitas: Set<string>; lim: Limiares; capturaPreta: boolean; jogoNaoEncontrado: boolean; precisaWizard: boolean; opacidade: number; expandido: boolean; sync: SyncInfo }`

- [ ] **Step 1: Teste que falha**

`tests/viewmodel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildViewModel } from '../src/viewmodel';
import type { Estado, Library } from '../src/types';

const lib: Library = {
  maps: [{ name: 'Line 1', street: 's', maxExpHr: 1000, mob: { name: 'm' }, why: '', levelMin: 11, levelMax: 15, sourceUrl: 'u' },
         { name: 'Novo', street: 's', maxExpHr: 2000, mob: { name: 'm' }, why: '', levelMin: 14, levelMax: 18, sourceUrl: 'u' }],
  quests: [{ id: '1', name: 'q', npc: '', level: 14, exp: 5, reward: '', sourceUrl: 'u' }],
  expRows: [], tips: [{ kind: 'ap', guide: 'G', title: 'AP', text: 't', sourceUrl: 'u' }],
};
const est = (o: Partial<Estado> = {}): Estado =>
  ({ level: 13, expAbs: 1, expPct: 1, expPorHora: 800, upou: false, semLeitura: false, ...o });
const base = { lib, fontes: [], feitas: new Set<string>(), lim: { verde: 0.7, amarelo: 0.4 },
  capturaPreta: false, jogoNaoEncontrado: false, precisaWizard: false, opacidade: 1, expandido: false,
  sync: { auto: true, guias: 34, ultima: 0, offline: false } };

describe('buildViewModel', () => {
  it('monta mapas, quests, dicas e veredito para o level', () => {
    const vm = buildViewModel({ ...base, estado: est() });
    expect(vm.mapas.map((m) => m.name)).toEqual(['Line 1']);
    expect(vm.veredito.cor).toBe('verde'); // 800 / 1000 = 0.8 >= 0.7
  });
  it('levelUp traz novidades do novo level', () => {
    const vm = buildViewModel({ ...base, estado: est({ level: 14, upou: true }) });
    expect(vm.levelUp).toMatchObject({ de: 13, para: 14 });
    expect(vm.levelUp!.novidades.maps.map((m) => m.name)).toEqual(['Novo']);
    expect(vm.levelUp!.novidades.quests.map((q) => q.id)).toEqual(['1']);
  });
  it('avisa quando a sincronização está offline', () => {
    const vm = buildViewModel({ ...base, estado: est(), sync: { auto: true, guias: 3, ultima: 1, offline: true } });
    expect(vm.avisos.join('|')).toMatch(/cache/i);
    expect(vm.sync.guias).toBe(3);
  });
  it('avisos: sem fontes, captura preta, jogo não encontrado', () => {
    const a = buildViewModel({ ...base, estado: null, capturaPreta: true, jogoNaoEncontrado: true }).avisos.join('|');
    expect(a).toMatch(/fonte/i);
    expect(a).toMatch(/tela cheia/i);
    expect(a).toMatch(/jogo/i);
  });
});
```
- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/viewmodel.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/viewmodel.ts`**

```ts
import { dicasPara, mapasParaLevel, novidadesNoLevel, questsParaLevel, veredito } from './advisor';
import type { Estado, Library, Limiares, Source, SyncInfo, ViewModel } from './types';

export type VMInput = {
  estado: Estado | null; lib: Library; fontes: Source[]; feitas: Set<string>; lim: Limiares;
  capturaPreta: boolean; jogoNaoEncontrado: boolean; precisaWizard: boolean;
  opacidade: number; expandido: boolean; sync: SyncInfo;
};

export function buildViewModel(i: VMInput): ViewModel {
  const { estado: e, lib } = i;
  const mapas = e ? mapasParaLevel(lib.maps, e.level) : [];
  const avisos: string[] = [];
  if (!i.fontes.length) avisos.push('Nenhuma fonte carregada. Verifique a conexão ou ligue a sincronização na aba Fontes.');
  if (i.sync.offline) avisos.push('Sem conexão com o site: usando guias em cache.');
  if (i.capturaPreta) avisos.push('Captura preta: o jogo parece estar em tela cheia exclusiva. Use o modo janela/borderless ou mova o widget para o 2º monitor.');
  if (i.jogoNaoEncontrado) avisos.push('Janela do jogo não encontrada.');
  if (e?.semLeitura) avisos.push('Sem leitura da HUD agora (mantendo último valor).');
  for (const f of i.fontes) if (f.status === 'erro') avisos.push(`Fonte com erro (usando cache): ${f.title}`);

  const dicas = e ? dicasPara(lib.tips, e.level, e.classe) : [];
  return {
    estado: e,
    veredito: e ? veredito(e.expPorHora, mapas[0], i.lim) : { cor: 'cinza', pct: null },
    mapas,
    quests: e ? questsParaLevel(lib.quests, e.level, i.feitas) : [],
    dicas,
    levelUp: e?.upou
      ? { de: e.level - 1, para: e.level, dicas, novidades: novidadesNoLevel(lib.maps, lib.quests, e.level) }
      : undefined,
    fontes: i.fontes, avisos, capturaPreta: i.capturaPreta, sync: i.sync,
    precisaWizard: i.precisaWizard, opacidade: i.opacidade, expandido: i.expandido,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run` → toda a suíte PASS (exceto o que depender de rede já está coberto).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: viewmodel puro com avisos e cartão de level up"
```

---

### Task 10: Shell Electron (main, preload, loop de captura)

**Files:**
- Create: `build.mjs`, `src/main/main.ts`, `src/main/preload.ts`, `src/renderer/api.d.ts`

**Interfaces:**
- Consumes: tudo de `src/` (HudReader, tracker, advisor, loadSource, Store, buildViewModel, image utils).
- Produces: IPC (main ↔ renderer). `window.api`:
  - `onVM(cb: (vm: ViewModel) => void): void`
  - `addSource(url: string): Promise<{ ok: boolean; erro?: string }>`
  - `removeSource(url: string): Promise<void>`
  - `refreshSources(): Promise<void>`
  - `syncNow(): Promise<void>` (sincroniza guias agora)
  - `setAutoSync(on: boolean): Promise<void>`
  - `toggleQuest(id: string): Promise<void>`
  - `setExpanded(b: boolean): Promise<void>`
  - `setOpacity(n: number): Promise<void>`
  - `pickGameFolder(): Promise<string | null>`
  - `getShot(): Promise<{ dataUrl: string; w: number; h: number } | null>`
  - `saveCalibration(key: string, regions: Regions, gamePath: string): Promise<void>`
  - `getConfig(): Promise<Config>`

- [ ] **Step 1: `build.mjs`**

```js
import { build } from 'esbuild';
import fs from 'node:fs';

fs.mkdirSync('dist', { recursive: true });
const common = { bundle: true, sourcemap: true, logLevel: 'info' };
await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs',
  external: ['electron', 'tesseract.js', 'cheerio', 'pngjs', 'jpeg-js'] });
await build({ ...common, entryPoints: ['src/main/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] });
await build({ ...common, entryPoints: ['src/renderer/renderer.ts'], outfile: 'dist/renderer.js', platform: 'browser', format: 'iife' });
fs.copyFileSync('src/renderer/index.html', 'dist/index.html');
fs.copyFileSync('src/renderer/styles.css', 'dist/styles.css');
```

- [ ] **Step 2: `src/renderer/api.d.ts`**

```ts
import type { Config, Regions, ViewModel } from '../types';
export interface Api {
  onVM(cb: (vm: ViewModel) => void): void;
  addSource(url: string): Promise<{ ok: boolean; erro?: string }>;
  removeSource(url: string): Promise<void>;
  refreshSources(): Promise<void>;
  syncNow(): Promise<void>;
  setAutoSync(on: boolean): Promise<void>;
  toggleQuest(id: string): Promise<void>;
  setExpanded(b: boolean): Promise<void>;
  setOpacity(n: number): Promise<void>;
  pickGameFolder(): Promise<string | null>;
  getShot(): Promise<{ dataUrl: string; w: number; h: number } | null>;
  saveCalibration(key: string, regions: Regions, gamePath: string): Promise<void>;
  getConfig(): Promise<Config>;
}
declare global { interface Window { api: Api } }
```

- [ ] **Step 3: `src/main/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '../renderer/api.d';

const api: Api = {
  onVM: (cb) => { ipcRenderer.on('vm', (_e, vm) => cb(vm)); },
  addSource: (u) => ipcRenderer.invoke('src:add', u),
  removeSource: (u) => ipcRenderer.invoke('src:remove', u),
  refreshSources: () => ipcRenderer.invoke('src:refresh'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  setAutoSync: (on) => ipcRenderer.invoke('sync:toggle', on),
  toggleQuest: (id) => ipcRenderer.invoke('quest:toggle', id),
  setExpanded: (b) => ipcRenderer.invoke('win:expand', b),
  setOpacity: (n) => ipcRenderer.invoke('win:opacity', n),
  pickGameFolder: () => ipcRenderer.invoke('wiz:folder'),
  getShot: () => ipcRenderer.invoke('wiz:shot'),
  saveCalibration: (k, r, p) => ipcRenderer.invoke('wiz:save', k, r, p),
  getConfig: () => ipcRenderer.invoke('cfg:get'),
};
contextBridge.exposeInMainWorld('api', api);
```

- [ ] **Step 4: `src/main/main.ts`**

```ts
import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { HudReader, DEFAULT_REGIONS } from '../capture/hud';
import { bgraToImg, decodeJpeg, isBlack, toPngBuffer } from '../capture/image';
import { createTracker } from '../tracker';
import { makeExpToNext } from '../advisor';
import { isAllowedUrl } from '../sources/allowlist';
import { loadSource } from '../sources/load';
import { syncAuto } from '../sources/sync';
import { Store } from '../store';
import { buildViewModel } from '../viewmodel';
import type { Estado, Img, Library, Regions, SourceData } from '../types';

const TICK_MS = 2000;
const W_COMPACTO = { w: 340, h: 64 }, W_EXPANDIDO = { w: 340, h: 460 };

let win: BrowserWindow;
let store: Store;
let cfg: ReturnType<Store['load']>;
let reader: HudReader;
let data: SourceData[] = [];
let tracker = createTracker(() => undefined);
let estado: Estado | null = null;
let flags = { capturaPreta: false, jogoNaoEncontrado: false };
let syncInfo = { ultima: 0, offline: false };
let busy = false;
const SYNC_INTERVALO_MS = 30 * 60_000;

const lib = (): Library => ({
  maps: data.flatMap((d) => d.maps), quests: data.flatMap((d) => d.quests),
  expRows: data.flatMap((d) => d.expRows), tips: data.flatMap((d) => d.tips),
});
const cacheDir = () => path.join(app.getPath('userData'), 'cache');
const resKey = (i: Img) => `${i.w}x${i.h}`;

function rebuildTracker() {
  tracker = createTracker(makeExpToNext(lib().expRows));
}
async function loadAll() {
  if (cfg.autoSync) {
    const r = await syncAuto({ sitemapUrl: cfg.sitemapUrl, dominios: cfg.dominios, cacheDir: cacheDir(), manual: cfg.sources });
    data = r.data;
    syncInfo = { ultima: Date.now(), offline: r.offline };
  } else {
    data = await Promise.all(cfg.sources.map((u) => loadSource(u, { dominios: cfg.dominios, cacheDir: cacheDir() })));
    syncInfo = { ultima: Date.now(), offline: false };
  }
  rebuildTracker();
}
function emit() {
  const vm = buildViewModel({
    estado, lib: lib(), fontes: data.map((d) => d.source), feitas: new Set(cfg.questsFeitas), lim: cfg.limiares,
    ...flags, precisaWizard: !cfg.gamePath, opacidade: cfg.opacidade, expandido: cfg.janela.expandido,
    sync: { auto: cfg.autoSync, guias: data.filter((d) => d.source.auto).length, ...syncInfo },
  });
  if (!win.isDestroyed()) win.webContents.send('vm', vm);
}

async function captureGame(): Promise<Img | null> {
  const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1920, height: 1080 } });
  const s = srcs.find((x) => /maple/i.test(x.name) && !/overlay/i.test(x.name));
  if (!s) return null;
  const { width, height } = s.thumbnail.getSize();
  return width && height ? bgraToImg(s.thumbnail.toBitmap(), width, height) : null;
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const img = await captureGame();
    flags = { capturaPreta: false, jogoNaoEncontrado: !img };
    if (img) {
      if (isBlack(img)) flags.capturaPreta = true;
      else {
        const regions = cfg.regions[resKey(img)] ?? DEFAULT_REGIONS;
        const r = await reader.read(img, regions);
        estado = tracker.push({ ...r, t: Date.now() });
      }
    }
    emit();
  } catch (e) { console.error('tick', e); } finally { busy = false; }
}

function createWindow() {
  win = new BrowserWindow({
    title: 'MW Overlay', width: W_COMPACTO.w, height: W_COMPACTO.h, x: cfg.janela.x, y: cfg.janela.y,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setOpacity(cfg.opacidade);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('moved', () => { const [x, y] = win.getPosition(); cfg.janela.x = x; cfg.janela.y = y; store.save(cfg); });
  applySize(cfg.janela.expandido);
}
function applySize(expandido: boolean) {
  const s = expandido ? W_EXPANDIDO : W_COMPACTO;
  win.setSize(s.w, s.h);
  cfg.janela.expandido = expandido;
}

function registerIpc() {
  ipcMain.handle('cfg:get', () => cfg);
  ipcMain.handle('src:add', async (_e, url: string) => {
    if (typeof url !== 'string' || !isAllowedUrl(url, cfg.dominios)) return { ok: false, erro: 'Domínio não permitido (use links do meowdb/niadb).' };
    if (cfg.sources.includes(url)) return { ok: false, erro: 'Fonte já adicionada.' };
    cfg.sources.push(url); store.save(cfg);
    await loadAll(); emit();
    return { ok: true };
  });
  ipcMain.handle('src:remove', async (_e, url: string) => {
    cfg.sources = cfg.sources.filter((u) => u !== url); store.save(cfg);
    await loadAll(); emit();
  });
  ipcMain.handle('src:refresh', async () => { await loadAll(); emit(); });
  ipcMain.handle('sync:now', async () => { await loadAll(); emit(); });
  ipcMain.handle('sync:toggle', async (_e, on: boolean) => { cfg.autoSync = !!on; store.save(cfg); await loadAll(); emit(); });
  ipcMain.handle('quest:toggle', (_e, id: string) => {
    const s = new Set(cfg.questsFeitas);
    s.has(id) ? s.delete(id) : s.add(id);
    cfg.questsFeitas = [...s]; store.save(cfg); emit();
  });
  ipcMain.handle('win:expand', (_e, b: boolean) => { applySize(!!b); store.save(cfg); });
  ipcMain.handle('win:opacity', (_e, n: number) => {
    cfg.opacidade = Math.min(1, Math.max(0.3, Number(n) || 1)); win.setOpacity(cfg.opacidade); store.save(cfg);
  });
  ipcMain.handle('wiz:folder', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: 'C:\\Nexon\\Library\\maplestorycw' });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('wiz:shot', async () => {
    const live = await captureGame();
    if (live && !isBlack(live)) return { dataUrl: 'data:image/png;base64,' + toPngBuffer(live).toString('base64'), w: live.w, h: live.h };
    const dir = path.join(cfg.gamePath, 'appdata');
    const f = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^Maple_A_.*\.jpg$/.test(n)).sort().at(-1) : undefined;
    if (!f) return null;
    const buf = fs.readFileSync(path.join(dir, f));
    const im = decodeJpeg(buf);
    return { dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64'), w: im.w, h: im.h };
  });
  ipcMain.handle('wiz:save', (_e, key: string, regions: Regions, gamePath: string) => {
    cfg.regions[key] = regions; cfg.gamePath = gamePath; store.save(cfg); emit();
  });
}

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'));
  cfg = store.load();
  reader = await HudReader.create(path.join(app.getPath('userData'), 'tessdata'));
  registerIpc();
  createWindow();
  await loadAll();
  globalShortcut.register('Ctrl+Alt+M', () => (win.isVisible() ? win.hide() : win.show()));
  let through = false;
  globalShortcut.register('Ctrl+Alt+C', () => { through = !through; win.setIgnoreMouseEvents(through, { forward: true }); });
  setInterval(tick, TICK_MS);
  setInterval(() => { if (cfg.autoSync) void loadAll().then(emit); }, SYNC_INTERVALO_MS);
  tick();
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); void reader?.close(); });
app.on('window-all-closed', () => app.quit());
```

Nota: o flag `upou` do `Estado` vale só para um `push` do tracker; o renderer guarda o cartão de level up por 15 s.

- [ ] **Step 5: Verificar build e typecheck**

Run: `npx tsc --noEmit` → sem erros. Run: `node build.mjs` → gera `dist/main.js`, `preload.js` (renderer ainda falha até a Task 11; criar stubs vazios `src/renderer/renderer.ts`, `index.html`, `styles.css` se necessário para o build passar).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: shell electron com captura, OCR, IPC e hotkeys"
```

---

### Task 11: UI do widget (renderer)

**Files:**
- Create: `src/renderer/index.html`, `src/renderer/styles.css`, `src/renderer/renderer.ts`

**Interfaces:**
- Consumes: `window.api` (Task 10), `ViewModel`.
- Produces: `startWizard(onDone: () => void): void` é consumido da Task 12 (`src/renderer/wizard.ts`); aqui apenas importar e chamar quando `vm.precisaWizard`.

- [ ] **Step 1: `src/renderer/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src https: data:; style-src 'self'; script-src 'self'" />
  <title>MW Overlay</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body><div id="app"></div><script src="renderer.js"></script></body>
</html>
```

- [ ] **Step 2: `src/renderer/styles.css`**

```css
:root { --bg: rgba(20, 22, 30, .94); --fg: #e8e8f0; --mut: #9aa0b4; --line: #2c3040;
  --verde: #3ecf6e; --amarelo: #f1c40f; --vermelho: #ef5350; --cinza: #6b7185; --acc: #ffb347; }
* { box-sizing: border-box; }
body { margin: 0; font: 13px/1.35 "Segoe UI", sans-serif; color: var(--fg); background: transparent; user-select: none; }
#app { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.drag { -webkit-app-region: drag; } .nodrag { -webkit-app-region: no-drag; }
.head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
.head .lv { font-weight: 700; color: var(--acc); white-space: nowrap; }
.bar { flex: 1; height: 8px; background: #0e1017; border-radius: 4px; overflow: hidden; min-width: 60px; }
.bar > i { display: block; height: 100%; background: var(--acc); }
.rate { color: var(--mut); white-space: nowrap; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--cinza); flex: none; }
.dot.verde { background: var(--verde); } .dot.amarelo { background: var(--amarelo); } .dot.vermelho { background: var(--vermelho); }
button { background: #232738; color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; cursor: pointer; font: inherit; }
button:hover { background: #2e3350; }
.tabs { display: flex; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.tabs button { flex: 1; border: 0; border-radius: 0; background: transparent; padding: 6px 0; }
.tabs button.on { color: var(--acc); box-shadow: inset 0 -2px var(--acc); }
.body { flex: 1; overflow: auto; padding: 8px 10px; user-select: text; }
.row { display: flex; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--line); }
.row img { width: 32px; height: 32px; object-fit: contain; image-rendering: pixelated; flex: none; }
.row .t { flex: 1; min-width: 0; } .row .t b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .m { color: var(--mut); font-size: 12px; }
.warn { background: #3a2f10; color: #ffd98a; padding: 6px 8px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
.card { margin: 8px 10px 0; padding: 8px 10px; background: #1f3a2a; border: 1px solid var(--verde); border-radius: 8px; animation: pulse 1s ease-in-out 3; }
@keyframes pulse { 50% { box-shadow: 0 0 12px var(--verde); } }
.card h4 { margin: 0 0 4px; } .card p { margin: 4px 0; white-space: pre-wrap; max-height: 110px; overflow: auto; }
input[type=text] { width: 100%; background: #0e1017; color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; font: inherit; }
.foot { padding: 6px 10px; border-top: 1px solid var(--line); color: var(--mut); display: flex; gap: 8px; align-items: center; }
.empty { color: var(--mut); padding: 12px 0; text-align: center; }
```

- [ ] **Step 3: `src/renderer/renderer.ts`**

```ts
import type { GrindMap, Quest, Tip, ViewModel } from '../types';
import { startWizard } from './wizard';

type Kid = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> | null, ...kids: Kid[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids) if (c) el.append(c as Node | string); // strings viram nós de texto: nunca HTML
  return el;
}
const icon = (url?: string) => {
  const i = h('img', { referrerpolicy: 'no-referrer', alt: '' });
  if (url) i.src = url; else i.style.visibility = 'hidden';
  i.addEventListener('error', () => (i.style.visibility = 'hidden'));
  return i;
};
const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.round(n)));

let vm: ViewModel | null = null;
let tab: 'agora' | 'quests' | 'mapas' | 'fontes' = 'agora';
let cardUntil = 0;
let wizard = false;
const app = document.getElementById('app')!;

window.api.onVM((v) => {
  vm = v;
  if (v.levelUp) { cardUntil = Date.now() + 15000; if (!v.expandido) { v.expandido = true; void window.api.setExpanded(true); } }
  if (v.precisaWizard && !wizard) { wizard = true; startWizard(() => { wizard = false; }); return; }
  if (!wizard) render();
});

function render() {
  if (!vm || document.activeElement instanceof HTMLInputElement) return; // não atrapalha digitação
  const e = vm.estado;
  const head = h('div', { class: 'head drag' },
    h('span', { class: 'lv' }, e ? `Lv ${e.level}${e.classe ? ' ' + e.classe : ''}` : 'Aguardando jogo…'),
    h('div', { class: 'bar' }, (() => { const i = h('i', null); i.style.width = `${Math.min(100, e?.expPct ?? 0)}%`; return i; })()),
    h('span', { class: 'rate' }, e ? `${(e.expPct).toFixed(2)}% · ${fmt(e.expPorHora)}/h` : ''),
    h('span', { class: `dot ${vm.veredito.cor}`, title: vm.veredito.pct === null ? 'sem dados' : `${Math.round(vm.veredito.pct * 100)}% do ideal` }),
    h('button', { class: 'nodrag', onclick: () => { vm!.expandido = !vm!.expandido; void window.api.setExpanded(vm!.expandido); render(); } }, vm.expandido ? '▴' : '▾'),
  );
  const kids: Node[] = [head];
  if (vm.expandido) {
    if (Date.now() < cardUntil && vm.levelUp) kids.push(levelCard(vm));
    kids.push(h('div', { class: 'tabs nodrag' }, ...(['agora', 'quests', 'mapas', 'fontes'] as const).map((t) =>
      h('button', { class: t === tab ? 'on' : '', onclick: () => { tab = t; render(); } }, t[0].toUpperCase() + t.slice(1)))));
    kids.push(h('div', { class: 'body nodrag' }, ...vm.avisos.map((a) => h('div', { class: 'warn' }, a)), ...tabBody(vm)));
    kids.push(footer(vm));
  }
  app.replaceChildren(...kids);
}

function levelCard(v: ViewModel) {
  const u = v.levelUp!;
  const dica = u.dicas[0];
  return h('div', { class: 'card nodrag', onclick: () => { cardUntil = 0; render(); } },
    h('h4', null, `Level up! Lv ${u.de} → ${u.para}`),
    dica ? h('p', null, dica.text) : h('p', null, 'Sem dica de AP/SP nas fontes configuradas.'),
    dica ? h('div', { class: 'm' }, `Fonte: ${dica.title}`) : null,
    u.novidades.maps.length || u.novidades.quests.length
      ? h('div', { class: 'm' }, `Novo neste level: ${u.novidades.maps.length} mapa(s), ${u.novidades.quests.length} quest(s)`) : null);
}

function mapRow(m: GrindMap) {
  return h('div', { class: 'row' }, icon(m.mob.iconUrl),
    h('div', { class: 't' }, h('b', null, m.name), h('span', { class: 'm' }, `${m.mob.name} · ${fmt(m.maxExpHr)}/h`)));
}
function questRow(q: Quest) {
  return h('div', { class: 'row' }, icon(q.iconUrl),
    h('div', { class: 't' }, h('b', null, q.name), h('span', { class: 'm' }, `${q.npc} · Lv ${q.level} · ${q.exp} EXP${q.reward ? ' · ' + q.reward : ''}`)),
    h('button', { onclick: () => void window.api.toggleQuest(q.id) }, '✓'));
}
const empty = (t: string) => h('div', { class: 'empty' }, t);

function tabBody(v: ViewModel): Node[] {
  if (tab === 'agora') {
    const best = v.mapas[0];
    return [
      h('div', { class: 'row' }, h('div', { class: 't' },
        h('b', null, v.estado?.mapa ?? 'Mapa desconhecido'),
        h('span', { class: 'm' }, best && v.veredito.pct !== null
          ? `${Math.round(v.veredito.pct * 100)}% do ideal (${fmt(best.maxExpHr)}/h em ${best.name})`
          : 'Sem comparação disponível'))),
      h('b', null, 'Melhores mapas para seu level'),
      ...(v.mapas.length ? v.mapas.map(mapRow) : [empty('Nenhum mapa para este level nas fontes.')]),
    ];
  }
  if (tab === 'quests') return v.quests.length ? v.quests.map(questRow) : [empty('Nenhuma quest para este level nas fontes.')];
  if (tab === 'mapas') return v.mapas.length ? v.mapas.map((m) => h('div', null, mapRow(m), h('div', { class: 'm' }, m.why))) : [empty('Nenhum mapa para este level nas fontes.')];
  return fontesTab(v);
}

function fontesTab(v: ViewModel): Node[] {
  const input = h('input', { type: 'text', placeholder: 'Link extra (opcional) e Enter' });
  const auto = h('div', { class: 'row' },
    h('div', { class: 't' }, h('b', null, 'Sincronização automática (meowdb)'),
      h('span', { class: 'm' }, v.sync.auto
        ? `${v.sync.guias} guias · ${v.sync.ultima ? 'sincronizado às ' + new Date(v.sync.ultima).toLocaleTimeString('pt-BR') : 'aguardando'}${v.sync.offline ? ' · offline (cache)' : ''}`
        : 'desligada')),
    h('button', { onclick: () => void window.api.setAutoSync(!v.sync.auto) }, v.sync.auto ? 'Desligar' : 'Ligar'),
    h('button', { title: 'Sincronizar agora', onclick: () => void window.api.syncNow() }, '⟳'));
  const msg = h('div', { class: 'm' });
  input.addEventListener('keydown', async (ev) => {
    if ((ev as KeyboardEvent).key !== 'Enter' || !input.value.trim()) return;
    const r = await window.api.addSource(input.value.trim());
    msg.textContent = r.ok ? 'Adicionada.' : (r.erro ?? 'Erro.');
    if (r.ok) input.value = '';
    input.blur(); render();
  });
  return [
    auto, input, msg,
    ...v.fontes.filter((f) => !f.auto).map((f) => h('div', { class: 'row' }, h('div', { class: 't' }, h('b', null, f.title),
      h('span', { class: 'm' }, `${f.status} · ${f.counts.maps} mapas, ${f.counts.quests} quests, ${f.counts.tips} dicas`)),
      h('button', { onclick: () => void window.api.removeSource(f.url) }, '✕'))),
    v.fontes.some((f) => !f.auto) ? h('button', { onclick: () => void window.api.refreshSources() }, 'Atualizar links extras') : null,
    h('button', { onclick: () => { wizard = true; startWizard(() => { wizard = false; render(); }); } }, 'Recalibrar HUD'),
  ];
}

function footer(v: ViewModel) {
  const r = h('input', { type: 'range', min: '0.3', max: '1', step: '0.05', value: String(v.opacidade), class: 'nodrag' });
  r.addEventListener('input', () => void window.api.setOpacity(Number(r.value)));
  return h('div', { class: 'foot nodrag' }, 'Opacidade', r, h('span', null, 'Ctrl+Alt+M ocultar · Ctrl+Alt+C click-through'));
}
```

Nota: o `onVM` chama `render()` a cada 2 s; o guard `activeElement instanceof HTMLInputElement` impede reset durante digitação (incluindo o slider; aceitável).

- [ ] **Step 4: Stub temporário do wizard para compilar**

Criar `src/renderer/wizard.ts` com `export function startWizard(onDone: () => void) { onDone(); }` (substituído na Task 12).

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && node build.mjs` → sem erros.  
Run: `npm start` → janela flutuante aparece (compacta). Sem o jogo aberto mostra "Aguardando jogo…" e o aviso "Janela do jogo não encontrada" ao expandir. Testar: expandir/recolher, arrastar, aba Fontes: com internet, a linha "Sincronização automática" deve mostrar ~34 guias e a hora da sincronização; o botão ⟳ sincroniza de novo (sem rebaixar nada se nada mudou); "Desligar" zera os guias automáticos. Colar um link extra válido (ex.: um guia do meowdb) entra na lista de extras; `https://evil.com/x` deve ser recusado. Testar as hotkeys `Ctrl+Alt+M` e `Ctrl+Alt+C`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: ui do widget (compacto/expandido, abas, cartão de level up, fontes)"
```

---

### Task 12: Assistente de primeira execução (calibração)

**Files:**
- Modify: `src/renderer/wizard.ts` (substituir stub)
- Modify: `src/renderer/styles.css` (acrescentar estilos do wizard)

**Interfaces:**
- Consumes: `window.api.pickGameFolder/getShot/saveCalibration/addSource/getConfig`, `DEFAULT_REGIONS` de `../capture/hud` **não** (o renderer não pode importar tesseract; usar valores iniciais copiados via `getConfig`/hard-coded abaixo).
- Produces: `startWizard(onDone: () => void): void`.

- [ ] **Step 1: Implementar `src/renderer/wizard.ts`**

```ts
import type { Region, Regions } from '../types';

const ORDEM: { key: keyof Regions; nome: string }[] = [
  { key: 'level', nome: 'o número do LEVEL (ao lado de "LV.")' },
  { key: 'cls', nome: 'o nome da CLASSE (ex.: Archer) e o nick' },
  { key: 'exp', nome: 'o texto da EXP (ex.: EXP 1 [0.02%])' },
  { key: 'map', nome: 'o nome do MAPA no minimapa (região + mapa)' },
];

const el = <K extends keyof HTMLElementTagNameMap>(t: K, c?: string, txt?: string) => {
  const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e;
};

export function startWizard(onDone: () => void) {
  const app = document.getElementById('app')!;
  let gamePath = '';
  void window.api.setExpanded(true);

  const passo1 = async () => {
    const cfg = await window.api.getConfig();
    gamePath = cfg.gamePath || 'C:\\Nexon\\Library\\maplestorycw';
    const box = el('div', 'body nodrag');
    const msg = el('div', 'm');
    const btn = el('button', undefined, 'Escolher pasta do jogo');
    const pasta = el('div', 'm', gamePath);
    btn.onclick = async () => { const p = await window.api.pickGameFolder(); if (p) { gamePath = p; pasta.textContent = p; } };
    const next = el('button', undefined, 'Próximo: calibrar HUD');
    next.onclick = () => passo2(msg);
    box.append(el('h4', undefined, 'Passo 1/3 · Pasta do jogo'), pasta, btn, next, msg);
    app.replaceChildren(el('div', 'head drag', 'Configuração inicial'), box);
  };

  const passo2 = async (msg: HTMLElement) => {
    const shot = await window.api.getShot();
    if (!shot) { msg.textContent = 'Abra o jogo (modo janela/borderless) ou tire um screenshot no jogo e tente de novo.'; return; }
    const wrap = el('div', 'body nodrag');
    const info = el('div', 'm');
    const cv = el('canvas');
    const ctx = cv.getContext('2d')!;
    const img = new Image();
    const regs: Partial<Regions> = {};
    let i = 0;
    let drag: { x: number; y: number } | null = null;
    let cur: Region | null = null;
    const W = 316; cv.style.width = W + 'px'; cv.style.border = '1px solid #2c3040'; cv.style.cursor = 'crosshair';
    const say = () => (info.textContent = `Passo 2/3 · Arraste um retângulo sobre ${ORDEM[i].nome}.`);
    const paint = () => {
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
      for (const r of [...Object.values(regs), cur]) if (r) ctx.strokeRect(r.x * cv.width, r.y * cv.height, r.w * cv.width, r.h * cv.height);
    };
    const pos = (e: MouseEvent) => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
    cv.onmousedown = (e) => { drag = pos(e); };
    cv.onmousemove = (e) => {
      if (!drag) return; const p = pos(e);
      cur = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) }; paint();
    };
    cv.onmouseup = () => {
      drag = null;
      if (!cur || cur.w < 0.003 || cur.h < 0.003) { cur = null; return; }
      regs[ORDEM[i].key] = cur; cur = null; i++; paint();
      if (i < ORDEM.length) say();
      else passo3(`${shot.w}x${shot.h}`, regs as Regions);
    };
    img.onload = () => { cv.width = shot.w; cv.height = shot.h; paint(); say(); };
    img.src = shot.dataUrl;
    wrap.append(info, cv);
    app.replaceChildren(el('div', 'head drag', 'Configuração inicial'), wrap);
  };

  const passo3 = async (key: string, regs: Regions) => {
    await window.api.saveCalibration(key, regs, gamePath);
    const box = el('div', 'body nodrag');
    const msg = el('div', 'm');
    box.append(el('h4', undefined, 'Passo 3/3 · Guias'),
      el('div', 'm', 'Todos os guias do MapleStory Classic no meowdb entram automaticamente e se mantêm atualizados. Links extras podem ser colados depois, na aba Fontes.'));
    const sync = el('button', undefined, 'Sincronizar agora');
    sync.onclick = async () => { msg.textContent = 'Sincronizando…'; await window.api.syncNow(); msg.textContent = 'Guias sincronizados.'; };
    box.append(sync);
    const fim = el('button', undefined, 'Concluir');
    fim.onclick = () => { void window.api.setExpanded(false); onDone(); };
    box.append(msg, fim);
    app.replaceChildren(el('div', 'head drag', 'Configuração inicial'), box);
  };

  void passo1();
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm start`  
Com o jogo em janela/borderless (ou sem jogo, usando o screenshot mais recente da pasta): o assistente abre na primeira execução; arrastar os 4 retângulos; o passo 3 mostra "Sincronizar agora" (baixa os guias automáticos); ao concluir, o widget volta ao compacto e passa a ler a HUD. Reabrir o app: o assistente **não** reaparece (config salva). Aba Fontes → "Recalibrar HUD" reabre o assistente.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: assistente de primeira execução com calibração da HUD"
```

---

### Task 13: Empacotar e validar nos modos de janela

**Files:**
- Modify: `package.json` (já tem script `dist` e `build`)

- [ ] **Step 1: Suíte completa**

Run: `npx tsc --noEmit && npx vitest run` → tudo PASS.

- [ ] **Step 2: Empacotar**

Run: `npm run dist` → gera `release/*.exe` (portable). Abrir o `.exe` gerado e conferir que o assistente e o OCR funcionam (o OCR baixa `eng.traineddata` na primeira execução; exige internet nesse momento).

- [ ] **Step 3: Checklist manual com o jogo aberto (anotar resultado de cada item)**

1. **Modo janela:** widget sobre o jogo, lê Lv/EXP/mapa em até 4 s; EXP/h aumenta ao matar mobs.
2. **Modo borderless:** idem; widget continua visível por cima.
3. **Tela cheia:** se visível e lendo → ok. Se sumir ou aparecer o aviso de captura preta → registrar e orientar (2º monitor / borderless).
4. **Level up:** subir um level → cartão "Lv N → N+1" aparece com dica de AP/SP (com fontes adicionadas) e fecha em 15 s ou ao clicar.
5. **Veredito:** com a fonte de grind, ponto verde/amarelo/vermelho coerente com `EXP/h ÷ Max EXP/hr` do melhor mapa.
6. **Fonte offline:** desligar a internet, reabrir: aba Fontes mostra "erro" mas dados vêm do cache.
7. **Hotkeys e persistência:** `Ctrl+Alt+M`, `Ctrl+Alt+C`; posição e opacidade persistem após reiniciar.
8. **Resoluções:** se a janela do jogo mudar de tamanho, o aviso/calibração por resolução funciona (recalibrar cria nova chave `WxH`).
9. **Sincronização automática:** com internet, a aba Fontes mostra todos os guias do sitemap (hoje 34); reabrir o app não rebaixa guias inalterados (só o sitemap); se o site publicar um guia novo ou mudar um `lastmod`, ele entra/atualiza na próxima sincronização (⟳ força na hora); offline, aparece o aviso de cache e os dados continuam.
10. **Dicas por classe:** com a classe lida como "Archer", o cartão de level up mostra dicas de AP/SP de guias Bowman/genéricos e **não** de guias de Warrior/Thief/Magician.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: empacotamento portable e checklist de validação"
```

---

## Self-Review (feito contra a spec)

- **Cobertura:** capture/OCR (T2–T3), tracker (T4), advisor com dicas por classe (T5), parser (T6), allowlist/cache/config (T7), descoberta e sincronização automática de guias por sitemap/lastmod (T8), viewmodel e avisos (T9), janela/captura/IPC/hotkeys/click-through/opacidade/posição/timer de sync (T10), UI compacto/expandido/abas/level up/fontes+sync (T11), assistente 3 passos (T12), empacotamento e validação dos modos e da sync (T13). Erros: cache offline (T7/T8), OCR implausível (T4), captura preta (T9/T10), sem fontes (T9/T11).
- **Desvios declarados** em *Global Constraints*: ícones sem cache próprio em disco; level up por subida do level lido.
- **Consistência de tipos:** `Reading`, `Estado`, `ViewModel`, `Library`, `SourceData` definidos na T1 e usados com os mesmos nomes nas demais. `HudReader.read` retorna `Omit<Reading,'t'>` e o main acrescenta `t`.
- **Riscos abertos (de propósito):** calibração fina das regiões e do predicado de cor do level (T3, passos 5–9); nome da janela do jogo para `desktopCapturer` (regex `/maple/i`, ajustar se o título real for diferente); comportamento em tela cheia exclusiva (T13).
