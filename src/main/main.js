const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const taskService = require('./coreServices/taskService');
const storageService = require('./coreServices/storageService');
// [修改点] 统一使用 linkParser，不再使用 parser.js
const linkParser = require('./business/videoDownload/linkParser');

let mainWindow;

function createWindow() {
  // ... 窗口创建逻辑保持不变 ...
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/ipc/preload.js'), // 确保路径对
      nodeIntegration: true,
      contextIsolation: false 
    }
  });
  
  // 开发环境加载Vite服务，生产环境加载文件
  if (process.env.NODE_ENV === 'development') {
      // [修改点] 将加载地址改为 5174 或使用环境变量动态配置
      mainWindow.loadURL('http://localhost:5174'); 
      mainWindow.webContents.openDevTools();
  } else {
      mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  registerIpcHandlers();
  setupServiceListeners();
}

function setupIpc() {
  // --- 视频解析 [修改点] ---
  ipcMain.handle('video:parse-url', async (_, url, cookie) => {
    try {
      // 调用 linkParser 实例的 parse 方法
      const data = await linkParser.parse(url, cookie);
      return { success: true, data };
    } catch (err) {
      console.error('解析错误:', err);
      return { success: false, error: err.message };
    }
  });

  // --- 任务管理 (对接 TaskService) ---
  ipcMain.handle('video:start-download', async (_, taskData) => {
    try {
      // TaskService 内部会调用 downloader.js
      const taskId = await taskService.addTask(taskData);
      return { success: true, taskId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  ipcMain.handle('task:get-all', async () => {
    return await taskService.getAllTasks();
  });

  ipcMain.on('task:control', (_, { action, taskId }) => {
    if (action === 'pause') taskService.pauseTask(taskId);
    if (action === 'resume') taskService.resumeTask(taskId);
    if (action === 'delete') taskService.deleteTask(taskId);
  });

  // --- 事件监听转发 ---
  taskService.on('update', (tasks) => {
    if(mainWindow) mainWindow.webContents.send('task:update-list', tasks);
  });
  
  taskService.on('progress', (data) => {
    if(mainWindow) mainWindow.webContents.send('video:download-progress', data);
  });
}

app.whenReady().then(createWindow);