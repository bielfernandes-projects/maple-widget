import { contextBridge, ipcRenderer } from 'electron';

// janela capturadora oculta: só envia quadros/fim e recebe comandos
contextBridge.exposeInMainWorld('captureApi', {
  frame: (msg: { w: number; h: number; buffer: ArrayBuffer }) => ipcRenderer.send('cap:frame', msg),
  ended: (erro?: string) => ipcRenderer.send('cap:ended', erro),
  onComando: (cb: (c: string) => void) => { ipcRenderer.on('cap:cmd', (_e, c) => cb(c)); },
});
