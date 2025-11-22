// src/renderer/pages/VideoDownloadPage.jsx
import React, { useState } from 'react';
import { 
  TextField, Button, Tabs, Tab, ProgressBar, 
  Card, CardContent, Stack, Text 
} from '@fluentui/react';
import { ipcRenderer } from 'electron';
import { useTaskStore } from '../store/taskStore'; // 任务状态管理

const VideoDownloadPage = () => {
  const [url, setUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const { tasks, addTask } = useTaskStore();

  // 解析URL
  const handleParse = async () => {
    if (!url) return;
    setParsing(true);
    try {
      const info = await ipcRenderer.invoke('parse-video-url', url);
      setVideoInfo(info);
    } catch (err) {
      alert(`解析失败：${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  // 添加下载任务
  const handleDownload = (episode) => {
    addTask({
      id: Date.now().toString(),
      title: `${videoInfo.title} - ${episode.name}`,
      type: 'video',
      status: 'pending',
      progress: 0,
      episodeId: episode.id,
      m3u8Url: episode.m3u8Url
    });
    ipcRenderer.send('start-video-download', {
      taskId: Date.now().toString(),
      m3u8Url: episode.m3u8Url,
      savePath: `./downloads/${videoInfo.title}`
    });
  };

  return (
    <Stack gap={2} style={{ padding: 20 }}>
      {/* URL输入区 */}
      <Stack horizontal gap={2}>
        <TextField
          placeholder="输入B站视频/BV号/番剧URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flexGrow: 1 }}
        />
        <Button 
          onClick={handleParse} 
          disabled={parsing}
          text={parsing ? "解析中..." : "解析"}
        />
      </Stack>

      {/* 视频信息与选集 */}
      {videoInfo && (
        <Card>
          <CardContent>
            <Text variant="xLarge">{videoInfo.title}</Text>
            <Tabs defaultSelectedKey="1">
              {videoInfo.episodes.map((ep, idx) => (
                <Tab 
                  key={ep.id} 
                  itemKey={ep.id} 
                  title={`第${idx+1}集：${ep.name}`}
                  onRenderTabContent={() => (
                    <Button 
                      onClick={() => handleDownload(ep)}
                      text="下载本集"
                    />
                  )}
                />
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 任务列表 */}
      <Text variant="large">下载任务</Text>
      {tasks.map(task => (
        <Card key={task.id}>
          <CardContent>
            <Text>{task.title}</Text>
            <ProgressBar value={task.progress} />
            <Text variant="small">
              {task.status === 'downloading' ? `进度：${task.progress}%` : task.status}
            </Text>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

export default VideoDownloadPage;