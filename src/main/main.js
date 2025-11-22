const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initIpcHandlers } = require('./ipcHandlers');
const Store = require('electron-store');

// 初始化配置存储（工程名相关设置）
const store = new Store({
  name: 'bili-downloader-config', // 配置文件名
  defaults: {
    downloadPath: path.join(app.getPath('desktop'), 'BiliDownloads'), // 下载目录
    concurrency: 3,
    videoQuality: '1080P',
    notifySound: true
  }
});

global.sharedState = { store };

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'BiliDownloader', // 窗口标题
    frame: false
  });

  // 开发环境加载Vite服务器
  mainWindow.loadURL('http://localhost:5173');
  // 生产环境：mainWindow.loadFile('dist/index.html')

  initIpcHandlers(mainWindow);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});