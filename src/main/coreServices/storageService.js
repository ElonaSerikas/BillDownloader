const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');

// --- 存储实例 ---
let db;
let dbReady = false;
let storeInstance = null; // 用于保存 electron-store 实例

/**
 * 异步初始化 Electron Store 和 SQLite。
 * 必须在任何同步访问 config 或 database 之前调用。
 */
async function initStore() {
  if (storeInstance && dbReady) return;

  // 1. 用户配置存储 (Electron-store)
  // 使用动态 import() 异步加载 ESM 模块
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

  // 【关键修复】将数据库连接包装在 Promise 中，确保 await initStore() 能真正等待数据库就绪
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
      } else {
        console.log('SQLite connected successfully.');
        dbReady = true;
        
        // 初始化表结构
        const createTableSQL = `
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
        `;
        
        db.run(createTableSQL, (createErr) => {
            if (createErr) {
                console.error('Error creating table:', createErr.message);
                reject(createErr);
            } else {
                resolve(); // 只有表创建成功后，Promise 才算完成
            }
        });
      }
    });
  });
}

// 辅助函数：确保 Store 实例已加载
const ensureStore = () => {
  if (!storeInstance) {
    throw new Error("Electron Store has not been initialized. Please call storageService.initStore() in main.js before use.");
  }
  return storeInstance;
}

// Promise化数据库操作
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

  // [修复] 确保这里有 updateStatus 方法供 taskService 使用
  updateStatus: async (id, status, progress) => {
    const updates = ['status = ?'];
    const params = [status];
    if (progress !== undefined) {
        updates.push('progress = ?');
        params.push(progress);
    }
    params.push(id);
    await dbRun(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);
  },

  // 仅更新进度的快捷方法
  updateTaskProgress: async (id, progress) => {
    await dbRun(`UPDATE tasks SET progress = ? WHERE id = ?`, [progress, id]);
  },

  getAllTasks: async () => {
    // [注意] 之前代码可能是 getAll 或 getAllTasks，这里统一导出名称为 getAllTasks
    // 但为了兼容 taskService.js 里的 taskDB.getAll() 调用，我们在下面导出时做个别名
    return dbAll(`SELECT * FROM tasks ORDER BY createdAt DESC`);
  },
  
  deleteTask: async (id) => {
    await dbRun(`DELETE FROM tasks WHERE id = ?`, [id]);
  }
};

// 统一导出
module.exports = {
  initStore, 
  config: {
    get: (key) => ensureStore().get(key),
    set: (key, val) => ensureStore().set(key, val),
    all: () => ensureStore().store
  },
  // 这里的 taskDB 对应 taskService.js 中的 require ... { taskDB }
  taskDB: {
    ...task,
    getAll: task.getAllTasks // [关键兼容] 增加 getAll 别名，因为 taskService.js 可能会调用 taskDB.getAll()
  }
};