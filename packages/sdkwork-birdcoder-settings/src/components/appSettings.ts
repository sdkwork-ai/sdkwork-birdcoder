export interface AppSettings {
  defaultOpenTarget: string;
  agentEnvironment: string;
  language: string;
  threadDetails: string;
  requireCtrlEnter: boolean;
  followUpBehavior: string;
  turnCompletionNotification: string;
  enablePermissionNotifications: boolean;
  theme: string;
  usePointerCursor: boolean;
  uiFontSize: string;
  codeFontSize: string;
  approvalPolicy: string;
  sandboxSettings: string;
  serverBaseUrl: string;
  codeSnippetStyle: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  minimap: boolean;
  gitAutoFetch: boolean;
  gitCommitMessageGeneration: boolean;
  gitDefaultBranch: string;
  envNodeVersion: string;
  envPackageManager: string;
  worktreeLocation: string;
  worktreeAutoCleanup: boolean;
  lightThemeName: string;
  lightAccent: string;
  lightBackground: string;
  lightForeground: string;
  lightUiFont: string;
  lightCodeFont: string;
  lightTranslucent: boolean;
  lightContrast: number;
  darkThemeName: string;
  darkAccent: string;
  darkBackground: string;
  darkForeground: string;
  darkUiFont: string;
  darkCodeFont: string;
  darkTranslucent: boolean;
  darkContrast: number;
  customInstructions: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultOpenTarget: 'VS Code',
  agentEnvironment: 'Windows native',
  language: 'Auto-detect',
  threadDetails: 'Steps with code commands',
  requireCtrlEnter: false,
  followUpBehavior: 'Queue',
  turnCompletionNotification: 'Only when app is unfocused',
  enablePermissionNotifications: true,
  theme: 'Dark',
  usePointerCursor: false,
  uiFontSize: '13',
  codeFontSize: '12',
  approvalPolicy: 'On request',
  sandboxSettings: 'Read only',
  serverBaseUrl: '',
  codeSnippetStyle: 'Auto',
  showLineNumbers: true,
  wordWrap: true,
  minimap: false,
  gitAutoFetch: true,
  gitCommitMessageGeneration: true,
  gitDefaultBranch: 'main',
  envNodeVersion: 'v20.x (LTS)',
  envPackageManager: 'pnpm',
  worktreeLocation: '../.worktrees',
  worktreeAutoCleanup: false,
  lightThemeName: 'Codex Light',
  lightAccent: '#0285FF',
  lightBackground: '#FFFFFF',
  lightForeground: '#0D0D0D',
  lightUiFont: '-apple-system, BlinkMacSystemFont',
  lightCodeFont: 'ui-monospace, SFMono-Regular',
  lightTranslucent: true,
  lightContrast: 45,
  darkThemeName: 'Codex Dark',
  darkAccent: '#339CFF',
  darkBackground: '#181818',
  darkForeground: '#FFFFFF',
  darkUiFont: '-apple-system, BlinkMacSystemFont',
  darkCodeFont: 'ui-monospace, SFMono-Regular',
  darkTranslucent: true,
  darkContrast: 60,
  customInstructions: '',
};
