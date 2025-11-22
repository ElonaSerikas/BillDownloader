const { session } = require('electron');
const Store = require('electron-store');
const store = new Store();

// 简单的 Cookie 管理，实际可能需要解析 Cookie 字符串
class SecurityService {
  constructor() {
    this.currentUserAgent = store.get('network.userAgent');
    this.cookieCache = store.get('user.cookie') || '';
  }

  setCookie(cookieStr) {
    this.cookieCache = cookieStr;
    store.set('user.cookie', cookieStr);
  }

  getCookie() {
    return this.cookieCache;
  }

  /**
   * 获取请求头，包含防盗链和仿真 UA
   * @param {string} url - 请求的 URL，用于判断 Referer
   */
  getHeaders(url) {
    const headers = {
      'User-Agent': this.currentUserAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Connection': 'keep-alive'
    };

    // B站防盗链 Referer 处理
    if (url) {
      if (url.includes('bilivideo.com') || url.includes('bilibili.com')) {
        headers['Referer'] = 'https://www.bilibili.com/';
        headers['Origin'] = 'https://www.bilibili.com';
      }
    }

    // 注入 Cookie
    if (this.cookieCache) {
      headers['Cookie'] = this.cookieCache;
    }

    return headers;
  }
  
  /**
   * 检查是否需要会员 (简单的逻辑判断)
   * @param {Object} videoData 
   */
  checkPrivilege(videoData) {
    // 逻辑：如果数据中标识了需要 VIP 且本地没有 VIP 标识的 Cookie，则返回 false
    // 此处仅为示例，实际需配合 API 返回的错误码判断
    return true; 
  }
}

module.exports = new SecurityService();