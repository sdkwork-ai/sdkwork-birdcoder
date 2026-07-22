import assert from "node:assert/strict";

import type { IFileSystemService } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IFileSystemService.ts";
import { ProjectRuntimeLocationExecutionUnavailableError } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectRuntimeLocationService.ts";
import { RuntimeProjectRuntimeLocationService } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeProjectRuntimeLocationService.ts";
import {
  DriveSandboxProjectFileSystemService,
  ProjectWorkspaceBindingRequiredError,
} from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/DriveSandboxProjectFileSystemService.ts";
import { resolveBirdCoderRuntimeTopology } from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeTopology.ts";
import {
  publishBirdCoderDesktopSdkRuntimeEnv,
  readDesktopRuntimeConfig,
} from "../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapDesktopRuntime.ts";
import type { SandboxExplorerPort } from "@sdkwork/drive-pc-sandbox-contracts";

assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: "standalone",
    runtimeTarget: "browser",
  }).executionLocation,
  "cloud-workspace",
);
assert.deepEqual(
  await readDesktopRuntimeConfig({
    configuredApiBaseUrl: "https://api.example.com/birdcoder/",
    deploymentProfile: "cloud",
  }),
  {
    apiBaseUrl: "https://api.example.com/birdcoder",
    deploymentProfile: "cloud",
    executionLocation: "cloud-workspace",
    runtimeTarget: "desktop",
  },
  "Remote desktop must resolve its configured API without invoking the embedded local runtime.",
);
const runtimeEnvHost = globalThis as typeof globalThis & {
  __SDKWORK_PC_REACT_ENV__?: Record<string, string>;
};
const previousRuntimeEnv = runtimeEnvHost.__SDKWORK_PC_REACT_ENV__;
runtimeEnvHost.__SDKWORK_PC_REACT_ENV__ = {
  VITE_SDKWORK_APPBASE_APP_API_BASE_URL: "https://platform.example.com",
};
publishBirdCoderDesktopSdkRuntimeEnv({
  apiBaseUrl: "https://birdcoder.example.com",
  deploymentProfile: "cloud",
  executionLocation: "cloud-workspace",
  runtimeTarget: "desktop",
});
assert.equal(
  runtimeEnvHost.__SDKWORK_PC_REACT_ENV__.VITE_SDKWORK_APPBASE_APP_API_BASE_URL,
  "https://platform.example.com",
  "Remote desktop must preserve the platform SDK gateway instead of replacing it with the BirdCoder API URL.",
);
assert.equal(
  runtimeEnvHost.__SDKWORK_PC_REACT_ENV__.VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL,
  "https://birdcoder.example.com",
);
runtimeEnvHost.__SDKWORK_PC_REACT_ENV__ = previousRuntimeEnv;
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: "cloud",
    runtimeTarget: "browser",
  }).executionLocation,
  "cloud-workspace",
);
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: "standalone",
    runtimeTarget: "desktop",
  }).executionLocation,
  "local-host",
);
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: "cloud",
    runtimeTarget: "desktop",
  }).executionLocation,
  "cloud-workspace",
);
assert.equal(
  resolveBirdCoderRuntimeTopology({
    deploymentProfile: "standalone",
    executionLocation: "cloud-workspace",
    runtimeTarget: "desktop",
  }).executionLocation,
  "cloud-workspace",
);

let remoteLocalFileSystemCalls = 0;
let remotePickerCalls = 0;
const remoteService = new RuntimeProjectRuntimeLocationService({
  executionLocation: "cloud-workspace",
  fileSystemService: new Proxy(
    {},
    {
      get() {
        return async () => {
          remoteLocalFileSystemCalls += 1;
          throw new Error(
            "remote execution must not inspect the local file system",
          );
        };
      },
    },
  ) as IFileSystemService,
  openLocalFolder: async () => {
    remotePickerCalls += 1;
    return { status: "cancelled" };
  },
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation() {
      throw new Error("remote execution must not inspect a desktop binding");
    },
    async resolvePreferredProjectRuntimeLocationId(projectId, capability) {
      assert.equal(projectId, "project-remote");
      assert.equal(capability, "terminal");
      return "runtime-location-server-1";
    },
    async synchronizeLocalDesktopRuntimeLocation() {
      throw new Error(
        "remote execution must not synchronize a desktop binding",
      );
    },
  },
});
assert.equal(
  await remoteService.resolveProjectRuntimeLocationExecutionId(
    "project-remote",
    "terminal",
    { allowFolderSelection: true },
  ),
  "runtime-location-server-1",
);
assert.equal(remoteLocalFileSystemCalls, 0);
assert.equal(remotePickerCalls, 0);

let forbiddenLocalFallbackCalls = 0;
const remoteFileSystem = new DriveSandboxProjectFileSystemService({
  allowLocalFallback: false,
  bindingClient: {
    async getProjectWorkspaceBinding() {
      return null;
    },
  },
  drivePort: {} as SandboxExplorerPort,
  localFileSystem: new Proxy(
    {},
    {
      get() {
        return async () => {
          forbiddenLocalFallbackCalls += 1;
          throw new Error("remote Drive mode must not fall back to Tauri");
        };
      },
    },
  ) as IFileSystemService,
});
await assert.rejects(
  remoteFileSystem.getFiles("project-without-sandbox"),
  (error: unknown) => error instanceof ProjectWorkspaceBindingRequiredError,
);
assert.equal(forbiddenLocalFallbackCalls, 0);

const missingRemoteService = new RuntimeProjectRuntimeLocationService({
  executionLocation: "cloud-workspace",
  fileSystemService: {} as IFileSystemService,
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation() {
      return { remoteSynchronization: "not_configured" };
    },
    async resolvePreferredProjectRuntimeLocationId() {
      return null;
    },
    async synchronizeLocalDesktopRuntimeLocation() {
      return { remoteSynchronization: "not_configured" };
    },
  },
});
await assert.rejects(
  missingRemoteService.resolveProjectRuntimeLocationExecutionId(
    "project-missing-remote-runtime",
    "terminal",
  ),
  (error: unknown) =>
    error instanceof ProjectRuntimeLocationExecutionUnavailableError &&
    error.code === "missing_runtime_location_id",
);

let localWorkingDirectory: string | null = null;
let synchronizationFinished = false;
const localService = new RuntimeProjectRuntimeLocationService({
  executionLocation: "local-host",
  fileSystemService: {
    async getProjectMountState() {
      return localWorkingDirectory
        ? { displayName: "local-project", host: "tauri", status: "mounted" }
        : { displayName: null, host: null, status: "mount_required" };
    },
    async mountFolder(_projectId, source) {
      assert.equal(source.type, "tauri");
      localWorkingDirectory = source.type === "tauri" ? source.path : null;
    },
    async resolveLocalWorkingDirectory() {
      return localWorkingDirectory;
    },
    async restoreProjectMount() {
      return {
        restored: false,
        state: { displayName: null, host: null, status: "mount_required" },
      };
    },
  } as IFileSystemService,
  openLocalFolder: async () => ({
    source: { path: "E:\\work\\local-project", type: "tauri" },
    status: "selected",
  }),
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation() {
      return { remoteSynchronization: "pending" };
    },
    async resolvePreferredProjectRuntimeLocationId() {
      throw new Error("local execution must not read a remote preference");
    },
    async synchronizeLocalDesktopRuntimeLocation() {
      await Promise.resolve();
      synchronizationFinished = true;
      return {
        remoteSynchronization: "registered",
        runtimeLocationId: "runtime-location-desktop-1",
      };
    },
  },
});
assert.equal(
  await localService.resolveProjectRuntimeLocationExecutionId(
    "project-local",
    "terminal",
    { allowFolderSelection: true },
  ),
  "runtime-location-desktop-1",
);
assert.equal(synchronizationFinished, true);

let activeLocalPath = "E:\\work\\project-a";
let resolveFirstSynchronization!: (
  result: { remoteSynchronization: "registered"; runtimeLocationId: string },
) => void;
const firstSynchronization = new Promise<{
  remoteSynchronization: "registered";
  runtimeLocationId: string;
}>((resolve) => {
  resolveFirstSynchronization = resolve;
});
const synchronizedPaths: string[] = [];
const remountingService = new RuntimeProjectRuntimeLocationService({
  executionLocation: "local-host",
  fileSystemService: {
    async getProjectMountState() {
      return { displayName: "remounted-project", host: "tauri", status: "mounted" };
    },
    async resolveLocalWorkingDirectory() {
      return activeLocalPath;
    },
  } as IFileSystemService,
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation() {
      return { remoteSynchronization: "pending" };
    },
    async resolvePreferredProjectRuntimeLocationId() {
      throw new Error("local execution must not read a remote preference");
    },
    async synchronizeLocalDesktopRuntimeLocation(input) {
      synchronizedPaths.push(input.absolutePath);
      if (input.absolutePath.endsWith("project-a")) {
        return firstSynchronization;
      }
      return {
        remoteSynchronization: "registered",
        runtimeLocationId: "runtime-location-project-b",
      };
    },
  },
});
const firstResolution = remountingService.resolveProjectRuntimeLocationExecutionId(
  "project-remounted",
  "terminal",
);
while (synchronizedPaths.length === 0) await Promise.resolve();
activeLocalPath = "E:\\work\\project-b";
assert.equal(
  await remountingService.resolveProjectRuntimeLocationExecutionId(
    "project-remounted",
    "terminal",
  ),
  "runtime-location-project-b",
  "A remounted project must not reuse an in-flight registration for its previous path.",
);
resolveFirstSynchronization({
  remoteSynchronization: "registered",
  runtimeLocationId: "runtime-location-project-a",
});
assert.equal(await firstResolution, "runtime-location-project-a");
assert.deepEqual(synchronizedPaths, [
  "E:\\work\\project-a",
  "E:\\work\\project-b",
]);

let inspectedMountedPath = "";
const mountedPathService = new RuntimeProjectRuntimeLocationService({
  executionLocation: "local-host",
  fileSystemService: {
    async getProjectMountState() {
      return { displayName: "worktree", host: "tauri", status: "mounted" };
    },
    async resolveLocalWorkingDirectory(_projectId, mountedPath) {
      return mountedPath ?? "E:\\work\\default";
    },
  } as IFileSystemService,
  registrationPort: {
    async inspectLocalDesktopRuntimeLocation(input) {
      inspectedMountedPath = input.absolutePath;
      return {
        remoteSynchronization: "registered",
        runtimeLocationId: "runtime-location-worktree",
      };
    },
    async resolvePreferredProjectRuntimeLocationId() {
      return null;
    },
    async synchronizeLocalDesktopRuntimeLocation() {
      return {
        remoteSynchronization: "registered",
        runtimeLocationId: "runtime-location-worktree",
      };
    },
  },
});
const mountedPathResolution = await mountedPathService.resolveProjectRuntimeLocation(
  "project-worktree",
  {
    allowFolderSelection: false,
    capability: "terminal",
    mountedPath: "E:\\work\\explicit-worktree",
  },
);
assert.equal(mountedPathResolution.status, "resolved");
assert.equal(
  inspectedMountedPath,
  "E:\\work\\explicit-worktree",
  "Runtime registration must use the same explicit mounted path that was resolved for the caller.",
);

console.log("new session runtime topology contract passed.");
