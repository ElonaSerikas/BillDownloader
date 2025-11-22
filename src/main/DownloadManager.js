const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static'); // 自动获取FFmpeg路径
const { EventEmitter } = require('events');

// 配置FFmpeg路径（跨平台自动适配）
ffmpeg.setFfmpegPath(ffmpegPath);

class DownloadManager extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.running = false;
  }

  addTask(task) {
    this.queue.push(task);
    if (!this.running) this.processQueue();
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.running = false;
      return;
    }
    this.running = true;
    const task = this.queue.shift();
    await this.downloadTask(task);
    this.processQueue();
  }

  async downloadTask(task) {
    const { url, savePath, title, cookie } = task;
    const tempDir = path.join(savePath, `.temp_${title.replace(/[\/:*?"<>|]/g, '-')}`); // 处理特殊字符
    fs.ensureDirSync(tempDir);

    try {
      // 1. 解析m3u8分片
      const m3u8Res = await axios.get(url, { headers: { Cookie: cookie } });
      const parser = new (require('m3u8-parser').Parser)();
      parser.push(m3u8Res.data);
      parser.end();
      const segments = parser.manifest.segments;
      if (!segments.length) throw new Error('未找到视频分片');

      // 2. 多线程下载分片
      const concurrency = global.sharedState.store.get('concurrency');
      let completed = 0;
      for (let i = 0; i < segments.length; i += concurrency) {
        const batch = segments.slice(i, i + concurrency);
        await Promise.all(batch.map(async (seg, idx) => {
          const segUrl = seg.uri.startsWith('http') ? seg.uri : new URL(seg.uri, url).href;
          const segPath = path.join(tempDir, `${i + idx}.ts`);
          const res = await axios.get(segUrl, {
            responseType: 'stream',
            headers: { Cookie: cookie, Referer: 'https://www.bilibili.com' }
          });
          return new Promise((resolve, reject) => {
            const stream = res.data.pipe(fs.createWriteStream(segPath));
            stream.on('finish', resolve);
            stream.on('error', reject);
          });
        }));
        completed += batch.length;
        this.emit('progress', {
          title,
          progress: Math.floor((completed / segments.length) * 100)
        });
      }

      // 3. 合并分片为MP4（使用集成的FFmpeg）
      const outputPath = path.join(savePath, `${title.replace(/[\/:*?"<>|]/g, '-')}.mp4`);
      const concatListPath = path.join(tempDir, 'concat.txt');
      // 生成FFmpeg合并列表
      fs.writeFileSync(concatListPath, segments.map((_, idx) => `file '${idx}.ts'`).join('\n'));

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .output(outputPath)
          .outputOptions(['-c copy', '-bsf:a aac_adtstoasc']) // 快速合并（不重新编码）
          .on('end', resolve)
          .on('error', (err) => reject(new Error(`FFmpeg错误: ${err.message}`)))
          .run();
      });

      // 4. 清理临时文件
      fs.removeSync(tempDir);
      this.emit('complete', { title, path: outputPath });
    } catch (err) {
      this.emit('error', { title, error: err.message });
      fs.removeSync(tempDir);
    }
  }
}

module.exports = new DownloadManager();