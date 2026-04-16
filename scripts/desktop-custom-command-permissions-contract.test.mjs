import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const desktopLibRsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'src',
  'lib.rs',
);
const desktopAppPermissionsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'permissions',
  'default.toml',
);

const desktopLibRsSource = fs.readFileSync(desktopLibRsPath, 'utf8');
const desktopAppPermissionsSource = fs.readFileSync(desktopAppPermissionsPath, 'utf8');

const generateHandlerMatch = desktopLibRsSource.match(
  /\.invoke_handler\(tauri::generate_handler!\[(?<commands>[\s\S]*?)\]\)/u,
);
assert.ok(
  generateHandlerMatch?.groups?.commands,
  'Desktop runtime must register a Tauri generate_handler list for custom Rust bridge commands.',
);

const generatedCommands = generateHandlerMatch.groups.commands
  .split(',')
  .map((command) => command.trim())
  .filter((command) => command.length > 0);

assert.ok(
  generatedCommands.includes('fs_snapshot_folder'),
  'Desktop Rust bridge must expose fs_snapshot_folder for mounted project imports.',
);

function parseTomlStringArray(arraySource) {
  return [...arraySource.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

const defaultPermissionMatch = desktopAppPermissionsSource.match(
  /\[default\][\s\S]*?permissions\s*=\s*\[(?<permissions>[\s\S]*?)\]/u,
);
assert.ok(
  defaultPermissionMatch?.groups?.permissions,
  'Desktop app permission manifest must declare a default permission list.',
);

const defaultPermissionReferences = parseTomlStringArray(defaultPermissionMatch.groups.permissions);

const permissionBlockRegex =
  /\[\[permission\]\][\s\S]*?identifier\s*=\s*"(?<identifier>[^"]+)"[\s\S]*?commands\.allow\s*=\s*\[(?<commands>[^\]]*)\]/gu;
const permissionBlocks = new Map();
for (const match of desktopAppPermissionsSource.matchAll(permissionBlockRegex)) {
  permissionBlocks.set(match.groups.identifier, parseTomlStringArray(match.groups.commands));
}

const permissionSetRegex =
  /\[\[set\]\][\s\S]*?identifier\s*=\s*"(?<identifier>[^"]+)"[\s\S]*?permissions\s*=\s*\[(?<permissions>[\s\S]*?)\]/gu;
const permissionSets = new Map();
for (const match of desktopAppPermissionsSource.matchAll(permissionSetRegex)) {
  permissionSets.set(match.groups.identifier, parseTomlStringArray(match.groups.permissions));
}

function expandPermissionReferences(references, expanded = new Set()) {
  for (const reference of references) {
    if (expanded.has(reference)) {
      continue;
    }

    expanded.add(reference);
    const nestedReferences = permissionSets.get(reference);
    if (nestedReferences) {
      expandPermissionReferences(nestedReferences, expanded);
    }
  }

  return expanded;
}

const effectivePermissionIdentifiers = expandPermissionReferences(defaultPermissionReferences);

for (const command of generatedCommands) {
  const allowingPermissionIdentifiers = [...permissionBlocks.entries()]
    .filter(([, allowedCommands]) => allowedCommands.includes(command))
    .map(([identifier]) => identifier);

  assert.ok(
    allowingPermissionIdentifiers.length > 0,
    `Desktop app permission manifest must declare an allow permission for the ${command} Rust command.`,
  );

  assert.ok(
    allowingPermissionIdentifiers.some((identifier) => effectivePermissionIdentifiers.has(identifier)),
    `Desktop default permission surface must include the ${command} Rust command so the main window can invoke it without runtime "not allowed" failures.`,
  );
}

console.log('desktop custom command permissions contract passed.');
