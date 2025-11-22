const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');
const { get } = require('../../coreServices/networkService');
const { parseM3u8 } = require('../../coreServices/parserService');
const { mergeTsToMp4 } = require('../../coreServices/mediaService');
const securityService = require('../../coreServices/securityService');
const storageService = require('../../coreServices/storageService');

class SegmentDownloader extends EventEmitter {
  constructor(task) {
    super();
    this.task = task;
    this.abortController = new AbortController();
    // 临时文件夹: downloadPath/.temp_taskId
    this.tempDir = path.join(task.meta.savePath, `.temp_${task.id}`);
    this.outputFile = path.join(task.meta.savePath, `${task.title}.mp4`);
  }

  async start() {
    fs.ensureDirSync(this.tempDir);
    
    // 1. 获取/解析 M3U8
    // 注意：实际开发中，task.meta.url 可能已经是 m3u8 地址，也可能是需要通过 API 获取 M3U8 的地址
    // 这里假设 task.meta.m3u8Url 已经存在，如果不存在需要调用 linkParser 获取
    let m3u8Url = this.task.meta.m3u8Url;
    
    if (!m3u8Url && this.task.meta.cid && this.task.meta.bvid) {
        // 如果只有 ID，需要重新获取播放地址 (模拟)
        // const playInfo = await ...
        // m3u8Url = ...
        throw new Error("M3U8 URL is missing, please implement getPlayUrl logic");
    }

    console.log(`Start downloading: ${this.task.title}`);
    
    // 下载 M3U8 内容
    const headers = securityService.getHeaders(m3u8Url);
    const m3u8Res = await get(m3u8Url, { headers });
    const { segments } = parseM3u8(m3u8Res.data);
    
    if (!segments || segments.length === 0) {
      throw new Error('No segments found in M3U8');
    }

    // 2. 检查已下载的分片 (断点续传)
    // 简单策略：检查文件是否存在且大小 > 0
    const todoSegments = segments.map((seg, index) => ({
      index,
      url: seg.uri.startsWith('http') ? seg.uri : new URL(seg.uri, m3u8Url).href,
      localPath: path.join(this.tempDir, `${index}.ts`)
    })).filter(item => {
      if (fs.existsSync(item.localPath) && fs.statSync(item.localPath).size > 0) {
        return false; // 已存在，跳过
      }
      return true;
    });

    const totalSegments = segments.length;
    let downloadedCount = totalSegments - todoSegments.length;
    this.emit('progress', Math.floor((downloadedCount / totalSegments) * 95)); // 下载占 95% 进度

    // 3. 并发下载队列
    const concurrency = storageService.config.get('download.concurrency') || 3;
    
    // 分批处理
    for (let i = 0; i < todoSegments.length; i += concurrency) {
      if (this.abortController.signal.aborted) throw new Error('Task paused or cancelled');

      const batch = todoSegments.slice(i, i + concurrency);
      await Promise.all(batch.map(async (seg) => {
        await this.downloadSegment(seg.url, seg.localPath);
        downloadedCount++;
        // 更新进度
        const percent = Math.floor((downloadedCount / totalSegments) * 95);
        this.emit('progress', percent);
      }));
    }

    // 4. 生成文件列表并合并
    const concatFilePath = path.join(this.tempDir, 'files.txt');
    const fileListContent = segments.map((_, i) => `file '${i}.ts'`).join('\n');
    fs.writeFileSync(concatFilePath, fileListContent);

    this.emit('progress', 96); // 开始合并

    await mergeTsToMp4(this.tempDir, this.outputFile, (val) => {
        // mergeTsToMp4 回调的是 0-100，我们需要映射到 96-100
        // 这里简单处理，直接完成
    });

    // 5. 清理
    fs.removeSync(this.tempDir);
    this.emit('progress', 100);
  }

  async downloadSegment(url, destPath) {
    const headers = securityService.getHeaders(url);
    const response = await get(url, { 
      headers, 
      responseType: 'stream',
      signal: this.abortController.signal
    });
    
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  pause() {
    this.abortController.abort();
  }
}

module.exports = SegmentDownloader;