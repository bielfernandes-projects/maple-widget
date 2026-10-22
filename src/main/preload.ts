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
  setOpacity: (n) => ipcRenderer.invoke('win:opacity', n),
  pickGameFolder: () => ipcRenderer.invoke('wiz:folder'),
  getShot: (j, p) => ipcRenderer.invoke('wiz:shot', j, p),
  listWindows: () => ipcRenderer.invoke('wiz:windows'),
  saveCalibration: (k, r, p, j) => ipcRenderer.invoke('wiz:save', k, r, p, j),
  getConfig: () => ipcRenderer.invoke('cfg:get'),
};
contextBridge.exposeInMainWorld('api', api);
