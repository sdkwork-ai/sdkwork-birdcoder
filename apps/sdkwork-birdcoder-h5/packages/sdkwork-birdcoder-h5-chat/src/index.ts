export {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_ROLES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS,
  type BirdCoderChatMessageContentBlockType,
  type BirdCoderChatMessageRecord,
  type BirdCoderChatMessageReasoningItem,
  type BirdCoderChatMessageResource,
  type BirdCoderChatMessageResourceCitation,
  type BirdCoderChatMessageResourceKind,
  type BirdCoderChatMessageResourceOrigin,
  type BirdCoderChatMessageRole,
  type BirdCoderChatMessageToolCall,
  type BirdCoderChatMessageViewKind,
} from '@sdkwork/birdcoder-chat-contracts';

import { uuid } from '@sdkwork/utils/id';

export const H5_CHAT_VERSION = '0.1.0';

export function createChatMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  id?: string,
): import('@sdkwork/birdcoder-chat-contracts').BirdCoderChatMessageRecord {
  return {
    id: id ?? uuid(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export {
  BirdCoderSettingsProvider,
  BIRDCODER_H5_ENGINE_OPTIONS,
  BIRDCODER_H5_LANGUAGE_OPTIONS,
  BIRDCODER_H5_SETTINGS_DEFAULT,
  BIRDCODER_H5_THEME_OPTIONS,
  useBirdCoderSettings,
  type BirdCoderEnginePreference,
  type BirdCoderLanguagePreference,
  type BirdCoderSettingsAction,
  type BirdCoderSettingsContextValue,
  type BirdCoderSettingsProviderProps,
  type BirdCoderSettingsState,
  type BirdCoderThemePreference,
} from './state/settingsState.tsx';
