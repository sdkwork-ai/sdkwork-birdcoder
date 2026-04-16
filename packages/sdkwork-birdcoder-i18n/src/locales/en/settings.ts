import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('settings', {
  "settings": {
    "general": "General",
    "defaultOpenTarget": "Default Open Target",
    "defaultOpenTargetDesc": "Where to open files and folders by default",
    "agentEnvironment": "Agent environment",
    "agentEnvironmentDesc": "Choose where the agent runs on Windows",
    "codeDevelopmentEngine": "Code Development Engine",
    "codeDevelopmentEngineDesc": "Choose the default engine for code development",
    "integratedTerminalShell": "Integrated terminal shell",
    "integratedTerminalShellDesc": "Choose which shell opens in the integrated terminal.",
    "language": "Language",
    "languageDesc": "App UI language",
    "threadDetails": "Session Details",
    "threadDetailsDesc": "Choose how much command output is shown in sessions",
    "requireCtrlEnter": "Require ^ + Enter for long prompts",
    "requireCtrlEnterDesc": "When enabled, long prompts require ^ + Enter to send.",
    "followUpBehavior": "Follow-up behavior",
    "followUpBehaviorDesc": "Queue follow-up tasks while Codex is running, or guide the current run. Press Ctrl+Shift+Enter to do the opposite for a single message.",
    "notifications": "Notifications",
    "turnCompletionNotification": "Turn completion notification",
    "turnCompletionNotificationDesc": "Set alerts for when Codex finishes a task",
    "enablePermissionNotifications": "Enable permission notifications",
    "enablePermissionNotificationsDesc": "Show alerts when permissions are needed"
  }
});
