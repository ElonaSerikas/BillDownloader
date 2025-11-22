// src/renderer/components/ArticleDownloadForm.jsx
import React, { useState } from 'react';
import { TextField, Button, Stack, Text } from '@fluentui/react';
import { submitDownloadTask } from '../ipc/ipcRenderer'; // 复用 ipc

const ArticleDownloadForm = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!url.includes('cv')) {
        alert('请输入包含 cv 号的专栏链接');
        return;
    }
    setLoading(true);
    try {
      await submitDownloadTask({
        id: Date.now().toString(),
        title: `专栏-${url.slice(-8)}`, // 临时标题
        url: url,
        type: 'article' // 告诉后端这是文章
      });
      setUrl('');
      alert('已添加到下载队列');
    } catch (err) {
      alert('添加失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 15 }} styles={{ root: { padding: 10 } }}>
      <Text variant="large">B站专栏/文章下载</Text>
      <TextField 
        label="专栏链接" 
        placeholder="例如: https://www.bilibili.com/read/cv123456"
        value={url}
        onChange={(_, val) => setUrl(val)}
      />
      <Button primary onClick={handleDownload} disabled={loading} text="添加到任务队列" />
    </Stack>
  );
};

export default ArticleDownloadForm;