const axios = require('axios');
const { parse } = require('m3u8-parser');

// B站API基础配置
const BILI_BASE_URL = 'https://api.bilibili.com';
const PGC_BASE_URL = 'https://api.bilibili.com/pgc/view/app';

// 解析普通视频（BV号）
async function parseVideo(bvId, cookie) {
  try {
    const res = await axios.get(`${BILI_BASE_URL}/x/web-interface/view`, {
      params: { bv_id: bvId },
      headers: { Cookie: cookie }
    });
    const data = res.data.data;
    return {
      title: data.title,
      cover: data.pic,
      pages: data.pages.map(page => ({
        cid: page.cid,
        title: page.part,
        duration: page.duration
      })),
      isVip: data.rights.is_vip !== 0
    };
  } catch (err) {
    throw new Error(`视频解析失败: ${err.message}`);
  }
}

// 解析番剧（seasonId）
async function parseBangumi(seasonId, cookie) {
  try {
    const res = await axios.get(`${PGC_BASE_URL}/season`, {
      params: { season_id: seasonId },
      headers: { Cookie: cookie }
    });
    const data = res.data.result;
    return {
      title: data.title,
      cover: data.cover,
      episodes: data.episodes.map(ep => ({
        episodeId: ep.id,
        title: ep.title,
        duration: ep.duration
      })),
      isVip: data.is_vip === 1
    };
  } catch (err) {
    throw new Error(`番剧解析失败: ${err.message}`);
  }
}

// 获取视频播放地址（m3u8）
async function getPlayUrl(cid, bvId, quality = 80, cookie) {
  try {
    const res = await axios.get('https://api.bilibili.com/x/player/playurl', {
      params: {
        bv_id: bvId,
        cid: cid,
        qn: quality, // 80=1080P, 64=720P
        fnval: 4048
      },
      headers: { Cookie: cookie }
    });
    const m3u8Url = res.data.data.dash.video[0].baseUrl;
    return m3u8Url;
  } catch (err) {
    throw new Error(`获取播放地址失败: ${err.message}`);
  }
}

module.exports = { parseVideo, parseBangumi, getPlayUrl };