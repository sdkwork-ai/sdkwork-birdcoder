export interface BirdCoderSavedPrompt {
  id: string;
  text: string;
  updatedAt: string | null;
}

export interface IPromptService {
  deleteSavedPrompt(text: string): Promise<void>;
  listSavedPrompts(limit?: number): Promise<BirdCoderSavedPrompt[]>;
  saveSavedPrompt(text: string): Promise<BirdCoderSavedPrompt>;
}
