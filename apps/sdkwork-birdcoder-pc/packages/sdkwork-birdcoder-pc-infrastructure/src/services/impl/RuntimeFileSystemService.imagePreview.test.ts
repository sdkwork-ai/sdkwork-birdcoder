import { describe, expect, it } from 'vitest';
import { resolveTauriImagePreviewMountedPath } from './RuntimeFileSystemService.ts';

describe('resolveTauriImagePreviewMountedPath', () => {
  const rootSystemPath = 'E:\\workspace\\project';
  const rootVirtualPath = '/project';

  it('maps provider-native absolute paths inside the mounted project', () => {
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      'e:\\WORKSPACE\\PROJECT\\artifacts\\preview.png',
    )).toBe('/project/artifacts/preview.png');
  });

  it('accepts project virtual and relative image paths', () => {
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      '/project/artifacts/preview.webp',
    )).toBe('/project/artifacts/preview.webp');
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      'artifacts/preview.gif',
    )).toBe('/project/artifacts/preview.gif');
  });

  it('rejects sibling roots, traversal, URLs, and the project directory itself', () => {
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      'E:\\workspace\\project-other\\preview.png',
    )).toBeNull();
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      '../outside.png',
    )).toBeNull();
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      'https://example.test/preview.png',
    )).toBeNull();
    expect(resolveTauriImagePreviewMountedPath(
      rootSystemPath,
      rootVirtualPath,
      rootSystemPath,
    )).toBeNull();
  });
});
