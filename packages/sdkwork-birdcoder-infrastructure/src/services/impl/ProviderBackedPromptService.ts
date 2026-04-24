import type { BirdCoderCodingSessionPromptHistoryRepository } from '../../storage/codingSessionPromptEntryRepository.ts';
import type { BirdCoderSavedPromptEntryRepository } from '../../storage/savedPromptEntryRepository.ts';
import type {
  BirdCoderPromptEntry,
  IPromptService,
} from '../interfaces/IPromptService.ts';

const DEFAULT_PROMPT_LIMIT = 100;

function normalizePromptEntryTimestamp(lastTouchedAt: string, updatedAt: string): number {
  const timestamp = Date.parse(lastTouchedAt) || Date.parse(updatedAt) || 0;
  return timestamp > 0 ? timestamp : 0;
}

function toPromptEntry(
  record: Readonly<{
    promptText: string;
    updatedAt: string;
    useCount: number;
  }> &
    (
      | {
          lastSavedAt: string;
        }
      | {
          lastUsedAt: string;
        }
    ),
): BirdCoderPromptEntry {
  return {
    text: record.promptText,
    timestamp: normalizePromptEntryTimestamp(
      'lastSavedAt' in record ? record.lastSavedAt : record.lastUsedAt,
      record.updatedAt,
    ),
    useCount: record.useCount,
  };
}

export interface ProviderBackedPromptServiceOptions {
  savedPromptRepository: BirdCoderSavedPromptEntryRepository;
  sessionPromptHistoryRepository: BirdCoderCodingSessionPromptHistoryRepository;
}

export class ProviderBackedPromptService implements IPromptService {
  private readonly savedPromptRepository: BirdCoderSavedPromptEntryRepository;

  private readonly sessionPromptHistoryRepository: BirdCoderCodingSessionPromptHistoryRepository;

  constructor({
    savedPromptRepository,
    sessionPromptHistoryRepository,
  }: ProviderBackedPromptServiceOptions) {
    this.savedPromptRepository = savedPromptRepository;
    this.sessionPromptHistoryRepository = sessionPromptHistoryRepository;
  }

  async deleteSavedPrompt(text: string): Promise<BirdCoderPromptEntry[]> {
    if (!text.trim()) {
      return this.listSavedPrompts();
    }

    await this.savedPromptRepository.deleteByText(text);
    return this.listSavedPrompts();
  }

  async deleteSessionPromptHistoryEntry(
    sessionId: string,
    text: string,
  ): Promise<BirdCoderPromptEntry[]> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return [];
    }

    await this.sessionPromptHistoryRepository.deleteByText(normalizedSessionId, text);
    return this.listSessionPromptHistory(normalizedSessionId);
  }

  async listSavedPrompts(limit = DEFAULT_PROMPT_LIMIT): Promise<BirdCoderPromptEntry[]> {
    return (await this.savedPromptRepository.listRecent(limit)).map(toPromptEntry);
  }

  async listSessionPromptHistory(
    sessionId: string,
    limit = DEFAULT_PROMPT_LIMIT,
  ): Promise<BirdCoderPromptEntry[]> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return [];
    }

    return (
      await this.sessionPromptHistoryRepository.listBySessionId(normalizedSessionId, limit)
    ).map(toPromptEntry);
  }

  async recordSessionPromptUsage(
    sessionId: string,
    text: string,
    limit = DEFAULT_PROMPT_LIMIT,
  ): Promise<BirdCoderPromptEntry[]> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId || !text.trim()) {
      return [];
    }

    return (
      await this.sessionPromptHistoryRepository.recordPromptUsage(normalizedSessionId, text)
    )
      .slice(0, Math.max(limit, 0))
      .map(toPromptEntry);
  }

  async saveSavedPrompt(
    text: string,
    limit = DEFAULT_PROMPT_LIMIT,
  ): Promise<BirdCoderPromptEntry[]> {
    if (!text.trim()) {
      return this.listSavedPrompts(limit);
    }

    return (await this.savedPromptRepository.recordPromptSave(text))
      .slice(0, Math.max(limit, 0))
      .map(toPromptEntry);
  }
}
