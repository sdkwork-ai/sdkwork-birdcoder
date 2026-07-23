import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shell = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx",
);
const hook = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useWorkbenchAgentSessionCreationActions.ts",
);
const creation = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionCreation.ts",
);
const projects = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts",
);
const services = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts",
);
const workspaceMenu = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppWorkspaceMenu.tsx",
);
const multiWindow = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/pages/MultiWindowProgrammingPage.tsx",
);
const desktopMain = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src/main.tsx",
);
const desktopRuntime = read(
  "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapDesktopRuntime.ts",
);

assert.equal(
  (shell.match(/useWorkbenchChatSelection\(/g) ?? []).length,
  1,
  "The shell must have one engine/model selection boundary for every new-session entry.",
);
assert.equal(
  (shell.match(/useWorkbenchAgentSessionCreationActions\(/g) ?? []).length,
  1,
  "The shell must have one UI-facing session creation use case.",
);
assert.doesNotMatch(
  shell,
  /createMenuAgentSessionWithSelection|createActiveAgentSessionWithSelection/,
);
assert.match(shell, /source: 'file-menu'/);
assert.match(shell, /source: 'keyboard-shortcut'/);
assert.match(shell, /source: 'workspace-menu'/);
assert.match(
  shell,
  /modelId: newSessionEngineCatalog\.preferredSelection\.modelId/,
);
assert.match(workspaceMenu, /engine\.modelId/);
assert.match(hook, /normalizeCreateNewAgentSessionRequest\(/);
assert.match(hook, /inFlightCreationsRef/);
assert.match(hook, /creation\.promise/);
assert.match(hook, /!creation\.selected[\s\S]*actionOptions\?\.shouldSelectCreatedSession/);
assert.match(hook, /actionOptions\?\.showSuccessToast !== false/);
assert.match(multiWindow, /useWorkbenchAgentSessionCreationActions\(/);
assert.equal(
  (multiWindow.match(/await createAgentSession\(/g) ?? []).length,
  0,
  "Multi-window manual and automatic session creation must not bypass the unified Workbench command.",
);
assert.equal(
  (multiWindow.match(/source: 'multi-window'/g) ?? []).length,
  2,
  "Multi-window manual and provisioning requests must preserve their source.",
);
assert.match(desktopMain, /readDesktopRuntimeConfig\(/);
assert.match(desktopMain, /publishBirdCoderDesktopSdkRuntimeEnv\(runtimeConfig\)/);
assert.match(desktopMain, /executionLocation: runtimeConfig\.executionLocation/);
assert.match(
  desktopRuntime,
  /topology\.executionLocation === 'cloud-workspace'[\s\S]*configuredApiBaseUrl/,
  "Cloud desktop must resolve its configured remote API without reading the embedded runtime.",
);
assert.doesNotMatch(
  desktopRuntime,
  /publishBirdCoderRuntimeEnvPatch\(\{[\s\S]{0,1200}VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone'/,
  "Generic desktop runtime publication must not overwrite cloud deployments as standalone.",
);
assert.match(shell, /e\.preventDefault\(\);\s*if \(e\.repeat\) return;/);
assert.match(
  creation,
  /ensureWorkbenchAgentSessionForMessage\([\s\S]*createAgentSessionFromRequest[\s\S]*source: 'message-submit'[\s\S]*showSuccessToast: false/,
  "Implicit first-message session creation must use the same typed command without a redundant success toast.",
);
assert.doesNotMatch(
  creation,
  /ensureWorkbenchAgentSessionForMessage\([\s\S]*createWorkbenchAgentSessionInProject\(/,
  "Implicit message submission must not bypass the unified request command.",
);
assert.match(projects, /resolveProjectRuntimeLocationExecutionId\(/);
assert.equal(
  (projects.match(/projectService\.createAgentSession\(/g) ?? []).length,
  1,
  "All useProjects new-session consumers must converge on one persistence call.",
);
assert.match(
  services,
  /runtimeTopology\.executionLocation === 'local-host'[\s\S]*\? runtimeFileSystemService[\s\S]*: new DriveSandboxProjectFileSystemService\(\{[\s\S]*allowLocalFallback: false/,
  "Runtime composition must select one filesystem authority and forbid local fallback in remote mode.",
);

console.log("new session creation architecture contract passed.");
