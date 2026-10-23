import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, session, shell, type WebContents } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HudReader, DEFAULT_REGIONS } from '../capture/hud';
import { LeitorComCache } from '../capture/cached-reader';
import { bgraToImg, decodeJpeg, isBlack, montarImg, toPngBuffer } from '../capture/image';
import { escalasCandidatas, resizeImg } from '../capture/scale';
import { escolherJanela } from '../capture/window';
import { createTracker } from '../tracker';
import { makeExpToNext } from '../advisor';
import { isAllowedUrl } from '../sources/allowlist';
import { loadSource } from '../sources/load';
import { syncAuto } from '../sources/sync';
import { Store } from '../store';
import { buildViewModel } from '../viewmodel';
import { validEscala, validFolderPath, validFrame, validJanelaJogo, validOpenUrl, validRecortes, validRegions, validResKey } from './validate';
import type { Estado, Img, Library, SourceData } from '../types';

const MAX_JPG = 20 * 1024 * 1024;
const OVERLAY = 'MW Overlay';
const CAPTURADOR = 'MW Capturador';
const TICK_MS = 2000;
const W_COMPACTO = { w: 340, h: 64 }, W_EXPANDIDO = { w: 340, h: 460 };

let win: BrowserWindow;
let store: Store;
let cfg: ReturnType<Store['load']>;
let reader: HudReader | undefined;
let leitor: LeitorComCache | undefined; // tick: OCR pesado só quando o recorte muda
let ocrErro = '';
const OCR_MSG = 'Leitura da tela indisponível (falha ao preparar o OCR — verifique a conexão). Tentando de novo…';
let data: SourceData[] = [];
let tracker = createTracker(() => undefined);
let estado: Estado | null = null;
let flags = { capturaPreta: false, jogoNaoEncontrado: false };
let syncInfo = { ultima: 0, offline: false };
let busy = false;
const SYNC_INTERVALO_MS = 30 * 60_000;
const QUADRO_VELHO_MS = 5000, REINICIO_MS = 3000;
// sem janela do jogo: recuo do reinício da captura (cada tentativa custa um getSources de ~0,45 s)
const RECUOS_MS = [3000, 6000, 12000, 30000];
const NATIVA_MSG = 'Captura nativa indisponível; usando captura por miniatura (a leitura pode falhar em resoluções diferentes de 1920×1080).';
// MW_SELFTEST=1: autoteste e sai; =hold: igual, mas não sai (sonda de desempenho). Só fora do pacote.
const SELFTEST = (process.env.MW_SELFTEST === '1' || process.env.MW_SELFTEST === 'hold') && !app.isPackaged;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// captura nativa (janela oculta + getDisplayMedia): só o último quadro importa, nunca uma fila
let cap: BrowserWindow | undefined;
// ultimoFrame: quadro montado só com os recortes da HUD (resto zerado); preta = todos os recortes pretos
let ultimoFrame: { img: Img; t: number; preta: boolean } | null = null;
// quadro inteiro pedido sob demanda (assistente/autoescala); consumido e solto logo depois
let ultimoCompleto: { img: Img; t: number } | null = null;
// regiões enviadas à capturadora (JSON) e sua versão: recortes de outra versão são descartados
let regioesEnviadas = '', versaoRegioes = 0, recuo = 0;
let alvo = ''; // janela procurada: cfg.janelaJogo ou a escolha ainda não salva do assistente
let semJanela = false; // a última tentativa foi negada por falta de janela (não é falha da captura)
let nativaFalhou = false;
let reinicioTimer: NodeJS.Timeout | undefined;
let logouQuadro = false;

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
    avisosExtras: [ocrErro, nativaFalhou ? NATIVA_MSG : ''].filter(Boolean),
    ...flags, precisaWizard: !cfg.gamePath && !cfg.assistentePulado, opacidade: cfg.opacidade, expandido: cfg.janela.expandido,
    sync: { auto: cfg.autoSync, guias: data.filter((d) => d.source.auto).length, ...syncInfo },
  });
  win.webContents.send('vm', vm);
}

// fallback: miniatura do desktopCapturer (reescalada para 1920 de largura)
async function capturarMiniatura(janela = alvo): Promise<Img | null> {
  const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1920, height: 1080 } });
  const s = escolherFonte(srcs, janela);
  if (!s) return null;
  const { width, height } = s.thumbnail.getSize();
  return width && height ? bgraToImg(s.thumbnail.toBitmap(), width, height) : null;
}
function escolherFonte<T extends { name: string }>(srcs: T[], janela: string): T | undefined {
  const nome = escolherJanela(srcs.map((x) => x.name).filter((n) => n !== OVERLAY && n !== CAPTURADOR), janela);
  return nome === undefined ? undefined : srcs.find((x) => x.name === nome);
}
const quadroNativo = () => (ultimoFrame && Date.now() - ultimoFrame.t <= QUADRO_VELHO_MS ? ultimoFrame : null);
async function captureGame(): Promise<{ img: Img; preta: boolean } | null> {
  if (!nativaFalhou) return quadroNativo();
  const img = await capturarMiniatura();
  return img && { img, preta: isBlack(img) };
}
const enviarCmd = (c: unknown) => { if (cap && !cap.isDestroyed()) cap.webContents.send('cap:cmd', c); };
// quadro inteiro da stream atual: pede um e espera até `ms` (null se não vier)
async function quadroCompleto(ms: number): Promise<Img | null> {
  const desde = Date.now();
  setTimeout(() => enviarCmd('quadroCompleto'), 0); // depois de um 'iniciar' já agendado (trocarAlvo), nunca antes
  for (let i = 0; i < ms / 250 && !(ultimoCompleto && ultimoCompleto.t >= desde); i++) await sleep(250);
  const q = ultimoCompleto && ultimoCompleto.t >= desde ? ultimoCompleto.img : null;
  ultimoCompleto = null;
  return q;
}
// assistente: quadro inteiro da janela `j` (troca o alvo e espera até 5 s por ele)
async function quadroDe(j: string): Promise<{ img: Img | null; nativa: boolean }> {
  if (nativaFalhou) return { img: await capturarMiniatura(j), nativa: false };
  trocarAlvo(j);
  if (reinicioTimer) reiniciarCaptura(0); // em recuo (sem janela): tenta já, sem esperar até 30 s
  return { img: await quadroCompleto(5000), nativa: true };
}
// regiões do quadro w×h (normalizadas; a escala é uniforme e aplicada no main depois de montar)
function conferirRegioes(w: number, h: number): boolean {
  const js = JSON.stringify(cfg.regions[`${w}x${h}`] ?? DEFAULT_REGIONS);
  if (js === regioesEnviadas) return true;
  regioesEnviadas = js; versaoRegioes++;
  const r = JSON.parse(js) as typeof DEFAULT_REGIONS;
  enviarCmd({ tipo: 'regioes', versao: versaoRegioes, regioes: [r.level, r.exp, r.cls, r.map] });
  return false;
}

function blindar(wc: WebContents) {
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.on('will-frame-navigate', (e) => e.preventDefault());
  wc.on('will-attach-webview', (e) => e.preventDefault());
}
function iniciarCaptura() { semJanela = false; enviarCmd('iniciar'); }
function reiniciarCaptura(ms = REINICIO_MS) {
  clearTimeout(reinicioTimer);
  reinicioTimer = setTimeout(() => { reinicioTimer = undefined; iniciarCaptura(); }, ms);
}
function trocarAlvo(j: string) { if (j !== alvo) { alvo = j; ultimoFrame = null; recuo = 0; reiniciarCaptura(0); } }

const CAP_FILE = () => path.join(__dirname, 'capturer.html');
const daCapturadora = (wc: WebContents) => !!cap && !cap.isDestroyed() && wc === cap.webContents;
let saindo = false, ultimaQueda = 0, quadros = 0;

function criarCapturadora() {
  const w = new BrowserWindow({
    show: false, title: CAPTURADOR,
    webPreferences: { preload: path.join(__dirname, 'capturer-preload.js'), additionalArguments: ['--mw-capturador'], contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, backgroundThrottling: false },
  });
  cap = w; regioesEnviadas = ''; // capturadora nova não tem regiões
  blindar(w.webContents);
  w.webContents.on('render-process-gone', (_e, d) => capturadoraCaiu(w, d.reason));
  w.on('unresponsive', () => capturadoraCaiu(w, 'unresponsive'));
  w.on('closed', () => capturadoraCaiu(w, 'closed'));
  w.loadFile(CAP_FILE()).then(iniciarCaptura).catch((e) => { console.error('[captura] capturadora', e); nativaFalhou = true; emit(); });
}
// recria a capturadora uma vez; se cair de novo em até 60 s, fica na miniatura
function capturadoraCaiu(w: BrowserWindow, motivo: string) {
  if (saindo || w !== cap) return; // eventos da janela antiga (ou do encerramento do app) são ignorados
  console.error('[captura] capturadora caiu:', motivo);
  cap = undefined;
  if (!w.isDestroyed()) w.destroy();
  const agora = Date.now();
  if (agora - ultimaQueda < 60_000) { nativaFalhou = true; emit(); return; }
  ultimaQueda = agora;
  criarCapturadora();
}

// registrado uma vez; vale para a capturadora atual (inclusive recriada)
function registrarCaptura() {
  const fileUrl = pathToFileURL(CAP_FILE()).href;
  // só a janela capturadora recebe stream; qualquer outro pedido (inclusive o overlay) é negado
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    let chamado = false;
    const responder = (s: Parameters<typeof callback>[0]) => { if (chamado) return; chamado = true; callback(s); };
    const f = request.frame, m = cap && !cap.isDestroyed() ? cap.webContents.mainFrame : null;
    if (!f || !m || f.processId !== m.processId || f.routingId !== m.routingId || f.url !== fileUrl) {
      console.warn('[captura] pedido de tela negado:', f?.url);
      responder(null); return; // null = negar (callback({}) lança no Electron 45)
    }
    desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } }).then(
      (srcs) => escolherFonte(srcs, alvo),
      (e) => { console.error('[captura] getSources', e); return undefined; },
    ).then((s) => {
      if (!s) { semJanela = true; flags.jogoNaoEncontrado = true; responder(null); return; }
      responder({ video: s });
    }).catch((e) => { console.error('[captura] handler', e); responder(null); });
  });
  ipcMain.on('cap:frame', (e, msg) => {
    if (!daCapturadora(e.sender)) return;
    if (validFrame(msg)) {
      ultimoCompleto = { img: { w: msg.w, h: msg.h, data: new Uint8ClampedArray(msg.buffer) }, t: Date.now() };
    } else if (validRecortes(msg)) {
      // recortes com regiões de outra chave/versão (corrida com uma troca de regiões) são descartados
      if (conferirRegioes(msg.w, msg.h) && msg.versao === versaoRegioes) {
        const rs = msg.recortes.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, data: new Uint8ClampedArray(r.buffer) }));
        ultimoFrame = { img: montarImg(msg.w, msg.h, rs), t: Date.now(), preta: rs.length > 0 && rs.every(isBlack) };
      }
    } else { console.warn('[captura] quadro inválido descartado'); return; }
    nativaFalhou = false; quadros++; recuo = 0;
    if (!logouQuadro) {
      logouQuadro = true; console.log(`[captura] quadro ${msg.w}x${msg.h}`);
      if (SELFTEST) void autoteste();
    }
  });
  ipcMain.on('cap:ended', (e, erro) => {
    if (!daCapturadora(e.sender)) return;
    if (typeof erro === 'string' && !semJanela) {
      if (!nativaFalhou) console.error('[captura] getDisplayMedia falhou:', erro.slice(0, 200));
      nativaFalhou = true;
    }
    reiniciarCaptura(semJanela ? RECUOS_MS[Math.min(recuo++, RECUOS_MS.length - 1)] : REINICIO_MS);
  });
}
// autoteste: dois `iniciar` sobrepostos devem deixar UMA stream ativa e quadros a cada ~2 s (sem duplicados);
// depois confere que chegam recortes e que o quadro completo sob demanda funciona
async function autoteste() {
  iniciarCaptura(); iniciarCaptura();
  quadros = 0;
  await sleep(7000);
  const ativas = cap && !cap.isDestroyed() ? await cap.webContents.executeJavaScript('window.__mwAtivas()') : -1;
  console.log(`[captura] autoteste: streams ativas ${ativas}, quadros em 7 s ${quadros}`);
  const q = quadroNativo(), c = await quadroCompleto(3000);
  console.log(`[captura] autoteste: recortes ${q ? "ok" : "nenhum"}, quadro completo ${c ? c.w + "x" + c.h : "nenhum"}`);
  if (process.env.MW_SELFTEST === 'hold') return;
  saindo = true; // app.exit não emite before-quit: sem isso o 'closed' recriaria a capturadora
  app.exit(0);
}

// sequencial: HudReader.read não é seguro em paralelo
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const q = await captureGame(), img = q?.img;
    flags = { capturaPreta: false, jogoNaoEncontrado: !img };
    if (q && img) {
      if (q.preta) flags.capturaPreta = true;
      else if (leitor) {
        // chave = quadro bruto; regiões normalizadas não mudam com escala uniforme.
        // ponytail: resizeImg percorre o quadro esparso inteiro (só quando há escala ≠ 1); reescalar só os recortes se pesar
        const key = resKey(img), esc = cfg.escalas[key];
        const r = await leitor.read(esc ? resizeImg(img, esc) : img, cfg.regions[key] ?? DEFAULT_REGIONS);
        estado = tracker.push({ ...r, t: Date.now() });
      }
    }
    emit();
  } catch (e) { console.error('tick', e); } finally { busy = false; }
}

function createWindow() {
  win = new BrowserWindow({
    title: OVERLAY, width: W_COMPACTO.w, height: W_COMPACTO.h, x: cfg.janela.x, y: cfg.janela.y,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), additionalArguments: ['--mw-overlay'], contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false },
  });
  blindar(win.webContents);
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
  handle<boolean>('wiz:check-folder', false, (p) => validFolderPath(p) && isDir(p));
  type Shot = { dataUrl: string; w: number; h: number; fuente: 'vivo' | 'arquivo'; nativa: boolean };
  handle<Shot | null>('wiz:shot', null, async (janela, pasta) => {
    // janela/pasta: escolhas do assistente ainda não gravadas (opcionais, validadas).
    // A janela vira o `alvo` temporário da captura; o assistente só termina por wiz:save/wiz:skip,
    // que voltam o alvo para cfg.janelaJogo (e um wiz:shot sem janela válida também volta).
    const j = validJanelaJogo(janela) ? janela : cfg.janelaJogo;
    const gp = validFolderPath(pasta) && isDir(pasta) ? pasta : (validFolderPath(cfg.gamePath) ? cfg.gamePath : '');
    const { img: live, nativa } = await quadroDe(j);
    if (live && !isBlack(live)) return { dataUrl: 'data:image/png;base64,' + toPngBuffer(live).toString('base64'), w: live.w, h: live.h, fuente: 'vivo', nativa };
    if (!gp) return null;
    const dir = path.join(gp, 'appdata');
    const nomes = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^Maple_A_.*\.jpg$/.test(n)).sort().reverse() : [];
    for (const n of nomes) {
      const f = path.join(dir, n);
      if (fs.statSync(f).size > MAX_JPG) continue; // arquivo suspeito de tão grande: tenta o próximo
      const buf = fs.readFileSync(f);
      const im = decodeJpeg(buf);
      return { dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64'), w: im.w, h: im.h, fuente: 'arquivo', nativa: false };
    }
    return null;
  });
  handle<string[]>('wiz:windows', [], async () => {
    const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } });
    return [...new Set(srcs.map((x) => x.name).filter((n) => n && n.length <= 200 && n !== OVERLAY && n !== CAPTURADOR))].slice(0, 30);
  });
  handle<void>('wiz:skip', undefined, () => { cfg.assistentePulado = true; store.save(cfg); trocarAlvo(cfg.janelaJogo); emit(); });
  type AE = { ok: boolean; escala?: number; pontos?: number; erro?: string };
  handle<AE>('capture:autoescala', { ok: false, erro: 'Erro ao detectar a escala.' }, async (): Promise<AE> => {
    if (!reader) return { ok: false, erro: 'Leitor da tela ainda não está pronto. Tente de novo em instantes.' };
    // ponytail: espera o tick por sondagem (50 ms); HudReader.read não é seguro em paralelo
    while (busy) await sleep(50);
    busy = true;
    try {
      const frame = quadroNativo() ? await quadroCompleto(3000) : null;
      if (!frame) return { ok: false, erro: 'Sem imagem ao vivo do jogo. Abra o jogo (janela/borderless) e tente de novo.' };
      if (isBlack(frame)) return { ok: false, erro: 'Quadro preto: o jogo parece estar em tela cheia exclusiva ou ainda carregando.' };
      const key = resKey(frame), regions = cfg.regions[key] ?? DEFAULT_REGIONS;
      let best = { escala: 1, pontos: -1 };
      for (const s of escalasCandidatas) {
        const r = await reader.read(resizeImg(frame, s), regions);
        const p = (r.level !== undefined ? 2 : 0) + (r.expAbs !== undefined ? 2 : 0) + (r.map !== undefined ? 1 : 0) + (r.cls !== undefined ? 1 : 0);
        if (p > best.pontos || (p === best.pontos && Math.abs(s - 1) < Math.abs(best.escala - 1))) best = { escala: s, pontos: p };
      }
      // nada lido em nenhuma escala: não sobrescreve um valor bom anterior
      if (best.pontos <= 0 || !validEscala(best.escala)) return { ok: false, erro: 'Não consegui ler a HUD em nenhuma escala. Confira a calibração das regiões e tente de novo com o jogo na tela do personagem.' };
      cfg.escalas[key] = best.escala; store.save(cfg);
      return { ok: true, ...best };
    } finally { busy = false; }
  });
  type R = { ok: boolean; erro?: string };
  handle<R>('wiz:save', { ok: false, erro: 'Erro ao salvar a configuração.' }, (key, regions, gamePath, janelaJogo): R => {
    if (janelaJogo !== undefined && !validJanelaJogo(janelaJogo)) return { ok: false, erro: 'Janela do jogo inválida.' };
    if (gamePath !== '' && !(validFolderPath(gamePath) && isDir(gamePath))) return { ok: false, erro: 'Pasta do jogo inválida ou não encontrada.' };
    if (regions !== null) {
      if (typeof key !== 'string' || !validResKey(key)) return { ok: false, erro: 'Resolução da captura inválida.' };
      if (!validRegions(regions)) return { ok: false, erro: 'Regiões da HUD inválidas.' };
      cfg.regions[key] = regions;
    }
    cfg.gamePath = gamePath as string;
    if (gamePath) cfg.assistentePulado = false;
    if (janelaJogo !== undefined) cfg.janelaJogo = janelaJogo;
    store.save(cfg); trocarAlvo(cfg.janelaJogo); emit();
    return { ok: true };
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
    leitor = new LeitorComCache(reader);
    ocrErro = '';
    console.log('[ocr] pronto');
    clearInterval(retryTimer); retryTimer = undefined;
    emit();
  } catch (e) {
    console.log('[ocr] falhou: ' + (e instanceof Error ? e.message : String(e)));
    console.error('OCR indisponível, nova tentativa em 30 s', e);
    ocrErro = OCR_MSG;
    emit();
    retryTimer ??= setInterval(() => { void initReader(); }, 30_000);
  }
}

app.whenReady().then(async () => {
  console.log('[app] ' + (app.isPackaged ? 'empacotado' : 'dev') + ' v' + app.getVersion());
  store = new Store(app.getPath('userData'));
  cfg = store.load();
  alvo = cfg.janelaJogo;
  registerIpc();
  createWindow();
  // a capturadora oculta não segura o app: fechar o overlay encerra
  win.on('closed', () => app.quit());
  // MW_SELFTEST=1 (só fora do pacote): verificação sem o jogo — captura uma janela de teste, loga e sai
  if (SELFTEST) {
    alvo = 'MW-SELFTEST';
    void new BrowserWindow({ width: 800, height: 600, title: alvo }).loadURL(`data:text/html,<title>${alvo}</title><body style="margin:0;height:100vh;background:linear-gradient(90deg,%23c33,%2336c)">`);
  }
  registrarCaptura();
  criarCapturadora();
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
app.on('before-quit', () => { saindo = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); flushSave(); void reader?.close(); });
app.on('window-all-closed', () => app.quit());
