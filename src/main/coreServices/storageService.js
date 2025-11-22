const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');

// --- 存储实例 ---
let db;
let dbReady = false;
let storeInstance = null; // 用于保存 electron-store 实例

/**
 * 异步初始化 Electron Store。必须在任何同步访问 config 之前调用。
 */
async function initStore() {
  if (storeInstance) return;

  // 1. 用户配置存储 (Electron-store)
  // [关键修改] 使用动态 import() 异步加载 ESM 模块
  const { default: Store } = await import('electron-store'); 

  storeInstance = new Store({
    defaults: {
      'download.path': path.join(app.getPath('downloads'), 'BiliDownloader'),
      'download.maxConcurrent': 3,
      'network.proxy': '',
      'user.cookie': '',
      'network.userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    }
  });

  // 2. 任务数据库存储 (SQLite)
  const dbPath = path.join(app.getPath('userData'), 'database', 'tasks.db');
  fs.ensureDirSync(path.dirname(dbPath));

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      dbReady = true;
      // 初始化表结构
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT,
          type TEXT NOT NULL,
          url TEXT,
          status TEXT, -- pending, downloading, paused, completed, error
          progress REAL,
          episodeId TEXT,
          m3u8Url TEXT,
          createdAt INTEGER
        )
      `);
    }
  });
}

// 辅助函数：确保 Store 实例已加载
const ensureStore = () => {
  if (!storeInstance) {
    throw new Error("Electron Store has not been initialized. Please call storageService.initStore() in main.js before use.");
  }
  return storeInstance;
}

// Promise化数据库操作（保持不变）
const dbRun = (sql, params = []) => {
  if (!dbReady) throw new Error('Database not ready');
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
};

const dbAll = (sql, params = []) => {
  if (!dbReady) throw new Error('Database not ready');
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};


// 数据库操作接口
const task = {
  addTask: async (taskData) => {
    const { id, title, type, url, status, progress, episodeId, m3u8Url } = taskData;
    const createdAt = Date.now();
    await dbRun(`
      INSERT INTO tasks (id, title, type, url, status, progress, episodeId, m3u8Url, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, title, type, url, status, progress, episodeId, m3u8Url, createdAt]);
  },

  updateTaskProgress: async (id, progress) => {
    await dbRun(`UPDATE tasks SET progress = ? WHERE id = ?`, [progress, id]);
  },

  getAllTasks: async () => {
    return dbAll(`SELECT * FROM tasks ORDER BY createdAt DESC`);
  }
};


module.exports = {
  initStore, // [新增]：导出初始化函数
  // 配置操作: 现在使用 ensureStore 确保实例存在
  config: {
    get: (key) => ensureStore().get(key),
    set: (key, val) => ensureStore().set(key, val),
    all: () => ensureStore().store
  },
  task // 任务数据库操作
};