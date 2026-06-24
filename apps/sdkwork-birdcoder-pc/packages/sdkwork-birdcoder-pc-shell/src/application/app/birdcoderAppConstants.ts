/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppTab } from '@sdkwork/birdcoder-pc-types';

export const PRIMARY_PERSISTED_APP_TABS = new Set<AppTab>(['code', 'studio', 'multiwindow', 'terminal']);

export const DESKTOP_WINDOW_FRAME_STATE_RECONCILIATION_DELAY_MS = 120;
export const DESKTOP_WINDOW_FRAME_STATE_CACHE_TTL_MS = 500;
export const WORKBENCH_RECOVERY_PERSIST_DELAY_MS = 80;
