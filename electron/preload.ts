import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc';
import type { DiaryApi } from '../src/shared/api';
import type { BootstrapState, MenuAction } from '../src/shared/models';

const api: DiaryApi = {
  getBootstrapState: () => ipcRenderer.invoke(IPC_CHANNELS.bootstrapState),
  setupVault: (password) => ipcRenderer.invoke(IPC_CHANNELS.setupVault, password),
  verifyPassword: (password) => ipcRenderer.invoke(IPC_CHANNELS.verifyPassword, password),
  lockVault: () => ipcRenderer.invoke(IPC_CHANNELS.lockVault),
  listDiaries: () => ipcRenderer.invoke(IPC_CHANNELS.listDiaries),
  loadDiaryContent: (id) => ipcRenderer.invoke(IPC_CHANNELS.loadDiaryContent, id),
  saveDiaryContent: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveDiaryContent, input),
  searchDiaries: (query) => ipcRenderer.invoke(IPC_CHANNELS.searchDiaries, query),
  onVaultLocked: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, reason: BootstrapState['lockedReason']) => callback(reason);
    ipcRenderer.on(IPC_CHANNELS.locked, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.locked, handler);
    };
  },
  onMenuAction: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on(IPC_CHANNELS.menuAction, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.menuAction, handler);
    };
  },
};

contextBridge.exposeInMainWorld('diaryApi', api);
