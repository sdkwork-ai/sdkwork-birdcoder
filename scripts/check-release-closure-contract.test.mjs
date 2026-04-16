import assert from 'node:assert/strict';

import * as releaseClosure from './check-release-closure.mjs';

const {
  validateLatestReleaseRegistryEntry,
  validateLatestReleaseNoteAgainstRegistry,
  validateLatestReleaseRegistryAgainstCanonicalTruth,
} = releaseClosure;

assert.equal(
  typeof validateLatestReleaseNoteAgainstRegistry,
  'function',
  'check-release-closure must export validateLatestReleaseNoteAgainstRegistry for note/registry closure checks.',
);
assert.equal(
  typeof validateLatestReleaseRegistryAgainstCanonicalTruth,
  'function',
  'check-release-closure must export validateLatestReleaseRegistryAgainstCanonicalTruth for canonical packaged-truth checks.',
);

assert.doesNotThrow(() => validateLatestReleaseRegistryEntry({
  notesFile: 'release-2026-04-15-99.md',
  stopShipSignals: [],
  promotionReadiness: {
    currentReleaseKind: 'formal',
    currentRolloutStage: 'general-availability',
    formalOrGaStatus: 'clear',
    stopShipSignals: [],
  },
}));

assert.throws(
  () => validateLatestReleaseRegistryEntry({
    notesFile: 'release-2026-04-15-99.md',
    stopShipSignals: ['runtime blockers `vite-host-build-preflight`'],
    promotionReadiness: {
      currentReleaseKind: 'canary',
      currentRolloutStage: 'ring-1',
      formalOrGaStatus: 'blocked',
      stopShipSignals: [],
    },
  }),
  /promotionReadiness\.stopShipSignals aligned/,
);

assert.doesNotThrow(() => validateLatestReleaseNoteAgainstRegistry({
  stopShipSignals: [
    'runtime blockers `vite-host-build-preflight`',
  ],
  promotionReadiness: {
    currentReleaseKind: 'canary',
    currentRolloutStage: 'ring-1',
    formalOrGaStatus: 'blocked',
    stopShipSignals: [
      'runtime blockers `vite-host-build-preflight`',
    ],
  },
}, `
## Post-release operations

- Release kind: \`canary\`
- Rollout stage: \`ring-1\`
- Formal or GA status: \`blocked\`
- Machine stop-ship signals: runtime blockers \`vite-host-build-preflight\`
`));

assert.throws(
  () => validateLatestReleaseNoteAgainstRegistry({
    stopShipSignals: [
      'runtime blocked tiers `fast`',
      'runtime blockers `vite-host-build-preflight`',
    ],
    promotionReadiness: {
      currentReleaseKind: 'canary',
      currentRolloutStage: 'ring-1',
      formalOrGaStatus: 'blocked',
      stopShipSignals: [
        'runtime blocked tiers `fast`',
        'runtime blockers `vite-host-build-preflight`',
      ],
    },
  }, `
## Post-release operations

- Release kind: \`canary\`
- Rollout stage: \`ring-1\`
- Formal or GA status: \`blocked\`
- Machine stop-ship signals: runtime blocked tiers \`fast\`
`),
  /must echo the latest registry stop-ship signal/i,
);

assert.doesNotThrow(() => validateLatestReleaseRegistryAgainstCanonicalTruth(
  {
    stopShipSignals: [
      'runtime blocked tiers `fast`',
      'runtime blockers `vite-host-build-preflight`',
    ],
    promotionReadiness: {
      currentReleaseKind: 'canary',
      currentRolloutStage: 'ring-1',
      formalOrGaStatus: 'blocked',
      stopShipSignals: [
        'runtime blocked tiers `fast`',
        'runtime blockers `vite-host-build-preflight`',
      ],
    },
  },
  {
    stopShipSignals: [
      'runtime blocked tiers `fast`',
      'runtime blockers `vite-host-build-preflight`',
    ],
    promotionReadiness: {
      currentReleaseKind: 'canary',
      currentRolloutStage: 'ring-1',
      formalOrGaStatus: 'blocked',
      stopShipSignals: [
        'runtime blocked tiers `fast`',
        'runtime blockers `vite-host-build-preflight`',
      ],
    },
  },
  {
    stopShipSignals: [
      'runtime blocked tiers `fast`',
      'runtime blockers `vite-host-build-preflight`',
    ],
    promotionReadiness: {
      currentReleaseKind: 'canary',
      currentRolloutStage: 'ring-1',
      formalOrGaStatus: 'blocked',
      stopShipSignals: [
        'runtime blocked tiers `fast`',
        'runtime blockers `vite-host-build-preflight`',
      ],
    },
  },
));

assert.throws(
  () => validateLatestReleaseRegistryAgainstCanonicalTruth(
    {
      stopShipSignals: [
        'runtime blocked tiers `fast`',
      ],
      promotionReadiness: {
        currentReleaseKind: 'canary',
        currentRolloutStage: 'ring-1',
        formalOrGaStatus: 'blocked',
        stopShipSignals: [
          'runtime blocked tiers `fast`',
        ],
      },
    },
    {
      stopShipSignals: [
        'runtime blocked tiers `fast`',
        'runtime blockers `vite-host-build-preflight`',
      ],
      promotionReadiness: {
        currentReleaseKind: 'canary',
        currentRolloutStage: 'ring-1',
        formalOrGaStatus: 'blocked',
        stopShipSignals: [
          'runtime blocked tiers `fast`',
          'runtime blockers `vite-host-build-preflight`',
        ],
      },
    },
    {
      stopShipSignals: [
        'runtime blocked tiers `fast`',
        'runtime blockers `vite-host-build-preflight`',
      ],
      promotionReadiness: {
        currentReleaseKind: 'canary',
        currentRolloutStage: 'ring-1',
        formalOrGaStatus: 'blocked',
        stopShipSignals: [
          'runtime blocked tiers `fast`',
          'runtime blockers `vite-host-build-preflight`',
        ],
      },
    },
  ),
  /canonical finalized manifest stop-ship summary/i,
);

console.log('check release closure contract passed.');
