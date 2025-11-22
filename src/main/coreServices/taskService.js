// src/main/coreServices/taskService.js
const { EventEmitter } = require('events');
const { taskDB, config } = require('./storageService');
// [修改] 引入 SegmentDownloader 类
const SegmentDownloader = require('../business/videoDownload/segmentDownloader');

class TaskService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.activeTasks = new Map(); // 存储 { taskId: downloaderInstance }
    this.maxConcurrent = config.get('download.maxConcurrent') || 3;
    this.init();
  }

  async init() {
    const tasks = await taskDB.getAllTasks();
    for (const task of tasks) {
      if (task.status === 'downloading') {
        await taskDB.updateStatus(task.id, 'paused');
      }
    }
    this.emit('update', await this.getAllTasks());
  }

  async addTask(taskData) {
    const task = {
      id: taskData.id || Date.now().toString(),
      type: taskData.type || 'video', // 支持 video 或 article
      title: taskData.title,
      status: 'pending',
      progress: 0,
      meta: {
        url: taskData.url,
        m3u8Url: taskData.m3u8Url,
        cid: taskData.cid,
        bvid: taskData.bvid,
        savePath: taskData.savePath || config.get('download.path'),
        cookie: taskData.cookie
      }
    };

    await taskDB.addTask(task);
    this.emit('update', await this.getAllTasks());
    this.processQueue();
    return task.id;
  }

  async getAllTasks() {
    return await taskDB.getAllTasks();
  }

  async resumeTask(taskId) {
    await taskDB.updateStatus(taskId, 'pending');
    this.emit('update', await this.getAllTasks());
    this.processQueue();
  }

  async pauseTask(taskId) {
    const downloader = this.activeTasks.get(taskId);
    if (downloader) {
      // [修改] 调用实例的 pause 方法
      if (typeof downloader.pause === 'function') {
          downloader.pause();
      } else if (downloader.abort) {
          downloader.abort(); // 兼容 AbortController
      }
      this.activeTasks.delete(taskId);
    }
    await taskDB.updateStatus(taskId, 'paused');
    this.emit('update', await this.getAllTasks());
    this.processQueue();
  }

  async deleteTask(taskId) {
    await this.pauseTask(taskId);
    await taskDB.deleteTask(taskId);
    this.emit('update', await this.getAllTasks());
  }

  async processQueue() {
    if (this.activeTasks.size >= this.maxConcurrent) return;
    const tasks = await taskDB.getAllTasks();
    const nextTask = tasks.find(t => t.status === 'pending');
    if (!nextTask) return;
    this.runTask(nextTask);
  }

  async runTask(task) {
    try {
      await taskDB.updateStatus(task.id, 'downloading');
      this.emit('update', await this.getAllTasks());

      // [关键逻辑] 根据任务类型选择下载器
      let downloader;
      
      if (task.type === 'video') {
          downloader = new SegmentDownloader(task);
      } else if (task.type === 'article') {
          // 稍后实现 ArticleDownloader
          const { downloadArticle } = require('../business/articleCrawl/articleCrawler');
          downloader = { 
              start: () => downloadArticle(task, (p) => downloader.emit('progress', p)),
              pause: () => {}, // 专栏下载暂不支持暂停
              on: (evt, cb) => { if(evt==='progress') downloader._cb = cb; },
              emit: (evt, val) => { if(downloader._cb) downloader._cb(val); }
          };
      }

      this.activeTasks.set(task.id, downloader);

      // 监听进度
      downloader.on('progress', async (progress) => {
         // 节流更新数据库，实时发送给前端
         if (Math.random() > 0.8 || progress === 100) {
             await taskDB.updateStatus(task.id, 'downloading', progress);
         }
         this.emit('progress', { taskId: task.id, progress });
      });

      // 开始下载
      await downloader.start();

      await taskDB.updateStatus(task.id, 'completed', 100);
    } catch (err) {
      console.error(`Task failed: ${err.message}`);
      if (err.message.includes('paused') || err.message.includes('Aborted')) {
          // 暂停状态已处理
      } else {
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