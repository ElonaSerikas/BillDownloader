const fs = require('fs-extra');
const path = require('path');
const { get } = require('../../coreServices/networkService');
const { parseM3u8 } = require('../../coreServices/parserService');
const { mergeTsToMp4 } = require('../../coreServices/mediaService');
// const taskService = require('../../coreServices/taskService'); // 如果不需要直接反向调用，可移除

/**
 * 下载单个视频任务
 * @param {Object} task - 任务信息 { id, cid, bvId, title, quality, savePath, cookie, m3u8Url }
 * @param {Function} progressCallback - 进度回调 (progress) => void
 * @param {AbortSignal} [signal] - 用于取消/暂停的信号
 */
async function downloadVideoTask(task, progressCallback, signal) {
  const { title, savePath, cookie } = task;
  const tempDir = path.join(savePath, `.temp_${task.id}`);
  fs.ensureDirSync(tempDir);

  try {
    // 0. 检查是否已取消
    if (signal?.aborted) throw new Error('Aborted');

    // 1. 获取 m3u8 地址 (如果任务中没有预解析 m3u8Url，则需要在此处获取，这里假设任务启动前已解析或重新解析)
    // 为了稳健性，这里保留获取逻辑，如果 task.m3u8Url 为空则重新请求
    let m3u8Url = task.m3u8Url;
    if (!m3u8Url && task.bvId && task.cid) {
        // 注意：这里需要引入 linkParser 或者直接请求，为解耦建议在 TaskService 层保证 m3u8Url 存在
        // 这里仅做简单容错，实际建议由 Parser 保证
        const playUrlRes = await get('https://api.bilibili.com/x/player/playurl', {
            params: {
                bvid: task.bvId,
                cid: task.cid,
                qn: 80,
                fnval: 16 // dash=16, m3u8=4 (不同接口定义不同，此处假设获取m3u8)
            },
            headers: { Cookie: cookie },
            signal // 传递信号
        });
        m3u8Url = playUrlRes.data.data.durl[0].url;
    }

    if (!m3u8Url) throw new Error('无法获取视频播放地址');

    // 2. 解析 m3u8 分片
    const m3u8Res = await get(m3u8Url, { 
        headers: { Cookie: cookie, Referer: 'https://www.bilibili.com' },
        signal
    });
    
    const { segments } = parseM3u8(m3u8Res.data);
    if (segments.length === 0) throw new Error('未找到视频分片');

    // 3. 多线程下载分片
    // 检查断点续传：过滤掉本地已经存在且大小大于0的分片
    const todoSegments = segments.map((seg, idx) => ({
        idx,
        uri: seg.uri,
        localPath: path.join(tempDir, `${idx}.ts`)
    })).filter(seg => {
        return !(fs.existsSync(seg.localPath) && fs.statSync(seg.localPath).size > 0);
    });

    const totalSegments = segments.length;
    let completedCount = totalSegments - todoSegments.length;

    // 初始进度
    progressCallback?.(Math.floor((completedCount / totalSegments) * 95));

    const concurrency = 3; // 并发数
    for (let i = 0; i < todoSegments.length; i += concurrency) {
      // 循环检查信号
      if (signal?.aborted) throw new Error('Aborted');

      const batch = todoSegments.slice(i, i + concurrency);
      
      await Promise.all(batch.map(async (seg) => {
        if (signal?.aborted) return; // 批次内部检查

        const segUrl = seg.uri.startsWith('http') ? seg.uri : new URL(seg.uri, m3u8Url).href;
        
        // 请求分片流
        const res = await get(segUrl, { 
            responseType: 'stream',
            headers: { 
                Referer: 'https://www.bilibili.com',
                'User-Agent': 'Mozilla/5.0 ...' 
            },
            signal // 关键：传递 signal 给 axios
        });

        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(seg.localPath);
          res.data.pipe(writer);
          
          // 监听流的销毁，用于处理手动 abort
          signal?.addEventListener('abort', () => {
              writer.destroy();
              reject(new Error('Aborted'));
          });

          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        completedCount++;
        // 只计算到 95%，剩下 5% 给合并
        const progress = Math.floor((completedCount / totalSegments) * 95);
        progressCallback?.(progress);
      }));
    }

    // 4. 生成合并列表并合并
    if (signal?.aborted) throw new Error('Aborted');
    
    const concatList = segments.map((_, idx) => `file '${idx}.ts'`).join('\n');
    fs.writeFileSync(path.join(tempDir, 'concat.txt'), concatList);
    
    const outputPath = path.join(savePath, `${title.replace(/[\\/:*?"<>|]/g, '_')}.mp4`);
    
    // 合并过程通常由 ffmpeg 进程控制，如果需要支持暂停合并，需要 mediaService 支持 kill 进程
    // 这里简化处理，假设合并过程很快或不可暂停
    await mergeTsToMp4(tempDir, outputPath, (mergeProgress) => {
       // 95 + (mergeProgress * 0.05)
    });

    // 5. 清理临时文件
    fs.removeSync(tempDir);
    progressCallback?.(100);
    return { success: true, path: outputPath };

  } catch (err) {
    // 如果是 Abort 错误，不清理临时文件（以便续传），否则清理
    if (err.message !== 'Aborted' && err.code !== 'ERR_CANCELED') {
        // 只有出错才清理，暂停时不清理
        // fs.removeSync(tempDir); 
    }
    throw err; // 抛出供 TaskService 捕获处理状态
  }
}

module.exports = { downloadVideoTask };