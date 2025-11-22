// src/main/main.js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
// 导入 coreServices，但 taskService 延迟加载
const storageService = require('./coreServices/storageService');
const securityService = require('./coreServices/securityService');

// [修复 Cannot find module 错误]
// 使用正确的文件引用
const { parseVideoUrl } = require('./business/videoDownload/linkParser'); // 使用 linkParser
const { downloadVideoTask } = require('./business/videoDownload/downloader'); // 确保此文件存在

let mainWindow;
let taskServiceInstance; 

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  // 注意：Vite 可能会使用不同的端口，请确保端口号与 vite.config.js 一致
  mainWindow.loadURL('http://localhost:5173'); 
  registerIpcHandlers();
}

/**
 * 注册 IPC 处理器
 */
function registerIpcHandlers() {
  // 解析视频URL
  ipcMain.handle('video:parse-url', async (_, url, cookie) => {
    try {
      // 临时设置 Cookie
      if (cookie) securityService.setCookie(cookie); 
      
      // [修改] 使用 linkParser 导出的函数 (假设 linkParser.js 导出了 parseVideoUrl)
      // 如果 linkParser.js 只导出了实例，这里需要调整调用方式。
      // 这里暂时使用 linkParser 实例的 parse 方法：
      const data = await require('./business/videoDownload/linkParser').parse(url, cookie);
      
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 开始下载任务
  ipcMain.handle('video:start-download', async (_, task) => {
    const taskDetails = { 
        ...task, 
        type: 'video', 
        status: 'pending' 
    };
    try {
      // taskServiceInstance 确保在 initApp 中被加载
      const taskId = taskServiceInstance.addTask(taskDetails); 
      
      // 实际下载逻辑应该在 taskService 中被调度，这里为了示例完整，保持原 downloader 逻辑
      downloadVideoTask({ ...taskDetails, id: taskId }, (progress) => {
        mainWindow.webContents.send('video:download-progress', {
          taskId,
          progress,
          title: task.title
        });
      }).then(() => {
        mainWindow.webContents.send('video:download-complete', { taskId });
      }).catch(err => {
        console.error('Download error:', err.message);
        mainWindow.webContents.send('video:download-error', { taskId, error: err.message });
      });
      
      return { success: true, taskId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

/**
 * 异步初始化应用的主入口
 */
async function initApp() {
  try {
    // 1. 必须首先初始化 Store (解决 ERR_REQUIRE_ESM)
    await storageService.initStore(); 
    
    // 2. 初始化 SecurityService (它依赖 Store 中的配置)
    securityService.init();

    // 3. 延迟加载 taskService (它在 top level 执行时会调用 storageService.config.get)
    taskServiceInstance = require('./coreServices/taskService'); 
    
    // 4. 准备就绪后创建窗口
    app.whenReady().then(createWindow);
    
  } catch (error) {
    console.error('Application initialization failed:', error);
    app.quit();
  }
}

// 启动应用初始化
initApp();