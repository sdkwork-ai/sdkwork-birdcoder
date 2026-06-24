import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const gradleSource = read('apps/sdkwork-birdcoder-flutter-mobile/android/app/build.gradle.kts');
const snippetSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/config/host/native/android/release-signing.gradle.properties.snippet',
);

assert.match(
  gradleSource,
  /BIRDCODER_ANDROID_RELEASE_STORE_FILE/u,
  'Flutter Android release build must read signing credentials from gradle properties.',
);
assert.match(
  snippetSource,
  /Never commit real keystore paths or passwords/u,
  'Flutter Android signing snippet must document secret handling.',
);

console.log('flutter mobile android release signing contract passed.');
