import { describe, expect, it, vi } from 'vitest';
import type { BirdCoderTauriFileSystemRuntime } from '../../platform/tauriFileSystemRuntime.ts';
import {
  isAbsoluteExternalImagePreviewPath,
  resolveTauriImagePreviewMountedPath,
  RuntimeFileSystemService,
} from './RuntimeFileSystemService.ts';

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

describe('isAbsoluteExternalImagePreviewPath', () => {
  it('allows Windows drive paths regardless of registered virtual roots', () => {
    expect(isAbsoluteExternalImagePreviewPath(
      'C:/Users/admin/.codex/visualizations/a.png',
      ['/project'],
    )).toBe(true);
    expect(isAbsoluteExternalImagePreviewPath(
      'D:\\work\\screenshot.png',
      ['/project'],
    )).toBe(true);
  });

  it('allows POSIX absolute paths outside registered virtual roots', () => {
    expect(isAbsoluteExternalImagePreviewPath(
      '/Users/admin/.codex/a.png',
      ['/project'],
    )).toBe(true);
    expect(isAbsoluteExternalImagePreviewPath(
      '/tmp/preview.png',
      [],
    )).toBe(true);
  });

  it('rejects POSIX absolute paths inside a registered virtual root', () => {
    expect(isAbsoluteExternalImagePreviewPath(
      '/project/artifacts/a.png',
      ['/project'],
    )).toBe(false);
    expect(isAbsoluteExternalImagePreviewPath(
      '/project',
      ['/project'],
    )).toBe(false);
  });

  it('rejects relative, empty, and URL paths', () => {
    expect(isAbsoluteExternalImagePreviewPath('artifacts/a.png', [])).toBe(false);
    expect(isAbsoluteExternalImagePreviewPath('', [])).toBe(false);
    expect(isAbsoluteExternalImagePreviewPath('https://example.com/a.png', [])).toBe(false);
  });
});

describe('RuntimeFileSystemService.resolveProjectImagePreviewUrl', () => {
  const externalPreviewUrl = 'data:image/png;base64,aW1hZ2U=';

  function createService(): {
    service: RuntimeFileSystemService;
    tauriRuntime: BirdCoderTauriFileSystemRuntime & {
      readExternalImagePreview: ReturnType<typeof vi.fn>;
    };
  } {
    const readExternalImagePreview = vi.fn(async () => externalPreviewUrl);
    const tauriRuntime = {
      readExternalImagePreview,
    } as unknown as BirdCoderTauriFileSystemRuntime & {
      readExternalImagePreview: ReturnType<typeof vi.fn>;
    };
    return {
      service: new RuntimeFileSystemService({ tauriRuntime }),
      tauriRuntime,
    };
  }

  it('resolves absolute local paths through the external preview bridge', async () => {
    const { service, tauriRuntime } = createService();

    const result = await service.resolveProjectImagePreviewUrl(
      'project-1',
      'C:/Users/admin/.codex/visualizations/preview.png',
    );

    expect(result).toBe(externalPreviewUrl);
    expect(tauriRuntime.readExternalImagePreview).toHaveBeenCalledWith(
      'C:/Users/admin/.codex/visualizations/preview.png',
    );
  });

  it('normalizes file: URLs before the external preview bridge', async () => {
    const { service, tauriRuntime } = createService();

    const result = await service.resolveProjectImagePreviewUrl(
      'project-1',
      'file:///C:/Users/admin/.codex/preview.png',
    );

    expect(result).toBe(externalPreviewUrl);
    expect(tauriRuntime.readExternalImagePreview).toHaveBeenCalledWith(
      'C:/Users/admin/.codex/preview.png',
    );
  });

  it('never routes relative, virtual, or URL paths to the external preview bridge', async () => {
    const { service, tauriRuntime } = createService();

    expect(await service.resolveProjectImagePreviewUrl(
      'project-1',
      'artifacts/preview.png',
    )).toBeUndefined();
    expect(await service.resolveProjectImagePreviewUrl(
      'project-1',
      'https://example.com/preview.png',
    )).toBeUndefined();
    expect(tauriRuntime.readExternalImagePreview).not.toHaveBeenCalled();
  });

  it('surfaces undefined when the external preview bridge fails', async () => {
    const { service, tauriRuntime } = createService();
    tauriRuntime.readExternalImagePreview.mockRejectedValueOnce(new Error('denied'));

    const result = await service.resolveProjectImagePreviewUrl(
      'project-1',
      'C:/Users/admin/preview.png',
    );

    expect(result).toBeUndefined();
  });
});
