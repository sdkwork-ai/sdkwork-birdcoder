/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { setStoredJson, type WorkbenchRecoverySnapshot } from '@sdkwork/birdcoder-pc-commons';
import { randomString } from '@sdkwork/utils/id';

export type DesktopWindowHandle = {
  isMinimized: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<() => void>;
  onScaleChanged: (handler: () => void) => Promise<() => void>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  startDragging: () => Promise<void>;
};

export function readDesktopWindowFrameStateClockMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

export function persistWorkbenchRecoverySnapshot(snapshot: WorkbenchRecoverySnapshot): void {
  void setStoredJson('workbench', 'recovery-context', snapshot).catch(() => {});
}

export function createWorkbenchRecoverySessionId() {
  return `recovery-${Date.now().toString(36)}-${randomString(6)}`;
}
