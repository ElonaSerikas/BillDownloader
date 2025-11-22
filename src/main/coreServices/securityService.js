// src/main/coreServices/securityService.js

const storageService = require('./storageService'); // [修改] 依赖 storageService

// [新增] 状态和初始化函数
const state = {
  currentUserAgent: '',
  cookieCache: ''
};

/**
 * 初始化安全服务，从存储中加载配置。
 */
function init() {
  // 从 storageService 加载配置，因为 storageService.initStore() 已在 main.js 中调用
  state.currentUserAgent = storageService.config.get('network.userAgent');
  state.cookieCache = storageService.config.get('user.cookie') || '';
}

/**
 * 设置 B站用户的 Cookie
 * @param {string} cookieStr - 完整的 Cookie 字符串
 */
function setCookie(cookieStr) {
  state.cookieCache = cookieStr;
  storageService.config.set('user.cookie', cookieStr); // 保存到 storageService
}

/**
 * 获取 B站用户的 Cookie
 * @returns {string}
 */
function getCookie() {
  return state.cookieCache;
}

/**
 * 获取请求头，包含仿真 UA 和 Referer
 * @param {string} url - 请求的 URL，用于判断 Referer
 * @returns {Object}
 */
function getHeaders(url) {
  const headers = {
    'User-Agent': state.currentUserAgent,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Connection': 'keep-alive'
  };

  // 简单的 Referer 策略：所有请求都伪装来自 bilibili 首页
  headers['Referer'] = 'https://www.bilibili.com/';

  // 注入 Cookie
  if (state.cookieCache) {
    headers['Cookie'] = state.cookieCache;
  }

  return headers;
}

/**
 * 检查内容权限（占位符）
 * @param {Object} videoData 
 */
function checkPrivilege(videoData) {
  // 实际逻辑会更复杂，这里仅作占位
  if (videoData.isVip) {
    console.log('该内容是会员专属，请确保Cookie有效。');
  }
  return true; 
}


module.exports = {
  init, // 关键：导出初始化函数
  setCookie,
  getCookie,
  getHeaders,
  checkPrivilege
};