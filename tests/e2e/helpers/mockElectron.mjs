export const app = {
  isPackaged: false,
  getPath: (_name) => {
    return process.cwd() + '/data';
  }
};

export const BrowserWindow = class {};
export const ipcMain = { on: () => {}, handle: () => {} };
export const dialog = { showOpenDialog: () => {}, showSaveDialog: () => {} };
export const shell = { openExternal: () => {} };
export const Notification = class {};

export default {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Notification
};
