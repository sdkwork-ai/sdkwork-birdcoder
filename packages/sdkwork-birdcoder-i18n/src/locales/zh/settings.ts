import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('settings', {
  "settings": {
    "general": "常规",
    "defaultOpenTarget": "默认打开目标",
    "defaultOpenTargetDesc": "默认在何处打开文件和文件夹",
    "agentEnvironment": "Agent 环境",
    "agentEnvironmentDesc": "选择 Agent 在 Windows 上的运行环境",
    "codeDevelopmentEngine": "代码开发引擎",
    "codeDevelopmentEngineDesc": "选择默认的代码开发引擎",
    "integratedTerminalShell": "集成终端 Shell",
    "integratedTerminalShellDesc": "选择在集成终端中打开哪个 Shell。",
    "language": "语言",
    "languageDesc": "应用界面语言",
    "threadDetails": "对话详情",
    "threadDetailsDesc": "选择在对话中显示多少命令输出",
    "requireCtrlEnter": "长提示词需要 ^ + Enter",
    "requireCtrlEnterDesc": "启用后，较长的提示词需要按 ^ + Enter 才能发送。",
    "followUpBehavior": "后续行为",
    "followUpBehaviorDesc": "在 Codex 运行时将后续任务排队，或引导当前运行。按 Ctrl+Shift+Enter 对单条消息执行相反操作。",
    "notifications": "通知",
    "turnCompletionNotification": "回合完成通知",
    "turnCompletionNotificationDesc": "设置 Codex 完成任务时的提醒",
    "enablePermissionNotifications": "启用权限通知",
    "enablePermissionNotificationsDesc": "需要权限时显示提醒"
  }
});
