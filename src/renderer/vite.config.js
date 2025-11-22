import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite 配置文件用于打包渲染进程 (React)
export default defineConfig({
  plugins: [react()],
  base: './', // 确保生产环境的相对路径正确
  // [注意] 将项目根目录设置为 BiliDownloader 文件夹
  root: path.resolve(__dirname), 
  server: {
    port: 5173, // 确保与 main.js 中加载的 URL 端口一致
  },
  build: {
    // 输出到项目根目录的 dist 文件夹
    outDir: path.resolve(__dirname, '../../dist'), 
    emptyOutDir: true,
  },
  resolve: {
    alias: {
        // 确保 Node.js 模块在渲染进程不被打包 (仅用于 Electron API)
        'electron': path.resolve(__dirname, 'node_modules/electron')
    }
  }
});