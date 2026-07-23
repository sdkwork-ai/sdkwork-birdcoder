import type {
  PromptTemplate,
  PromptTemplateVersion,
  SdkworkPromptsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/prompts-app';
import { sha256Hash } from '@sdkwork/utils/crypto';

import type {
  BirdCoderSavedPrompt,
  IPromptService,
} from '../interfaces/IPromptService.ts';

const SAVED_PROMPT_TAG = 'sdkwork-birdcoder:saved-prompt';
const SAVED_PROMPT_KEY_PREFIX = 'birdcoder.saved.';
const DEFAULT_PROMPT_LIMIT = 100;
const TEMPLATE_PAGE_SIZE = 100;
const MAX_TEMPLATE_SCAN_PAGES = 100;

interface GeneratedPage<T> {
  items: T[];
  nextCursor: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readGeneratedPage<T>(
  value: Record<string, unknown>,
  resourceName: string,
): GeneratedPage<T> {
  if (!Array.isArray(value.items)) {
    throw new Error(`${resourceName} SDK response must contain an items array.`);
  }
  if (!isRecord(value.pageInfo)) {
    throw new Error(`${resourceName} SDK response must contain pageInfo.`);
  }

  const rawNextCursor = value.pageInfo.nextCursor;
  const nextCursor = typeof rawNextCursor === 'string' && rawNextCursor.trim()
    ? rawNextCursor.trim()
    : null;
  if (value.pageInfo.hasMore === true && !nextCursor) {
    throw new Error(`${resourceName} SDK response has more items but no next cursor.`);
  }

  return {
    items: value.items as T[],
    nextCursor,
  };
}

function promptKey(text: string): string {
  return `${SAVED_PROMPT_KEY_PREFIX}${sha256Hash(text)}`;
}

function isSavedPromptTemplate(template: PromptTemplate): boolean {
  return template.status !== 'archived' && template.tags?.includes(SAVED_PROMPT_TAG) === true;
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_PROMPT_LIMIT;
  }
  return Math.max(0, Math.min(DEFAULT_PROMPT_LIMIT, Math.trunc(limit)));
}

function normalizeUpdatedAt(updatedAt?: string): string | null {
  const normalized = updatedAt?.trim();
  return normalized || null;
}

function resolveLatestVersion(
  template: PromptTemplate,
  versions: readonly PromptTemplateVersion[],
): PromptTemplateVersion | null {
  return versions.find((version) => version.id === template.latest_version_id)
    ?? versions[0]
    ?? null;
}

function toSavedPrompt(
  template: PromptTemplate,
  version: PromptTemplateVersion,
): BirdCoderSavedPrompt {
  return {
    id: template.id,
    text: version.content.trim(),
    updatedAt: normalizeUpdatedAt(template.updated_at),
  };
}

export class PromptsSdkPromptService implements IPromptService {
  private readonly client: SdkworkPromptsAppClient;

  constructor(client: SdkworkPromptsAppClient) {
    this.client = client;
  }

  async deleteSavedPrompt(text: string): Promise<void> {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    const template = await this.findTemplateByKey(promptKey(normalized));
    if (template && template.status !== 'archived') {
      await this.client.prompts.templates.update(template.id, { status: 'archived' });
    }
  }

  async listSavedPrompts(limit = DEFAULT_PROMPT_LIMIT): Promise<BirdCoderSavedPrompt[]> {
    const normalizedLimit = normalizeLimit(limit);
    if (normalizedLimit === 0) {
      return [];
    }

    const entries: BirdCoderSavedPrompt[] = [];
    for await (const page of this.listTemplatePages()) {
      const pageEntries = await Promise.all(
        page.filter(isSavedPromptTemplate).map(
          async (template): Promise<BirdCoderSavedPrompt | null> => {
            const versions = await this.listTemplateVersions(template.id);
            const latestVersion = resolveLatestVersion(template, versions);
            return latestVersion?.content.trim()
              ? toSavedPrompt(template, latestVersion)
              : null;
          },
        ),
      );
      for (const entry of pageEntries) {
        if (entry) {
          entries.push(entry);
        }
        if (entries.length >= normalizedLimit) {
          return entries;
        }
      }
    }
    return entries;
  }

  async saveSavedPrompt(text: string): Promise<BirdCoderSavedPrompt> {
    const normalized = text.trim();
    if (!normalized) {
      throw new Error('Saved prompt text is required.');
    }

    const key = promptKey(normalized);
    let template = await this.findTemplateByKey(key);
    if (!template) {
      template = await this.client.prompts.templates.create({
        key,
        name: `BirdCoder saved prompt ${key.slice(-12)}`,
        description: 'Saved prompt owned by SDKWork BirdCoder.',
        tags: [SAVED_PROMPT_TAG],
      });
    }

    const versions = await this.listTemplateVersions(template.id);
    let latestVersion = resolveLatestVersion(template, versions);
    if (latestVersion && latestVersion.content.trim() !== normalized) {
      throw new Error(`Saved prompt key ownership conflict for template ${template.id}.`);
    }
    if (!latestVersion) {
      latestVersion = await this.client.prompts.templateVersions.create(template.id, {
        content: normalized,
        version_label: new Date().toISOString(),
      });
    }

    if (template.status !== 'active') {
      template = await this.client.prompts.templates.update(template.id, {
        status: 'active',
        tags: Array.from(new Set([...(template.tags ?? []), SAVED_PROMPT_TAG])),
      });
    }

    return toSavedPrompt(template, latestVersion);
  }

  private async findTemplateByKey(key: string): Promise<PromptTemplate | null> {
    for await (const page of this.listTemplatePages()) {
      const template = page.find((candidate) => candidate.key === key);
      if (!template) {
        continue;
      }
      if (template.tags?.includes(SAVED_PROMPT_TAG) !== true) {
        throw new Error(`Prompt template key ${key} is owned by another capability.`);
      }
      return template;
    }
    return null;
  }

  private async *listTemplatePages(): AsyncGenerator<PromptTemplate[]> {
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    for (let pageIndex = 0; pageIndex < MAX_TEMPLATE_SCAN_PAGES; pageIndex += 1) {
      const response = await this.client.prompts.templates.list({
        cursor,
        limit: TEMPLATE_PAGE_SIZE,
      });
      const page = readGeneratedPage<PromptTemplate>(response, 'Prompt template list');
      yield page.items;

      if (!page.nextCursor) {
        return;
      }
      if (visitedCursors.has(page.nextCursor)) {
        throw new Error('Prompt template pagination returned a repeated cursor.');
      }
      visitedCursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }

    throw new Error('Prompt template pagination exceeded the configured scan limit.');
  }

  private async listTemplateVersions(templateId: string): Promise<PromptTemplateVersion[]> {
    const response = await this.client.prompts.templateVersions.list(templateId);
    return readGeneratedPage<PromptTemplateVersion>(
      response,
      'Prompt template version list',
    ).items;
  }
}
