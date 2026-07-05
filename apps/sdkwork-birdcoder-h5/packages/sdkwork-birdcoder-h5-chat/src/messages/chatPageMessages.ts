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
    description:
      'Mobile chat persists through the BirdCoder app SDK chat conversation API and Drive uploader.',
    loadingHistory: 'Loading chat history…',
    loadHistoryFailed: 'Failed to load chat history.',
    sendFailed: 'Failed to send message.',
    attach: 'Attach',
    uploading: 'Uploading…',
    inputPlaceholder: 'Message BirdCoder',
    send: 'Send',
    sending: 'Sending…',
  },
  'zh-Hans': {
    title: '聊天',
    description: '移动端聊天通过 BirdCoder 应用 SDK 会话 API 与 Drive 上传持久化。',
    loadingHistory: '正在加载聊天记录…',
    loadHistoryFailed: '加载聊天记录失败。',
    sendFailed: '发送消息失败。',
    attach: '附件',
    uploading: '上传中…',
    inputPlaceholder: '发送消息…',
    send: '发送',
    sending: '发送中…',
  },
  'zh-Hant': {
    title: '聊天',
    description: '行動端聊天透過 BirdCoder 應用 SDK 會話 API 與 Drive 上傳持久化。',
    loadingHistory: '正在載入聊天記錄…',
    loadHistoryFailed: '載入聊天記錄失敗。',
    sendFailed: '傳送訊息失敗。',
    attach: '附件',
    uploading: '上傳中…',
    inputPlaceholder: '傳送訊息…',
    send: '傳送',
    sending: '傳送中…',
  },
};

export function resolveChatPageMessages(language: BirdCoderLanguagePreference): ChatPageMessages {
  return CHAT_PAGE_MESSAGES[language] ?? CHAT_PAGE_MESSAGES.en;
}
