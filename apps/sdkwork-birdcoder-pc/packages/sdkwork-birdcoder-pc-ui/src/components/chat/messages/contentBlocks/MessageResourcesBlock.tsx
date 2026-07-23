import React, { memo } from 'react';
import {
  AtSign,
  AudioLines,
  FileText,
  Image as ImageIcon,
  Link2,
  Quote,
  Sparkles,
} from 'lucide-react';
import type {
  AgentSessionItemResourceView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { resolveAgentSessionItemMediaSource } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { ChatMessageRenderContext } from '../types.ts';
import type { ChatMessageContentBlockRendererProps } from './registry.ts';

const RESOURCE_ICON_BY_KIND = {
  audio: AudioLines,
  citation: Quote,
  file: FileText,
  image: ImageIcon,
  mention: AtSign,
  skill: Sparkles,
  uri: Link2,
} as const;

function resolveSafeMediaSource(resource: AgentSessionItemResourceView): string | undefined {
  if (resource.kind !== 'image' && resource.kind !== 'audio') {
    return undefined;
  }
  return resolveAgentSessionItemMediaSource(
    resource.mediaSource,
    resource.kind,
    resource.mimeType,
  );
}

function resolveSafeExternalUri(resource: AgentSessionItemResourceView): string | undefined {
  for (const value of [resource.uri, resource.origin?.uri]) {
    const uri = value?.trim();
    if (uri && /^https?:\/\//iu.test(uri)) {
      return uri;
    }
  }
  return undefined;
}

function isOpaqueMediaLocation(value: string | undefined): boolean {
  return Boolean(value && /^(?:data|blob):/iu.test(value.trim()));
}

function resolveOpenableFilePath(resource: AgentSessionItemResourceView): string | undefined {
  for (const value of [resource.path, resource.origin?.path]) {
    const path = value?.trim();
    if (path && !/^(?:data|blob|https?):/iu.test(path)) {
      return path;
    }
  }
  return undefined;
}

function resolveResourceKindLabel(
  resource: AgentSessionItemResourceView,
  context: ChatMessageRenderContext,
): string {
  const labels = {
    audio: context.environment?.t('chat.messageResourceAudio') ?? 'Audio',
    citation: context.environment?.t('chat.messageResourceCitation') ?? 'Citation',
    file: context.environment?.t('chat.messageResourceFile') ?? 'File',
    image: context.environment?.t('chat.messageResourceImage') ?? 'Image',
    mention: context.environment?.t('chat.messageResourceMention') ?? 'Mention',
    skill: context.environment?.t('chat.messageResourceSkill') ?? 'Skill',
    uri: context.environment?.t('chat.messageResourceLink') ?? 'Resource',
  } as const;
  return labels[resource.kind];
}

function formatLineLocation(resource: AgentSessionItemResourceView): string {
  const start = resource.citation?.lineStart ?? resource.origin?.lineStart;
  const end = resource.citation?.lineEnd ?? resource.origin?.lineEnd;
  if (start === undefined) {
    return '';
  }
  return end !== undefined && end !== start ? `:${start}-${end}` : `:${start}`;
}

function resolvePrimaryLocation(resource: AgentSessionItemResourceView): string {
  return resolveOpenableFilePath(resource)
    ?? (!isOpaqueMediaLocation(resource.uri) ? resource.uri : undefined)
    ?? (!isOpaqueMediaLocation(resource.origin?.uri) ? resource.origin?.uri : undefined)
    ?? '';
}

function resolveResourceTitle(
  resource: AgentSessionItemResourceView,
  kindLabel: string,
): string {
  const location = resolvePrimaryLocation(resource);
  return resource.name ?? resource.origin?.name ?? (location || kindLabel);
}

function buildResourceMetadata(resource: AgentSessionItemResourceView): string[] {
  const primaryLocation = resolvePrimaryLocation(resource);
  const metadata = [resource.mimeType];
  const originIdentity = resource.origin?.clientName ?? resource.origin?.name;
  if (originIdentity && originIdentity !== resource.name) {
    metadata.push(originIdentity);
  }
  if (resource.uri && !isOpaqueMediaLocation(resource.uri) && resource.uri !== primaryLocation) {
    metadata.push(resource.uri);
  }
  if (
    resource.origin?.uri
    && !isOpaqueMediaLocation(resource.origin.uri)
    && resource.origin.uri !== primaryLocation
  ) {
    metadata.push(resource.origin.uri);
  }
  const threadCount = resource.citation?.threadIds?.length ?? 0;
  if (threadCount > 0) {
    metadata.push(`${threadCount} thread${threadCount === 1 ? '' : 's'}`);
  }
  return metadata.flatMap((value) => value ? [value] : []);
}

export const MessageResourcesBlock = memo(function MessageResourcesBlock({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'resources' || block.items.length === 0) {
    return null;
  }
  const resourcesLabel = context.environment?.t('chat.messageResources') ?? 'Message resources';
  const openFileLabel = context.environment?.t('chat.openFileInEditor') ?? 'Open file in editor';

  return (
    <div
      className="mt-2 min-w-0 divide-y divide-white/[0.06] border-y border-white/[0.06]"
      role="list"
      aria-label={resourcesLabel}
      data-chat-message-resources
    >
      {block.items.map((resource) => {
        const ResourceIcon = RESOURCE_ICON_BY_KIND[resource.kind];
        const kindLabel = resolveResourceKindLabel(resource, context);
        const title = resolveResourceTitle(resource, kindLabel);
        const location = resolvePrimaryLocation(resource);
        const lineLocation = formatLineLocation(resource);
        const description = resource.description
          ?? resource.citation?.note
          ?? resource.origin?.excerpt;
        const metadata = buildResourceMetadata(resource);
        const mediaSource = resolveSafeMediaSource(resource);
        const externalUri = resolveSafeExternalUri(resource);
        const openableFilePath = resolveOpenableFilePath(resource);
        const canOpenFile = Boolean(openableFilePath && context.environment?.onOpenFile);
        const titleContent = (
          <>
            <span className="min-w-0 truncate font-medium text-gray-300" title={title}>
              {title}
            </span>
            {lineLocation ? (
              <span className="shrink-0 font-mono text-[10px] text-gray-500">
                {lineLocation}
              </span>
            ) : null}
          </>
        );

        return (
          <div
            key={resource.id}
            className="flex min-w-0 items-start gap-2.5 py-2"
            role="listitem"
            data-chat-message-resource={resource.kind}
          >
            {resource.kind === 'image' && mediaSource ? (
              <img
                src={mediaSource}
                alt={title}
                className="h-9 w-9 shrink-0 rounded border border-white/10 object-cover"
                loading="lazy"
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-500">
                <ResourceIcon size={14} aria-hidden="true" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-1 text-[12px] leading-5">
                {canOpenFile ? (
                  <button
                    type="button"
                    className="flex min-w-0 items-baseline gap-1 text-left hover:text-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                    title={`${openFileLabel}: ${openableFilePath}`}
                    aria-label={`${openFileLabel}: ${openableFilePath}`}
                    onClick={() => context.environment?.onOpenFile?.(openableFilePath!)}
                  >
                    {titleContent}
                  </button>
                ) : externalUri ? (
                  <a
                    className="flex min-w-0 items-baseline gap-1 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                    href={externalUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={externalUri}
                  >
                    {titleContent}
                  </a>
                ) : (
                  <span className="flex min-w-0 items-baseline gap-1">{titleContent}</span>
                )}
                <span className="shrink-0 text-[10px] text-gray-600">{kindLabel}</span>
              </div>

              {location && location !== title ? (
                <div
                  className="truncate font-mono text-[10px] leading-4 text-gray-500"
                  title={location}
                >
                  {location}
                </div>
              ) : null}
              {metadata.length > 0 ? (
                <div
                  className="truncate text-[10px] leading-4 text-gray-600"
                  title={metadata.join(' / ')}
                >
                  {metadata.join(' / ')}
                </div>
              ) : null}
              {description ? (
                <div
                  className="line-clamp-2 whitespace-pre-wrap break-words text-[11px] leading-4 text-gray-500 [overflow-wrap:anywhere]"
                  title={description}
                >
                  {description}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
});
