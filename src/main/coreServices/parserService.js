const cheerio = require('cheerio');
const { Parser } = require('m3u8-parser');
const jsonpath = require('jsonpath');

/**
 * 解析HTML内容（用于专栏爬取）
 * @param {string} html - HTML字符串
 * @returns {Object} 解析后的内容（标题、正文、图片）
 */
function parseHtml(html) {
  const $ = cheerio.load(html);
  // 移除广告和无关元素
  $('.ad-wrap, .related-recommends').remove();
  
  return {
    title: $('h1.title').text().trim(),
    content: $('.article-holder').html(), // 保留HTML结构
    images: Array.from($('.img-box img')).map(img => $(img).attr('src'))
  };
}

/**
 * 解析m3u8视频流
 * @param {string} m3u8Content - m3u8文本内容
 * @returns {Object} 分片信息和画质
 */
function parseM3u8(m3u8Content) {
  const parser = new Parser();
  parser.push(m3u8Content);
  parser.end();
  const { segments, playlists } = parser.manifest;
  
  return {
    segments: segments.map(seg => ({
      uri: seg.uri,
      duration: seg.duration
    })),
    qualities: playlists?.map(pl => ({
      name: pl.attributes.NAME,
      uri: pl.uri,
      bandwidth: pl.attributes.BANDWIDTH
    })) || []
  };
}

/**
 * 从JSON中提取指定路径数据
 * @param {Object} json - 源JSON
 * @param {string} path - jsonpath表达式
 * @returns {any} 提取的结果
 */
function parseJson(json, path) {
  return jsonpath.query(json, path);
}

module.exports = { parseHtml, parseM3u8, parseJson };