const axios = require('axios');
const Agent = require('agentkeepalive'); 
const { getHeaders, getCookie } = require('../coreServices/securityService');
const { getProxy } = require('../coreServices/storageService').config;

// 初始化长连接代理（复用TCP连接）
const keepaliveAgent = new Agent({
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000, // 60秒无活动关闭连接
  freeSocketTimeout: 30000 // 30秒空闲关闭
});

// 创建axios实例
const request = axios.create({
  timeout: 15000,
  httpAgent: keepaliveAgent,
  httpsAgent: keepaliveAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com'
  }
});

// 请求拦截器（添加Cookie和签名参数）
request.interceptors.request.use(config => {
  // 从安全服务获取Cookie
  const cookie = getCookie(config.url);
  if (cookie) config.headers.Cookie = cookie;
  
  // 针对B站API添加签名参数（示例）
  if (config.url.includes('api.bilibili.com')) {
    config.params = {
      ...config.params,
      ts: Date.now(),
      sign: 'dummy_sign' // 实际项目需实现签名算法
    };
  }
  return config;
});

// 响应拦截器（处理重试和加密数据）
request.interceptors.response.use(
  response => response,
  async error => {
    const { config } = error;
    // 重试逻辑（最多3次）
    if (!config._retryCount) config._retryCount = 0;
    if (config._retryCount < 3 && [500, 502, 503].includes(error.response?.status)) {
      config._retryCount++;
      return request(config);
    }
    return Promise.reject(error);
  }
);

module.exports = {
  get: request.get,
  post: request.post,
  setRetryLimit: (limit) => { /* 动态调整重试次数 */ }
};