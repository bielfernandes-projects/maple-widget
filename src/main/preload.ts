import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from '../renderer/api.d';

const api: Api = {
  onVM: (cb) => { ipcRenderer.on('vm', (_e, vm) => cb(vm)); },
  addSource: (u) => ipcRenderer.invoke('src:add', u),
  removeSource: (u) => ipcRenderer.invoke('src:remove', u),
  refreshSources: () => ipcRenderer.invoke('src:refresh'),
  openSource: (u) => ipcRenderer.invoke('open:source', u),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  setAutoSync: (on) => ipcRenderer.invoke('sync:toggle', on),
  toggleQuest: (id) => ipcRenderer.invoke('quest:toggle', id),
  setExpanded: (b) => ipcRenderer.invoke('win:expand', b),
  apoiar: (como) => ipcRenderer.invoke('app:apoiar', como),
  search: (q) => ipcRenderer.invoke('search:query', q),
  onBuscar: (cb) => { ipcRenderer.on('buscar', () => cb()); },
  setSize: (w, h) => ipcRenderer.invoke('win:size', w, h),
  setCalibSize: () => ipcRenderer.invoke('win:calib'),
  setOpacity: (n) => ipcRenderer.invoke('win:opacity', n),
  pickGameFolder: () => ipcRenderer.invoke('wiz:folder'),
  getShot: (j, p) => ipcRenderer.invoke('wiz:shot', j, p),
  checkFolder: (p) => ipcRenderer.invoke('wiz:check-folder', p),
  skipWizard: () => ipcRenderer.invoke('wiz:skip'),
  listWindows: () => ipcRenderer.invoke('wiz:windows'),
  saveCalibration: (k, r, p, j) => ipcRenderer.invoke('wiz:save', k, r, p, j),
  getConfig: () => ipcRenderer.invoke('cfg:get'),
  autoEscala: () => ipcRenderer.invoke('capture:autoescala'),
  quit: () => ipcRenderer.invoke('app:quit'),
};
contextBridge.exposeInMainWorld('api', api);
