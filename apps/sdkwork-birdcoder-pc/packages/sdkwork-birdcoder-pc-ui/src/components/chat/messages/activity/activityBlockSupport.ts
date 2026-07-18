import type { CommandExecution } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ActivityFileChange } from '../messageActivity.ts';

export function filterCommandExecutions(
  commands: readonly unknown[] | undefined,
): CommandExecution[] {
  return (commands ?? []).filter((command): command is CommandExecution => {
    if (typeof command !== 'object' || command === null) {
      return false;
    }

    const value = (command as CommandExecution).command;
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function normalizeActivityFileChanges(
  fileChanges: readonly unknown[] | undefined,
): ActivityFileChange[] {
  return (fileChanges ?? [])
    .filter((fileChange): fileChange is ActivityFileChange => {
      if (typeof fileChange !== 'object' || fileChange === null) {
        return false;
      }

      const path = (fileChange as ActivityFileChange).path;
      return typeof path === 'string' && path.trim().length > 0;
    })
    .map((fileChange) => ({
      ...fileChange,
      lineImpactKnown: fileChange.lineImpactKnown ?? true,
    }));
}
