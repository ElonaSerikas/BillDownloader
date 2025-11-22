// src/main/business/videoDownload/linkParser.js
const { get } = require('../../coreServices/networkService');

class LinkParser {
  /**
   * 解析视频URL，返回元数据
   * @param {string} url - 视频URL（BV号/番剧season_id）
   * @param {string} [cookie] - 用户 Cookie
   * @returns {Promise<{title: string, episodes: Array<{id: string, name: string, m3u8Url: string}>}>}
   */
  async parse(url, cookie = '') {
    // 提取URL中的标识（BV号/season_id）
    const bvMatch = url.match(/BV([\w\d]+)/);
    const seasonMatch = url.match(/ss(\d+)/);
    const epMatch = url.match(/ep(\d+)/);

    // 设置通用 Header
    this.headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Cookie': cookie
    };

    if (seasonMatch || epMatch) {
      // 简单的逻辑：如果是 ep，可能需要先查 season_id，这里简化默认为 ss 处理
      // 实际 B 站 URL 结构较复杂，建议优先匹配 ss
      const id = seasonMatch ? seasonMatch[1] : null; // 需完善 ep 转 season 逻辑
      if(id) return this.parseBangumi(id);
      throw new Error('暂只支持 ss开头的番剧链接');
    } else if (bvMatch) {
      return this.parseNormalVideo(bvMatch[1]);
    } else {
      throw new Error('不支持的URL格式，请使用 BV号 或 番剧Season ID');
    }
  }

  // 解析普通视频
  async parseNormalVideo(bvId) {
    const res = await get('https://api.bilibili.com/x/web-interface/view', {
      params: { bvid: bvId },
      headers: this.headers
    });
    
    if (res.data.code !== 0) throw new Error(res.data.message);
    
    const { title, pages, pic } = res.data.data;
    
    // 并发获取所有分P的播放地址（注意：B站API可能有速率限制，量大时需控制并发）
    const episodes = await Promise.all(pages.map(async (page) => ({
      id: page.cid.toString(),
      cid: page.cid, 
      bvId: bvId, // 保留原始ID方便重新请求
      name: page.part,
      // 暂不在此处获取 m3u8Url，为了加快解析速度，改为下载开始时获取，
      // 或者在此处仅获取第一个分P演示
      // m3u8Url: ... 
    })));

    return {
      type: 'video',
      title,
      cover: pic,
      episodes
    };
  }

  // 解析番剧
  async parseBangumi(seasonId) {
    const res = await get('https://api.bilibili.com/pgc/view/app/season', {
      params: { season_id: seasonId },
      headers: this.headers
    });

    if (res.data.code !== 0) throw new Error(res.data.message || '番剧解析失败');
    
    const { title, cover, episodes } = res.data.result;
    
    return {
      type: 'bangumi',
      title,
      cover,
      episodes: episodes.map(ep => ({
        id: ep.cid.toString(),
        cid: ep.cid,
        episodeId: ep.id, //Ep ID
        name: `第${ep.index}话 ${ep.index_title}`,
        // m3u8Url 同样建议延迟获取
      }))
    };
  }
}

module.exports = new LinkParser();