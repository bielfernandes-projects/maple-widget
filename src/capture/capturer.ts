// Roda na janela capturadora oculta: stream da janela do jogo em pixels nativos → quadros RGBA para o main.
type CaptureApi = {
  frame(msg: { w: number; h: number; buffer: ArrayBuffer }): void;
  ended(erro?: string): void;
  onComando(cb: (c: string) => void): void;
};
const api = (window as unknown as { captureApi: CaptureApi }).captureApi;
const FRAME_MS = 2000;
const v = document.getElementById('v') as HTMLVideoElement;
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d', { willReadFrequently: true })!;
let stream: MediaStream | null = null;
let timer: number | undefined;

function parar() {
  clearInterval(timer); timer = undefined;
  // remove o onended antes de parar: parada pedida não é "fim" da faixa
  stream?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
  stream = null; v.srcObject = null;
}

function enviar() {
  const w = v.videoWidth, h = v.videoHeight;
  if (!w || !h) return;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  ctx.drawImage(v, 0, 0);
  api.frame({ w, h, buffer: ctx.getImageData(0, 0, w, h).data.buffer });
}

async function iniciar() {
  parar();
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    stream = s;
    s.getVideoTracks()[0].onended = () => { parar(); api.ended(); };
    v.srcObject = s;
    await v.play();
    enviar();
    timer = window.setInterval(enviar, FRAME_MS);
  } catch (e) { parar(); api.ended(String(e).slice(0, 200)); }
}

api.onComando((c) => { if (c === 'iniciar') void iniciar(); else if (c === 'parar') parar(); });
