import { describe, expect, it } from 'vitest';

import { resolveProjectDeviceMountTarget } from '../src/events/projectDeviceMountEvents.ts';

describe('project runtime-location target', () => {
  it('normalizes a complete project object through the shared target entrypoint', () => {
    const project = {
      name: 'BirdCoder',
      projectId: ' project.runtime-location ',
    };

    expect(resolveProjectDeviceMountTarget(project)).toEqual({
      projectId: 'project.runtime-location',
    });
  });

  it('keeps a mounted child path on the project target', () => {
    expect(resolveProjectDeviceMountTarget({
      mountedPath: ' /BirdCoder/apps/desktop ',
      projectId: ' project.runtime-location ',
    })).toEqual({
      mountedPath: '/BirdCoder/apps/desktop',
      projectId: 'project.runtime-location',
    });
  });

  it('rejects an empty project identity', () => {
    expect(resolveProjectDeviceMountTarget({ projectId: '   ' })).toBeNull();
  });
});
