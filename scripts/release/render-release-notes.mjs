import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { DEFAULT_RELEASE_PROFILE_ID, resolveReleaseProfile } from './release-profiles.mjs';
import { normalizeQualityEvidenceSummary } from './quality-gate-release-evidence.mjs';
import { normalizeCodingServerOpenApiEvidenceSummary } from './coding-server-openapi-release-evidence.mjs';
import {
  buildPromotionReadinessSummary,
  collectReleaseStopShipSignals,
  normalizePromotionReadinessSummary,
  normalizeStopShipSignals,
} from './release-stop-ship-governance.mjs';
import { refreshReleaseChecksumsIfPresent as refreshReleaseAssetChecksumsIfPresent } from './release-checksums.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..', '..');
const defaultReleaseDocsDir = path.resolve(workspaceRootDir, 'docs', 'release');

function printHelp() {
  console.log(`Usage: node scripts/release/render-release-notes.mjs --release-tag <tag> [--docs-dir <dir>] [--release-assets-dir <dir>] [--profile <id>] [--output <file>]

Render GitHub release notes from repository-owned release docs, with a local manifest fallback for release-local flows.

Options:
  --release-tag <tag>          Required release tag, for example release-2026-04-08-02
  --docs-dir <dir>             Override the release docs directory (default: docs/release)
  --release-assets-dir <dir>   Override the finalized release assets directory
  --profile <id>               Release profile id used for manifest fallback
  --output <file>              Write rendered notes to a file instead of stdout
  --help                       Show this help message
`);
}

export function parseArgs(argv) {
  const options = {
    releaseTag: '',
    docsDir: defaultReleaseDocsDir,
    releaseAssetsDir: '',
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    output: '',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (
      argument === '--release-tag'
      || argument === '--docs-dir'
      || argument === '--release-assets-dir'
      || argument === '--profile'
      || argument === '--output'
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}.`);
      }

      if (argument === '--release-tag') {
        options.releaseTag = value.trim();
      } else if (argument === '--docs-dir') {
        options.docsDir = path.resolve(process.cwd(), value);
      } else if (argument === '--release-assets-dir') {
        options.releaseAssetsDir = path.resolve(process.cwd(), value);
      } else if (argument === '--profile') {
        options.profileId = value.trim();
      } else {
        options.output = path.resolve(process.cwd(), value);
      }

      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export function buildReleaseNotesMarkdown({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = 'release-local',
  releaseAssetsDir = '',
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const manifest = readFinalizedReleaseManifest({
    profileId,
    releaseAssetsDir,
  });
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const generatedAt = String(manifest?.generatedAt ?? '').trim();

  const families = [...new Set(assets.map((entry) => entry.family).filter(Boolean))];

  return [
    `# ${profile.releaseName} ${releaseTag}`,
    '',
    `- Product: ${profile.productName}`,
    `- Profile: ${profileId}`,
    `- Asset families: ${families.length > 0 ? families.join(', ') : 'pending'}`,
    `- Finalized at: ${generatedAt || 'pending'}`,
    ...buildFinalizedReleaseReadinessOverviewLines(manifest),
    '',
    ...buildManifestEvidenceSections({
      manifest,
      releaseTag,
      releaseAssetsDir,
      docsDir: defaultReleaseDocsDir,
      notesFile: releaseTag !== 'release-local' ? `${releaseTag}.md` : '',
    }),
  ].join('\n');
}

function buildFinalizedReleaseReadinessOverviewLines(manifest = null) {
  if (!manifest?.qualityEvidence) {
    return [];
  }

  const normalized = normalizeQualityEvidenceSummary(manifest.qualityEvidence);
  const stopShipSignals = Array.isArray(manifest.stopShipSignals)
    ? normalizeStopShipSignals(manifest.stopShipSignals)
    : collectReleaseStopShipSignals({
      qualityEvidence: manifest.qualityEvidence,
      assets: manifest.assets ?? [],
      artifacts: manifest.artifacts ?? [],
    });
  const finalizedReadinessSignals = normalizeStopShipSignals([
    ...stopShipSignals,
    ...(Array.isArray(normalized.releaseReadinessSignals)
      ? normalized.releaseReadinessSignals
      : []),
  ]);

  return [
    `- Finalized release readiness: \`${finalizedReadinessSignals.length > 0 ? 'blocked' : 'clear'}\``,
    `- Finalized readiness signals: ${finalizedReadinessSignals.length > 0 ? finalizedReadinessSignals.join('; ') : '`none`'}`,
  ];
}

function readFinalizedReleaseManifest({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseAssetsDir = '',
} = {}) {
  const normalizedReleaseAssetsDir = String(releaseAssetsDir ?? '').trim();
  if (!normalizedReleaseAssetsDir) {
    return null;
  }

  const profile = resolveReleaseProfile(profileId);
  const manifestPath = path.resolve(
    process.cwd(),
    normalizedReleaseAssetsDir,
    profile.release.manifestFileName,
  );
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function buildQualityEvidenceSummaryLines(qualityEvidence) {
  const normalized = normalizeQualityEvidenceSummary(qualityEvidence);
  const tierSummary = normalized.tierIds.length > 0
    ? normalized.tierIds.map((tierId) => `\`${tierId}\``).join(', ')
    : 'pending';
  const blockingSummary = normalized.blockingDiagnosticIds.length > 0
    ? normalized.blockingDiagnosticIds.map((diagnosticId) => `\`${diagnosticId}\``).join(', ')
    : '`none`';

  const lines = [
    '## Quality evidence',
    '',
    `- Report: \`${normalized.archiveRelativePath || 'pending'}\``,
    `- Quality tiers: ${tierSummary}`,
    `- Workflow-bound tiers: \`${normalized.workflowBoundTiers}/${normalized.totalTiers}\``,
    `- Manifest-bound tiers: \`${normalized.manifestBoundTiers}/${normalized.totalTiers}\``,
    `- Environment diagnostics: \`${normalized.environmentDiagnostics}\``,
    `- Blocking diagnostics: ${blockingSummary}`,
  ];

  if (normalized.missingWorkflowBindings.length > 0) {
    lines.push(
      `- Missing workflow bindings: ${normalized.missingWorkflowBindings.map((tierId) => `\`${tierId}\``).join(', ')}`,
    );
  }

  if (normalized.missingManifestBindings.length > 0) {
    lines.push(
      `- Missing manifest bindings: ${normalized.missingManifestBindings.map((tierId) => `\`${tierId}\``).join(', ')}`,
    );
  }

  if (normalized.releaseGovernanceCheckIds.length > 0) {
    lines.push(
      `- Release governance checks: ${normalized.releaseGovernanceCheckIds.map((entry) => `\`${entry}\``).join(', ')}`,
    );
  }

  for (const diagnostic of normalized.blockingDiagnostics) {
    const appliesTo = diagnostic.appliesTo.length > 0
      ? diagnostic.appliesTo.map((entry) => `\`${entry}\``).join(', ')
      : '`n/a`';
    lines.push(
      `- Blocking detail: \`${diagnostic.id}\` (\`${diagnostic.classification || 'unknown'}\`; ${appliesTo}) - ${diagnostic.summary || 'pending'}`,
    );
    if (diagnostic.requiredCapabilities.length > 0) {
      lines.push(
        `- Required host capabilities for \`${diagnostic.id}\`: ${diagnostic.requiredCapabilities.map((entry) => `\`${entry}\``).join(', ')}`,
      );
    }
    if (diagnostic.rerunCommands.length > 0) {
      lines.push(
        `- Rerun sequence for \`${diagnostic.id}\`: ${diagnostic.rerunCommands.map((entry) => `\`${entry}\``).join(' -> ')}`,
      );
    }
  }

  if (normalized.executionArchiveRelativePath) {
    lines.push(`- Runtime execution report: \`${normalized.executionArchiveRelativePath}\``);
  }
  if (normalized.executionStatus) {
    lines.push(`- Runtime gate status: \`${normalized.executionStatus}\``);
  }
  if (normalized.lastExecutedTierId) {
    lines.push(`- Last executed tier: \`${normalized.lastExecutedTierId}\``);
  }
  if ((normalized.executionBlockingTierIds ?? []).length > 0) {
    lines.push(
      `- Blocked tiers: ${normalized.executionBlockingTierIds.map((entry) => `\`${entry}\``).join(', ')}`,
    );
  }
  if ((normalized.executionFailedTierIds ?? []).length > 0) {
    lines.push(
      `- Failed tiers: ${normalized.executionFailedTierIds.map((entry) => `\`${entry}\``).join(', ')}`,
    );
  }
  if ((normalized.executionSkippedTierIds ?? []).length > 0) {
    lines.push(
      `- Skipped tiers: ${normalized.executionSkippedTierIds.map((entry) => `\`${entry}\``).join(', ')}`,
    );
  }
  if ((normalized.executionBlockingDiagnosticIds ?? []).length > 0) {
    lines.push(
      `- Runtime blocking diagnostics: ${normalized.executionBlockingDiagnosticIds.map((entry) => `\`${entry}\``).join(', ')}`,
    );
  }
  if ((normalized.releaseReadinessSignals ?? []).length > 0) {
    lines.push(
      `- Release readiness signals: ${normalized.releaseReadinessSignals.join('; ')}`,
    );
  }

  const loopScoreboard = normalized.loopScoreboard ?? null;
  if (loopScoreboard) {
    lines.push(
      `- Loop scoreboard: \`architecture_alignment=${Number(loopScoreboard.architecture_alignment ?? 0)}\`, \`implementation_completeness=${Number(loopScoreboard.implementation_completeness ?? 0)}\`, \`test_closure=${Number(loopScoreboard.test_closure ?? 0)}\`, \`commercial_readiness=${Number(loopScoreboard.commercial_readiness ?? 0)}\``,
    );
    if (loopScoreboard.lowest_score_item) {
      lines.push(`- Lowest score item: \`${String(loopScoreboard.lowest_score_item).trim()}\``);
    }
    if (loopScoreboard.next_focus) {
      lines.push(`- Next focus: ${String(loopScoreboard.next_focus).trim()}`);
    }
  }

  lines.push('');
  return lines;
}

function buildCodingServerOpenApiEvidenceSummaryLines(summary) {
  if (!summary) {
    return [];
  }

  const normalized = normalizeCodingServerOpenApiEvidenceSummary(summary);
  return [
    '## Coding-server OpenAPI evidence',
    '',
    `- Canonical snapshot: \`${normalized.canonicalRelativePath || 'pending'}\``,
    `- Mirrored snapshots: ${normalized.mirroredRelativePaths.length > 0 ? normalized.mirroredRelativePaths.map((entry) => `\`${entry}\``).join(', ') : '`pending`'}`,
    `- Targets: ${normalized.targets.length > 0 ? normalized.targets.map((entry) => `\`${entry}\``).join(', ') : '`pending`'}`,
    `- Target count: \`${normalized.targetCount}\``,
    `- OpenAPI version: \`${normalized.openapi || 'pending'}\``,
    `- API version: \`${normalized.version || 'pending'}\``,
    `- Title: \`${normalized.title || 'pending'}\``,
    `- SHA256: \`${normalized.sha256 || 'pending'}\``,
    '',
  ];
}

function normalizeNotePath(targetPath) {
  const trimmed = String(targetPath ?? '').trim();
  if (!trimmed) {
    return 'pending';
  }

  const absolutePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(process.cwd(), trimmed);
  const rootRelativePath = path.relative(workspaceRootDir, absolutePath);
  const cwdRelativePath = path.relative(process.cwd(), absolutePath);
  const displayPath = rootRelativePath && !rootRelativePath.startsWith('..') && !path.isAbsolute(rootRelativePath)
    ? rootRelativePath
    : cwdRelativePath && !cwdRelativePath.startsWith('..') && !path.isAbsolute(cwdRelativePath)
      ? cwdRelativePath
      : trimmed;

  return displayPath.replace(/\\/g, '/');
}

function formatBooleanReadiness(value, { truthy = 'ready', falsy = 'not-ready' } = {}) {
  if (value === true) {
    return `\`${truthy}\``;
  }
  if (value === false) {
    return `\`${falsy}\``;
  }
  return '`pending`';
}

function formatCheckSummary(checks) {
  return Array.isArray(checks) && checks.length > 0
    ? checks
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => `\`${entry}\``)
      .join(', ')
    : '`pending`';
}

function resolveObservationGoal(releaseKind) {
  switch (String(releaseKind ?? '').trim()) {
    case 'canary':
      return 'Hold wider rollout until the canary ring stays stable for the full monitoring window.';
    case 'hotfix':
      return 'Verify incident symptom closure and absence of release regressions during the monitoring window.';
    case 'rollback':
      return 'Confirm rollback traffic and user flows recover on the restored release target.';
    case 'formal':
      return 'Observe general-availability health after publication before closing the release.';
    default:
      return 'Observe the active rollout until the release can be formally closed or rolled back.';
  }
}

function resolveFallbackRollbackEntryCommand({
  releaseTag = 'release-local',
  releaseAssetsDir = '',
} = {}) {
  const normalizedReleaseAssetsDir = normalizeNotePath(releaseAssetsDir || 'artifacts/release');
  const normalizedReleaseTag = String(releaseTag ?? '').trim() || 'release-local';

  return `pnpm release:rollback:plan -- --release-tag ${normalizedReleaseTag} --release-assets-dir ${normalizedReleaseAssetsDir}`;
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === ''
    || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function refreshRenderedReleaseChecksumsIfPresent({
  outputPath = '',
  releaseAssetsDir = '',
  profileId = DEFAULT_RELEASE_PROFILE_ID,
} = {}) {
  const normalizedOutputPath = String(outputPath ?? '').trim();
  const normalizedReleaseAssetsDir = String(releaseAssetsDir ?? '').trim();
  if (!normalizedOutputPath || !normalizedReleaseAssetsDir) {
    return;
  }

  const resolvedOutputPath = path.resolve(process.cwd(), normalizedOutputPath);
  const resolvedReleaseAssetsDir = path.resolve(process.cwd(), normalizedReleaseAssetsDir);
  if (!isPathInside(resolvedReleaseAssetsDir, resolvedOutputPath)) {
    return;
  }

  const manifest = readFinalizedReleaseManifest({
    profileId,
    releaseAssetsDir: resolvedReleaseAssetsDir,
  });
  const checksumFileName = String(
    manifest?.checksumFileName
    ?? resolveReleaseProfile(profileId).release.globalChecksumsFileName,
  ).trim();
  if (!checksumFileName) {
    return;
  }

  const checksumsPath = path.join(resolvedReleaseAssetsDir, checksumFileName);
  if (!fs.existsSync(checksumsPath)) {
    return;
  }

  refreshReleaseAssetChecksumsIfPresent({
    releaseAssetsDir: resolvedReleaseAssetsDir,
    checksumFileName,
  });
}

function buildPostReleaseOperationsLines({
  manifest = null,
  assets = [],
  releaseTag = 'release-local',
  releaseAssetsDir = '',
  docsDir = defaultReleaseDocsDir,
  notesFile = '',
} = {}) {
  if (!manifest) {
    return [];
  }

  const releaseControl = manifest.releaseControl ?? {};
  const rollbackEntryCommand = String(releaseControl.rollbackCommand ?? '').trim()
    || resolveFallbackRollbackEntryCommand({
      releaseTag,
      releaseAssetsDir,
    });
  const stopShipSignals = collectReleaseStopShipSignals({
    qualityEvidence: manifest.qualityEvidence ?? null,
    assets,
    artifacts: manifest.artifacts ?? [],
  });

  const registryTarget = normalizeNotePath(path.join(docsDir, 'releases.json'));
  const notesTarget = notesFile
    ? normalizeNotePath(path.join(docsDir, notesFile))
    : String(releaseTag ?? '').trim() && String(releaseTag ?? '').trim() !== 'release-local'
      ? normalizeNotePath(path.join(docsDir, `${String(releaseTag ?? '').trim()}.md`))
      : 'pending';
  const writebackTargets = notesTarget === 'pending'
    ? `\`${registryTarget}\``
    : `\`${registryTarget}\` and \`${notesTarget}\``;

  return [
    '## Post-release operations',
    '',
    `- Observation goal: ${resolveObservationGoal(releaseControl.releaseKind)}`,
    `- Observation window: \`${Number(releaseControl.monitoringWindowMinutes ?? 0)}\` minutes on \`${String(releaseControl.rolloutStage ?? '').trim() || 'pending'}\``,
    `- Stop-ship signals: ${stopShipSignals.length > 0 ? stopShipSignals.join('; ') : '`none` in finalized quality evidence'}`,
    `- Rollback entry: \`${rollbackEntryCommand}\``,
    `- Rollback runbook: \`${String(releaseControl.rollbackRunbookRef ?? '').trim() || 'pending'}\``,
    '- Re-issue path: `pnpm release:plan` -> affected `release:package:*` / `release:smoke:*` -> `pnpm release:finalize`',
    `- Writeback targets: ${writebackTargets}`,
    '',
  ];
}

function buildManifestEvidenceSections({
  manifest = null,
  releaseTag = 'release-local',
  releaseAssetsDir = '',
  docsDir = defaultReleaseDocsDir,
  notesFile = '',
} = {}) {
  if (manifest && !manifest.qualityEvidence) {
    throw new Error('Missing finalized manifest qualityEvidence summary.');
  }

  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const releaseControl = manifest?.releaseControl ?? null;
  const codingServerOpenApiEvidence = manifest?.codingServerOpenApiEvidence ?? null;
  const qualityEvidence = manifest?.qualityEvidence ?? null;
  const familySummaryLines = assets.length > 0
    ? assets.map((entry) => {
      const targetLabel = [entry.platform, entry.arch, entry.accelerator]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join('/');
      const smokeState = entry.desktopStartupSmoke?.status
        || entry.releaseSmoke?.status
        || 'pending';
      const detailParts = [`smoke: \`${smokeState}\``];

      if (entry.family === 'desktop' && entry.desktopStartupReadinessSummary) {
        detailParts.push(
          `startup readiness: ${formatBooleanReadiness(entry.desktopStartupReadinessSummary.ready)}`,
          `shell mounted: ${formatBooleanReadiness(entry.desktopStartupReadinessSummary.shellMounted, { truthy: 'yes', falsy: 'no' })}`,
          `workspace bootstrap: ${formatCheckSummary(entry.desktopStartupReadinessSummary.workspaceBootstrapChecks)}`,
          `local project recovery: ${formatCheckSummary(entry.desktopStartupReadinessSummary.localProjectRecoveryChecks)}`,
        );
      }

      return `- \`${entry.family}\`${targetLabel ? ` [${targetLabel}]` : ''}: \`${entry.file}\` (${detailParts.join('; ')})`;
    })
    : ['- Release assets will be listed after finalize step runs.'];
  const releaseControlSummaryLines = releaseControl
    ? [
      '## Release control',
      '',
      `- Release kind: \`${String(releaseControl.releaseKind ?? '').trim() || 'pending'}\``,
      `- Rollout stage: \`${String(releaseControl.rolloutStage ?? '').trim() || 'pending'}\``,
      `- Monitoring window: \`${Number(releaseControl.monitoringWindowMinutes ?? 0)}\` minutes`,
      `- Rollback runbook: \`${String(releaseControl.rollbackRunbookRef ?? '').trim() || 'pending'}\``,
      `- Rollback command: \`${String(releaseControl.rollbackCommand ?? '').trim() || 'pending'}\``,
      '',
    ]
    : [];
  return [
    ...releaseControlSummaryLines,
    '## Included assets',
    '',
    ...familySummaryLines,
    '',
    ...buildCodingServerOpenApiEvidenceSummaryLines(codingServerOpenApiEvidence),
    ...buildQualityEvidenceSummaryLines(qualityEvidence),
    ...buildPostReleaseOperationsLines({
      manifest,
      assets,
      releaseTag,
      releaseAssetsDir,
      docsDir,
      notesFile,
    }),
  ];
}

export function readReleaseRegistry(docsDir) {
  const registryPath = path.join(docsDir, 'releases.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Missing release registry at ${registryPath}.`);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (!Array.isArray(registry?.releases)) {
    throw new Error(`Invalid release registry at ${registryPath}: missing releases array.`);
  }

  return {
    registry,
    registryPath,
    releases: registry.releases,
  };
}

function findReleaseEntry(releases, releaseTag) {
  const entry = releases.find((candidate) => candidate?.tag === releaseTag);
  if (!entry) {
    throw new Error(`No release document metadata found for ${releaseTag}.`);
  }

  if (typeof entry.notesFile !== 'string' || entry.notesFile.trim() === '') {
    throw new Error(`Release ${releaseTag} is missing notesFile metadata.`);
  }

  return entry;
}

function readReleaseNotesMarkdown(entry, docsDir) {
  const notesPath = path.join(docsDir, entry.notesFile);
  if (!fs.existsSync(notesPath)) {
    throw new Error(`Missing release notes file for ${entry.tag}: ${notesPath}.`);
  }

  return fs.readFileSync(notesPath, 'utf8').trim();
}

function buildRegistryPromotionMetadata(manifest = null) {
  if (!manifest?.qualityEvidence) {
    return null;
  }

  const stopShipSignals = Array.isArray(manifest.stopShipSignals)
    ? normalizeStopShipSignals(manifest.stopShipSignals)
    : collectReleaseStopShipSignals({
      qualityEvidence: manifest.qualityEvidence,
      assets: manifest.assets ?? [],
      artifacts: manifest.artifacts ?? [],
    });
  const promotionReadiness = manifest.promotionReadiness
    ? normalizePromotionReadinessSummary(manifest.promotionReadiness)
    : buildPromotionReadinessSummary({
      releaseControl: manifest.releaseControl ?? null,
      stopShipSignals,
    });

  return {
    stopShipSignals,
    promotionReadiness,
  };
}

function writeReleaseRegistryPromotionMetadata({
  docsDir = defaultReleaseDocsDir,
  releaseTag = '',
  finalizedManifest = null,
} = {}) {
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  if (!normalizedReleaseTag || !finalizedManifest?.qualityEvidence) {
    return false;
  }

  const promotionMetadata = buildRegistryPromotionMetadata(finalizedManifest);
  if (!promotionMetadata) {
    return false;
  }

  const { registry, registryPath, releases } = readReleaseRegistry(docsDir);
  const releaseIndex = releases.findIndex((candidate) => candidate?.tag === normalizedReleaseTag);
  if (releaseIndex < 0) {
    return false;
  }

  const nextEntry = {
    ...releases[releaseIndex],
    ...promotionMetadata,
  };
  const nextReleases = releases.slice();
  nextReleases[releaseIndex] = nextEntry;
  const nextRegistry = {
    ...registry,
    releases: nextReleases,
  };
  const previousSerialized = fs.readFileSync(registryPath, 'utf8').trim();
  const nextSerialized = JSON.stringify(nextRegistry, null, 2);
  if (previousSerialized === nextSerialized) {
    return false;
  }

  fs.writeFileSync(registryPath, `${nextSerialized}\n`, 'utf8');
  return true;
}

function renderDocsReleaseNotes({
  releaseTag,
  docsDir = defaultReleaseDocsDir,
  releaseAssetsDir = '',
  profileId = DEFAULT_RELEASE_PROFILE_ID,
}) {
  const { releases } = readReleaseRegistry(docsDir);
  const entry = findReleaseEntry(releases, releaseTag);
  const carriedForwardEntries = Array.isArray(entry.carryForward)
    ? entry.carryForward.map((tag) => findReleaseEntry(releases, tag))
    : [];
  const finalizedManifest = readFinalizedReleaseManifest({
    profileId,
    releaseAssetsDir,
  });

  const sections = [
    `# ${entry.title || entry.tag}`,
    '',
    `- Tag: \`${entry.tag}\``,
    `- Date: ${entry.date || 'Unknown'}`,
    `- Status: ${entry.status || 'pending'}`,
  ];

  if (typeof entry.summary === 'string' && entry.summary.trim().length > 0) {
    sections.push(`- Summary: ${entry.summary.trim()}`);
  }
  if (finalizedManifest) {
    sections.push(...buildFinalizedReleaseReadinessOverviewLines(finalizedManifest));
  }

  sections.push('', readReleaseNotesMarkdown(entry, docsDir));

  if (carriedForwardEntries.length > 0) {
    sections.push('', '## Carried Forward From Earlier Unpublished Tags');

    for (const carriedEntry of carriedForwardEntries) {
      sections.push(
        '',
        `### ${carriedEntry.tag}`,
        '',
        `Status: ${carriedEntry.status || 'pending'}`,
        '',
        readReleaseNotesMarkdown(carriedEntry, docsDir),
      );
    }
  }

  if (finalizedManifest) {
    const finalizedAt = String(finalizedManifest.generatedAt ?? '').trim() || 'pending';
    sections.push(
      '',
      '## Finalized Release Evidence',
      '',
      `- Finalized at: ${finalizedAt}`,
      '',
      ...buildManifestEvidenceSections({
        manifest: finalizedManifest,
        releaseTag,
        releaseAssetsDir,
        docsDir,
        notesFile: entry.notesFile,
      }),
    );
  }

  return `${sections.join('\n').trim()}\n`;
}

function normalizeRenderOptions(rawOptions = {}) {
  const output = rawOptions.output
    ? path.resolve(process.cwd(), rawOptions.output)
    : '';
  const releaseAssetsDir = rawOptions['release-assets-dir']
    ? path.resolve(process.cwd(), rawOptions['release-assets-dir'])
    : rawOptions.releaseAssetsDir
      ? path.resolve(process.cwd(), rawOptions.releaseAssetsDir)
      : output
        ? path.dirname(output)
        : '';

  return {
    releaseTag: String(rawOptions['release-tag'] ?? rawOptions.releaseTag ?? 'release-local').trim() || 'release-local',
    docsDir: path.resolve(process.cwd(), rawOptions['docs-dir'] ?? rawOptions.docsDir ?? defaultReleaseDocsDir),
    releaseAssetsDir,
    profileId: String(rawOptions.profile ?? rawOptions.profileId ?? DEFAULT_RELEASE_PROFILE_ID).trim() || DEFAULT_RELEASE_PROFILE_ID,
    output,
  };
}

function shouldFallbackToManifest(error, releaseTag) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    String(releaseTag ?? '').trim() === 'release-local'
    && /^(Missing release registry at|No release document metadata found for )/.test(error.message)
  );
}

export function renderReleaseNotes(rawOptions = {}) {
  const options = normalizeRenderOptions(rawOptions);
  let markdown = '';

  try {
    markdown = renderDocsReleaseNotes({
      releaseTag: options.releaseTag,
      docsDir: options.docsDir,
      releaseAssetsDir: options.releaseAssetsDir,
      profileId: options.profileId,
    });
  } catch (error) {
    if (!shouldFallbackToManifest(error, options.releaseTag)) {
      throw error;
    }
  }

  if (!markdown) {
    markdown = buildReleaseNotesMarkdown({
      profileId: options.profileId,
      releaseTag: options.releaseTag,
      releaseAssetsDir: options.releaseAssetsDir,
    });
  }

  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, markdown);
    const finalizedManifest = readFinalizedReleaseManifest({
      profileId: options.profileId,
      releaseAssetsDir: options.releaseAssetsDir,
    });
    writeReleaseRegistryPromotionMetadata({
      docsDir: options.docsDir,
      releaseTag: options.releaseTag,
      finalizedManifest,
    });
    refreshRenderedReleaseChecksumsIfPresent({
      outputPath: options.output,
      releaseAssetsDir: options.releaseAssetsDir,
      profileId: options.profileId,
    });
  }

  return markdown;
}

export {
  defaultReleaseDocsDir,
  renderDocsReleaseNotes,
};

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.releaseTag) {
    throw new Error('Missing required --release-tag argument.');
  }

  const markdown = renderReleaseNotes({
    releaseTag: options.releaseTag,
    docsDir: options.docsDir,
    releaseAssetsDir: options.releaseAssetsDir,
    profileId: options.profileId,
    output: options.output,
  });

  if (!options.output) {
    process.stdout.write(markdown);
  }
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
