const ipc = window.electron?.ipcRenderer;

// Mock IPC for safety and browser debugging
const mockIpc = {
  invoke: () => Promise.resolve({ success: false, error: 'Electron环境未连接' }),
  send: () => {},
  on: () => () => {}, // on 应该返回一个 cleanup 函数
  removeListener: () => {}
};

const safeIpc = ipc || mockIpc;

// --- 鉴权与用户 ---
export const getQRCode = () => safeIpc.invoke('auth:get-qrcode');
export const pollQRCode = (key) => safeIpc.invoke('auth:poll-qrcode', key);
export const getUserInfo = () => safeIpc.invoke('auth:get-user-info');
export const importCookie = (cookie) => safeIpc.invoke('auth:import-cookie', cookie);
export const logout = () => safeIpc.invoke('auth:logout');

// --- 视频与专栏解析 ---
export const parseVideoUrl = (url) => safeIpc.invoke('video:parse-url', url);
export const parseArticleUrl = (url) => safeIpc.invoke('article:parse-url', url);

// --- 任务管理 ---
export const getTasks = () => safeIpc.invoke('task:get-all');
export const submitDownloadTask = (task) => safeIpc.invoke('video:start-download', task);

export const pauseTask = (taskId) => safeIpc.send('task:control', { action: 'pause', taskId });
export const resumeTask = (taskId) => safeIpc.send('task:control', { action: 'resume', taskId });
export const deleteTask = (taskId) => safeIpc.send('task:control', { action: 'delete', taskId });

// --- 监听器 ---
export const onTaskListUpdate = (callback) => {
  // on 方法在 preload 中已封装，返回一个移除监听的函数
  return safeIpc.on('task:update-list', (tasks) => callback(tasks));
};

export const onDownloadProgress = (callback) => {
  return safeIpc.on('video:download-progress', (data) => callback(data));
};

// --- 配置 ---
export const getConfig = (key) => safeIpc.invoke('config:get', key);
export const setConfig = (key, val) => safeIpc.invoke('config:set', key, val);