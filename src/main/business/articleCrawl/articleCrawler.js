// src/main/business/articleCrawl/articleCrawler.js
const fs = require('fs-extra');
const path = require('path');
const { get } = require('../../coreServices/networkService');
const { parseHtml } = require('../../coreServices/parserService');

/**
 * 下载 B站专栏 并保存为 Markdown
 * @param {Object} task - 任务对象
 * @param {Function} onProgress - 进度回调
 */
async function downloadArticle(task, onProgress) {
  const { url, savePath } = task.meta;
  
  // 1. 提取 CV 号 (支持 https://www.bilibili.com/read/cv123456)
  const cvMatch = url.match(/cv(\d+)/);
  if (!cvMatch) throw new Error('无效的专栏 URL，需包含 cv 号');
  const cvId = cvMatch[1];

  onProgress(10); // 开始请求

  // 2. 获取 HTML
  // 注意：专栏 API 也可以用 https://api.bilibili.com/x/article/view?id={cvId} 获取结构化数据
  // 这里沿用您 parserService 中基于 HTML 解析的设计
  const res = await get(url);
  onProgress(40); // 获取完成

  // 3. 解析内容
  const { title, content, images } = parseHtml(res.data);
  onProgress(60); // 解析完成

  // 4. 构建 Markdown 内容
  let markdown = `# ${title}\n\n`;
  markdown += `> 原文链接: ${url}\n\n`;
  
  // 简单处理：将 HTML img 标签替换为 Markdown 图片语法
  // 实际项目中可以使用 'turndown' 库进行更完美的转换
  let processedContent = content
    .replace(/<img.*?src="(.*?)".*?>/g, '![]($1)\n') // 替换图片
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n') // 替换段落
    .replace(/<br>/g, '\n'); // 替换换行
    // 去除其他 HTML 标签 (简单的正则，生产环境建议用库)
  processedContent = processedContent.replace(/<[^>]+>/g, '');

  markdown += processedContent;

  // 5. 保存文件
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
  const outputDir = path.join(savePath, 'Articles');
  fs.ensureDirSync(outputDir);
  
  const outputPath = path.join(outputDir, `${safeTitle}.md`);
  fs.writeFileSync(outputPath, markdown, 'utf8');

  onProgress(100);
  return outputPath;
}

module.exports = { downloadArticle };