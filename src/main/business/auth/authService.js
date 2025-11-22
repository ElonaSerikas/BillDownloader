const axios = require('axios');
const securityService = require('../../coreServices/securityService');

const API = {
  QR_GENERATE: 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
  QR_POLL: 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll',
  NAV_INFO: 'https://api.bilibili.com/x/web-interface/nav'
};

class AuthService {
  constructor() {
    this.pollInterval = null;
  }

  /**
   * 获取登录二维码
   * @returns {Promise<{url: string, qrcode_key: string}>}
   */
  async getQRCode() {
    try {
      const res = await axios.get(API.QR_GENERATE);
      if (res.data.code === 0) {
        return res.data.data; // { url, qrcode_key }
      }
      throw new Error(res.data.message);
    } catch (error) {
      console.error('获取二维码失败:', error);
      throw error;
    }
  }

  /**
   * 轮询二维码扫描状态
   * @param {string} qrcode_key 
   * @returns {Promise<{status: number, message: string, cookie?: string}>}
   */
  async pollQRCode(qrcode_key) {
    try {
      const res = await axios.get(API.QR_POLL, {
        params: { qrcode_key }
      });
      
      const { code, message, url } = res.data.data;
      
      // code: 0 成功, 86101 未扫码, 86090 已扫码未确认, 86038 已过期
      if (code === 0) {
        // 登录成功，提取 Cookie
        const cookie = url.split('?')[1]; // 简单提取，实际可能需要更严谨的解析
        // 保存 Cookie
        securityService.setCookie(cookie);
        return { status: 0, message: '登录成功', cookie };
      }
      
      return { status: code, message };
    } catch (error) {
      return { status: -1, message: error.message };
    }
  }

  /**
   * 验证当前 Cookie 是否有效，并获取用户信息
   */
  async getUserInfo() {
    const cookie = securityService.getCookie();
    if (!cookie) return null;

    try {
      // 使用 axios 实例，可以利用 networkService 的配置，但这里直接用 axios 确保依赖清晰
      const res = await axios.get(API.NAV_INFO, {
        headers: { Cookie: cookie }
      });

      if (res.data.code === 0 && res.data.data.isLogin) {
        return res.data.data; // 返回用户信息
      }
      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 直接导入 Cookie
   */
  async importCookie(cookieStr) {
    // 简单的格式化，去除空格
    const formatted = cookieStr.replace(/\s+/g, '');
    securityService.setCookie(formatted);
    // 验证有效性
    return await this.getUserInfo();
  }

  logout() {
    securityService.setCookie('');
  }
}

module.exports = new AuthService();