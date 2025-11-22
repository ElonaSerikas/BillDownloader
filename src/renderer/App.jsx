// src/renderer/App.jsx
import React from 'react';
import { ThemeProvider, createTheme, Pivot, PivotItem } from '@fluentui/react';
import VideoDownloadForm from './components/VideoDownloadForm';
import ArticleDownloadForm from './components/ArticleDownloadForm'; // 引入新组件
import TaskList from './components/TaskList'; // 建议把任务列表单独抽离，或者暂时放在 VideoDownloadForm 下方

const myTheme = createTheme({
  palette: {
    themePrimary: '#0078d4',
    themeLighterAlt: '#eff6fc',
    themeLighter: '#deecf9',
    themeLight: '#c7e0f4',
    themeTertiary: '#71afe5',
    themeSecondary: '#2b88d8',
    themeDarkAlt: '#106ebe',
    themeDark: '#005a9e',
    themeDarker: '#004578',
    neutralLighterAlt: '#faf9f8',
    neutralLighter: '#f3f2f1',
    neutralLight: '#edebe9',
    neutralQuaternaryAlt: '#e1dfdd',
    neutralQuaternary: '#d0d0d0',
    neutralTertiaryAlt: '#c8c6c4',
    neutralTertiary: '#a19f9d',
    neutralSecondary: '#605e5c',
    neutralPrimaryAlt: '#3b3a39',
    neutralPrimary: '#323130',
    neutralDark: '#201f1e',
    black: '#000000',
    white: '#ffffff',
  }});

const App = () => {
  return (
    <ThemeProvider theme={myTheme}>
      <div style={{ height: '100vh', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>BiliDownloader</h2>
        
        {/* 顶部导航栏 */}
        <Pivot aria-label="功能切换">
          <PivotItem headerText="视频下载">
            <div style={{ marginTop: 20 }}>
              <VideoDownloadForm />
            </div>
          </PivotItem>
          
          <PivotItem headerText="专栏下载">
            <div style={{ marginTop: 20 }}>
              <ArticleDownloadForm />
            </div>
          </PivotItem>
          
          {/* 可以在这里添加 直播录制 等其他 Tab */}
        </Pivot>
        
        {/* 这里可以放一个全局的任务列表，或者集成在各个 Form 里 */}
      </div>
    </ThemeProvider>
  );
};

export default App;