import type { BirdCoderLanguagePreference } from '../state/settingsState.tsx';

export interface ChatPageMessages {
  title: string;
  description: string;
  loadingHistory: string;
  loadHistoryFailed: string;
  sendFailed: string;
  attach: string;
  uploading: string;
  inputPlaceholder: string;
  send: string;
  sending: string;
}

const CHAT_PAGE_MESSAGES: Record<BirdCoderLanguagePreference, ChatPageMessages> = {
  en: {
    title: 'Chat',
    description: 'Continue your BirdCoder assistant session across devices.',
    loadingHistory: 'Loading chat history...',
    loadHistoryFailed: 'Failed to load chat history.',
    sendFailed: 'Failed to send message.',
    attach: 'Attach',
    uploading: 'Uploading...',
    inputPlaceholder: 'Message BirdCoder',
    send: 'Send',
    sending: 'Sending...',
  },
  'zh-Hans': {
    title: '对话',
    description: '在不同设备上继续使用 BirdCoder 助手会话。',
    loadingHistory: '正在加载对话记录...',
    loadHistoryFailed: '加载对话记录失败。',
    sendFailed: '发送消息失败。',
    attach: '附件',
    uploading: '正在上传...',
    inputPlaceholder: '给 BirdCoder 发送消息',
    send: '发送',
    sending: '正在发送...',
  },
  'zh-Hant': {
    title: '對話',
    description: '在不同裝置上繼續使用 BirdCoder 助手工作階段。',
    loadingHistory: '正在載入對話記錄...',
    loadHistoryFailed: '載入對話記錄失敗。',
    sendFailed: '傳送訊息失敗。',
    attach: '附件',
    uploading: '正在上傳...',
    inputPlaceholder: '給 BirdCoder 傳送訊息',
    send: '傳送',
    sending: '正在傳送...',
  },
};

export function resolveChatPageMessages(language: BirdCoderLanguagePreference): ChatPageMessages {
  return CHAT_PAGE_MESSAGES[language] ?? CHAT_PAGE_MESSAGES.en;
}
