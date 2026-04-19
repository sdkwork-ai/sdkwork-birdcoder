import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(
  appSource,
  /buildProjectCodingSessionIndex/,
  'App must import the shared project/session index utilities for shell-level selection performance.',
);

assert.match(
  appSource,
  /const resolveImmediateProjectIndex = useCallback\(/,
  'App must centralize immediate workspace/project index resolution so selection flows do not rebuild array-scan logic inline.',
);

assert.match(
  appSource,
  /latestCodingSessionIdByProjectId\.get\(projectId\)/,
  'App must resolve latest coding session ids through the shared index cache instead of project-array scans.',
);

assert.match(
  appSource,
  /const activeProjectsIndex = useMemo\(\s*\(\) => buildProjectCodingSessionIndex\(activeProjects\)/,
  'App must build a memoized project/session index for the active workspace instead of repeatedly scanning project arrays.',
);

assert.match(
  appSource,
  /const menuProjectsIndex = useMemo\(\s*\(\) => buildProjectCodingSessionIndex\(menuProjects\)/,
  'App must build a memoized project/session index for the workspace menu project collection.',
);

assert.match(
  appSource,
  /activeProjectsIndex\.projectsById\.get\(effectiveProjectId\)/,
  'App must resolve the active project through the shared index instead of repeated array finds.',
);

assert.match(
  appSource,
  /activeProjectsIndex\.projectsById\.has\(activeProjectId\)/,
  'App must validate the selected project through the shared index instead of repeated array scans.',
);

console.log('app shell selection index performance contract passed.');
