import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const infrastructureRoot = path.join(
  repositoryRoot,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure',
);
const infrastructureServicesRoot = path.join(infrastructureRoot, 'src/services');

for (const retiredFile of ['appSdkTransport.ts', 'sdkClients.ts']) {
  assert.equal(
    existsSync(path.join(infrastructureServicesRoot, retiredFile)),
    false,
    `${retiredFile} must remain retired; generated SDK clients are composed through PC core.`,
  );
}

function listTypeScriptSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptSources(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

for (const sourcePath of listTypeScriptSources(path.join(infrastructureRoot, 'src'))) {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /(?:from|import\s*\()[^'"\n]*['"][^'"]*(?:appSdkTransport|sdkClients)(?:\.ts)?['"]/u,
    `${path.relative(repositoryRoot, sourcePath)} must not restore a retired SDK facade or handwritten transport.`,
  );
}

const birdCoderClientSource = readFileSync(
  path.join(infrastructureServicesRoot, 'birdCoderSdkClient.ts'),
  'utf8',
);
assert.match(
  birdCoderClientSource,
  /from ['"]@sdkwork\/birdcoder-pc-core\/sdk\/birdcoder-app['"]/u,
  'The BirdCoder adapter must consume the application SDK through the PC core public composition entry.',
);
assert.match(
  birdCoderClientSource,
  /bindBirdCoderSdkSessionErrorHandler\(createClient\(/u,
  'The BirdCoder generated client must retain the shared unauthorized-session interceptor.',
);
assert.doesNotMatch(
  birdCoderClientSource,
  /createBirdCoderAppSdkApiClient|\bfetch\s*\(|\baxios\b|Authorization\s*:/u,
  'The BirdCoder adapter must not reintroduce the retired facade, raw HTTP, or manual auth headers.',
);

const dependencyClientSource = readFileSync(
  path.join(infrastructureServicesRoot, 'dependencyAppSdkClients.ts'),
  'utf8',
);
for (const coreSdkEntry of ['documents-app', 'prompts-app']) {
  assert.match(
    dependencyClientSource,
    new RegExp(`from ['"]@sdkwork/birdcoder-pc-core/sdk/${coreSdkEntry}['"]`, 'u'),
    `Dependency SDK composition must consume the PC core ${coreSdkEntry} entry.`,
  );
}
assert.doesNotMatch(
  dependencyClientSource,
  /from ['"]@sdkwork\/(?:documents|prompts)-app-sdk['"]/u,
  'Infrastructure must not bypass the PC core dependency SDK inventory.',
);
assert.match(
  dependencyClientSource,
  /resolveBirdCoderDependencySdkBaseUrl/u,
  'Dependency SDK clients must resolve through the platform/dependency topology boundary.',
);
assert.doesNotMatch(
  dependencyClientSource,
  /applicationApiBaseUrl|runtimeConfig\.apiBaseUrl|BIRDCODER_DEFAULT_LOCAL_API_BASE_URL/u,
  'Dependency SDK clients must never fall back to the BirdCoder application ingress or a local default.',
);

const sdkBaseUrlsSource = readFileSync(
  path.join(infrastructureServicesRoot, 'sdkBaseUrls.ts'),
  'utf8',
);
assert.match(sdkBaseUrlsSource, /resolveBirdCoderApplicationSdkBaseUrl/u);
assert.match(sdkBaseUrlsSource, /resolveBirdCoderPlatformSdkBaseUrl/u);
assert.match(sdkBaseUrlsSource, /resolveBirdCoderDependencySdkBaseUrl/u);
assert.doesNotMatch(
  sdkBaseUrlsSource,
  /BIRDCODER_DEFAULT_LOCAL_API_BASE_URL|runtimeConfig\.apiBaseUrl/u,
  'The connectivity-plane resolver must fail closed without legacy defaults.',
);

console.log('app SDK composition boundary contract passed.');
