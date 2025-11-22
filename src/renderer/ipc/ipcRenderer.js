import { ipcRenderer } from 'electron';

// --- 视频解析 ---
export const parseVideoUrl = (url, cookie) => {
  return ipcRenderer.invoke('video:parse-url', url, cookie);
};

// --- 任务管理 ---
export const getTasks = () => {
  return ipcRenderer.invoke('task:get-all');
};

export const submitDownloadTask = (task) => {
  return ipcRenderer.invoke('video:start-download', task);
};

export const pauseTask = (taskId) => {
  ipcRenderer.send('task:control', { action: 'pause', taskId });
};

export const resumeTask = (taskId) => {
  ipcRenderer.send('task:control', { action: 'resume', taskId });
};

export const deleteTask = (taskId) => {
  ipcRenderer.send('task:control', { action: 'delete', taskId });
};

// --- 监听器 ---
// 监听全量列表更新
export const onTaskListUpdate = (callback) => {
  const listener = (_, tasks) => callback(tasks);
  ipcRenderer.on('task:update-list', listener);
  return () => ipcRenderer.removeListener('task:update-list', listener);
};

// 监听实时进度（用于进度条动画，避免全量更新导致的React渲染卡顿）
export const onDownloadProgress = (callback) => {
  const listener = (_, data) => callback(data);
  ipcRenderer.on('video:download-progress', listener);
  return () => ipcRenderer.removeListener('video:download-progress', listener);
};

// --- 配置 ---
export const getConfig = (key) => ipcRenderer.invoke('config:get', key);
export const setConfig = (key, val) => ipcRenderer.invoke('config:set', key, val);