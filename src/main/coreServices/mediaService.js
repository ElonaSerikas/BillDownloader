const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const { promisify } = require('util');

// 配置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * 合并TS分片为MP4
 * @param {string} tempDir - 分片目录
 * @param {string} outputPath - 输出文件路径
 * @param {Function} progressCallback - 进度回调
 */
async function mergeTsToMp4(tempDir, outputPath, progressCallback) {
  const concatListPath = path.join(tempDir, 'concat.txt');
  
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0'])
      .output(outputPath)
      .outputOptions([
        '-c copy', // 快速合并（不重新编码）
        '-bsf:a aac_adtstoasc' // 修复音频流
      ])
      .on('progress', (progress) => {
        progressCallback?.(Math.floor(progress.percent));
      })
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`FFmpeg合并失败: ${err.message}`)))
      .run();
  });
}

/**
 * 转换视频格式
 * @param {string} inputPath - 输入文件
 * @param {string} outputPath - 输出文件（含格式）
 * @param {string} format - 目标格式（mp4/webm等）
 */
async function convertVideoFormat(inputPath, outputPath, format) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .format(format)
      .on('end', resolve)
      .on('error', (err) => reject(new Error(`格式转换失败: ${err.message}`)))
      .run();
  });
}

module.exports = { mergeTsToMp4, convertVideoFormat };