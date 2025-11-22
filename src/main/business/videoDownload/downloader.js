const fs = require('fs-extra');
const path = require('path');
const { get } = require('../../coreServices/networkService');
const { parseM3u8 } = require('../../coreServices/parserService');
const { mergeTsToMp4 } = require('../../coreServices/mediaService');
const taskService = require('../../coreServices/taskService');

/**
 * 下载单个视频任务
 * @param {Object} task - 任务信息 { cid, bvId, title, quality, savePath }
 * @param {Function} progressCallback - 进度回调
 */
async function downloadVideoTask(task, progressCallback) {
  const { cid, bvId, title, quality, savePath, cookie } = task;
  const tempDir = path.join(savePath, `.temp_${title.replace(/[\/:*?"<>|]/g, '-')}`);
  fs.ensureDirSync(tempDir);

  try {
    // 1. 获取m3u8播放地址
    const playUrlRes = await get('https://api.bilibili.com/x/player/playurl', {
      params: {
        bv_id: bvId,
        cid: cid,
        qn: quality === '1080P' ? 80 : 64, // 画质对应编号
        fnval: 4048
      }
    });
    const m3u8Url = playUrlRes.data.data.dash.video[0].baseUrl;

    // 2. 解析m3u8分片
    const m3u8Res = await get(m3u8Url);
    const { segments } = parseM3u8(m3u8Res.data);
    if (segments.length === 0) throw new Error('未找到视频分片');

    // 3. 多线程下载分片
    const concurrency = 3; // 可从配置获取
    let completed = 0;
    
    for (let i = 0; i < segments.length; i += concurrency) {
      const batch = segments.slice(i, i + concurrency);
      await Promise.all(batch.map(async (seg, idx) => {
        const segUrl = seg.uri.startsWith('http') ? seg.uri : new URL(seg.uri, m3u8Url).href;
        const segPath = path.join(tempDir, `${i + idx}.ts`);
        
        const res = await get(segUrl, { responseType: 'stream' });
        await new Promise((resolve, reject) => {
          const stream = res.data.pipe(fs.createWriteStream(segPath));
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
      }));
      
      completed += batch.length;
      const progress = Math.floor((completed / segments.length) * 100);
      progressCallback?.(progress);
      taskService.updateTaskProgress(task.id, progress); // 同步到任务服务
    }

    // 4. 生成合并列表并合并
    const concatList = segments.map((_, idx) => `file '${idx}.ts'`).join('\n');
    fs.writeFileSync(path.join(tempDir, 'concat.txt'), concatList);
    
    const outputPath = path.join(savePath, `${title}.mp4`);
    await mergeTsToMp4(tempDir, outputPath, (mergeProgress) => {
      // 合并阶段进度（下载100% + 合并0-100%映射为100%）
      progressCallback?.(100);
    });

    // 5. 清理临时文件
    fs.removeSync(tempDir);
    return { success: true, path: outputPath };
  } catch (err) {
    fs.removeSync(tempDir); // 失败时清理
    throw new Error(`下载失败: ${err.message}`);
  }
}

module.exports = { downloadVideoTask };