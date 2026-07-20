import React, { memo } from 'react';
import { buildChatContentPreview, MAX_CHAT_CONTENT_PREVIEW_CHARACTERS } from '../contentPreview.ts';
import type { ChatMessageTranslate } from '../types.ts';

const MAX_VISIBLE_TOOL_INPUT_FIELDS = 24;
const MAX_TOOL_INPUT_FIELD_CHARACTERS = 4_000;

export interface ToolInputField {
  name: string;
  value: string;
}

export interface ToolInputDetailsProps {
  argumentsText: string;
  compact: boolean;
  inputLabel: string;
  t?: ChatMessageTranslate;
}

function formatToolInputValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function resolveToolInputFields(argumentsText: string): {
  fields: ToolInputField[];
  isTruncated: boolean;
  omittedFieldCount: number;
} | null {
  const trimmedArguments = argumentsText.trim();
  if (
    !trimmedArguments
    || trimmedArguments.length > MAX_CHAT_CONTENT_PREVIEW_CHARACTERS
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmedArguments);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) {
      return null;
    }
    const visibleEntries = entries.slice(0, MAX_VISIBLE_TOOL_INPUT_FIELDS);
    const omittedFieldCount = Math.max(0, entries.length - visibleEntries.length);
    let hasTruncatedField = false;
    const fields = visibleEntries.map(([name, value]) => {
      const preview = buildChatContentPreview(formatToolInputValue(value), {
        maxCharacters: MAX_TOOL_INPUT_FIELD_CHARACTERS,
        tailCharacters: 1_000,
      });
      hasTruncatedField ||= preview.isTruncated;
      return {
        name,
        value: preview.text,
      };
    });
    return {
      fields,
      isTruncated: omittedFieldCount > 0 || hasTruncatedField,
      omittedFieldCount,
    };
  } catch {
    return null;
  }
}

function formatToolInputFallback(argumentsText: string): string {
  const trimmedArguments = argumentsText.trim();
  if (!trimmedArguments) {
    return '';
  }
  if (trimmedArguments.length > MAX_CHAT_CONTENT_PREVIEW_CHARACTERS) {
    return argumentsText;
  }

  try {
    return JSON.stringify(JSON.parse(trimmedArguments), null, 2);
  } catch {
    return argumentsText;
  }
}

export const ToolInputDetails = memo(function ToolInputDetails({
  argumentsText,
  compact,
  inputLabel,
  t,
}: ToolInputDetailsProps) {
  const structuredInput = resolveToolInputFields(argumentsText);
  if (structuredInput) {
    return (
      <div
        className="overflow-hidden rounded-md bg-black/20"
        data-chat-tool-input-fields="true"
      >
        <div
          className={`overflow-auto custom-scrollbar ${compact ? 'max-h-36' : 'max-h-48'}`}
          role="region"
          aria-label={inputLabel}
          tabIndex={0}
        >
          <dl className="divide-y divide-white/[0.04]">
            {structuredInput.fields.map((field) => (
              <div
                key={field.name}
                className="grid min-w-0 grid-cols-[minmax(5rem,0.32fr)_minmax(0,1fr)] gap-3 px-2 py-1.5 max-[520px]:grid-cols-1 max-[520px]:gap-0.5"
              >
                <dt className="min-w-0 truncate font-mono text-[10px] text-gray-500" title={field.name}>
                  {field.name}
                </dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-300">
                  {field.value || '""'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {structuredInput.isTruncated ? (
          <div className="border-t border-white/[0.04] px-2 py-1 text-[10px] text-gray-400/80">
            {t?.('chat.toolDetailTruncated')
              ?? 'Preview truncated. Copy to inspect the full content.'}
          </div>
        ) : null}
      </div>
    );
  }

  const fallbackPreview = buildChatContentPreview(
    formatToolInputFallback(argumentsText),
  );
  return (
    <>
      <pre
        className={`overflow-auto rounded-md bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap custom-scrollbar ${compact ? 'max-h-36' : 'max-h-48'}`}
        role="region"
        aria-label={inputLabel}
        tabIndex={0}
      >
        {fallbackPreview.text}
      </pre>
      {fallbackPreview.isTruncated ? (
        <div className="pt-1 text-[10px] text-gray-400/80">
          {t?.('chat.toolDetailTruncated')
            ?? 'Preview truncated. Copy to inspect the full content.'}
        </div>
      ) : null}
    </>
  );
});
