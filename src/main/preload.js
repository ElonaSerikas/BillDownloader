// 文件: src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 只有在 preload 中，contextBridge 才是可用的
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => {
      const subscription = (_event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    removeListener: (channel, func) => ipcRenderer.removeListener(channel, func)
  }
});