import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL(
  '../src/App.tsx',
  import.meta.url,
);
const indexCssPath = new URL(
  '../src/index.css',
  import.meta.url,
);

const appSource = fs.readFileSync(appPath, 'utf8');
const indexCssSource = fs.readFileSync(indexCssPath, 'utf8');

assert.match(
  indexCssSource,
  /html,\s*body,\s*#root\s*\{/s,
  'Desktop shell styles must define explicit html/body/#root host sizing so the app can follow the real webview bounds instead of relying on viewport units.',
);

assert.match(
  indexCssSource,
  /html,\s*body,\s*#root\s*\{[\s\S]*width:\s*100%;/s,
  'Desktop shell host sizing must stretch html/body/#root to the full host width.',
);

assert.match(
  indexCssSource,
  /html,\s*body,\s*#root\s*\{[\s\S]*height:\s*100%;/s,
  'Desktop shell host sizing must stretch html/body/#root to the full host height.',
);

assert.match(
  indexCssSource,
  /html,\s*body,\s*#root\s*\{[\s\S]*overflow:\s*hidden;/s,
  'Desktop shell host sizing must hide outer overflow so resize follows the host frame cleanly.',
);

assert.match(
  appSource,
  /className="flex h-full w-full bg-\[#0e0e11\] text-white items-center justify-center"/,
  'SurfaceLoader full-screen mode must use host-sized dimensions instead of viewport units.',
);

assert.match(
  appSource,
  /<div className="flex flex-col h-full w-full bg-\[#0e0e11\] text-white items-center justify-center p-8">/,
  'Error boundary fallback must use host-sized dimensions instead of viewport units.',
);

assert.match(
  appSource,
  /<div className="flex h-full w-full bg-\[#0e0e11\] text-white items-center justify-center">/,
  'Auth-loading fallback must use host-sized dimensions instead of viewport units.',
);

assert.match(
  appSource,
  /className="flex flex-col h-full w-full bg-\[#0e0e11\] text-gray-100 overflow-hidden font-sans selection:bg-blue-500\/30"/,
  'Desktop app root container must use host-sized dimensions instead of viewport units so restore transitions track the actual webview bounds.',
);

console.log('desktop host sizing contract passed.');
