import { useState, useEffect, useCallback } from 'react';

// 创建一个简单的事件总线风格的 Store
const listeners = new Set();
let state = {
  tasks: []
};

const setState = (newState) => {
  state = { ...state, ...newState };
  listeners.forEach(listener => listener(state));
};

export const useTaskStore = () => {
  const [localState, setLocalState] = useState(state);

  useEffect(() => {
    listeners.add(setLocalState);
    return () => listeners.delete(setLocalState);
  }, []);
  
  // 用于接收后端全量更新
  const setTasks = useCallback((tasks) => {
      setState({ tasks });
  }, []);
  
  // 用于接收后端实时进度更新
  const updateTaskProgress = useCallback(({ taskId, progress }) => {
      setState({
          tasks: state.tasks.map(task => 
              task.id === taskId 
                  ? { ...task, progress: progress, status: progress === 100 ? 'completed' : task.status }
                  : task
          )
      });
  }, []);

  return {
    tasks: localState.tasks,
    setTasks,
    updateTaskProgress
  };
};