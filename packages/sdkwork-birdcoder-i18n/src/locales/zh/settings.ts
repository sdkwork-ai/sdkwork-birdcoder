import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('settings', {
  settings: {
    general: '通用',
    defaultOpenTarget: '默认打开目标',
    defaultOpenTargetDesc: '默认使用何处打开文件和文件夹',
    agentEnvironment: 'Agent 环境',
    agentEnvironmentDesc: '选择 Agent 在 Windows 上的运行环境',
    codeDevelopmentEngine: '代码开发引擎',
    codeDevelopmentEngineDesc: '选择代码开发使用的默认引擎',
    defaultTerminalProfile: '默认终端配置',
    defaultTerminalProfileDesc: '选择集成终端默认使用的启动配置。',
    language: '语言',
    languageDesc: '应用界面语言',
    sessionDetails: '会话详情',
    sessionDetailsDesc: '选择在会话中显示多少命令输出',
    requireCtrlEnter: '长提示词需使用 Ctrl + Enter',
    requireCtrlEnterDesc: '启用后，长提示词需要使用 Ctrl + Enter 才能发送。',
    followUpBehavior: '后续行为',
    followUpBehaviorDesc:
      '当 Codex 正在运行时，将后续任务排队，或引导当前运行。按 Ctrl+Shift+Enter 可在单次消息中执行相反操作。',
    notifications: '通知',
    turnCompletionNotification: '回合完成通知',
    turnCompletionNotificationDesc: '设置 Codex 完成任务时的提醒方式',
    enablePermissionNotifications: '启用权限通知',
    enablePermissionNotificationsDesc: '当需要权限时显示提醒',
  },
});
