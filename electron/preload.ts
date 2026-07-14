import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  IPC_EVENTS,
  type WindowSettings,
  type WindowCorner,
  type PlatformInfo,
} from './ipc';

// The ONLY bridge between the sandboxed renderer and the main process.
// Nothing here exposes `require`, `process`, or arbitrary IPC. Each method maps
// to one explicitly-allowed, typed channel.
const api = {
  isDesktop: true as const,

  getWindowSettings: (): Promise<WindowSettings> => ipcRenderer.invoke(IPC.getWindowSettings),
  setWindowSettings: (partial: Partial<WindowSettings>): Promise<WindowSettings> =>
    ipcRenderer.invoke(IPC.setWindowSettings, partial),
  setAlwaysOnTop: (value: boolean): Promise<WindowSettings> =>
    ipcRenderer.invoke(IPC.setAlwaysOnTop, value),
  setClickThrough: (value: boolean): Promise<WindowSettings> =>
    ipcRenderer.invoke(IPC.setClickThrough, value),
  moveToCorner: (corner: WindowCorner): Promise<WindowSettings> =>
    ipcRenderer.invoke(IPC.moveToCorner, corner),
  setScale: (scale: number): Promise<WindowSettings> => ipcRenderer.invoke(IPC.setScale, scale),
  hideToTray: (): Promise<void> => ipcRenderer.invoke(IPC.hideToTray),
  show: (): Promise<void> => ipcRenderer.invoke(IPC.show),
  quit: (): Promise<void> => ipcRenderer.invoke(IPC.quit),
  getIdleSeconds: (): Promise<number> => ipcRenderer.invoke(IPC.getIdleSeconds),
  getPlatformInfo: (): Promise<PlatformInfo> => ipcRenderer.invoke(IPC.getPlatformInfo),

  // Event subscriptions. Return an unsubscribe function to avoid listener leaks.
  onToggleVisibility: (cb: () => void) => subscribe(IPC_EVENTS.toggleVisibility, () => cb()),
  onQuietMode: (cb: (enabled: boolean) => void) =>
    subscribe(IPC_EVENTS.quietMode, (args) => cb(Boolean(args[0]))),
  onFocusChanged: (cb: (focused: boolean) => void) =>
    subscribe(IPC_EVENTS.focusChanged, (args) => cb(Boolean(args[0]))),
  onShowSettings: (cb: () => void) => subscribe(IPC_EVENTS.showSettings, () => cb()),
};

function subscribe(channel: string, listener: (args: unknown[]) => void): () => void {
  const wrapped = (_e: unknown, ...args: unknown[]) => listener(args);
  ipcRenderer.on(channel, wrapped as never);
  return () => ipcRenderer.removeListener(channel, wrapped as never);
}

contextBridge.exposeInMainWorld('desktop', api);

export type DesktopApi = typeof api;
