#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function main() {
  const workflow = read('.github/workflows/release-reusable.yml');
  const kubernetesValues = read('deploy/kubernetes/values.yaml');
  const kubernetesDeployment = read('deploy/kubernetes/templates/deployment.yaml');
  const kubernetesReadme = read('deploy/kubernetes/README.md');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const releaseRegistry = JSON.parse(read('docs/release/releases.json'));
  const latestReleaseEntry = releaseRegistry.releases.at(-1);

  assert.ok(
    latestReleaseEntry?.notesFile,
    'release registry must expose a latest release note entry with notesFile metadata.',
  );

  const latestReleaseNote = read(path.join('docs/release', latestReleaseEntry.notesFile));

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

main();
