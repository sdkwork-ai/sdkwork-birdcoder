import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MINI_PROGRAM_ROOT } from '../scripts/lib/build-context.mjs';
import { projectBirdCoderMiniProgramRoutes } from '../scripts/project-routes.mjs';

test('route contribution deterministically projects the native app.json page', () => {
  const { appJson, content, route } = projectBirdCoderMiniProgramRoutes({ write: false });
  assert.equal(route.id, 'app.workbench.index');
  assert.equal(route.titleKey, 'route.workbench');
  assert.equal(route.permissionHint, 'birdcoder.system-descriptor.read');
  assert.deepEqual(appJson.pages, ['pages/__generated__/workbench/index']);
  assert.equal(
    fs.readFileSync(path.join(MINI_PROGRAM_ROOT, 'src', 'app.json'), 'utf8'),
    content,
  );
  assert.ok(
    fs.existsSync(
      path.join(
        MINI_PROGRAM_ROOT,
        'src',
        `${route.placement.pagePath}.wxml`,
      ),
    ),
  );
});

test('route metadata contains navigation facts but no transport declarations', () => {
  const source = fs.readFileSync(
    path.join(
      MINI_PROGRAM_ROOT,
      'packages',
      'sdkwork-birdcoder-mp-workbench',
      'src',
      'routes',
      'workbench.route.json',
    ),
    'utf8',
  );
  assert.doesNotMatch(source, /https?:\/\/|apiUrl|sdkMethod|Authorization|\/app\/v\d+\/api/u);
});
