const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { parseVideoUrl } = require('./business/videoDownload/parser');
const { downloadVideoTask } = require('./business/videoDownload/downloader');
const taskService = require('./coreServices/taskService');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  mainWindow.loadURL('http://localhost:5173'); // 开发环境
  registerIpcHandlers();
}

// 注册IPC处理器
function registerIpcHandlers() {
  // 解析视频URL
  ipcMain.handle('video:parse-url', async (_, url, cookie) => {
    try {
      const data = await parseVideoUrl(url, cookie);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 开始下载任务
  ipcMain.handle('video:start-download', async (_, task) => {
    try {
      const taskId = taskService.addTask(task); // 添加到任务队列
      // 执行下载并同步进度到渲染进程
      downloadVideoTask({ ...task, id: taskId }, (progress) => {
        mainWindow.webContents.send('video:download-progress', {
          taskId,
          progress,
          title: task.title
        });
      }).then(() => {
        mainWindow.webContents.send('video:download-complete', { taskId });
      });
      return { success: true, taskId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(createWindow);