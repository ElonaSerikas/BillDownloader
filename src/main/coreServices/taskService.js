const { EventEmitter } = require('events');
const { taskDB, config } = require('./storageService');
const { downloadVideoTask } = require('../business/videoDownload/downloader');

class TaskService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.activeTasks = new Map(); // 存储正在运行的任务引用，用于暂停/取消
    this.maxConcurrent = config.get('download.maxConcurrent') || 3;
    this.isRunning = false;
    
    // 启动时恢复未完成任务状态
    this.init();
  }

  async init() {
    const tasks = await taskDB.getAll();
    // 将意外中断的 'downloading' 任务重置为 'paused'
    for (const task of tasks) {
      if (task.status === 'downloading') {
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

    await taskDB.addTask(task);
    this.emit('update', await this.getAllTasks()); // 通知前端更新
    this.processQueue();
    return task.id;
  }

  // 获取所有任务
  async getAllTasks() {
    return await taskDB.getAll();
  }

  // 开始/恢复任务
  async resumeTask(taskId) {
    await taskDB.updateStatus(taskId, 'pending');
    this.emit('update', await this.getAllTasks());
    this.processQueue();
  }

  // 暂停任务
  async pauseTask(taskId) {
    const controller = this.activeTasks.get(taskId);
    if (controller) {
      controller.abort(); // 触发下载器内部的中断
      this.activeTasks.delete(taskId);
    }
    await taskDB.updateStatus(taskId, 'paused');
    this.emit('update', await this.getAllTasks());
    this.processQueue(); // 释放了槽位，尝试执行下一个
  }

  // 删除任务
  async deleteTask(taskId) {
    await this.pauseTask(taskId); // 先停止
    await taskDB.deleteTask(taskId);
    // TODO: 可选删除本地文件
    this.emit('update', await this.getAllTasks());
  }

  // 队列调度核心
  async processQueue() {
    // 1. 检查当前并发数
    if (this.activeTasks.size >= this.maxConcurrent) return;

    // 2. 从数据库获取下一个 pending 任务
    const tasks = await taskDB.getAll();
    const nextTask = tasks.find(t => t.status === 'pending');
    
    if (!nextTask) return;

    // 3. 执行任务
    this.runTask(nextTask);
  }

  async runTask(task) {
    this.activeTasks.set(task.id, new AbortController()); // 占位，防止重复调度
    
    try {
      await taskDB.updateStatus(task.id, 'downloading');
      this.emit('update', await this.getAllTasks());

      // 传入 abortSignal 以支持暂停
      const signal = this.activeTasks.get(task.id).signal;
      
      // 调用下载器
      await downloadVideoTask({
        ...task.meta,
        id: task.id,
        title: task.title
      }, async (progress) => {
        // 进度回调：节流更新数据库，实时发送给前端
        if (Math.random() > 0.5 || progress === 100) { // 简单节流
             await taskDB.updateStatus(task.id, 'downloading', progress);
        }
        // 通过事件发送给主进程，主进程再转发给渲染进程
        this.emit('progress', { taskId: task.id, progress });
      }, signal);

      await taskDB.updateStatus(task.id, 'completed', 100);
    } catch (err) {
      if (err.message === 'Aborted') {
        // 是被暂停的，状态已经在 pauseTask 中处理了
      } else {
        console.error(`Task failed: ${err.message}`);
        await taskDB.updateStatus(task.id, 'error');
      }
    } finally {
      this.activeTasks.delete(task.id);
      this.emit('update', await this.getAllTasks());
      this.processQueue(); // 递归调度下一个
    }
  }
}

module.exports = new TaskService();