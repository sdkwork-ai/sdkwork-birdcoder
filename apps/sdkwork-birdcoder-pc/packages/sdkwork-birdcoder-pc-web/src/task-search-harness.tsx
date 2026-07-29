import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import '@sdkwork/birdcoder-pc-shell/styles';
import { TaskSearchDialog } from '../../sdkwork-birdcoder-pc-code/src/components/TaskSearchDialog.tsx';

const taskSeeds = [
  ['review', '全面审查应用实现质量', 'streaming'],
  ['composer', '调整输入框加号面板', 'initializing'],
  ['publish', '完善应用发布体系', 'initializing'],
  ['provider', '修复上游服务商列表报错', 'initializing'],
  ['models', '修复模型厂商和表头样式', 'unknown'],
  ['chat', '对齐多Provider对话显示', 'initializing'],
  ['messages', '优化消息列表渲染体验', 'unknown'],
  ['agents', 'Fix agents migration drift', 'unknown'],
  ['desktop', 'http://ipc.localhost/desktop_runtime_config failed', 'unknown'],
] as const;

const sessions = taskSeeds.map(([id, title, runtimeStatus], index) => ({
  agentId: 'agent.codex',
  createdAt: `2026-07-28T${String(20 - index).padStart(2, '0')}:00:00.000Z`,
  displayTime: 'now',
  engineId: index === 3 ? 'claude-code' : 'codex',
  hostMode: 'desktop',
  id,
  items: [],
  modelId: index === 3 ? 'claude-sonnet-4-5' : 'gpt-5-codex',
  projectId: index === 3 || index === 4 ? 'project-clawrouter' : 'project-birdcoder',
  providerId: index === 3 ? 'anthropic' : 'openai',
  runtimeStatus,
  status: 'active',
  title,
  updatedAt: `2026-07-28T${String(20 - index).padStart(2, '0')}:00:00.000Z`,
})) as AgentSessionView[];

const projects = [
  {
    projectId: 'project-birdcoder',
    name: 'sdkwork-birdcoder',
    agentSessions: sessions.filter((session) => session.projectId === 'project-birdcoder'),
  },
  {
    projectId: 'project-clawrouter',
    name: 'sdkwork-clawrouter',
    agentSessions: sessions.filter((session) => session.projectId === 'project-clawrouter'),
  },
] as AgentProjectView[];

const harnessThemeTokens = {
  dark: {
    '--sdk-color-border-default': 'rgba(255, 255, 255, 0.14)',
    '--sdk-color-surface-canvas': '#181818',
    '--sdk-color-surface-elevated': '#2d2d2d',
    '--sdk-color-surface-field-hover': '#333333',
    '--sdk-color-surface-panel-muted': '#262626',
    '--sdk-color-text-muted': '#8c8c8c',
    '--sdk-color-text-primary': '#ffffff',
    '--sdk-color-text-secondary': '#b8b8b8',
  },
  light: {
    '--sdk-color-border-default': 'rgba(13, 13, 13, 0.10)',
    '--sdk-color-surface-canvas': '#ffffff',
    '--sdk-color-surface-elevated': '#ffffff',
    '--sdk-color-surface-field-hover': '#fafafa',
    '--sdk-color-surface-panel-muted': '#f7f7f8',
    '--sdk-color-text-muted': '#737373',
    '--sdk-color-text-primary': '#0d0d0d',
    '--sdk-color-text-secondary': '#525252',
  },
} as const;

function Harness() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const colorMode = new URLSearchParams(window.location.search).get('theme') === 'light'
    ? 'light'
    : 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-sdk-color-mode', colorMode);
    root.style.colorScheme = colorMode;
    Object.entries(harnessThemeTokens[colorMode]).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
  }, [colorMode]);

  return (
    <main className="min-h-screen bg-[var(--sdk-color-surface-canvas)] text-[var(--sdk-color-text-primary)]">
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)}>
        打开任务搜索
      </button>
      <output aria-label="已选任务">{selectedTaskId}</output>
      {isOpen ? <TaskSearchDialog
        canCreateTask
        canSearchFiles
        labels={{
          clearSearch: '清除任务搜索',
          newTask: '新建任务',
          noTasksFound: '未找到任务',
          openFolder: '打开文件夹',
          recommendations: '推荐',
          searchFiles: '搜索文件',
          searchPlaceholder: '搜索任务',
          selectProjectFirst: '请先选择项目',
          tasks: '任务',
        }}
        projects={projects}
        query={query}
        returnFocusElement={triggerRef.current}
        runtimeStatusLabels={{
          awaitingApproval: '等待审批',
          awaitingTool: '等待工具',
          awaitingUser: '等待用户',
          executing: '执行中',
          failed: '失败',
          initializing: '初始化中',
          stale: '已过期',
          unknown: '未知',
        }}
        selectedProjectId="project-birdcoder"
        selectedSessionId="review"
        onClose={() => setIsOpen(false)}
        onCreateTask={() => undefined}
        onOpenFolder={() => undefined}
        onQueryChange={setQuery}
        onSearchFiles={() => undefined}
        onSelectTask={(entry) => setSelectedTaskId(entry.session.id)}
      /> : null}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
