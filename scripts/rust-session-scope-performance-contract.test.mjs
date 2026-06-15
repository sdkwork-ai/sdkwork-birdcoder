import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
);

const coreSessionsStart = source.indexOf('async fn core_sessions(');
const coreNativeSessionStart = source.indexOf('async fn core_native_session(');
assert.notEqual(coreSessionsStart, -1, 'core_sessions route handler must exist.');
assert.notEqual(coreNativeSessionStart, -1, 'core_native_session route handler must exist.');

const coreSessionsSource = source.slice(coreSessionsStart, coreNativeSessionStart);

assert.match(
  coreSessionsSource,
  /filter_projects_by_scope\(\s*console_state\.projects,\s*normalized_workspace_id\.as_deref\(\),\s*normalized_project_id\.as_deref\(\),\s*\)/u,
  'core_sessions must apply projectId before native-session discovery instead of scanning every project in the workspace.',
);
assert.match(
  coreSessionsSource,
  /native_sessions::NativeSessionQuery\s*\{[\s\S]*?project_id:\s*normalized_project_id\.clone\(\),/u,
  'core_sessions must pass projectId into NativeSessionQuery so native providers do not scan unrelated projects.',
);

console.log('rust session scope performance contract passed.');
