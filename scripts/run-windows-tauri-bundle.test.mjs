import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const desktopPackageDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
const bundleModulePath = path.join(rootDir, 'scripts', 'run-windows-tauri-bundle.mjs');
const bundleModule = await import(pathToFileURL(bundleModulePath).href);

assert.equal(
  typeof bundleModule.parseArgs,
  'function',
  'run-windows-tauri-bundle must export parseArgs',
);
assert.equal(
  typeof bundleModule.createWindowsTauriBundlePlan,
  'function',
  'run-windows-tauri-bundle must export createWindowsTauriBundlePlan',
);
assert.equal(
  typeof bundleModule.createWixValidationRecoveryPlan,
  'function',
  'run-windows-tauri-bundle must export createWixValidationRecoveryPlan',
);

const defaults = bundleModule.parseArgs([]);
assert.equal(
  defaults.configPath,
  path.join('packages', 'sdkwork-birdcoder-desktop', 'src-tauri', 'tauri.conf.json'),
);
assert.equal(defaults.targetTriple, '');
assert.equal(defaults.viteMode, 'production');
assert.deepEqual(defaults.bundleTargets, []);
assert.throws(
  () => bundleModule.parseArgs(['--config']),
  /Missing value for --config/,
  'run-windows-tauri-bundle must reject a missing --config value',
);
assert.throws(
  () => bundleModule.parseArgs(['--target']),
  /Missing value for --target/,
  'run-windows-tauri-bundle must reject a missing --target value',
);
assert.throws(
  () => bundleModule.parseArgs(['--bundles']),
  /Missing value for --bundles/,
  'run-windows-tauri-bundle must reject a missing --bundles value',
);
assert.throws(
  () => bundleModule.parseArgs(['--vite-mode']),
  /Missing value for --vite-mode/,
  'run-windows-tauri-bundle must reject a missing --vite-mode value',
);

const bundlePlan = bundleModule.createWindowsTauriBundlePlan({
  configPath: path.join('packages', 'sdkwork-birdcoder-desktop', 'src-tauri', 'tauri.test.conf.json'),
  targetTriple: 'x86_64-pc-windows-msvc',
  viteMode: 'test',
});
assert.equal(bundlePlan.command, process.execPath);
assert.deepEqual(
  bundlePlan.args.slice(0, 8),
  [
    path.join(rootDir, 'scripts', 'run-tauri-cli.mjs'),
    'build',
    '--config',
    'src-tauri/tauri.test.conf.json',
    '--target',
    'x86_64-pc-windows-msvc',
    '--vite-mode',
    'test',
  ],
  'run-windows-tauri-bundle must invoke the shared Tauri CLI runner from the desktop package directory with the requested config and vite mode',
);
assert.equal(
  bundlePlan.cwd,
  desktopPackageDir,
  'run-windows-tauri-bundle must execute the shared Tauri CLI runner from the desktop package directory',
);
assert.equal(bundlePlan.shell, false);

const explicitBundlesPlan = bundleModule.createWindowsTauriBundlePlan({
  bundleTargets: ['nsis', 'msi'],
});
assert.deepEqual(
  explicitBundlesPlan.args.slice(-2),
  ['--bundles', 'nsis,msi'],
  'run-windows-tauri-bundle must pass explicit bundle target overrides through to the shared Tauri CLI runner',
);

const recoveryPlan = bundleModule.createWixValidationRecoveryPlan({
  targetTriple: 'x86_64-pc-windows-msvc',
  wixToolPath: 'C:\\Users\\admin\\AppData\\Local\\tauri\\WixTools314\\light.exe',
});
assert.equal(recoveryPlan.command, 'C:\\Users\\admin\\AppData\\Local\\tauri\\WixTools314\\light.exe');
assert.equal(
  recoveryPlan.args[0],
  '-sval',
  'run-windows-tauri-bundle must retry WiX light.exe with -sval so local MSI recovery bypasses ICE validation when Windows Installer is unavailable',
);
assert.ok(
  recoveryPlan.args.includes('-ext') && recoveryPlan.args.includes('WixUIExtension'),
  'run-windows-tauri-bundle must include the standard WixUIExtension when retrying MSI packaging',
);
assert.ok(
  recoveryPlan.args.includes(path.join(desktopPackageDir, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'wix', 'x64', 'main.wixobj')),
  'run-windows-tauri-bundle must retry MSI packaging from the generated main.wixobj file',
);
assert.ok(
  recoveryPlan.args.includes(path.join(desktopPackageDir, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'msi', 'SDKWork BirdCoder_0.1.0_x64_en-US.msi')),
  'run-windows-tauri-bundle must restore the expected MSI output path when retrying WiX packaging',
);

console.log('windows tauri bundle contract passed.');
