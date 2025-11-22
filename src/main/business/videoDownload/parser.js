const { get } = require('../../coreServices/networkService');
const { parseJson } = require('../../coreServices/parserService');

const BILI_API = 'https://api.bilibili.com/x/web-interface/view';
const PGC_API = 'https://api.bilibili.com/pgc/view/app/season';

/**
 * 解析普通视频（BV号）
 * @param {string} bvId - BV号
 * @returns {Object} 视频信息（标题、分P、画质等）
 */
async function parseVideo(bvId) {
  const res = await get(BILI_API, { params: { bv_id: bvId } });
  if (res.data.code !== 0) throw new Error(`解析失败: ${res.data.message}`);
  
  const data = res.data.data;
  return {
    type: 'video',
    title: data.title,
    cover: data.pic,
    isVip: data.rights.is_vip === 1,
    pages: data.pages.map(page => ({
      cid: page.cid,
      title: page.part,
      duration: page.duration
    }))
  };
}

/**
 * 解析番剧（seasonId）
 * @param {string} seasonId - 番剧seasonId
 * @returns {Object} 番剧信息（标题、集数、权限等）
 */
async function parseBangumi(seasonId) {
  const res = await get(PGC_API, { params: { season_id: seasonId } });
  if (res.data.code !== 0) throw new Error(`解析失败: ${res.data.message}`);
  
  const data = res.data.result;
  return {
    type: 'bangumi',
    title: data.title,
    cover: data.cover,
    isVip: data.is_vip === 1,
    episodes: data.episodes.map(ep => ({
      episodeId: ep.id,
      title: ep.title,
      duration: ep.duration
    }))
  };
}

/**
 * 统一解析入口（自动识别类型）
 * @param {string} url - 视频URL
 * @returns {Object} 解析结果
 */
async function parseVideoUrl(url) {
  if (url.includes('bangumi')) {
    const seasonId = url.match(/ss(\d+)/)[1];
    return parseBangumi(seasonId);
  } else {
    const bvId = url.match(/BV(\w+)/)[1];
    return parseVideo(bvId);
  }
}

module.exports = { parseVideoUrl, parseVideo, parseBangumi };