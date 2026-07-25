import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';

const appSource = readBirdcoderAppShellSource();

assert.match(
  appSource,
  /buildProjectAgentSessionIndex/,
  'App must import the shared project/session index utilities for shell-level selection performance.',
);

assert.match(
  appSource,
  /const projectsIndex = useMemo\(\s*\(\) => buildProjectAgentSessionIndex\(projects\),\s*\[projects\],\s*\);/,
  'App must build one memoized project/session index for canonical Agents Project inventory.',
);

assert.match(
  appSource,
  /latestAgentSessionIdByProjectId\.get\(projectId\)/,
  'App must resolve latest coding session ids through the shared index cache instead of project-array scans.',
);

assert.match(
  appSource,
  /projectsIndex\.projectsById\.get\(effectiveProjectId\)/,
  'App must resolve the active project through the shared index instead of repeated array finds.',
);

assert.match(
  appSource,
  /projectsIndex\.projectsById\.has\(activeProjectId\)/,
  'App must validate the selected project through the shared index instead of repeated array scans.',
);

assert.doesNotMatch(
  appSource,
  /activeProjectsIndex|menuProjectsIndex|resolveImmediateProjectIndex/,
  'App must not maintain duplicate project indexes after converging on one canonical Agents Project collection.',
);

console.log('app shell selection index performance contract passed.');
