const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');

// --- 存储实例 ---
let store;
let isInitialized = false;


// 1. 用户配置存储 (Electron-store)
const store = new Store({
  defaults: {
    'download.path': path.join(app.getPath('downloads'), 'BiliDownloader'),
    'download.maxConcurrent': 3,
    'network.proxy': '',
    'user.cookie': ''
  }
});

// 2. 任务数据库存储 (SQLite)
const dbDir = path.join(app.getPath('userData'), 'database');
fs.ensureDirSync(dbDir);
const dbPath = path.join(dbDir, 'tasks.db');

const db = new sqlite3.Database(dbPath);

// 初始化表结构
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      status TEXT, -- pending, downloading, paused, completed, error
      progress INTEGER DEFAULT 0,
      total_size TEXT,
      created_at INTEGER,
      meta_data TEXT -- 存储JSON格式的元数据(url, cover, quality等)
    )
  `);
});

// Promise化数据库操作
const dbRun = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

module.exports = {
  // 配置操作
  config: {
    get: (key) => store.get(key),
    set: (key, val) => store.set(key, val),
    all: () => store.store
  },
  
  // 任务操作
  taskDB: {
    addTask: async (task) => {
      const sql = `INSERT OR REPLACE INTO tasks (id, type, title, status, progress, created_at, meta_data) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      return dbRun(sql, [
        task.id, 
        task.type, 
        task.title, 
        task.status || 'pending', 
        task.progress || 0, 
        Date.now(), 
        JSON.stringify(task.meta || {})
      ]);
    },
    
    updateStatus: async (id, status, progress) => {
      // 如果进度存在则更新，否则只更新状态
      if (progress !== undefined) {
        return dbRun(`UPDATE tasks SET status = ?, progress = ? WHERE id = ?`, [status, progress, id]);
      } else {
        return dbRun(`UPDATE tasks SET status = ? WHERE id = ?`, [status, id]);
      }
    },

    deleteTask: async (id) => {
      return dbRun(`DELETE FROM tasks WHERE id = ?`, [id]);
    },
    
    getAll: async () => {
      const rows = await dbAll(`SELECT * FROM tasks ORDER BY created_at DESC`);
      return rows.map(row => ({
        ...row,
        meta: JSON.parse(row.meta_data || '{}')
      }));
    },
    
    get: async (id) => {
      const row = await dbGet(`SELECT * FROM tasks WHERE id = ?`, [id]);
      if (row) row.meta = JSON.parse(row.meta_data || '{}');
      return row;
    }
  }
};