import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const capacitorRoot = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

assert.ok(
  exists(`${capacitorRoot}/android/app/src/main/AndroidManifest.xml`),
  'H5 capacitor package must include an Android host project.',
);
assert.ok(
  exists(`${capacitorRoot}/ios/App/App/Info.plist`),
  'H5 capacitor package must include an iOS host project.',
);

const packageConfig = read(`${capacitorRoot}/capacitor.config.ts`);
const androidManifest = read(`${capacitorRoot}/android/app/src/main/AndroidManifest.xml`);
const androidGradle = read(`${capacitorRoot}/android/app/build.gradle`);
const iosInfoPlist = read(`${capacitorRoot}/ios/App/App/Info.plist`);
const iosEntitlements = read(`${capacitorRoot}/ios/App/App/App.entitlements`);
const iosProject = read(`${capacitorRoot}/ios/App/App.xcodeproj/project.pbxproj`);
const appManifest = JSON.parse(read('apps/sdkwork-birdcoder-h5/sdkwork.app.config.json'));

assert.match(
  packageConfig,
  /path:\s*'android'/u,
  'H5 capacitor config must own the Android native project path.',
);
assert.match(
  packageConfig,
  /path:\s*'ios'/u,
  'H5 capacitor config must own the iOS native project path.',
);
assert.match(
  packageConfig,
  /webDir:\s*options\.webDir \?\? '\.\.\/\.\.\/dist'/u,
  'H5 capacitor config must point webDir at the H5 renderer build output.',
);

assert.match(
  androidGradle,
  /applicationId "com\.sdkwork\.birdcoder\.h5"/u,
  'Android applicationId must match sdkwork.app.config identifiers.packageName.',
);
assert.equal(
  appManifest.app.identifiers.packageName,
  'com.sdkwork.birdcoder.h5',
  'App manifest packageName must stay aligned with Android applicationId.',
);
assert.equal(
  appManifest.app.identifiers.bundleId,
  'com.sdkwork.birdcoder.h5',
  'App manifest bundleId must stay aligned with iOS bundle identifier.',
);

assert.match(
  androidManifest,
  /android:scheme="birdcoderh5"/u,
  'Android manifest must declare the birdcoderh5 OAuth custom scheme.',
);
assert.match(
  iosInfoPlist,
  /<string>birdcoderh5<\/string>/u,
  'iOS Info.plist must declare the birdcoderh5 URL scheme.',
);
assert.match(
  iosEntitlements,
  /applinks:birdcoder\.sdkwork\.com/u,
  'iOS entitlements must declare BirdCoder universal link domains.',
);
assert.match(
  iosProject,
  /PRODUCT_BUNDLE_IDENTIFIER = com\.sdkwork\.birdcoder\.h5;/u,
  'iOS Xcode project must use the canonical BirdCoder H5 bundle identifier.',
);
assert.match(
  iosProject,
  /CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/u,
  'iOS Xcode project must sign App target with universal link entitlements.',
);

console.log('h5 capacitor native platform contract passed.');
