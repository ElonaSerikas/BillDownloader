import { ipcRenderer } from 'electron';

// 解析视频URL
export const parseVideoUrl = async (url, cookie) => {
  return ipcRenderer.invoke('video:parse-url', url, cookie);
};

// 提交下载任务
export const submitDownloadTask = async (task) => {
  return ipcRenderer.invoke('video:start-download', task);
};

// 监听下载进度
export const onDownloadProgress = (callback) => {
  ipcRenderer.on('video:download-progress', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('video:download-progress');
};

// 监听下载完成
export const onDownloadComplete = (callback) => {
  ipcRenderer.on('video:download-complete', (_, data) => callback(data));
  return () => ipcRenderer.removeAllListeners('video:download-complete');
};