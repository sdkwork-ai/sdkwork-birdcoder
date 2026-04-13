import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

import { createDesktopConfiguredViteServer } from './desktop-standard-vite-server.mjs';

const rootDir = process.cwd();
const desktopRootDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
const desktopRequire = createRequire(path.join(desktopRootDir, 'package.json'));
const rootRequire = createRequire(path.join(rootDir, 'package.json'));
const uiRequire = createRequire(path.join(rootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json'));

function toFsUrl(filePath) {
  return `/@fs/${filePath.replace(/\\/g, '/')}`;
}

async function createDesktopServer() {
  return createDesktopConfiguredViteServer({
    host: '127.0.0.1',
    port: 1532,
    strictPort: true,
    mode: 'development',
  });
}

const lucideEntryPath = rootRequire.resolve('lucide-react');
const lucidePackageDir = path.resolve(path.dirname(lucideEntryPath), '..');
const iconEntryPath = path.join(lucidePackageDir, 'esm', 'Icon.js');
const htmlParseStringifyEntryPath = desktopRequire.resolve('html-parse-stringify/dist/html-parse-stringify.module.js');
const voidElementsEntryPath = desktopRequire.resolve('void-elements');
const hastUtilToJsxRuntimePackageEntryPath = uiRequire.resolve('hast-util-to-jsx-runtime');
const hastUtilToJsxRuntimeEntryPath = path.join(
  path.dirname(hastUtilToJsxRuntimePackageEntryPath),
  'index.js',
);
const styleToJsEntryPath = uiRequire.resolve('style-to-js');
const reactSyntaxHighlighterPackageEntryPath = uiRequire.resolve('react-syntax-highlighter');
const reactSyntaxHighlighterPackageDir = path.resolve(path.dirname(reactSyntaxHighlighterPackageEntryPath), '..', '..');
const reactSyntaxHighlighterVueEntryPath = path.join(
  reactSyntaxHighlighterPackageDir,
  'dist',
  'esm',
  'languages',
  'hljs',
  'vue.js',
);
const highlightJsEntryPath = uiRequire.resolve('highlight.js');
const micromarkPackageEntryPath = uiRequire.resolve('micromark');
const micromarkCreateTokenizerEntryPath = path.join(
  path.dirname(micromarkPackageEntryPath),
  'lib',
  'create-tokenizer.js',
);
const debugPackageDir = path.resolve(
  path.dirname(micromarkPackageEntryPath),
  '..',
  'debug',
);
const debugBrowserEntryPath = path.join(debugPackageDir, 'src', 'browser.js');
const unifiedPackageEntryPath = uiRequire.resolve('unified');
const unifiedLibIndexEntryPath = path.join(
  path.dirname(unifiedPackageEntryPath),
  'lib',
  'index.js',
);
const extendEntryPath = uiRequire.resolve('extend');

const server = await createDesktopServer();

try {
  await server.listen();

  const mainResponse = await fetch('http://127.0.0.1:1532/src/main.tsx');
  const mainSource = await mainResponse.text();

  assert.equal(
    mainResponse.status,
    200,
    `Desktop main.tsx should transform successfully during dev startup. Received ${mainResponse.status} with body:\n${mainSource}`,
  );
  assert.doesNotMatch(
    mainSource,
    /spawn EPERM/u,
    'Desktop main.tsx transform must not rely on an esbuild child-process path that fails with spawn EPERM in this Windows environment.',
  );

  const iconResponse = await fetch(`http://127.0.0.1:1532${toFsUrl(iconEntryPath)}`);
  const iconSource = await iconResponse.text();

  assert.equal(
    iconResponse.status,
    200,
    `lucide-react Icon.js should transform successfully for the browser. Received ${iconResponse.status} with body:\n${iconSource}`,
  );
  assert.doesNotMatch(
    iconSource,
    /\/react\/index\.js/u,
    'lucide-react browser transforms must not leak raw React CommonJS entry files into browser imports.',
  );
  assert.doesNotMatch(
    iconSource,
    /_container/u,
    'Desktop dependency transforms must not crash the CommonJS plugin container while resolving React runtime modules.',
  );

  const htmlParseStringifyResponse = await fetch(`http://127.0.0.1:1532${toFsUrl(htmlParseStringifyEntryPath)}`);
  const htmlParseStringifySource = await htmlParseStringifyResponse.text();

  assert.equal(
    htmlParseStringifyResponse.status,
    200,
    `html-parse-stringify.module.js should transform successfully for the browser. Received ${htmlParseStringifyResponse.status} with body:\n${htmlParseStringifySource}`,
  );
  assert.doesNotMatch(
    htmlParseStringifySource,
    new RegExp(toFsUrl(voidElementsEntryPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
    'Desktop dependency transforms must not leak the raw void-elements CommonJS entry into browser ESM imports.',
  );

  const voidElementsCompatResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-void-elements',
  );
  const voidElementsCompatSource = await voidElementsCompatResponse.text();

  assert.equal(
    voidElementsCompatResponse.status,
    200,
    `Desktop void-elements compat module should transform successfully. Received ${voidElementsCompatResponse.status} with body:\n${voidElementsCompatSource}`,
  );
  assert.match(
    voidElementsCompatSource,
    /export\s+default/u,
    'Desktop void-elements compat module must provide a default export so html-parse-stringify can import it in the browser.',
  );

  const hastUtilToJsxRuntimeResponse = await fetch(`http://127.0.0.1:1532${toFsUrl(hastUtilToJsxRuntimeEntryPath)}`);
  const hastUtilToJsxRuntimeSource = await hastUtilToJsxRuntimeResponse.text();

  assert.equal(
    hastUtilToJsxRuntimeResponse.status,
    200,
    `hast-util-to-jsx-runtime/lib/index.js should transform successfully for the browser. Received ${hastUtilToJsxRuntimeResponse.status} with body:\n${hastUtilToJsxRuntimeSource}`,
  );
  assert.doesNotMatch(
    hastUtilToJsxRuntimeSource,
    new RegExp(toFsUrl(styleToJsEntryPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
    'Desktop dependency transforms must not leak the raw style-to-js CommonJS entry into browser ESM imports.',
  );

  const styleToJsCompatResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-style-to-js',
  );
  const styleToJsCompatSource = await styleToJsCompatResponse.text();

  assert.equal(
    styleToJsCompatResponse.status,
    200,
    `Desktop style-to-js compat module should transform successfully. Received ${styleToJsCompatResponse.status} with body:\n${styleToJsCompatSource}`,
  );
  assert.match(
    styleToJsCompatSource,
    /export\s+default/u,
    'Desktop style-to-js compat module must provide a default export so hast-util-to-jsx-runtime can import it in the browser.',
  );

  const reactSyntaxHighlighterVueResponse = await fetch(
    `http://127.0.0.1:1532${toFsUrl(reactSyntaxHighlighterVueEntryPath)}`,
  );
  const reactSyntaxHighlighterVueSource = await reactSyntaxHighlighterVueResponse.text();

  assert.equal(
    reactSyntaxHighlighterVueResponse.status,
    200,
    `react-syntax-highlighter/dist/esm/languages/hljs/vue.js should transform successfully for the browser. Received ${reactSyntaxHighlighterVueResponse.status} with body:\n${reactSyntaxHighlighterVueSource}`,
  );
  assert.doesNotMatch(
    reactSyntaxHighlighterVueSource,
    new RegExp(toFsUrl(highlightJsEntryPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
    'Desktop dependency transforms must not leak the raw highlight.js CommonJS entry into browser ESM imports.',
  );

  const highlightJsCompatResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-highlight-js',
  );
  const highlightJsCompatSource = await highlightJsCompatResponse.text();

  assert.equal(
    highlightJsCompatResponse.status,
    200,
    `Desktop highlight.js compat module should transform successfully. Received ${highlightJsCompatResponse.status} with body:\n${highlightJsCompatSource}`,
  );
  assert.match(
    highlightJsCompatSource,
    /export\s+default/u,
    'Desktop highlight.js compat module must provide a default export so react-syntax-highlighter language modules can import it in the browser.',
  );

  const micromarkCreateTokenizerResponse = await fetch(
    `http://127.0.0.1:1532${toFsUrl(micromarkCreateTokenizerEntryPath)}`,
  );
  const micromarkCreateTokenizerSource = await micromarkCreateTokenizerResponse.text();

  assert.equal(
    micromarkCreateTokenizerResponse.status,
    200,
    `micromark/lib/create-tokenizer.js should transform successfully for the browser. Received ${micromarkCreateTokenizerResponse.status} with body:\n${micromarkCreateTokenizerSource}`,
  );
  assert.doesNotMatch(
    micromarkCreateTokenizerSource,
    new RegExp(toFsUrl(debugBrowserEntryPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
    'Desktop dependency transforms must not leak the raw debug browser CommonJS entry into browser ESM imports.',
  );

  const debugCompatResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-debug',
  );
  const debugCompatSource = await debugCompatResponse.text();

  assert.equal(
    debugCompatResponse.status,
    200,
    `Desktop debug compat module should transform successfully. Received ${debugCompatResponse.status} with body:\n${debugCompatSource}`,
  );
  assert.match(
    debugCompatSource,
    /export\s+default/u,
    'Desktop debug compat module must provide a default export so micromark can import debug in the browser.',
  );

  const unifiedLibIndexResponse = await fetch(
    `http://127.0.0.1:1532${toFsUrl(unifiedLibIndexEntryPath)}`,
  );
  const unifiedLibIndexSource = await unifiedLibIndexResponse.text();

  assert.equal(
    unifiedLibIndexResponse.status,
    200,
    `unified/lib/index.js should transform successfully for the browser. Received ${unifiedLibIndexResponse.status} with body:\n${unifiedLibIndexSource}`,
  );
  assert.doesNotMatch(
    unifiedLibIndexSource,
    new RegExp(toFsUrl(extendEntryPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
    'Desktop dependency transforms must not leak the raw extend CommonJS entry into browser ESM imports.',
  );

  const extendCompatResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-extend',
  );
  const extendCompatSource = await extendCompatResponse.text();

  assert.equal(
    extendCompatResponse.status,
    200,
    `Desktop extend compat module should transform successfully. Received ${extendCompatResponse.status} with body:\n${extendCompatSource}`,
  );
  assert.match(
    extendCompatSource,
    /export\s+default/u,
    'Desktop extend compat module must provide a default export so unified can import extend in the browser.',
  );

  const reactDomClientCompiledResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-react-dom-client-compiled',
  );
  const reactDomClientCompiledSource = await reactDomClientCompiledResponse.text();

  assert.equal(
    reactDomClientCompiledResponse.status,
    200,
    `Desktop react-dom/client compat chunk should transform successfully. Received ${reactDomClientCompiledResponse.status} with body:\n${reactDomClientCompiledSource}`,
  );
  assert.doesNotMatch(
    reactDomClientCompiledSource,
    /Failed to resolve import "scheduler"/u,
    'Desktop react-dom/client compat chunk must resolve scheduler without leaking raw unresolved imports into the startup graph.',
  );

  const reactCompatCompiledResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-react-compiled',
  );
  const reactCompatCompiledSource = await reactCompatCompiledResponse.text();

  assert.equal(
    reactCompatCompiledResponse.status,
    200,
    `Desktop react compat chunk should transform successfully. Received ${reactCompatCompiledResponse.status} with body:\n${reactCompatCompiledSource}`,
  );
  assert.match(
    reactCompatCompiledSource,
    /export\s+(?:default|\{[^}]*\bdefault\b[^}]*\})/u,
    'Desktop react compat chunk must preserve a default export because the virtual wrapper imports React as a default export.',
  );

  const reactCompatWrapperResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-react',
  );
  const reactCompatWrapperSource = await reactCompatWrapperResponse.text();

  assert.equal(
    reactCompatWrapperResponse.status,
    200,
    `Desktop react compat wrapper should transform successfully. Received ${reactCompatWrapperResponse.status} with body:\n${reactCompatWrapperSource}`,
  );
  assert.match(
    reactCompatWrapperSource,
    /import __compatModule from ['"]\/@id\/__x00__sdkwork-birdcoder-desktop-react-compiled['"]/u,
    'Desktop react compat wrapper must continue to import the compiled React chunk as a default export.',
  );

  const useSyncShimCompiledResponse = await fetch(
    'http://127.0.0.1:1532/@id/__x00__sdkwork-birdcoder-desktop-use-sync-external-store-shim-compiled',
  );
  const useSyncShimCompiledSource = await useSyncShimCompiledResponse.text();

  assert.equal(
    useSyncShimCompiledResponse.status,
    200,
    `Desktop use-sync-external-store/shim compat chunk should transform successfully. Received ${useSyncShimCompiledResponse.status} with body:\n${useSyncShimCompiledSource}`,
  );
  assert.doesNotMatch(
    useSyncShimCompiledSource,
    /spawn EPERM/u,
    'Desktop use-sync-external-store/shim compat chunk must not rely on a Vite transform path that triggers spawn EPERM in this Windows environment.',
  );
  assert.doesNotMatch(
    useSyncShimCompiledSource,
    /Failed to resolve import/u,
    'Desktop use-sync-external-store/shim compat chunk must not leak unresolved imports into the startup graph.',
  );
} finally {
  await server.close();
}

console.log('desktop react compatibility contract passed.');
process.exit(0);
