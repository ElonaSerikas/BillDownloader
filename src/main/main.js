// 文件: src/main/main.js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
// 导入 coreServices
const storageService = require('./coreServices/storageService');
const securityService = require('./coreServices/securityService');

// 【修复】清理和简化导入，只导入实例
const linkParser = require('./business/videoDownload/linkParser'); 
// downloader.js 模块现在只被 taskService.js 使用，不需要在这里导入。

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
      if (cookie) securityService.setCookie(cookie); 
      
      // 【修复】使用 linkParser 导出的实例的 parse 方法
      const data = await linkParser.parse(url, cookie);
      
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
      // 【修复】必须等待 taskService.addTask 完成
      const taskId = await taskServiceInstance.addTask(taskDetails); 
      
      // 【移除】移除了冗余的 downloadVideoTask 启动逻辑，交给 taskService 队列调度
      
      return { success: true, taskId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 【新增】任务控制 IPC 处理器 (暂停、恢复、删除)
  ipcMain.on('task:control', async (event, { action, taskId }) => {
    if (!taskServiceInstance) return;

    try {
        switch (action) {
            case 'pause':
                await taskServiceInstance.pauseTask(taskId);
                break;
            case 'resume':
                await taskServiceInstance.resumeTask(taskId);
                break;
            case 'delete':
                await taskServiceInstance.deleteTask(taskId);
                break;
        }
    } catch (error) {
        console.error(`Task control action failed for ${action} ${taskId}:`, error);
    }
  });
  
  // 【新增】获取所有任务列表（供渲染进程启动时拉取）
  ipcMain.handle('task:get-all', async () => {
      return taskServiceInstance ? await taskServiceInstance.getAllTasks() : [];
  });
}

/**
 * 异步初始化应用的主入口
 */
async function initApp() {
  try {
    // 1. 必须首先初始化 Store 
    await storageService.initStore(); 
    
    // 2. 初始化 SecurityService (它依赖 Store 中的配置)
    securityService.init();

    // 3. 延迟加载 taskService 
    taskServiceInstance = require('./coreServices/taskService'); 
    
    // 【新增】监听 taskService 事件并转发给渲染进程
    taskServiceInstance.on('update', (tasks) => {
        // 使用可选链操作符防止窗口未完全加载
        mainWindow?.webContents.send('task:update-list', tasks); 
    });
    taskServiceInstance.on('progress', (data) => {
        mainWindow?.webContents.send('video:download-progress', data);
    });

    // 4. 准备就绪后创建窗口
    app.whenReady().then(createWindow);
    
  } catch (error) {
    console.error('Application initialization failed:', error);
    app.quit();
  }
}

// 启动应用初始化
initApp();