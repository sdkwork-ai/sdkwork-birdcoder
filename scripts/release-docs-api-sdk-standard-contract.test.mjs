import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const releaseDocsDir = path.join(rootDir, 'docs', 'release');

const forbiddenReleaseDocPatterns = [
  {
    pattern: /\/api\/(?:core|admin)\/v\d+/iu,
    message: 'release docs must not preserve retired core/admin API prefixes.',
  },
  {
    pattern: /\bApp\/Admin\b/u,
    message: 'release docs must describe the canonical app/backend split instead of App/Admin.',
  },
  {
    pattern: /\b(?:appAdminApiClient|BirdCoderAppAdminApiClient|createBirdCoderGeneratedAppAdminApiClient)\b/u,
    message: 'release docs must not preserve retired mixed app-admin SDK client names.',
  },
  {
    pattern:
      /\b(?:ICore(?:Read|Write)Service|ApiBackedCore(?:Read|Write)Service|core(?:Read|Write)Service)\b/u,
    message: 'release docs must not preserve retired core runtime service names.',
  },
  {
    pattern:
      /\b(?:createBirdCoderGeneratedCore(?:Read|Write)ApiClient|BirdCoderCore(?:Read|Write)ApiClient|BIRDCODER_SHARED_CORE_FACADE)\b/u,
    message: 'release docs must not preserve retired generated core SDK facade names.',
  },
  {
    pattern: /\bshared core\b|\bgenerated core\b/iu,
    message: 'release docs must describe app-runtime SDK/facade ownership instead of shared/generated core.',
  },
  {
    pattern: /\bcore\.(?:createAgentSession|createAgentSessionTurn|submitApprovalDecision)\b/u,
    message: 'release docs must describe app-runtime operation ownership instead of retired core operation ids.',
  },
  {
    pattern: /\bcore\.[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*\b/u,
    message: 'release docs must not preserve retired core operation ids.',
  },
  {
    pattern: /\b17-Coding-Server-Core-App\b/u,
    message: 'release docs must point to the canonical Step 17 app/backend SDK document.',
  },
  {
    pattern:
      /\b(?:default-ide-services-core-read-service-contract|api-backed-project-service-core-create-coding-session(?:-turn)?-contract)\b/u,
    message: 'release docs must not preserve retired core-named contract script ids.',
  },
  {
    pattern:
      /node --experimental-strip-types scripts\/split-sdk-(?:client-facade|consumer)-contract\.test\.ts/u,
    message: 'release docs must use the current run-local-tsx command for split SDK TypeScript contracts.',
  },
  {
    pattern:
      /\b(?:runtime-bound core HTTP|core API|core turn API|core session SSE projection|core projection(?: resources| reads and writes| read facade)?|core route skeleton|core stub)\b/iu,
    message: 'release docs must use app-runtime wording for runtime API and projection lanes.',
  },
  {
    pattern: /\b(?:unified `core` prefixes|`core` handlers|`core`, `app`, and `admin`)\b/iu,
    message: 'release docs must not preserve retired core/admin surface transition wording.',
  },
  {
    pattern:
      /\b(?:generated-app\/backend-client-facade-contract|app\/backend-sdk-consumer-contract|no-app\/backend-client-wrapper-contract)\b/u,
    message: 'release docs must not preserve old mixed app/backend script path names.',
  },
  {
    pattern: /\/backend\/v3\/api\/platform\/projects\b/u,
    message: 'release docs must not duplicate the platform resource domain inside backend route paths.',
  },
];

function listReleaseDocFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listReleaseDocFiles(absolutePath));
      continue;
    }

    if (entry.name.endsWith('.md') || entry.name === 'releases.json') {
      files.push(absolutePath);
    }
  }

  return files;
}

const violations = [];

for (const absolutePath of listReleaseDocFiles(releaseDocsDir)) {
  const relativePath = path.relative(rootDir, absolutePath).replaceAll(path.sep, '/');
  const source = fs.readFileSync(absolutePath, 'utf8');

  for (const { message, pattern } of forbiddenReleaseDocPatterns) {
    const match = source.match(pattern);
    if (match) {
      violations.push(`${relativePath}: ${message} Found "${match[0]}".`);
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `release docs must align with canonical API_SPEC and SDK_SPEC language:\n${violations.join('\n')}`,
);

console.log('release docs API/SDK standard contract passed.');
