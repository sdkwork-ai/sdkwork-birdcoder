// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UniversalChatMarkdown } from './UniversalChatMarkdown.tsx';

afterEach(() => cleanup());

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('UniversalChatMarkdown', () => {
  it('renders Windows absolute image paths with a non-empty src', () => {
    render(
      <UniversalChatMarkdown
        content={'![亮色价格详情弹窗](C:/Users/admin/.codex/visualizations/a.png)'}
      />,
    );

    const image = screen.getByAltText('亮色价格详情弹窗');
    expect(image.getAttribute('src')).toBe('C:/Users/admin/.codex/visualizations/a.png');
  });

  it('renders Windows absolute image paths in basic mode', () => {
    render(
      <UniversalChatMarkdown
        mode="basic"
        content={'![a](D:/work/screenshot.png)'}
      />,
    );

    const image = screen.getByAltText('a');
    expect(image.getAttribute('src')).toBe('D:/work/screenshot.png');
  });

  it('normalizes file: image URLs to a usable local src', () => {
    render(<UniversalChatMarkdown content={'![a](file:///C:/Users/admin/a.png)'} />);

    const image = screen.getByAltText('a');
    expect(image.getAttribute('src')).toBe('C:/Users/admin/a.png');
  });

  it('keeps data: image sources that the media policy allows', () => {
    render(<UniversalChatMarkdown content={`![a](${TINY_PNG_DATA_URL})`} />);

    const image = screen.getByAltText('a');
    expect(image.getAttribute('src')).toBe(TINY_PNG_DATA_URL);
  });

  it('keeps https, relative and POSIX absolute image srcs untouched', () => {
    const { rerender } = render(
      <UniversalChatMarkdown content={'![a](https://example.com/a.png)'} />,
    );
    expect(screen.getByAltText('a').getAttribute('src')).toBe('https://example.com/a.png');

    rerender(<UniversalChatMarkdown content={'![a](./img/a.png)'} />);
    expect(screen.getByAltText('a').getAttribute('src')).toBe('./img/a.png');

    rerender(<UniversalChatMarkdown content={'![a](/Users/admin/a.png)'} />);
    expect(screen.getByAltText('a').getAttribute('src')).toBe('/Users/admin/a.png');
  });

  it('drops dangerous image URLs instead of rendering an empty img', () => {
    render(<UniversalChatMarkdown content={'![a](javascript:alert(1))'} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders local-path links as file-open buttons', () => {
    const onOpenFile = vi.fn();
    render(
      <UniversalChatMarkdown
        content={'[index.tsx](E:/sdkwork-space/index.tsx)'}
        onOpenFile={onOpenFile}
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Open file in editor: E:/sdkwork-space/index.tsx',
    });
    fireEvent.click(button);
    expect(onOpenFile).toHaveBeenCalledWith('E:/sdkwork-space/index.tsx');
  });

  it('renders skill:// links as skill chips', () => {
    render(
      <UniversalChatMarkdown
        content={'[Skill demo](skill://demo)'}
        skills={[{ id: 'demo', name: 'demo', desc: 'Demo skill' }]}
      />,
    );

    expect(screen.getByText('demo')).toBeTruthy();
  });

  it('resolves local image paths through resolveLocalImagePreviewUrl', async () => {
    const resolveLocalImagePreviewUrl = vi.fn(async () => TINY_PNG_DATA_URL);
    render(
      <UniversalChatMarkdown
        content={'![a](C:/work/img.png)'}
        resolveLocalImagePreviewUrl={resolveLocalImagePreviewUrl}
      />,
    );

    const image = screen.getByAltText('a');
    await waitFor(() => expect(image.getAttribute('src')).toBe(TINY_PNG_DATA_URL));
    expect(resolveLocalImagePreviewUrl).toHaveBeenCalledWith('C:/work/img.png');
  });

  it('keeps the raw local src when preview resolution fails', async () => {
    const resolveLocalImagePreviewUrl = vi.fn(async () => undefined);
    render(
      <UniversalChatMarkdown
        content={'![a](C:/missing/out.png)'}
        resolveLocalImagePreviewUrl={resolveLocalImagePreviewUrl}
      />,
    );

    const image = screen.getByAltText('a');
    await waitFor(() => expect(resolveLocalImagePreviewUrl).toHaveBeenCalled());
    expect(image.getAttribute('src')).toBe('C:/missing/out.png');
  });

  it('does not send http image srcs to the local preview resolver', () => {
    const resolveLocalImagePreviewUrl = vi.fn(async () => TINY_PNG_DATA_URL);
    render(
      <UniversalChatMarkdown
        content={'![a](https://example.com/a.png)'}
        resolveLocalImagePreviewUrl={resolveLocalImagePreviewUrl}
      />,
    );

    expect(screen.getByAltText('a').getAttribute('src')).toBe('https://example.com/a.png');
    expect(resolveLocalImagePreviewUrl).not.toHaveBeenCalled();
  });
});
