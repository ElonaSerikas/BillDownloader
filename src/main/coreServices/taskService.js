const { EventEmitter } = require('events');
// 【修复】确保 taskDB 和 config 导入正确
const { taskDB, config } = require('./storageService'); 
const { downloadVideoTask } = require('../business/videoDownload/downloader');

class TaskService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.activeTasks = new Map(); 
    // 【注意】虽然 init() 中有数据库操作，但 main.js 已保证 initStore() 在 require(taskService) 前完成。
    this.maxConcurrent = config.get('download.maxConcurrent') || 3;
    this.isRunning = false;
    
    // 启动时恢复未完成任务状态
    this.init();
  }

  async init() {
    // 【修复】使用正确的数据库方法名
    const tasks = await taskDB.getAllTasks(); 
    // 将意外中断的 'downloading' 任务重置为 'paused'
    for (const task of tasks) {
      if (task.status === 'downloading') {
        // 【修复】使用新的更新状态方法
        await taskDB.updateStatus(task.id, 'paused'); 
      }
    }
  }

  // 添加任务
  async addTask(taskData) {
    const task = {
      id: taskData.id || Date.now().toString(),
      type: 'video',
      title: taskData.title,
      status: 'pending',
      progress: 0,
      meta: {
        url: taskData.url,
        m3u8Url: taskData.m3u8Url,
        savePath: taskData.savePath || config.get('download.path'),
        cookie: taskData.cookie
      }
    };

    // 【修复】使用正确的数据库方法名
    await taskDB.addTask(task);
    this.emit('update', await this.getAllTasks()); 
    this.processQueue();
    return task.id;
  }

  // 获取所有任务
  async getAllTasks() {
    // 【修复】使用正确的数据库方法名
    return await taskDB.getAllTasks();
  }

  // 开始/恢复任务
  async resumeTask(taskId) {
    // 【修复】使用正确的更新状态方法
    await taskDB.updateStatus(taskId, 'pending');
    this.emit('update', await this.getAllTasks());
    this.processQueue();
  }

  // 暂停任务
  async pauseTask(taskId) {
    const controller = this.activeTasks.get(taskId);
    if (controller) {
      controller.abort(); 
      this.activeTasks.delete(taskId);
    }
    // 【修复】使用正确的更新状态方法
    await taskDB.updateStatus(taskId, 'paused');
    this.emit('update', await this.getAllTasks());
    this.processQueue(); 
  }

  // 删除任务
  async deleteTask(taskId) {
    await this.pauseTask(taskId); 
    // 【修复】使用正确的数据库方法名
    await taskDB.deleteTask(taskId);
    this.emit('update', await this.getAllTasks());
  }

  // 队列调度核心 (保持不变)

  async runTask(task) {
    this.activeTasks.set(task.id, new AbortController()); 
    
    try {
      // 【修复】使用正确的更新状态方法
      await taskDB.updateStatus(task.id, 'downloading');
      this.emit('update', await this.getAllTasks());

      const signal = this.activeTasks.get(task.id).signal;
      
      // 调用下载器
      await downloadVideoTask({
        ...task.meta,
        id: task.id,
        title: task.title
      }, async (progress) => {
        // 进度回调：节流更新数据库，实时发送给前端
        if (Math.random() > 0.5 || progress === 100) {
             // 【修复】使用正确的更新状态方法
             await taskDB.updateStatus(task.id, 'downloading', progress);
        }
        this.emit('progress', { taskId: task.id, progress });
      }, signal);

      // 【修复】使用正确的更新状态方法
      await taskDB.updateStatus(task.id, 'completed', 100);
    } catch (err) {
      if (err.message === 'Aborted') {
        // 是被暂停的，状态已经在 pauseTask 中处理了
      } else {
        console.error(`Task failed: ${err.message}`);
        // 【修复】使用正确的更新状态方法
        await taskDB.updateStatus(task.id, 'error');
      }
    } finally {
      this.activeTasks.delete(task.id);
      this.emit('update', await this.getAllTasks());
      this.processQueue(); 
    }
  }
}

module.exports = new TaskService();