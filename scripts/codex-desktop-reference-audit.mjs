import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { sha256File, sha256Value } from "./sdkwork-utils-digest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROVIDER_ITEM_TYPES = [
  "userMessage",
  "hookPrompt",
  "agentMessage",
  "plan",
  "reasoning",
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "subAgentActivity",
  "webSearch",
  "imageView",
  "sleep",
  "imageGeneration",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction",
];

const SERVER_REQUEST_METHODS = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
  "item/tool/requestOptionPicker",
  "item/tool/requestSetupCodexContextPicker",
  "mcpServer/elicitation/request",
];

const RENDERER_SEMANTIC_MARKERS = {
  composer: ["composer-surface-chrome", "multilineSurface"],
  itemPresentation: [
    "assistant-message",
    "proposed-plan",
    "multi-agent-action",
    "subagent-activity",
    "todo-list",
    "planImplementation",
    "automaticApprovalReview",
    "userInputResponse",
    "mcpServerElicitation",
    "permissionRequest",
    "steeringUserMessage",
  ],
  requestSurfaces: [
    "data-codex-approval-surface",
    "data-codex-composer-request-navigation",
    "data-user-input-auto-resolution",
  ],
  conditionalVisibility: [
    ".codex",
    "visualizations",
    "automation_update",
    "load_workspace_dependencies",
    "failed_runs_only",
  ],
  richToolResults: [
    "mcpAppResourceUri",
    "pluginId",
    "inputImage",
    "inputAudio",
  ],
  assistantMessages: [
    "final_answer",
    "<![CDATA[ ",
    "<oai-mem-citation>",
    "renderPlaceholderWhileStreaming",
    "allowCopyWhileStreaming",
  ],
};

const AUTOMATION_SEMANTIC_MARKERS = {
  actions: [
    "automation-create",
    "automation-update",
    "automation-delete",
    "automation-run-now",
    "Run now",
    "Pause scheduled task",
    "Resume scheduled task",
    "Delete scheduled task",
  ],
  discovery: [
    "list-automations",
    "Search scheduled tasks",
    "Scheduled task status",
    "Create with Codex",
    "Set up manually",
  ],
  history: [
    "Previous runs",
    "automation_history",
    "Archive all",
    "Mark all as read",
    "Open chat",
  ],
  scheduling: [
    "nextRunAt",
    "notificationPolicy",
    "customRrule",
    "rrule",
    "timeZone",
  ],
  states: ["IN_PROGRESS", "PAUSED", "ARCHIVED"],
};

const DESKTOP_RENDERER_FUNCTION_PATTERNS = {
  itemMappingLines:
    /function ([A-Za-z_$][\w$]*)\(e,t,n\)\{let\{assistantMessageStartedAtMsById:/u,
  visibilityPredicate:
    /function ([A-Za-z_$][\w$]*)\(e,t,n\)\{let\{isAeonThread:/u,
};

const DESKTOP_RENDERER_RAW_MARKERS = {
  composerSurface: "composer-surface-chrome",
  approvalSurface: "data-codex-approval-surface",
  userInputAutoResolution: "data-user-input-auto-resolution",
  composerRequestNavigation: "data-codex-composer-request-navigation",
};

function parseArguments(argv) {
  const options = {
    allowDrift: false,
    installRoot: process.env.SDKWORK_CODEX_DESKTOP_INSTALL_ROOT ?? null,
    json: false,
    specPath: path.join(root, "specs/codex-desktop-parity.spec.json"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-drift") {
      options.allowDrift = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--install-root") {
      options.installRoot = path.resolve(argv[++index] ?? "");
    } else if (argument === "--spec") {
      options.specPath = path.resolve(argv[++index] ?? "");
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function sha256Buffer(buffer) {
  return sha256Value(buffer);
}

function walkAsarFiles(node, parent = "", output = []) {
  for (const [name, value] of Object.entries(node.files ?? {})) {
    const entryPath = parent ? `${parent}/${name}` : name;
    if (value.files) {
      walkAsarFiles(value, entryPath, output);
    } else {
      output.push({ path: entryPath, ...value });
    }
  }
  return output;
}

export function readAsarIndex(archivePath) {
  const descriptor = fs.openSync(archivePath, "r");
  try {
    const prefix = Buffer.alloc(16);
    fs.readSync(descriptor, prefix, 0, prefix.length, 0);
    const headerSize = prefix.readUInt32LE(4);
    const jsonSize = prefix.readUInt32LE(12);
    const json = Buffer.alloc(jsonSize);
    fs.readSync(descriptor, json, 0, json.length, 16);
    const header = JSON.parse(json.toString("utf8"));
    return {
      archivePath,
      dataOffset: 8 + headerSize,
      entries: walkAsarFiles(header),
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

export function readAsarEntry(index, entry) {
  if (entry.unpacked) {
    return fs.readFileSync(
      path.join(`${index.archivePath}.unpacked`, ...entry.path.split("/")),
    );
  }
  const descriptor = fs.openSync(index.archivePath, "r");
  try {
    const buffer = Buffer.alloc(entry.size);
    fs.readSync(
      descriptor,
      buffer,
      0,
      buffer.length,
      index.dataOffset + Number(entry.offset),
    );
    return buffer;
  } finally {
    fs.closeSync(descriptor);
  }
}

function selectLargestEntry(entries, pattern, label) {
  const matches = entries
    .filter((entry) => pattern.test(entry.path))
    .sort((left, right) => right.size - left.size);
  if (matches.length === 0)
    throw new Error(`Missing Codex archive entry: ${label}`);
  return matches[0];
}

export function discoverRendererEntries(entries) {
  const exact = (entryPath, label) => {
    const entry = entries.find((candidate) => candidate.path === entryPath);
    if (!entry) throw new Error(`Missing Codex archive entry: ${label}`);
    return entry;
  };

  return {
    packageJson: exact("package.json", "package.json"),
    mainProcess: selectLargestEntry(
      entries,
      /^\.vite\/build\/main-[^/]+\.js$/u,
      "main process bundle",
    ),
    rendererBridge: selectLargestEntry(
      entries,
      /^\.vite\/build\/src-[^/]+\.js$/u,
      "renderer bridge bundle",
    ),
    appInitial: selectLargestEntry(
      entries,
      /^webview\/assets\/app-initial-[^/]+\.js$/u,
      "app initial bundle",
    ),
    appInitialStylesheet: selectLargestEntry(
      entries,
      /^webview\/assets\/app-initial-[^/]+\.css$/u,
      "app initial stylesheet",
    ),
    responsiveStylesheet: selectLargestEntry(
      entries,
      /^webview\/assets\/app-[^/]+\.css$/u,
      "responsive stylesheet",
    ),
    automations: selectLargestEntry(
      entries,
      /^webview\/assets\/automations-page-[^/]+\.js$/u,
      "Automations bundle",
    ),
    browser: selectLargestEntry(
      entries,
      /^webview\/assets\/browser-[^/]+\.js$/u,
      "Browser bundle",
    ),
    backgroundBrowserHost: selectLargestEntry(
      entries,
      /^webview\/assets\/browser-sidebar-hidden-background-webview-host-[^/]+\.js$/u,
      "background Browser host bundle",
    ),
    browserUseHost: selectLargestEntry(
      entries,
      /^webview\/assets\/browser-sidebar-hidden-browser-use-webview-host-[^/]+\.js$/u,
      "Browser-use host bundle",
    ),
    browserSettings: selectLargestEntry(
      entries,
      /^webview\/assets\/browser-use-settings-[^/]+\.js$/u,
      "Browser settings bundle",
    ),
    browserPanelTabs: selectLargestEntry(
      entries,
      /^webview\/assets\/thread-browser-panel-tabs-[^/]+\.js$/u,
      "Browser panel tabs bundle",
    ),
    remoteConnections: selectLargestEntry(
      entries,
      /^webview\/assets\/remote-connections-settings-[^/]+\.js$/u,
      "remote connections bundle",
    ),
    remoteConversation: selectLargestEntry(
      entries,
      /^webview\/assets\/remote-conversation-page-[^/]+\.js$/u,
      "remote conversation bundle",
    ),
  };
}

function discoverWindowsPackage() {
  const command = [
    "$package = Get-AppxPackage -Name OpenAI.Codex |",
    "Sort-Object Version -Descending | Select-Object -First 1;",
    "if ($null -eq $package) { exit 2 };",
    '$package | Select-Object InstallLocation,PackageFullName,@{n="Version";e={$_.Version.ToString()}} |',
    "ConvertTo-Json -Compress",
  ].join(" ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      "OpenAI.Codex AppX package is not installed or cannot be inspected.",
    );
  }
  return JSON.parse(result.stdout.trim());
}

function resolveInstallation(explicitInstallRoot) {
  if (!explicitInstallRoot) return discoverWindowsPackage();
  const manifestPath = path.join(explicitInstallRoot, "AppxManifest.xml");
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const version =
    manifest.match(/<Identity\b[^>]*\bVersion="([^"]+)"/u)?.[1] ?? null;
  return {
    InstallLocation: explicitInstallRoot,
    PackageFullName: path.basename(explicitInstallRoot),
    Version: version,
  };
}

function probeProviderVersion(executablePath) {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "sdkwork-codex-audit-"),
  );
  const temporaryExecutable = path.join(
    temporaryRoot,
    path.basename(executablePath),
  );
  try {
    fs.copyFileSync(executablePath, temporaryExecutable);
    const result = spawnSync(temporaryExecutable, ["--version"], {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    if (result.status !== 0) return null;
    return result.stdout.trim().match(/codex-cli\s+([^\s]+)/u)?.[1] ?? null;
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function fileArtifact(displayPath, filePath) {
  const stats = fs.statSync(filePath);
  return {
    path: displayPath,
    sha256: sha256File(filePath),
    sizeBytes: stats.size,
  };
}

function archiveArtifact(index, entry) {
  const buffer = readAsarEntry(index, entry);
  return {
    path: `app/resources/app.asar::${entry.path}`,
    sha256: sha256Buffer(buffer),
    sizeBytes: buffer.length,
  };
}

function collectMediaQueryWidths(cssText) {
  const widths = new Set();
  const mediaPattern = /@media([^\{]+)/gu;
  const widthPattern =
    /(?:(?:min|max)-width:\s*|\bwidth\s*(?:>=|<=|>|<)\s*)(\d+(?:\.\d+)?)(px|rem)/gu;
  for (const media of cssText.matchAll(mediaPattern)) {
    for (const match of media[1].matchAll(widthPattern)) {
      const value = Number(match[1]) * (match[2] === "rem" ? 16 : 1);
      widths.add(value);
    }
  }
  return [...widths].sort((left, right) => right - left);
}

function collectSemanticMarkers(text, markerGroups) {
  return Object.fromEntries(
    Object.entries(markerGroups).map(([group, markers]) => [
      group,
      Object.fromEntries(
        markers.map((marker) => [marker, text.includes(marker)]),
      ),
    ]),
  );
}

export function collectAutomationSemanticEvidence(text) {
  return collectSemanticMarkers(text, AUTOMATION_SEMANTIC_MARKERS);
}

function sourceLocation(text, codeUnitOffset, archiveEntryByteOffset) {
  if (!Number.isInteger(codeUnitOffset) || codeUnitOffset < 0) {
    throw new Error("Codex renderer evidence marker is missing.");
  }
  const entryByteOffset = Buffer.byteLength(
    text.slice(0, codeUnitOffset),
    "utf8",
  );
  return {
    rawLine: text.slice(0, codeUnitOffset).split(/\n/u).length,
    entryCodeUnitOffset: codeUnitOffset,
    entryByteOffset,
    archiveByteOffset: archiveEntryByteOffset + entryByteOffset,
  };
}

export function collectDesktopRendererEvidence(archiveIndex, entry, text) {
  const archiveEntryByteOffset = archiveIndex.dataOffset + Number(entry.offset);
  const functionEvidence = Object.fromEntries(
    Object.entries(DESKTOP_RENDERER_FUNCTION_PATTERNS).map(([key, pattern]) => {
      const match = pattern.exec(text);
      if (!match) {
        throw new Error(`Missing Codex renderer function evidence: ${key}`);
      }
      return [
        key,
        {
          symbol: match[1],
          ...sourceLocation(text, match.index, archiveEntryByteOffset),
        },
      ];
    }),
  );
  const rawArchiveEvidence = Object.fromEntries(
    Object.entries(DESKTOP_RENDERER_RAW_MARKERS).map(([key, marker]) => {
      const codeUnitOffset = text.indexOf(marker);
      return [
        key,
        {
          marker,
          ...sourceLocation(text, codeUnitOffset, archiveEntryByteOffset),
        },
      ];
    }),
  );

  return {
    archiveEntry: entry.path,
    archiveEntryByteOffset,
    archiveEntryRawLineCount: text.split(/\n/u).length,
    ...functionEvidence,
    rawArchiveEvidence,
  };
}

function buildObservedReference(installation) {
  const installRoot = installation.InstallLocation;
  const appRoot = path.join(installRoot, "app");
  const resourcesRoot = path.join(appRoot, "resources");
  const archivePath = path.join(resourcesRoot, "app.asar");
  const archiveIndex = readAsarIndex(archivePath);
  const rendererEntries = discoverRendererEntries(archiveIndex.entries);
  const packageJson = JSON.parse(
    readAsarEntry(archiveIndex, rendererEntries.packageJson).toString("utf8"),
  );
  const browserManifestPath = path.join(
    resourcesRoot,
    "plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json",
  );
  const browserManifest = JSON.parse(
    fs.readFileSync(browserManifestPath, "utf8"),
  );
  const cuaManifestPath = path.join(resourcesRoot, "cua_node/manifest.json");
  const cuaManifest = JSON.parse(fs.readFileSync(cuaManifestPath, "utf8"));
  const owlManifestPath = path.join(resourcesRoot, "owl-electron-app.json");
  const owlManifest = JSON.parse(fs.readFileSync(owlManifestPath, "utf8"));
  const providerPath = path.join(resourcesRoot, "codex.exe");
  const appInitialText = readAsarEntry(
    archiveIndex,
    rendererEntries.appInitial,
  ).toString("utf8");
  const automationsText = readAsarEntry(
    archiveIndex,
    rendererEntries.automations,
  ).toString("utf8");
  const protocolText = [
    appInitialText,
    readAsarEntry(archiveIndex, rendererEntries.mainProcess).toString("utf8"),
    readAsarEntry(archiveIndex, rendererEntries.rendererBridge).toString(
      "utf8",
    ),
  ].join("\n");
  const rendererStylesheets = archiveIndex.entries.filter((entry) =>
    /^webview\/assets\/[^/]+\.css$/u.test(entry.path),
  );
  const stylesheetText = rendererStylesheets
    .map((entry) => readAsarEntry(archiveIndex, entry).toString("utf8"))
    .join("\n");

  const archiveArtifacts = Object.values(rendererEntries).map((entry) =>
    archiveArtifact(archiveIndex, entry),
  );
  const directArtifacts = [
    fileArtifact("app/resources/app.asar", archivePath),
    fileArtifact(
      "AppxManifest.xml",
      path.join(installRoot, "AppxManifest.xml"),
    ),
    fileArtifact("app/resources/codex.exe", providerPath),
    {
      path: "app/resources/owl-electron-app.json",
      runtimeArchiveSha256: owlManifest.runtimeArchiveSha,
    },
    fileArtifact("app/resources/cua_node/manifest.json", cuaManifestPath),
    fileArtifact(
      "app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json",
      browserManifestPath,
    ),
    fileArtifact(
      "app/resources/plugins/openai-bundled/plugins/browser/skills/control-in-app-browser/SKILL.md",
      path.join(
        resourcesRoot,
        "plugins/openai-bundled/plugins/browser/skills/control-in-app-browser/SKILL.md",
      ),
    ),
    fileArtifact(
      "app/resources/plugins/openai-bundled/plugins/browser/docs/api.json",
      path.join(
        resourcesRoot,
        "plugins/openai-bundled/plugins/browser/docs/api.json",
      ),
    ),
    fileArtifact(
      "app/resources/plugins/openai-bundled/plugins/browser/scripts/browser-client.mjs",
      path.join(
        resourcesRoot,
        "plugins/openai-bundled/plugins/browser/scripts/browser-client.mjs",
      ),
    ),
  ];

  return {
    application: "OpenAI Codex",
    artifacts: [...directArtifacts, ...archiveArtifacts],
    browserRuntime: {
      nodeVersion: cuaManifest.node_version,
      pluginVersion: browserManifest.version,
      runtimeArchiveVersion: cuaManifest.runtime_archive_version,
    },
    build: installation.Version,
    installationVerification: {
      packageFullName: installation.PackageFullName,
      packageVersion: installation.Version,
    },
    packageBuildNumber: packageJson.codexBuildNumber,
    providerHost: {
      version: probeProviderVersion(providerPath),
    },
    presentationEvidence: {
      desktopRenderer: collectDesktopRendererEvidence(
        archiveIndex,
        rendererEntries.appInitial,
        appInitialText,
      ),
    },
    rendererPackageVersion: packageJson.version,
    semanticEvidence: {
      automationMarkers: collectAutomationSemanticEvidence(automationsText),
      mediaQueryWidths: collectMediaQueryWidths(stylesheetText),
      providerItems: Object.fromEntries(
        PROVIDER_ITEM_TYPES.map((type) => [type, protocolText.includes(type)]),
      ),
      serverRequestMethods: Object.fromEntries(
        SERVER_REQUEST_METHODS.map((method) => [
          method,
          protocolText.includes(method),
        ]),
      ),
      rendererMarkers: collectSemanticMarkers(
        `${appInitialText}\n${stylesheetText}`,
        RENDERER_SEMANTIC_MARKERS,
      ),
    },
    runtimeArchiveSha256: owlManifest.runtimeArchiveSha,
  };
}

function addDrift(drift, field, expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    drift.push({ actual, expected, field });
  }
}

export function compareReference(expectedReference, observedReference) {
  const drift = [];
  addDrift(
    drift,
    "reference.build",
    expectedReference.build,
    observedReference.build,
  );
  addDrift(
    drift,
    "reference.rendererPackageVersion",
    expectedReference.rendererPackageVersion,
    observedReference.rendererPackageVersion,
  );
  addDrift(
    drift,
    "reference.packageBuildNumber",
    expectedReference.packageBuildNumber,
    observedReference.packageBuildNumber,
  );
  addDrift(
    drift,
    "reference.providerHost.version",
    expectedReference.providerHost.version,
    observedReference.providerHost.version,
  );
  addDrift(
    drift,
    "reference.browserRuntime.nodeVersion",
    expectedReference.browserRuntime.nodeVersion,
    observedReference.browserRuntime.nodeVersion,
  );
  addDrift(
    drift,
    "reference.browserRuntime.pluginVersion",
    expectedReference.browserRuntime.pluginVersion,
    observedReference.browserRuntime.pluginVersion,
  );
  addDrift(
    drift,
    "reference.browserRuntime.runtimeArchiveVersion",
    expectedReference.browserRuntime.runtimeArchiveVersion,
    observedReference.browserRuntime.runtimeArchiveVersion,
  );
  addDrift(
    drift,
    "reference.installationVerification.packageFullName",
    expectedReference.installationVerification.packageFullName,
    observedReference.installationVerification.packageFullName,
  );
  addDrift(
    drift,
    "reference.installationVerification.packageVersion",
    expectedReference.installationVerification.packageVersion,
    observedReference.installationVerification.packageVersion,
  );
  addDrift(
    drift,
    "reference.runtimeArchiveSha256",
    expectedReference.runtimeArchiveSha256,
    observedReference.runtimeArchiveSha256,
  );
  addDrift(
    drift,
    "reference.semanticEvidence",
    expectedReference.semanticEvidence,
    observedReference.semanticEvidence,
  );

  const observedArtifacts = new Map(
    observedReference.artifacts.map((artifact) => [artifact.path, artifact]),
  );
  for (const expectedArtifact of expectedReference.artifacts) {
    const observedArtifact = observedArtifacts.get(expectedArtifact.path);
    if (!observedArtifact) {
      drift.push({
        actual: null,
        expected: expectedArtifact,
        field: expectedArtifact.path,
      });
      continue;
    }
    for (const field of ["sha256", "sizeBytes", "runtimeArchiveSha256"]) {
      if (field in expectedArtifact) {
        const actual =
          field === "runtimeArchiveSha256"
            ? observedReference.runtimeArchiveSha256
            : observedArtifact[field];
        addDrift(
          drift,
          `${expectedArtifact.path}.${field}`,
          expectedArtifact[field],
          actual,
        );
      }
    }
  }
  return drift;
}

export function compareDesktopRendererEvidence(expected, observed) {
  const drift = [];
  for (const field of [
    "archiveEntry",
    "archiveEntryByteOffset",
    "archiveEntryRawLineCount",
  ]) {
    addDrift(
      drift,
      `presentationEvidence.desktopRenderer.${field}`,
      expected[field],
      observed[field],
    );
  }
  for (const key of Object.keys(DESKTOP_RENDERER_FUNCTION_PATTERNS)) {
    for (const field of [
      "symbol",
      "rawLine",
      "entryCodeUnitOffset",
      "entryByteOffset",
      "archiveByteOffset",
    ]) {
      addDrift(
        drift,
        `presentationEvidence.desktopRenderer.${key}.${field}`,
        expected[key]?.[field],
        observed[key]?.[field],
      );
    }
  }
  for (const key of Object.keys(DESKTOP_RENDERER_RAW_MARKERS)) {
    addDrift(
      drift,
      `presentationEvidence.desktopRenderer.rawArchiveEvidence.${key}`,
      expected.rawArchiveEvidence?.[key],
      observed.rawArchiveEvidence?.[key],
    );
  }
  return drift;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const spec = JSON.parse(fs.readFileSync(options.specPath, "utf8"));
  const installation = resolveInstallation(options.installRoot);
  const observedReference = buildObservedReference(installation);
  const drift = [
    ...compareReference(spec.reference, observedReference),
    ...compareDesktopRendererEvidence(
      spec.presentationEvidence.desktopRenderer,
      observedReference.presentationEvidence.desktopRenderer,
    ),
  ];
  const report = {
    auditedAt: new Date().toISOString(),
    drift,
    driftCount: drift.length,
    observedReference,
    specPath: path.relative(root, options.specPath).replaceAll("\\", "/"),
    status: drift.length === 0 ? "matched" : "drifted",
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(
      `Codex desktop reference ${report.status}: ${observedReference.build} / renderer ${observedReference.rendererPackageVersion} / provider ${observedReference.providerHost.version}`,
    );
    for (const item of drift) {
      console.log(
        `- ${item.field}: expected ${JSON.stringify(item.expected)}, observed ${JSON.stringify(item.actual)}`,
      );
    }
  }

  if (drift.length > 0 && !options.allowDrift) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) main();
