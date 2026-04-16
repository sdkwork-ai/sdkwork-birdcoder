#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateLatestReleaseRegistryEntry(latestReleaseEntry = {}) {
  assert.ok(
    latestReleaseEntry?.notesFile,
    'release registry must expose a latest release note entry with notesFile metadata.',
  );
  assert.ok(
    Array.isArray(latestReleaseEntry?.stopShipSignals),
    'release registry must expose latest stopShipSignals metadata for machine-readable promotion decisions.',
  );
  assert.ok(
    latestReleaseEntry?.promotionReadiness
    && typeof latestReleaseEntry.promotionReadiness === 'object',
    'release registry must expose latest promotionReadiness metadata for machine-readable promotion decisions.',
  );
  assert.match(
    String(latestReleaseEntry.promotionReadiness?.currentReleaseKind ?? '').trim(),
    /.+/,
    'release registry must expose promotionReadiness.currentReleaseKind on the latest entry.',
  );
  assert.match(
    String(latestReleaseEntry.promotionReadiness?.currentRolloutStage ?? '').trim(),
    /.+/,
    'release registry must expose promotionReadiness.currentRolloutStage on the latest entry.',
  );
  assert.match(
    String(latestReleaseEntry.promotionReadiness?.formalOrGaStatus ?? '').trim(),
    /^(blocked|clear)$/,
    'release registry must expose promotionReadiness.formalOrGaStatus as blocked or clear on the latest entry.',
  );
  assert.deepEqual(
    latestReleaseEntry.promotionReadiness.stopShipSignals,
    latestReleaseEntry.stopShipSignals,
    'release registry must keep promotionReadiness.stopShipSignals aligned with the top-level stopShipSignals summary.',
  );
}

export function validateLatestReleaseNoteAgainstRegistry(
  latestReleaseEntry = {},
  latestReleaseNote = '',
) {
  const noteText = String(latestReleaseNote ?? '');
  const promotionReadiness = latestReleaseEntry?.promotionReadiness ?? {};
  const stopShipSignals = Array.isArray(latestReleaseEntry?.stopShipSignals)
    ? latestReleaseEntry.stopShipSignals
    : [];

  assert.match(
    noteText,
    new RegExp(`Release kind:\\s*\`${escapeRegExp(String(promotionReadiness.currentReleaseKind ?? ''))}\``),
    'latest registry-backed release note must echo promotionReadiness.currentReleaseKind.',
  );
  assert.match(
    noteText,
    new RegExp(`Rollout stage:\\s*\`${escapeRegExp(String(promotionReadiness.currentRolloutStage ?? ''))}\``),
    'latest registry-backed release note must echo promotionReadiness.currentRolloutStage.',
  );
  assert.match(
    noteText,
    new RegExp(`Formal or GA status:\\s*\`${escapeRegExp(String(promotionReadiness.formalOrGaStatus ?? ''))}\``),
    'latest registry-backed release note must echo promotionReadiness.formalOrGaStatus.',
  );
  assert.match(
    noteText,
    /Machine stop-ship signals:/,
    'latest registry-backed release note must include an explicit Machine stop-ship signals summary.',
  );

  if (stopShipSignals.length === 0) {
    assert.match(
      noteText,
      /Machine stop-ship signals:\s*`none`/i,
      'latest registry-backed release note must echo `none` when the latest registry stop-ship signals are empty.',
    );
    return;
  }

  for (const signal of stopShipSignals) {
    assert.match(
      noteText,
      new RegExp(escapeRegExp(signal)),
      `latest registry-backed release note must echo the latest registry stop-ship signal ${signal}.`,
    );
  }
}

export function validateLatestReleaseRegistryAgainstCanonicalTruth(
  latestReleaseEntry = {},
  canonicalManifest = {},
  canonicalFinalizedSmokeReport = {},
) {
  assert.deepEqual(
    latestReleaseEntry?.stopShipSignals ?? [],
    canonicalManifest?.stopShipSignals ?? [],
    'latest release registry entry must preserve the canonical finalized manifest stop-ship summary.',
  );
  assert.deepEqual(
    latestReleaseEntry?.promotionReadiness ?? {},
    canonicalManifest?.promotionReadiness ?? {},
    'latest release registry entry must preserve the canonical finalized manifest promotionReadiness summary.',
  );
  assert.deepEqual(
    latestReleaseEntry?.stopShipSignals ?? [],
    canonicalFinalizedSmokeReport?.stopShipSignals ?? [],
    'latest release registry entry must preserve the canonical finalized smoke stop-ship summary.',
  );
  assert.deepEqual(
    latestReleaseEntry?.promotionReadiness ?? {},
    canonicalFinalizedSmokeReport?.promotionReadiness ?? {},
    'latest release registry entry must preserve the canonical finalized smoke promotionReadiness summary.',
  );
}

function main() {
  const workflow = read('.github/workflows/release-reusable.yml');
  const kubernetesValues = read('deploy/kubernetes/values.yaml');
  const kubernetesDeployment = read('deploy/kubernetes/templates/deployment.yaml');
  const kubernetesReadme = read('deploy/kubernetes/README.md');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const releaseRegistry = JSON.parse(read('docs/release/releases.json'));
  const latestReleaseEntry = releaseRegistry.releases.at(-1);
  const canonicalManifestPath = path.join(rootDir, 'artifacts', 'release-openapi-canonical', 'release-manifest.json');
  const canonicalFinalizedSmokeReportPath = path.join(
    rootDir,
    'artifacts',
    'release-openapi-canonical',
    'finalized-release-smoke-report.json',
  );

  validateLatestReleaseRegistryEntry(latestReleaseEntry);

  const latestReleaseNote = read(path.join('docs/release', latestReleaseEntry.notesFile));
  validateLatestReleaseNoteAgainstRegistry(latestReleaseEntry, latestReleaseNote);
  if (fs.existsSync(canonicalManifestPath) || fs.existsSync(canonicalFinalizedSmokeReportPath)) {
    assert.ok(
      fs.existsSync(canonicalManifestPath),
      'release closure requires artifacts/release-openapi-canonical/release-manifest.json when canonical packaged truth is present.',
    );
    assert.ok(
      fs.existsSync(canonicalFinalizedSmokeReportPath),
      'release closure requires artifacts/release-openapi-canonical/finalized-release-smoke-report.json when canonical packaged truth is present.',
    );
    validateLatestReleaseRegistryAgainstCanonicalTruth(
      latestReleaseEntry,
      JSON.parse(fs.readFileSync(canonicalManifestPath, 'utf8')),
      JSON.parse(fs.readFileSync(canonicalFinalizedSmokeReportPath, 'utf8')),
    );
  }

  assert.doesNotMatch(
    kubernetesValues,
    /tag:\s+latest/,
    'kubernetes values.yaml must not ship a mutable latest image tag',
  );
  assert.match(
    kubernetesDeployment,
    /image:\s+"?\{\{[^}]*\.Values\.image\.repository[^}]*\}\}@\{\{[^}]*\.Values\.image\.digest[^}]*\}\}"?/,
    'kubernetes deployment template must support digest-pinned images',
  );
  assert.match(
    kubernetesDeployment,
    /image:\s+"?\{\{[^}]*\.Values\.image\.repository[^}]*\}\}:\{\{[^}]*\.Values\.image\.tag[^}]*\}\}"?/,
    'kubernetes deployment template must support explicit tag fallback',
  );
  assert.match(
    workflow,
    /docker\/build-push-action@v6/,
    'release workflow must publish OCI images before kubernetes bundles are finalized',
  );
  assert.match(
    workflow,
    /container-image-metadata-\$\{\{ matrix\.arch \}\}/,
    'release workflow must persist published image metadata by architecture',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs kubernetes[\s\S]*--image-repository \$\{\{ steps\.image_metadata\.outputs\.image_repository \}\}[\s\S]*--image-tag \$\{\{ steps\.image_metadata\.outputs\.image_tag \}\}[\s\S]*--image-digest \$\{\{ steps\.image_metadata\.outputs\.image_digest \}\}/,
    'release workflow must stamp kubernetes bundles with the published image repository, tag, and digest',
  );
  assert.match(
    workflow,
    /smoke-desktop-installers\.mjs[\s\S]*smoke-desktop-packaged-launch\.mjs/s,
    'desktop release workflow must run installer and packaged launch smoke phases',
  );
  assert.doesNotMatch(
    workflow,
    /smoke-desktop-startup-evidence\.mjs/,
    'desktop startup smoke remains a local/manual BirdCoder release check and should not be required in the reusable release workflow',
  );
  assert.doesNotMatch(
    workflow,
    /smoke-release-assets\.mjs web/,
    'web release smoke should stay aligned with the Claw reusable release workflow and not add an extra web smoke step',
  );
  assert.match(
    workflow,
    /finalize-release-assets\.mjs[\s\S]*smoke-finalized-release-assets\.mjs --release-assets-dir release-assets[\s\S]*render-release-notes\.mjs --release-tag .* --output release-assets\/release-notes\.md/,
    'release workflow must run finalized smoke after finalization and before rendering release notes',
  );
  assert.match(
    kubernetesReadme,
    /immutable image tag/i,
    'kubernetes README must explain the immutable image tag contract',
  );
  assert.match(
    releaseDoc,
    /Release And Deployment/i,
    'release and deployment docs must expose the canonical Release And Deployment title',
  );
  assert.match(
    releaseDoc,
    /## Release Notes Source/,
    'release and deployment docs must include a dedicated Release Notes Source section',
  );
  assert.match(
    releaseDoc,
    /## Release Metadata Contract/,
    'release and deployment docs must include a dedicated Release Metadata Contract section',
  );
  assert.match(
    releaseDoc,
    /## GitHub Workflow/,
    'release and deployment docs must include a dedicated GitHub Workflow section',
  );
  assert.match(
    releaseDoc,
    /## Artifact Families/,
    'release and deployment docs must include a dedicated Artifact Families section',
  );
  assert.match(
    releaseDoc,
    /check:multi-mode/,
    'release and deployment docs must expose the unified multi-mode verification command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop-packaged-launch/,
    'release docs must expose the packaged desktop launch smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop-startup/,
    'release docs must expose the desktop startup smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:server/,
    'release docs must expose the server smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:container/,
    'release docs must expose the container smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:kubernetes/,
    'release docs must expose the kubernetes smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:finalized/,
    'release docs must expose the finalized release smoke command',
  );
  assert.match(
    releaseDoc,
    /Post-release operations and writeback:/,
    'release docs must describe post-release operations and writeback guidance',
  );
  assert.match(
    releaseDoc,
    /Rollback entry:/,
    'release docs must describe the rendered rollback entry guidance',
  );
  assert.match(
    releaseDoc,
    /Writeback targets:/,
    'release docs must describe the rendered writeback targets guidance',
  );
  assert.match(
    releaseDoc,
    /release-manifest\.json/,
    'release and deployment docs must describe the finalized release-manifest.json inventory surface',
  );
  assert.match(
    releaseDoc,
    /SHA256SUMS\.txt/,
    'release and deployment docs must describe the finalized SHA256SUMS.txt checksum surface',
  );
  assert.match(
    releaseDoc,
    /previewEvidence/,
    'release docs must describe the finalized previewEvidence manifest summary',
  );
  assert.match(
    releaseDoc,
    /buildEvidence/,
    'release docs must describe the finalized buildEvidence manifest summary',
  );
  assert.match(
    releaseDoc,
    /simulatorEvidence/,
    'release docs must describe the finalized simulatorEvidence manifest summary',
  );
  assert.match(
    releaseDoc,
    /testEvidence/,
    'release docs must describe the finalized testEvidence manifest summary',
  );
  assert.match(
    releaseDoc,
    /governanceEvidence/,
    'release docs must describe the finalized governanceEvidence manifest summary',
  );
  assert.match(
    releaseDoc,
    /studio\/preview\/studio-preview-evidence\.json/,
    'release docs must describe the studio preview evidence archive path',
  );
  assert.match(
    releaseDoc,
    /studio\/build\/studio-build-evidence\.json/,
    'release docs must describe the studio build evidence archive path',
  );
  assert.match(
    releaseDoc,
    /studio\/simulator\/studio-simulator-evidence\.json/,
    'release docs must describe the studio simulator evidence archive path',
  );
  assert.match(
    releaseDoc,
    /studio\/test\/studio-test-evidence\.json/,
    'release docs must describe the studio test evidence archive path',
  );
  assert.match(
    releaseDoc,
    /terminal\/governance\/terminal-governance-diagnostics\.json/,
    'release docs must describe the terminal governance evidence archive path',
  );
  assert.match(
    releaseDoc,
    /desktop/i,
    'release and deployment docs must describe the desktop artifact family',
  );
  assert.match(
    releaseDoc,
    /server/i,
    'release and deployment docs must describe the server artifact family',
  );
  assert.match(
    releaseDoc,
    /container/i,
    'release and deployment docs must describe the container artifact family',
  );
  assert.match(
    releaseDoc,
    /kubernetes/i,
    'release and deployment docs must describe the kubernetes artifact family',
  );
  assert.match(
    releaseDoc,
    /web/i,
    'release and deployment docs must describe the web artifact family',
  );
  assert.match(
    releaseDoc,
    /immutable image tags/i,
    'release docs must describe the immutable image tag contract',
  );
  assert.match(
    latestReleaseNote,
    /## Post-release operations/,
    'latest registry-backed release note must include the Post-release operations section.',
  );
  assert.match(
    latestReleaseNote,
    /Observation window:/,
    'latest registry-backed release note must include the observation window guidance.',
  );
  assert.match(
    latestReleaseNote,
    /Stop-ship signals:/,
    'latest registry-backed release note must include the stop-ship signals guidance.',
  );
  assert.match(
    latestReleaseNote,
    /Rollback entry:/,
    'latest registry-backed release note must include the rollback entry guidance.',
  );
  assert.match(
    latestReleaseNote,
    /Re-issue path:/,
    'latest registry-backed release note must include the re-issue path guidance.',
  );
  assert.match(
    latestReleaseNote,
    /Writeback targets:/,
    'latest registry-backed release note must include the writeback targets guidance.',
  );

  console.log('Release closure checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
