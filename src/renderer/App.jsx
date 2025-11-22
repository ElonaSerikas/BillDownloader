import React from 'react';
import { FluentProvider, themes, Stack, Nav, NavItem, Text } from '@fluentui/react';
import VideoDownload from './VideoDownload';

function App() {
  const [activeKey, setActiveKey] = React.useState('video');

  return (
    <FluentProvider theme={themes.teamsLight}>
      <Stack horizontal styles={{ root: { height: '100vh' } }}>
        {/* 左侧导航栏（Fluent Design） */}
        <Nav 
          styles={{ root: { width: 200, padding: 10, backgroundColor: '#f3f2f1' } }}
          onLinkClick={(_, item) => setActiveKey(item.key)}
        >
          <NavItem key="video" name="视频/番剧下载" />
          <NavItem key="article" name="专栏爬取" />
          <NavItem key="live" name="直播录制" />
          <NavItem key="settings" name="设置" />
        </Nav>

        {/* 主内容区 */}
        <Stack styles={{ root: { flexGrow: 1, overflow: 'auto', padding: 20 } }}>
          <Text variant="xxLarge" styles={{ root: { marginBottom: 20 } }}>
            BiliDownloader
          </Text>
          {activeKey === 'video' && <VideoDownload />}
          {activeKey === 'article' && <Text>专栏爬取功能开发中...</Text>}
          {activeKey === 'live' && <Text>直播录制功能开发中...</Text>}
          {activeKey === 'settings' && <Text>设置界面开发中...</Text>}
        </Stack>
      </Stack>
    </FluentProvider>
  );
}

export default App;