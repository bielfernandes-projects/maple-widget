import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, shell } from 'electron';
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
import { validGamePathShape, validOpenUrl, validRegions, validResKey } from './validate';
import type { Estado, Img, Library, SourceData } from '../types';

const TICK_MS = 2000;
const W_COMPACTO = { w: 340, h: 64 }, W_EXPANDIDO = { w: 340, h: 460 };

let win: BrowserWindow;
let store: Store;
let cfg: ReturnType<Store['load']>;
let reader: HudReader | undefined;
let ocrErro = '';
const OCR_MSG = 'Leitura da tela indisponível (falha ao preparar o OCR — verifique a conexão). Tentando de novo…';
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
async function doLoad() {
  if (cfg.autoSync) {
    const r = await syncAuto({ sitemapUrl: cfg.sitemapUrl, dominios: cfg.dominios, cacheDir: cacheDir(), manual: cfg.sources, fixas: cfg.fontesFixas });
    data = r.data;
    syncInfo = { ultima: Date.now(), offline: r.offline };
  } else {
    data = await Promise.all(cfg.sources.map((u) => loadSource(u, { dominios: cfg.dominios, cacheDir: cacheDir() })));
    syncInfo = { ultima: Date.now(), offline: false };
  }
  rebuildTracker();
}
// cargas em fila (nunca duas ao mesmo tempo); `loading` é a última da fila
let loading: Promise<void> | null = null;
function loadAll(): Promise<void> {
  const p = (loading ?? Promise.resolve()).catch(() => {}).then(doLoad);
  loading = p;
  const clear = () => { if (loading === p) loading = null; };
  p.then(clear, clear);
  return p;
}
function emit() {
  if (!win || win.isDestroyed()) return;
  const vm = buildViewModel({
    estado, lib: lib(), fontes: data.map((d) => d.source), feitas: new Set(cfg.questsFeitas), lim: cfg.limiares,
    avisosExtras: ocrErro ? [ocrErro] : [],
    ...flags, precisaWizard: !cfg.gamePath, opacidade: cfg.opacidade, expandido: cfg.janela.expandido,
    sync: { auto: cfg.autoSync, guias: data.filter((d) => d.source.auto).length, ...syncInfo },
  });
  win.webContents.send('vm', vm);
}

async function captureGame(): Promise<Img | null> {
  const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1920, height: 1080 } });
  const s = srcs.find((x) => /maplestory/i.test(x.name) && !/overlay/i.test(x.name));
  if (!s) return null;
  const { width, height } = s.thumbnail.getSize();
  return width && height ? bgraToImg(s.thumbnail.toBitmap(), width, height) : null;
}

// sequencial: HudReader.read não é seguro em paralelo
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const img = await captureGame();
    flags = { capturaPreta: false, jogoNaoEncontrado: !img };
    if (img) {
      if (isBlack(img)) flags.capturaPreta = true;
      else if (reader) {
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false },
  });
  const wc = win.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.on('will-frame-navigate', (e) => e.preventDefault());
  wc.on('will-attach-webview', (e) => e.preventDefault());
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setOpacity(cfg.opacidade);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('moved', () => { const [x, y] = win.getPosition(); cfg.janela.x = x; cfg.janela.y = y; scheduleSave(); });
  applySize(cfg.janela.expandido);
}
function applySize(expandido: boolean) {
  const s = expandido ? W_EXPANDIDO : W_COMPACTO;
  win.setSize(s.w, s.h);
  cfg.janela.expandido = expandido;
}

// salvamento com debounce (500 ms) para eventos frequentes (mover janela, opacidade)
let saveTimer: NodeJS.Timeout | undefined;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = undefined; store.save(cfg); }, 500);
}
function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; store.save(cfg); }
}
const isDir = (p: string) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// o renderer não é confiável: todo handler captura erros e valida argumentos
function handle<R>(ch: string, fallback: R, fn: (...a: unknown[]) => R | Promise<R>) {
  ipcMain.handle(ch, async (_e, ...a) => {
    try { return await fn(...a); } catch (e) { console.error(ch, e); return fallback; }
  });
}
function registerIpc() {
  handle('cfg:get', null as unknown, () => cfg);
  handle<{ ok: boolean; erro?: string }>('src:add', { ok: false, erro: 'Erro ao adicionar a fonte.' }, async (url) => {
    if (typeof url !== 'string' || !isAllowedUrl(url, cfg.dominios)) return { ok: false, erro: 'Domínio não permitido (use links do meowdb/niadb).' };
    if (cfg.sources.includes(url)) return { ok: false, erro: 'Fonte já adicionada.' };
    cfg.sources.push(url); store.save(cfg);
    await loadAll(); emit();
    return { ok: true };
  });
  handle<void>('open:source', undefined, async (url) => {
    if (!validOpenUrl(url, cfg.dominios)) return;
    await shell.openExternal(url);
  });
  handle<void>('src:remove', undefined, async (url) => {
    if (typeof url !== 'string') return;
    cfg.sources = cfg.sources.filter((u) => u !== url); store.save(cfg);
    await loadAll(); emit();
  });
  handle<void>('src:refresh', undefined, async () => { await loadAll(); emit(); });
  handle<void>('sync:now', undefined, async () => { await loadAll(); emit(); });
  handle<void>('sync:toggle', undefined, async (on) => { cfg.autoSync = !!on; store.save(cfg); await loadAll(); emit(); });
  handle<void>('quest:toggle', undefined, (id) => {
    if (typeof id !== 'string') return;
    const s = new Set(cfg.questsFeitas);
    s.has(id) ? s.delete(id) : s.add(id);
    cfg.questsFeitas = [...s]; store.save(cfg); emit();
  });
  handle<void>('win:expand', undefined, (b) => { applySize(!!b); store.save(cfg); });
  handle<void>('win:opacity', undefined, (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return;
    cfg.opacidade = Math.min(1, Math.max(0.3, n)); win.setOpacity(cfg.opacidade); scheduleSave();
  });
  handle<string | null>('wiz:folder', null, async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: 'C:\\Nexon\\Library\\maplestorycw' });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  });
  handle<{ dataUrl: string; w: number; h: number } | null>('wiz:shot', null, async () => {
    const live = await captureGame();
    if (live && !isBlack(live)) return { dataUrl: 'data:image/png;base64,' + toPngBuffer(live).toString('base64'), w: live.w, h: live.h };
    if (!cfg.gamePath) return null;
    const dir = path.join(cfg.gamePath, 'appdata');
    const f = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^Maple_A_.*\.jpg$/.test(n)).sort().at(-1) : undefined;
    if (!f) return null;
    const buf = fs.readFileSync(path.join(dir, f));
    const im = decodeJpeg(buf);
    return { dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64'), w: im.w, h: im.h };
  });
  handle<void>('wiz:save', undefined, (key, regions, gamePath) => {
    if (typeof key !== 'string' || !validResKey(key) || !validRegions(regions) || !validGamePathShape(gamePath) || !(gamePath === '' || isDir(gamePath))) return;
    cfg.regions[key] = regions; cfg.gamePath = gamePath; store.save(cfg); emit();
  });
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

let retryTimer: NodeJS.Timeout | undefined;
async function initReader() {
  try {
    // MW_FORCE_OCR_FAIL=1: só para o smoke test da falha de OCR
    if (process.env.MW_FORCE_OCR_FAIL) throw new Error('MW_FORCE_OCR_FAIL');
    reader = await HudReader.create(path.join(app.getPath('userData'), 'tessdata'));
    ocrErro = '';
    clearInterval(retryTimer); retryTimer = undefined;
    emit();
  } catch (e) {
    console.error('OCR indisponível, nova tentativa em 30 s', e);
    ocrErro = OCR_MSG;
    emit();
    retryTimer ??= setInterval(() => { void initReader(); }, 30_000);
  }
}

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'));
  cfg = store.load();
  registerIpc();
  createWindow();
  void loadAll().then(emit).catch((e) => console.error('loadAll', e));
  const reg = (k: string, f: () => void) => { if (!globalShortcut.register(k, f)) console.warn('atalho não registrado:', k); };
  reg('Ctrl+Alt+M', () => (win.isVisible() ? win.hide() : win.show()));
  let through = false;
  reg('Ctrl+Alt+C', () => { through = !through; win.setIgnoreMouseEvents(through, { forward: true }); });
  setInterval(tick, TICK_MS);
  // não empilha sincronização: pula se já há carga em andamento
  setInterval(() => { if (cfg.autoSync && !loading) loadAll().then(emit).catch((e) => console.error('sync', e)); }, SYNC_INTERVALO_MS);
  await initReader();
  void tick();
}).catch((e) => { console.error('startup', e); app.quit(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); flushSave(); void reader?.close(); });
app.on('window-all-closed', () => app.quit());
