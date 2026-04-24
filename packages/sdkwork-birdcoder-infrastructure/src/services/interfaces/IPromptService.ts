export interface BirdCoderPromptEntry {
  text: string;
  timestamp: number;
  useCount: number;
}

export interface IPromptService {
  deleteSavedPrompt(text: string): Promise<BirdCoderPromptEntry[]>;
  deleteSessionPromptHistoryEntry(
    sessionId: string,
    text: string,
  ): Promise<BirdCoderPromptEntry[]>;
  listSavedPrompts(limit?: number): Promise<BirdCoderPromptEntry[]>;
  listSessionPromptHistory(
    sessionId: string,
    limit?: number,
  ): Promise<BirdCoderPromptEntry[]>;
  recordSessionPromptUsage(
    sessionId: string,
    text: string,
    limit?: number,
  ): Promise<BirdCoderPromptEntry[]>;
  saveSavedPrompt(
    text: string,
    limit?: number,
  ): Promise<BirdCoderPromptEntry[]>;
}
