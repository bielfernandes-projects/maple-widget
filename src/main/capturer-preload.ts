import { contextBridge, ipcRenderer } from 'electron';

// janela capturadora oculta: só envia quadros/recortes e fim, e recebe comandos (o main valida tudo que chega)
contextBridge.exposeInMainWorld('captureApi', {
  frame: (msg: object) => ipcRenderer.send('cap:frame', msg),
  ended: (erro?: string) => ipcRenderer.send('cap:ended', erro),
  onComando: (cb: (c: unknown) => void) => { ipcRenderer.on('cap:cmd', (_e, c) => cb(c)); },
});
