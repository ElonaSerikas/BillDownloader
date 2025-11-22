import React, { useState } from 'react';
import { TextField, Button, Stack, Text, ProgressIndicator } from '@fluentui/react';
import { parseVideoUrl, submitDownloadTask, onDownloadProgress } from '../ipc/ipcRenderer';

const VideoDownloadForm = () => {
  const [url, setUrl] = useState('');
  const [cookie, setCookie] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({});

  // 解析URL
  const handleParse = async () => {
    if (!url) return setError('请输入视频URL');
    setLoading(true);
    setError('');
    try {
      const result = await parseVideoUrl(url, cookie);
      if (result.success) {
        setVideoInfo(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(`解析失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 开始下载
  const handleDownload = async (item) => {
    setLoading(true);
    try {
      const task = {
        id: Date.now(),
        cid: item.cid || item.episodeId,
        bvId: url.match(/BV(\w+)/)[1],
        title: `${videoInfo.title}-${item.title}`,
        quality: '1080P',
        savePath: '默认路径', // 实际应从配置获取
        cookie
      };
      await submitDownloadTask(task);
      setProgress(prev => ({ ...prev, [task.id]: 0 }));
    } catch (err) {
      setError(`下载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 监听进度更新
  React.useEffect(() => {
    const cleanup = onDownloadProgress((data) => {
      setProgress(prev => ({ ...prev, [data.taskId]: data.progress }));
    });
    return cleanup;
  }, []);

  return (
    <Stack tokens={{ childrenGap: 16 }} styles={{ root: { padding: 20 } }}>
      <TextField
        label="视频/番剧URL"
        value={url}
        onChange={(_, val) => setUrl(val)}
        placeholder="示例: https://www.bilibili.com/video/BVxxxx 或 https://www.bilibili.com/bangumi/play/ssxxxx"
      />
      <TextField
        label="Cookie（会员内容必填）"
        value={cookie}
        onChange={(_, val) => setCookie(val)}
        placeholder="SESSDATA=xxx; bili_jct=xxx;"
        multiline
        rows={2}
      />
      <Button primary onClick={handleParse} disabled={loading}>
        {loading ? '解析中...' : '解析视频'}
      </Button>
      {error && <Text variant="error">{error}</Text>}

      {/* 解析结果展示 */}
      {videoInfo && (
        <Stack tokens={{ childrenGap: 12 }}>
          <Text variant="large">{videoInfo.title}</Text>
          <img src={videoInfo.cover} alt="封面" style={{ width: 200, borderRadius: 4 }} />
          {videoInfo.isVip && <Text variant="warning">提示: 该内容为会员专属</Text>}
          
          <Text>可下载内容:</Text>
          {(videoInfo.pages || videoInfo.episodes).map(item => (
            <Stack key={item.cid || item.episodeId} horizontal tokens={{ childrenGap: 10 }}>
              <Text>{item.title}</Text>
              <Button onClick={() => handleDownload(item)} disabled={loading}>
                下载
              </Button>
              {progress[item.cid || item.episodeId] !== undefined && (
                <ProgressIndicator
                  percentComplete={progress[item.cid || item.episodeId]}
                  label={`${progress[item.cid || item.episodeId]}%`}
                />
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default VideoDownloadForm;