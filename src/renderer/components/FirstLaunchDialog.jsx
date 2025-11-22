// src/renderer/components/FirstLaunchDialog.jsx（首次启动用户协议）
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox } from '@fluentui/react';
import { ipcRenderer } from 'electron';

const FirstLaunchDialog = ({ visible, onClose }) => {
  const [agreed, setAgreed] = useState(false);

  const handleConfirm = () => {
    ipcRenderer.send('accept-agreement'); // 通知主进程保存同意状态
    onClose();
  };

  return (
    <Dialog visible={visible} onDismiss={onClose}>
      <DialogTitle>用户协议与版权声明</DialogTitle>
      <DialogContent style={{ maxHeight: 400, overflow: 'auto' }}>
        <p>1. 本工具仅用于个人学习使用，不得用于商业用途或非法传播。</p>
        <p>2. 下载内容的版权归B站及原作者所有，请遵守相关法律法规。</p>
        <p>3. 请勿下载会员/付费内容，除非您已获得合法授权。</p>
        <Checkbox 
          label="我已阅读并同意上述条款" 
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={handleConfirm} 
          disabled={!agreed}
          text="同意并继续"
        />
      </DialogActions>
    </Dialog>
  );
};