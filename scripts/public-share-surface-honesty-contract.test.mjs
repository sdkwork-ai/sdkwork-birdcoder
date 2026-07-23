import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const codeShareSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/TopBar.tsx',
);
const studioCollaborationSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioCollaboration.ts',
);
const studioShareSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPageDialogs.tsx',
);
const collaborationServiceSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/ICollaborationService.ts',
);
const appOpenApi = JSON.parse(
  readText('sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json'),
);
const shareLocaleSources = [
  readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/app/collaboration.ts',
  ),
  readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/app/collaboration.ts',
  ),
  readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/studio/dialogs.ts',
  ),
  readText(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/studio/dialogs.ts',
  ),
];

for (const [surface, source] of [
  ['Code', codeShareSource],
  ['Studio collaboration hook', studioCollaborationSource],
  ['Studio dialog', studioShareSource],
]) {
  assert.doesNotMatch(
    source,
    /https:\/\/ide\.sdkwork\.com\/p\/|publicShareUrl|handleCopyPublicLink/u,
    `${surface} must not manufacture or copy a public project URL without an authoritative share grant.`,
  );
}

assert.doesNotMatch(
  collaborationServiceSource,
  /publicShare|shareUrl|shareToken|createProjectShare|publishProjectShare/iu,
  'The collaboration service currently has no server-backed public-share grant contract.',
);

const projectSharePaths = Object.keys(appOpenApi.paths ?? {}).filter(
  (routePath) => /project/iu.test(routePath) && /share|public/iu.test(routePath),
);
assert.deepEqual(
  projectSharePaths,
  [],
  'The app OpenAPI must not be treated as a public-share authority until it exposes an explicit project share route.',
);

assert.match(
  codeShareSource,
  /disabled\s+aria-describedby="code-public-share-unavailable"/u,
  'Code must expose the public-link choice as unavailable instead of an actionable access mode.',
);
assert.match(
  studioShareSource,
  /disabled\s+aria-describedby="studio-public-share-unavailable"/u,
  'Studio must expose the public-link choice as unavailable instead of an actionable access mode.',
);

for (const [surface, source, namespace] of [
  ['Code', codeShareSource, 'app'],
  ['Studio', studioShareSource, 'studio'],
]) {
  assert.match(
    source,
    new RegExp(`t\\('${namespace}\\.publicLinkUnavailable'\\)`, 'u'),
    `${surface} must label the public-link option as unavailable.`,
  );
  assert.match(
    source,
    new RegExp(`t\\('${namespace}\\.publicLinkUnavailableDesc'\\)`, 'u'),
    `${surface} must state that no public access exists and the project remains private.`,
  );
}

for (const localeSource of shareLocaleSources) {
  assert.match(
    localeSource,
    /"publicLinkUnavailable"\s*:/u,
    'Every share locale must label public links as unavailable.',
  );
  assert.match(
    localeSource,
    /"publicLinkUnavailableDesc"\s*:/u,
    'Every share locale must explain that the project remains private.',
  );
  assert.doesNotMatch(
    localeSource,
    /"linkCopied"\s*:/u,
    'Share locales must not retain copy-success messaging for a non-existent public link.',
  );
}

assert.match(
  codeShareSource,
  /collaborationService\.upsertProjectCollaborator/u,
  'Code must retain the real collaborator invitation flow.',
);
assert.match(
  studioCollaborationSource,
  /collaborationService\.upsertProjectCollaborator/u,
  'Studio must retain the real collaborator invitation flow.',
);

console.log('public share surface honesty contract passed.');
