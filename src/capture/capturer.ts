// Roda na janela capturadora oculta: stream da janela do jogo em pixels nativos → recortes RGBA da HUD para o main.
// A cada 2 s envia só os recortes das regiões (comando `regioes`); o quadro inteiro só sob demanda (`quadroCompleto`).
import { MARGEM_RECORTE, retanguloComMargem } from './scale';
import type { Region } from '../types';

type Comando = 'iniciar' | 'parar' | 'quadroCompleto' | { tipo: 'regioes'; versao: number; regioes: Region[] };
type CaptureApi = {
  frame(msg: object): void;
  ended(erro?: string): void;
  onComando(cb: (c: Comando) => void): void;
};
const api = (window as unknown as { captureApi: CaptureApi }).captureApi;
const FRAME_MS = 2000;
const v = document.getElementById('v') as HTMLVideoElement;
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d', { willReadFrequently: true })!;
let stream: MediaStream | null = null;
let timer: number | undefined;
// geração: cada iniciar/parar invalida o que estava em andamento (iniciar sobreposto não vaza stream/timer)
let gen = 0;
const vivos = new Set<MediaStream>();
let regioes: Region[] = [], versao = 0, pedirCompleto = false;
// um canvas pequeno por região (não realoca a cada quadro)
const telas: CanvasRenderingContext2D[] = [];
// diagnóstico (main lê por executeJavaScript no autoteste): streams com faixa ainda viva
(window as unknown as { __mwAtivas: () => number }).__mwAtivas = () =>
  [...vivos].filter((s) => s.getVideoTracks().some((t) => t.readyState === 'live')).length;

const pararStream = (s: MediaStream) => { s.getTracks().forEach((t) => { t.onended = null; t.stop(); }); vivos.delete(s); };

function parar() {
  gen++;
  clearInterval(timer); timer = undefined;
  if (stream) pararStream(stream);
  stream = null; v.srcObject = null;
}

function enviar() {
  const w = v.videoWidth, h = v.videoHeight;
  if (!w || !h) return;
  if (pedirCompleto) {
    pedirCompleto = false;
    cv.width = w; cv.height = h;
    ctx.drawImage(v, 0, 0);
    api.frame({ w, h, buffer: ctx.getImageData(0, 0, w, h).data.buffer });
    cv.width = cv.height = 1; // solta o buffer do quadro inteiro
    return;
  }
  const recortes = regioes.map((r, i) => {
    const q = retanguloComMargem(w, h, r, MARGEM_RECORTE);
    const c = (telas[i] ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!);
    if (c.canvas.width !== q.w || c.canvas.height !== q.h) { c.canvas.width = q.w; c.canvas.height = q.h; }
    c.drawImage(v, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
    return { ...q, buffer: c.getImageData(0, 0, q.w, q.h).data.buffer };
  });
  api.frame({ w, h, versao, recortes });
}

async function iniciar() {
  parar();
  const g = gen;
  let s: MediaStream | undefined;
  try {
    s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    vivos.add(s);
    if (g !== gen) { pararStream(s); return; }
    stream = s;
    s.getVideoTracks()[0].onended = () => { if (g === gen) { parar(); api.ended(); } };
    v.srcObject = s;
    await v.play();
    if (g !== gen) return; // parar() de uma geração mais nova já encerrou `s`
    enviar();
    timer = window.setInterval(enviar, FRAME_MS);
  } catch (e) {
    if (g !== gen) { if (s) pararStream(s); return; }
    parar(); api.ended(String(e).slice(0, 200));
  }
}

api.onComando((c) => {
  if (c === 'iniciar') void iniciar();
  else if (c === 'parar') parar();
  else if (c === 'quadroCompleto') { pedirCompleto = true; if (stream) enviar(); }
  else if (typeof c === 'object' && c?.tipo === 'regioes' && Array.isArray(c.regioes)) { regioes = c.regioes.slice(0, 4); versao = c.versao; if (stream) enviar(); }
});
