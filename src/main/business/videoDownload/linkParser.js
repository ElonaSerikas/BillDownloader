// src/main/business/videoDownload/linkParser.js
const { request } = require('../../coreServices/networkService');
const { parseM3u8 } = require('../../coreServices/parserService');

class LinkParser {
  /**
   * 解析视频URL，返回元数据
   * @param {string} url - 视频URL（BV号/番剧season_id）
   * @returns {Promise<{title: string, episodes: Array<{id: string, name: string, m3u8Url: string}>}>}
   */
  async parse(url) {
    // 提取URL中的标识（BV号/season_id）
    const bvMatch = url.match(/BV([\w\d]+)/);
    const seasonMatch = url.match(/ss(\d+)/);

    if (bvMatch) {
      return this.parseNormalVideo(bvMatch[1]); // 普通视频解析
    } else if (seasonMatch) {
      return this.parseBangumi(seasonMatch[1]); // 番剧解析
    } else {
      throw new Error('不支持的URL格式');
    }
  }

  // 解析普通视频
  async parseNormalVideo(bvId) {
    const res = await request({
      url: '/x/web-interface/view',
      params: { bvid: bvId }
    });
    if (res.code !== 0) throw new Error(res.message);
    
    const { title, pages } = res.data;
    return {
      title,
      episodes: pages.map(page => ({
        id: page.cid.toString(),
        name: page.part,
        m3u8Url: await this.getM3u8Url(bvId, page.cid) // 获取播放地址
      }))
    };
  }

  // 解析番剧
  async parseBangumi(seasonId) {
    const res = await request({
      url: '/pgc/view/app/season',
      params: { season_id: seasonId }
    });
    if (res.code !== 0) throw new Error(res.message);
    
    const { title, sections } = res.result;
    const episodes = [];
    sections.forEach(section => {
      section.episodes.forEach(ep => {
        episodes.push({
          id: ep.id.toString(),
          name: ep.title,
          m3u8Url: await this.getBangumiM3u8Url(ep.id) // 番剧播放地址
        });
      });
    });
    return { title, episodes };
  }

  // 获取视频m3u8地址（需处理签名）
  async getM3u8Url(bvId, cid) {
    const res = await request({
      url: '/x/player/playurl',
      params: { bvid: bvId, cid, fnval: 16 } // fnval=16表示请求m3u8格式
    });
    return res.data.durl[0].url;
  }
}

module.exports = new LinkParser();