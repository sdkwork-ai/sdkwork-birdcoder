import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const flutterRoot = 'apps/sdkwork-birdcoder-flutter-mobile';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

assert.ok(
  exists(`${flutterRoot}/android/app/src/main/AndroidManifest.xml`),
  'Flutter mobile root must include an Android host project.',
);
assert.ok(
  exists(`${flutterRoot}/ios/Runner/Info.plist`),
  'Flutter mobile root must include an iOS host project.',
);

const androidManifest = read(`${flutterRoot}/android/app/src/main/AndroidManifest.xml`);
const androidGradle = read(`${flutterRoot}/android/app/build.gradle.kts`);
const iosInfoPlist = read(`${flutterRoot}/ios/Runner/Info.plist`);
const iosEntitlements = read(`${flutterRoot}/ios/Runner/Runner.entitlements`);
const iosProject = read(`${flutterRoot}/ios/Runner.xcodeproj/project.pbxproj`);
const appManifest = JSON.parse(read(`${flutterRoot}/sdkwork.app.config.json`));

assert.match(
  androidGradle,
  /applicationId = "com\.sdkwork\.birdcoder\.mobile"/u,
  'Android applicationId must match sdkwork.app.config identifiers.packageName.',
);
assert.equal(
  appManifest.app.identifiers.packageName,
  'com.sdkwork.birdcoder.mobile',
  'App manifest packageName must stay aligned with Android applicationId.',
);
assert.equal(
  appManifest.app.identifiers.bundleId,
  'com.sdkwork.birdcoder.mobile',
  'App manifest bundleId must stay aligned with iOS bundle identifier.',
);

assert.match(
  androidManifest,
  /android:scheme="birdcoder"/u,
  'Android manifest must declare the birdcoder OAuth custom scheme.',
);
assert.match(
  androidManifest,
  /android:host="auth"/u,
  'Android manifest must declare the OAuth callback host authority.',
);
assert.match(
  androidManifest,
  /android:pathPrefix="\/oauth\/callback"/u,
  'Android manifest must declare the OAuth callback path prefix.',
);
assert.match(
  androidManifest,
  /android:autoVerify="true"/u,
  'Android manifest must enable App Links auto verification.',
);

assert.match(
  iosInfoPlist,
  /<string>birdcoder<\/string>/u,
  'iOS Info.plist must declare the birdcoder URL scheme.',
);
assert.match(
  iosEntitlements,
  /applinks:birdcoder\.sdkwork\.com/u,
  'iOS entitlements must declare BirdCoder universal link domains.',
);
assert.match(
  iosProject,
  /PRODUCT_BUNDLE_IDENTIFIER = com\.sdkwork\.birdcoder\.mobile;/u,
  'iOS Xcode project must use the canonical BirdCoder bundle identifier.',
);
assert.match(
  iosProject,
  /CODE_SIGN_ENTITLEMENTS = Runner\/Runner\.entitlements;/u,
  'iOS Xcode project must sign Runner with universal link entitlements.',
);

console.log('flutter mobile native platform contract passed.');
