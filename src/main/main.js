const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const storageService = require('./coreServices/storageService');
const securityService = require('./coreServices/securityService');
const authService = require('./business/auth/authService'); // 引入鉴权服务
const linkParser = require('./business/videoDownload/linkParser');
// 专栏下载器需要在这里 require 一次，确保其逻辑被加载
require('./business/articleCrawl/articleCrawler'); 


let mainWindow;
let taskServiceInstance;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, 
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true, 
    backgroundColor: '#f3f2f1', 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false 
    }
  });

  mainWindow.loadURL('http://localhost:5173');

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  registerIpcHandlers();
}

function registerIpcHandlers() {
  // --- 鉴权相关 IPC ---
  ipcMain.handle('auth:get-qrcode', async () => authService.getQRCode());
  ipcMain.handle('auth:poll-qrcode', async (_, key) => authService.pollQRCode(key));
  ipcMain.handle('auth:get-user-info', async () => authService.getUserInfo());
  ipcMain.handle('auth:import-cookie', async (_, cookie) => authService.importCookie(cookie));
  ipcMain.handle('auth:logout', async () => {
    authService.logout();
    return { success: true };
  });

  // --- 视频与专栏解析 IPC ---
  ipcMain.handle('video:parse-url', async (_, url) => {
    try {
      const cookie = securityService.getCookie();
      const data = await linkParser.parse(url, cookie);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 专栏解析 IPC
  ipcMain.handle('article:parse-url', async (_, url) => {
     if (url.includes('bilibili.com/read/cv')) {
         return { success: true, data: { title: 'B站专栏', url } };
     }
     return { success: false, error: '无效的专栏链接' };
  });

  // --- 任务管理 IPC ---
  ipcMain.handle('video:start-download', async (_, task) => {
    if (!taskServiceInstance) return { success: false, error: '服务未初始化' };
    
    const taskDetails = { 
        ...task, 
        type: task.type || 'video', 
        status: 'pending',
        cookie: securityService.getCookie() // 注入最新 Cookie
    };
    
    try {
      const taskId = await taskServiceInstance.addTask(taskDetails);
      return { success: true, taskId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('task:control', async (event, { action, taskId }) => {
    if (!taskServiceInstance) return;
    try {
        switch (action) {
            case 'pause': await taskServiceInstance.pauseTask(taskId); break;
            case 'resume': await taskServiceInstance.resumeTask(taskId); break;
            case 'delete': await taskServiceInstance.deleteTask(taskId); break;
        }
    } catch (e) { console.error(e); }
  });

  ipcMain.handle('task:get-all', async () => {
      return taskServiceInstance ? await taskServiceInstance.getAllTasks() : [];
  });

  // --- 配置 IPC ---
  ipcMain.handle('config:get', (_, key) => storageService.config.get(key));
  ipcMain.handle('config:set', (_, key, val) => storageService.config.set(key, val));
}

async function initApp() {
  try {
    await storageService.initStore();
    securityService.init();
    
    // 延迟加载 TaskService
    taskServiceInstance = require('./coreServices/taskService');
    
    // 事件转发
    taskServiceInstance.on('update', (tasks) => {
        if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('task:update-list', tasks);
    });
    taskServiceInstance.on('progress', (data) => {
        if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('video:download-progress', data);
    });

    app.whenReady().then(createWindow);
    
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });
  } catch (error) {
    console.error('Application initialization failed:', error);
    app.quit();
  }
}

initApp();