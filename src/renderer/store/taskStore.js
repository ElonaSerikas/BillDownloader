import { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';

// 创建一个简单的事件总线风格的 Store
// 在实际项目中推荐使用 zustand 或 redux
const listeners = new Set();
let state = {
  tasks: []
};

const setState = (newState) => {
  state = { ...state, ...newState };
  listeners.forEach(listener => listener(state));
};

// 接收主进程推送的任务更新
ipcRenderer.on('task:list-update', (_, tasks) => {
  setState({ tasks });
});

export const useTaskStore = () => {
  const [localState, setLocalState] = useState(state);

  useEffect(() => {
    listeners.add(setLocalState);
    return () => listeners.delete(setLocalState);
  }, []);

  const addTask = (task) => {
    // 乐观更新，随后主进程会推送最新状态
    setState({ tasks: [...state.tasks, task] });
  };

  // 辅助函数：获取最新任务列表（如果需要主动拉取）
  const refreshTasks = () => {
    ipcRenderer.invoke('task:get-all').then(tasks => {
      setState({ tasks });
    });
  };

  return {
    tasks: localState.tasks,
    addTask,
    refreshTasks
  };
};