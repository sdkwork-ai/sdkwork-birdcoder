import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const studioPagePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioChatSidebar.tsx',
);

const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');

assert.match(
  studioPageSource,
  /<div className="flex-1 min-h-0">\s*<DeferredUniversalChat/s,
  'StudioChatSidebar sidebar chat must keep the deferred chat surface inside a flex-1 min-h-0 container so the chat body fits below the header.',
);

assert.match(
  studioPageSource,
  /currentProjectId && selectedAgentSessionId[\s\S]*`\$\{currentProjectId\}\\u0001\$\{selectedAgentSessionId\}`/s,
  'StudioChatSidebar must scope transcript virtualization by the canonical Agents project and session identifiers.',
);
assert.doesNotMatch(
  studioPageSource,
  /workspaceId|currentProjectWorkspaceId/u,
  'StudioChatSidebar must not restore a second Workspace scope around canonical Agents project/session identity.',
);

console.log('studio chat layout contract passed.');
