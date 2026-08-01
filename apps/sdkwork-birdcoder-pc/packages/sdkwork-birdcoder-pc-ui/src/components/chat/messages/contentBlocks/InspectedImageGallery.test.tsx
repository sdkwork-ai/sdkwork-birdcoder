// @vitest-environment jsdom

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';
import { InspectedImageGallery } from './InspectedImageGallery.tsx';

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR42mP8z8BQDwAFgwJ/lY8vWQAAAABJRU5ErkJggg==';

function createMessage(id: string): AgentSessionItemView {
  return {
    id,
    sessionId: 'session-1',
    role: 'assistant',
    content: '',
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

const imageActivityMessage = createMessage('image-activity-message');
const defaultMessages = [
  createMessage('preceding-message'),
  imageActivityMessage,
];
const expandedImageDisclosureKey =
  'session-1\u0001image-activity-message\u0001inspected-images:image-1,image-2';

function createContext(
  expanded: boolean,
  options: {
    allMessages?: readonly AgentSessionItemView[];
    index?: number;
  } = {},
): ChatMessageRenderContext {
  const allMessages = options.allMessages ?? defaultMessages;
  const index = options.index ?? 1;
  return {
    actionTarget: null,
    allMessages,
    copyMessageToClipboard: () => undefined,
    engineId: 'codex',
    environment: {
      addToast: () => undefined,
      skills: [],
      t: (key, options) => {
        if (key === 'chat.viewedImagesSummary') {
          const count = Number(options?.count ?? 0);
          return count === 1 ? 'Viewed an image' : `Viewed ${count} images`;
        }
        return {
          'chat.closeImagePreview': 'Close image preview',
          'chat.inspectedImageAlt': 'Inspected image',
          'chat.nextInspectedImage': 'Next image',
          'chat.previewImage': 'Preview image',
          'chat.previousInspectedImage': 'Previous image',
          'chat.viewedImagesCollapse': 'Hide inspected images',
          'chat.viewedImagesExpand': 'Show inspected images',
        }[key] ?? key;
      },
    },
    expandedDisclosureKeys: expanded ? new Set([expandedImageDisclosureKey]) : new Set(),
    index,
    layout: 'main',
    renderMarkdownContent: () => null,
    sessionId: 'session-1',
    showMessageActions: false,
    toggleDisclosure: () => undefined,
    turn: {
      isActiveTail: false,
      isEnd: true,
      isStart: true,
      key: 'turn-1',
      position: 'only',
    },
  };
}

function InteractiveGallery() {
  const [expandedDisclosureKeys, setExpandedDisclosureKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const baseContext = createContext(false);

  return (
    <InspectedImageGallery
      context={{
        ...baseContext,
        environment: {
          ...baseContext.environment!,
          resolveLocalImagePreviewUrl: async () => ONE_PIXEL_PNG,
        },
        expandedDisclosureKeys,
        toggleDisclosure: (key) => {
          setExpandedDisclosureKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.add(key);
            }
            return next;
          });
        },
      }}
      images={images.map((image) => ({ ...image, mediaSource: undefined }))}
    />
  );
}

const images = [
  {
    id: 'image-1',
    kind: 'image' as const,
    mediaSource: ONE_PIXEL_PNG,
    mimeType: 'image/png',
    path: 'E:\\workspace\\preview-1.png',
  },
  {
    id: 'image-2',
    kind: 'image' as const,
    mediaSource: ONE_PIXEL_PNG,
    mimeType: 'image/png',
    path: 'E:\\workspace\\preview-2.png',
  },
];

afterEach(() => cleanup());

describe('InspectedImageGallery', () => {
  it('renders the exact collapsed Codex image activity summary', () => {
    const markup = renderToStaticMarkup(
      <InspectedImageGallery context={createContext(false)} images={images} />,
    );

    expect(markup).toContain('Viewed 2 images');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('data-chat-inspected-image-thumbnails="true"');
  });

  it('expands into stable 80px horizontally scrollable thumbnails', () => {
    const markup = renderToStaticMarkup(
      <InspectedImageGallery context={createContext(true)} images={images} />,
    );

    expect(markup).toContain('data-chat-inspected-image-thumbnails="true"');
    expect(markup).toContain('overflow-x-auto');
    expect(markup).toContain('h-20 w-20');
    expect(markup.match(/data:image\/png;base64/gu)).toHaveLength(2);
  });

  it('keeps the image disclosure expanded when history pagination changes its index', () => {
    const paginatedMessages = [createMessage('older-message'), ...defaultMessages];
    const beforePagination = renderToStaticMarkup(
      <InspectedImageGallery context={createContext(true)} images={images} />,
    );
    const afterPagination = renderToStaticMarkup(
      <InspectedImageGallery
        context={createContext(true, {
          allMessages: paginatedMessages,
          index: 2,
        })}
        images={images}
      />,
    );

    expect(beforePagination).toContain('data-chat-inspected-image-thumbnails="true"');
    expect(afterPagination).toContain('data-chat-inspected-image-thumbnails="true"');
  });

  it('resolves local previews, opens the gallery dialog, navigates, and closes it', async () => {
    render(<InteractiveGallery />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Viewed 2 images. Show inspected images',
    }));

    const previewButtons = screen.getAllByRole('button', {
      name: /Preview image:/u,
    });
    expect(previewButtons).toHaveLength(2);
    await waitFor(() => {
      expect((previewButtons[0] as HTMLButtonElement).disabled).toBe(false);
      expect((previewButtons[1] as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(previewButtons[0]!);
    expect(screen.getByRole('dialog', { name: 'Inspected image' })).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close image preview' }));
    expect(screen.queryByRole('dialog', { name: 'Inspected image' })).toBeNull();

    fireEvent.click(previewButtons[1]!);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Inspected image' })).toBeNull();
  });
});
