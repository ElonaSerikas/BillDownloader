// 文件位置: src/renderer/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeIcons } from '@fluentui/react';
import App from './App';

// 初始化 Fluent UI 图标
initializeIcons();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);