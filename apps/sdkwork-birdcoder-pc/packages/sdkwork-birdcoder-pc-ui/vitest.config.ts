import { createRequire } from 'node:module';
import path from 'node:path';

import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const testingLibraryRoot = path.dirname(
  require.resolve('@testing-library/react/package.json'),
);
const canonicalTestReactRoot = path.dirname(
  require.resolve('react/package.json', { paths: [testingLibraryRoot] }),
);
const canonicalTestReactDomRoot = path.dirname(
  require.resolve('react-dom/package.json', { paths: [testingLibraryRoot] }),
);

// Workspace sibling repositories (e.g. sdkwork-models vendor icons) live
// outside the Vite search root; allow them explicitly so tests can import
// their assets without tripping the dev-server filesystem sandbox.
const siblingWorkspaceRoot = path.resolve(__dirname, '../../../../..');
const modelsPickerRoot = path.resolve(
  __dirname,
  '../../../../../sdkwork-models/apps/sdkwork-models-pc/packages/sdkwork-models-pc-picker',
);

const fsAllow = [siblingWorkspaceRoot, modelsPickerRoot];

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react$/u, replacement: canonicalTestReactRoot },
      { find: /^react\/(.*)$/u, replacement: `${canonicalTestReactRoot}/$1` },
      { find: /^react-dom$/u, replacement: canonicalTestReactDomRoot },
      { find: /^react-dom\/(.*)$/u, replacement: `${canonicalTestReactDomRoot}/$1` },
    ],
  },
  server: {
    fs: {
      allow: fsAllow,
    },
  },
});
