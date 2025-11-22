const { ipcMain } = require('electron');
const { parseVideo, parseBangumi, getPlayUrl } = require('./apiParser');
const downloadManager = require('./downloadManager');

exports.initIpcHandlers = (mainWindow) => {
  // 解析视频/番剧信息
  ipcMain.handle('parse-url', async (_, url, cookie) => {
    try {
      let result;
      if (url.includes('bangumi')) {
        const seasonId = url.match(/ss(\d+)/)[1];
        result = await parseBangumi(seasonId, cookie);
        result.type = 'bangumi';
      } else {
        const bvId = url.match(/BV(\w+)/)[1];
        result = await parseVideo(bvId, cookie);
        result.type = 'video';
      }
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 开始下载任务
  ipcMain.handle('start-download', async (_, task) => {
    try {
      // 获取播放地址
      const m3u8Url = await getPlayUrl(
        task.cid, 
        task.bvId, 
        task.quality === '1080P' ? 80 : 64, 
        task.cookie
      );

      // 添加到下载队列
      downloadManager.addTask({
        url: m3u8Url,
        savePath: global.sharedState.store.get('downloadPath'),
        title: task.title,
        cookie: task.cookie
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 监听下载进度，转发给渲染进程
  downloadManager.on('progress', (data) => {
    mainWindow.webContents.send('download-progress', data);
  });

  // 监听下载完成
  downloadManager.on('complete', (data) => {
    mainWindow.webContents.send('download-complete', data);
  });
};