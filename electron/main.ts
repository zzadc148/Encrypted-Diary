import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IPC_CHANNELS, registerIpcHandlers } from './ipc';
import { VaultStore } from './vaultStore';
import type { MenuAction } from '../src/shared/models';

let mainWindow: BrowserWindow | null = null;
let store: VaultStore | null = null;
let handlersRegistered = false;

function sendMenuAction(action: MenuAction): void {
  const webContents = mainWindow?.webContents;
  if (webContents && !webContents.isDestroyed()) {
    webContents.send(IPC_CHANNELS.menuAction, action);
  }
}

function configureApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建日记',
          accelerator: 'CommandOrControl+N',
          click: () => sendMenuAction('new-diary'),
        },
        {
          label: '立即保存',
          accelerator: 'CommandOrControl+S',
          click: () => sendMenuAction('save-diary'),
        },
        { type: 'separator' },
        {
          label: '锁定保险库',
          accelerator: 'CommandOrControl+L',
          click: () => sendMenuAction('lock-vault'),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '日记',
      submenu: [
        {
          label: '刷新列表',
          accelerator: 'F5',
          click: () => sendMenuAction('refresh-diaries'),
        },
        {
          label: '搜索',
          accelerator: 'CommandOrControl+F',
          click: () => sendMenuAction('focus-search'),
        },
        {
          label: '查看与编辑',
          accelerator: 'CommandOrControl+E',
          click: () => sendMenuAction('focus-editor'),
        },
      ],
    },
  ];

  if (process.env.VITE_DEV_SERVER_URL) {
    template.push({
      label: '开发',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getRendererUrl(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return pathToFileURL(path.join(app.getAppPath(), 'dist/renderer/index.html')).toString();
}

async function createWindow(store: VaultStore): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: '加密日记',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:') && !url.startsWith('http://localhost:')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  await mainWindow.loadURL(getRendererUrl());

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', () => {
    void store.lock('close');
  });
}

async function bootstrap(): Promise<void> {
  if (store === null) {
    const dataDir = path.join(app.getPath('userData'), 'appData');
    store = new VaultStore(dataDir);
    await store.initialize();
  }

  if (!handlersRegistered) {
    registerIpcHandlers(store, () => mainWindow?.webContents ?? null);
    handlersRegistered = true;
  }

  if (mainWindow !== null) {
    return;
  }

  await createWindow(store);
  configureApplicationMenu();
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    void bootstrap();
  }).catch((error) => {
    console.error('Failed to bootstrap app', error);
  });

  app.on('before-quit', () => {
    void store?.lock('close');
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void bootstrap();
    }
  });
}
