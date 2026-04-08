import { ipcMain, type WebContents } from 'electron';
import { VaultStore } from './vaultStore';
import type { SaveDiaryInput } from '../src/shared/models';

export const IPC_CHANNELS = {
  bootstrapState: 'vault:bootstrapState',
  setupVault: 'vault:setupVault',
  verifyPassword: 'vault:verifyPassword',
  lockVault: 'vault:lockVault',
  listDiaries: 'vault:listDiaries',
  loadDiaryContent: 'vault:loadDiaryContent',
  saveDiaryContent: 'vault:saveDiaryContent',
  searchDiaries: 'vault:searchDiaries',
  locked: 'vault:locked',
  menuAction: 'vault:menuAction',
} as const;

export function registerIpcHandlers(store: VaultStore, getMainWindow: () => WebContents | null): void {
  store.onLock((reason) => {
    if (reason === 'close') {
      return;
    }

    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.send(IPC_CHANNELS.locked, reason);
    }
  });

  ipcMain.handle(IPC_CHANNELS.bootstrapState, async () => store.bootstrapState());
  ipcMain.handle(IPC_CHANNELS.setupVault, async (_event, password: string) => {
    await store.setupVault(password);
    return store.bootstrapState();
  });
  ipcMain.handle(IPC_CHANNELS.verifyPassword, async (_event, password: string) => {
    await store.verifyPassword(password);
    return store.bootstrapState();
  });
  ipcMain.handle(IPC_CHANNELS.lockVault, async () => {
    await store.lock('manual');
    return store.bootstrapState();
  });
  ipcMain.handle(IPC_CHANNELS.listDiaries, async () => store.listDiaries());
  ipcMain.handle(IPC_CHANNELS.loadDiaryContent, async (_event, id: string) => store.loadDiaryContent(id));
  ipcMain.handle(IPC_CHANNELS.saveDiaryContent, async (_event, input: SaveDiaryInput) => {
    const result = await store.saveDiaryContent(input);
    return {
      ...result,
      diaries: await store.listDiaries(),
    };
  });
  ipcMain.handle(IPC_CHANNELS.searchDiaries, async (_event, query: string) => store.searchDiaries(query));
}
