// src/main/coreServices/taskService.js
const { EventEmitter } = require('events');

class TaskQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = []; // 任务队列
    this.running = false;
    this.maxConcurrent = 2; // 最大并发数（可由用户设置）
    this.runningTasks = 0;
  }

  // 添加任务（支持优先级，1最高）
  addTask(task, priority = 3) {
    this.queue.push({ ...task, priority });
    this.queue.sort((a, b) => a.priority - b.priority); // 按优先级排序
    this.processQueue(); // 尝试执行任务
  }

  // 处理队列
  async processQueue() {
    if (this.running || this.runningTasks >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    this.running = true;

    // 取出可执行的任务
    while (this.runningTasks < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.runningTasks++;
      this.executeTask(task)
        .then(() => {
          this.runningTasks--;
          this.emit('task-complete', task.id);
          this.processQueue(); // 继续处理下一个
        })
        .catch((err) => {
          this.runningTasks--;
          this.emit('task-error', task.id, err);
          this.processQueue();
        });
    }

    this.running = false;
  }

  // 执行具体任务（由业务层实现）
  async executeTask(task) {
    switch (task.type) {
      case 'video':
        const downloader = require('../business/videoDownload/segmentDownloader');
        return downloader.download(task);
      case 'live':
        const recorder = require('../business/liveRecord/recorder');
        return recorder.start(task);
      default:
        throw new Error('未知任务类型');
    }
  }
}

module.exports = new TaskQueue();