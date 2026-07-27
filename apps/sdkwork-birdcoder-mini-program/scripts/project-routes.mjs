import fs from 'node:fs';
import path from 'node:path';

import { MINI_PROGRAM_ROOT } from './lib/build-context.mjs';

const ROUTE_FILE = path.join(
  MINI_PROGRAM_ROOT,
  'packages',
  'sdkwork-birdcoder-mp-workbench',
  'src',
  'routes',
  'workbench.route.json',
);
const APP_JSON_FILE = path.join(MINI_PROGRAM_ROOT, 'src', 'app.json');

export function projectBirdCoderMiniProgramRoutes({ write = true } = {}) {
  const route = JSON.parse(fs.readFileSync(ROUTE_FILE, 'utf8'));
  const appJson = {
    pages: [route.placement.pagePath],
    window: {
      navigationBarTitleText: route.placement.navigationBarTitleText,
      navigationBarBackgroundColor: '#0b1020',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0b1020',
      backgroundTextStyle: 'light',
    },
    style: 'v2',
    sitemapLocation: 'sitemap.json',
  };
  const content = `${JSON.stringify(appJson, null, 2)}\n`;
  if (write && (!fs.existsSync(APP_JSON_FILE) || fs.readFileSync(APP_JSON_FILE, 'utf8') !== content)) {
    fs.writeFileSync(APP_JSON_FILE, content, 'utf8');
  }
  return { appJson, content, route };
}
