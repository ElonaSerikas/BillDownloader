import React, { useState } from 'react';
import { 
  TextField, Button, Card, CardContent, 
  Dropdown, SelectItem, Label, Checkbox,
  ProgressIndicator, Text, Stack, Separator
} from '@fluentui/react';
import { ipcRenderer } from 'electron';

const VideoDownload = () => {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState({});
  const [cookie, setCookie] = useState(''); // 用户输入的Cookie（用于会员内容）

  // 解析URL
  const handleParse = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const result = await ipcRenderer.invoke('parse-url', url, cookie);
      if (result.success) {
        setVideoInfo(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 开始下载
  const handleDownload = async (cid, bvId, title) => {
    setLoading(true);
    try {
      await ipcRenderer.invoke('start-download', {
        cid,
        bvId: url.match(/BV(\w+)/)[1],
        title,
        quality: '1080P',
        cookie
      });
      setDownloadProgress(prev => ({ ...prev, [title]: 0 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 监听下载进度
  React.useEffect(() => {
    ipcRenderer.on('download-progress', (_, data) => {
      setDownloadProgress(prev => ({ ...prev, [data.title]: data.progress }));
    });

    ipcRenderer.on('download-complete', (_, data) => {
      setDownloadProgress(prev => ({ ...prev, [data.title]: 100 }));
    });

    return () => {
      ipcRenderer.removeAllListeners('download-progress');
      ipcRenderer.removeAllListeners('download-complete');
    };
  }, []);

  return (
    <Stack tokens={{ childrenGap: 20 }} styles={{ root: { padding: 20 } }}>
      <Text variant="xLarge" styles={{ root: { marginBottom: 10 } }}>
        视频/番剧下载
      </Text>

      {/* URL输入区 */}
      <Stack tokens={{ childrenGap: 10 }}>
        <TextField
          label="B站视频/番剧URL"
          value={url}
          onChange={(_, newValue) => setUrl(newValue)}
          placeholder="例如：https://www.bilibili.com/video/BVxxxx 或 https://www.bilibili.com/bangumi/play/ssxxxx"
        />
        <TextField
          label="Cookie（会员内容需填写）"
          value={cookie}
          onChange={(_, newValue) => setCookie(newValue)}
          placeholder="SESSDATA=xxx; bili_jct=xxx;"
          multiline
          rows={2}
        />
        <Button 
          primary 
          onClick={handleParse} 
          disabled={loading}
        >
          {loading ? '解析中...' : '解析视频'}
        </Button>
        {error && <Text variant="error">{error}</Text>}
      </Stack>

      {/* 视频信息区 */}
      {videoInfo && (
        <Card>
          <CardContent styles={{ root: { padding: 20 } }}>
            <Stack tokens={{ childrenGap: 15 }}>
              <Text variant="large">{videoInfo.title}</Text>
              <img 
                src={videoInfo.cover} 
                alt="封面" 
                style={{ width: 200, height: 'auto', borderRadius: 4 }}
              />
              {videoInfo.isVip && (
                <Text variant="warning">提示：该内容为会员专属，请确保已登录对应账号</Text>
              )}
              
              <Separator />
              <Text>可下载内容：</Text>
              
              {/* 分P/集数列表 */}
              {videoInfo.pages ? (
                videoInfo.pages.map(page => (
                  <Stack key={page.cid} horizontal tokens={{ childrenGap: 10 }}>
                    <Text>{page.title}</Text>
                    <Button 
                      onClick={() => handleDownload(page.cid, null, `${videoInfo.title}-${page.title}`)}
                      disabled={loading}
                    >
                      下载
                    </Button>
                    {downloadProgress[`${videoInfo.title}-${page.title}`] !== undefined && (
                      <ProgressIndicator 
                        percentComplete={downloadProgress[`${videoInfo.title}-${page.title}`]} 
                        label={`${downloadProgress[`${videoInfo.title}-${page.title}`]}%`}
                      />
                    )}
                  </Stack>
                ))
              ) : (
                videoInfo.episodes.map(ep => (
                  <Stack key={ep.episodeId} horizontal tokens={{ childrenGap: 10 }}>
                    <Text>{ep.title}</Text>
                    <Button 
                      onClick={() => handleDownload(ep.episodeId, null, `${videoInfo.title}-${ep.title}`)}
                      disabled={loading}
                    >
                      下载
                    </Button>
                    {downloadProgress[`${videoInfo.title}-${ep.title}`] !== undefined && (
                      <ProgressIndicator 
                        percentComplete={downloadProgress[`${videoInfo.title}-${ep.title}`]} 
                        label={`${downloadProgress[`${videoInfo.title}-${ep.title}`]}%`}
                      />
                    )}
                  </Stack>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default VideoDownload;