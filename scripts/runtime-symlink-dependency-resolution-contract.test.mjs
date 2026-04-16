import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const rootDir = process.cwd();
const npmrcPath = path.join(rootDir, '.npmrc');
const desktopViteConfigPath = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'vite.config.ts');
const desktopViteHostPath = path.join(rootDir, 'scripts', 'run-desktop-vite-host.mjs');

const npmrcSource = fs.readFileSync(npmrcPath, 'utf8');
const desktopViteConfigSource = fs.readFileSync(desktopViteConfigPath, 'utf8');
const desktopViteHostSource = fs.readFileSync(desktopViteHostPath, 'utf8');

assert.match(
  npmrcSource,
  /link-workspace-packages\s*=\s*true/,
  'Workspace dependency management must enable root-level workspace linking, matching the claw-studio baseline.',
);

assert.match(
  npmrcSource,
  /auto-install-peers\s*=\s*false/,
  'Workspace dependency management must disable auto-install-peers so optional provider SDK peers remain optional and do not force npm registry fetches during root installs.',
);

assert.doesNotMatch(
  desktopViteConfigSource,
  /preserveSymlinks\s*:\s*true/,
  'Desktop Vite config must not preserve symlinked package paths now that dependency resolution is managed from the workspace root.',
);

assert.match(
  desktopViteConfigSource,
  /dedupe\s*:\s*\[\.\.\.desktopDedupePackages\]/,
  'Desktop Vite config must dedupe shared runtime packages so root-managed dependencies resolve consistently.',
);

assert.match(
  desktopViteHostSource,
  /vite-windows-realpath-patch\.mjs/,
  'Desktop Vite host must import the Windows realpath patch so normal Vite realpath resolution remains stable.',
);

const rootReactI18nextRuntimeDependencies = {
  '@babel/runtime': '^7.29.2',
  'html-parse-stringify': '^3.0.1',
  'react-i18next': '^17.0.2',
  'use-sync-external-store': '^1.6.0',
  'void-elements': '^3.1.0',
};

const sharedI18nextWorkspaceDependencies = {
  '@babel/runtime': '^7.29.2',
  'html-parse-stringify': '^3.0.1',
  'react-i18next': '^17.0.2',
  'use-sync-external-store': '^1.6.0',
};

const sharedMarkdownRuntimeDependencies = {
  '@ungap/structured-clone': '^1.3.0',
  bail: '^2.0.2',
  ccount: '^2.0.1',
  'character-entities-html4': '^2.1.0',
  'character-entities-legacy': '^3.0.0',
  'character-reference-invalid': '^2.0.1',
  'comma-separated-tokens': '^2.0.3',
  'decode-named-character-reference': '^1.3.0',
  dequal: '^2.0.3',
  devlop: '^1.1.0',
  'estree-util-is-identifier-name': '^3.0.0',
  extend: '^3.0.2',
  'hast-util-to-jsx-runtime': '^2.3.6',
  'hast-util-whitespace': '^3.0.0',
  'html-url-attributes': '^3.0.1',
  'inline-style-parser': '^0.2.7',
  'is-alphabetical': '^2.0.1',
  'is-alphanumerical': '^2.0.1',
  'is-decimal': '^2.0.1',
  'is-hexadecimal': '^2.0.1',
  'is-plain-obj': '^4.1.0',
  'mdast-util-from-markdown': '^2.0.3',
  'mdast-util-mdx-expression': '^2.0.1',
  'mdast-util-mdx-jsx': '^3.2.0',
  'mdast-util-mdxjs-esm': '^2.0.1',
  'mdast-util-to-hast': '^13.2.1',
  'mdast-util-to-markdown': '^2.1.2',
  'mdast-util-to-string': '^4.0.0',
  micromark: '^4.0.2',
  'micromark-util-character': '^2.1.1',
  'micromark-util-decode-numeric-character-reference': '^2.0.2',
  'micromark-util-decode-string': '^2.0.1',
  'micromark-util-encode': '^2.0.1',
  'micromark-util-normalize-identifier': '^2.0.1',
  'micromark-util-sanitize-uri': '^2.0.1',
  'micromark-util-symbol': '^2.0.1',
  'micromark-util-types': '^2.0.2',
  'parse-entities': '^4.0.2',
  'property-information': '^7.1.0',
  'remark-parse': '^11.0.0',
  'remark-rehype': '^11.1.2',
  'space-separated-tokens': '^2.0.2',
  'stringify-entities': '^4.0.4',
  'style-to-js': '^1.1.21',
  'style-to-object': '^1.0.14',
  'trim-lines': '^3.0.1',
  trough: '^2.2.0',
  unified: '^11.0.5',
  'unist-util-is': '^6.0.1',
  'unist-util-position': '^5.0.0',
  'unist-util-stringify-position': '^4.0.0',
  'unist-util-visit': '^5.1.0',
  'unist-util-visit-parents': '^6.0.2',
  vfile: '^6.0.3',
  'vfile-message': '^4.0.3',
};

const uiRuntimeDependencies = {
  ...sharedMarkdownRuntimeDependencies,
  '@babel/runtime': '^7.29.2',
  '@monaco-editor/loader': '^1.7.0',
  '@monaco-editor/react': '^4.7.0',
  '@radix-ui/react-compose-refs': '^1.1.2',
  '@radix-ui/react-slot': '^1.2.4',
  'class-variance-authority': '^0.7.1',
  clsx: '^2.1.1',
  fault: '^1.0.4',
  format: '^0.2.2',
  'hast-util-parse-selector': '^4.0.0',
  hastscript: '^9.0.1',
  'highlight.js': '^10.7.3',
  'highlightjs-vue': '^1.0.0',
  lowlight: '^1.20.0',
  'lucide-react': '^1.7.0',
  'monaco-editor': '^0.55.1',
  prismjs: '^1.30.0',
  'react-markdown': '^10.1.0',
  'react-syntax-highlighter': '^16.1.1',
  refractor: '^5.0.0',
  'state-local': '^1.0.7',
  'tailwind-merge': '^3.3.1',
};

const legacyReactMarkdownRuntimeDependencies = {
  ...sharedMarkdownRuntimeDependencies,
  'lucide-react': '^0.546.0',
  'react-markdown': '^9.1.0',
};

const packageDependencyExpectations = [
  {
    packageName: '.',
    dependencies: rootReactI18nextRuntimeDependencies,
  },
  {
    packageName: '@sdkwork/birdcoder-i18n',
    dependencies: sharedI18nextWorkspaceDependencies,
  },
  {
    packageName: '@sdkwork/birdcoder-appbase',
    dependencies: {
      ...sharedI18nextWorkspaceDependencies,
      'lucide-react': '^0.546.0',
    },
  },
  {
    packageName: '@sdkwork/birdcoder-shell',
    dependencies: {
      ...sharedI18nextWorkspaceDependencies,
      'lucide-react': '^0.546.0',
    },
  },
  {
    packageName: '@sdkwork/birdcoder-code',
    dependencies: legacyReactMarkdownRuntimeDependencies,
  },
  {
    packageName: '@sdkwork/birdcoder-skills',
    dependencies: legacyReactMarkdownRuntimeDependencies,
  },
  {
    packageName: '@sdkwork/birdcoder-studio',
    dependencies: legacyReactMarkdownRuntimeDependencies,
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    dependencies: uiRuntimeDependencies,
  },
  {
    packageName: '@sdkwork/birdcoder-desktop',
    dependencies: {
      scheduler: '^0.27.0',
    },
  },
];

const runtimeResolutionChecks = [
  {
    packageName: '.',
    entryPath: ['node_modules', 'react-i18next', 'dist', 'es', 'useTranslation.js'],
    dependencies: ['use-sync-external-store/shim'],
  },
  {
    packageName: '.',
    entryPath: ['node_modules', 'react-i18next', 'dist', 'es', 'TransWithoutContext.js'],
    dependencies: ['@babel/runtime/helpers/extends', 'html-parse-stringify'],
  },
  {
    packageName: '.',
    entryPath: ['node_modules', 'html-parse-stringify', 'dist', 'html-parse-stringify.module.js'],
    dependencies: ['void-elements'],
  },
  {
    packageName: '@sdkwork/birdcoder-i18n',
    entryPath: ['node_modules', 'react-i18next', 'dist', 'es', 'useTranslation.js'],
    dependencies: ['use-sync-external-store/shim'],
  },
  {
    packageName: '@sdkwork/birdcoder-i18n',
    entryPath: ['node_modules', 'html-parse-stringify', 'dist', 'html-parse-stringify.module.js'],
    dependencies: ['void-elements'],
  },
  {
    packageName: '@sdkwork/birdcoder-appbase',
    entryPath: ['node_modules', 'html-parse-stringify', 'dist', 'html-parse-stringify.module.js'],
    dependencies: ['void-elements'],
  },
  {
    packageName: '@sdkwork/birdcoder-shell',
    entryPath: ['node_modules', 'html-parse-stringify', 'dist', 'html-parse-stringify.module.js'],
    dependencies: ['void-elements'],
  },
  {
    packageName: '@sdkwork/birdcoder-code',
    entryPath: ['node_modules', 'react-markdown', 'lib', 'index.js'],
    dependencies: ['devlop', 'hast-util-to-jsx-runtime', 'html-url-attributes', 'mdast-util-to-hast', 'remark-parse', 'remark-rehype', 'unified', 'unist-util-visit', 'vfile'],
  },
  {
    packageName: '@sdkwork/birdcoder-code',
    entryPath: ['node_modules', 'mdast-util-from-markdown', 'dev', 'lib', 'index.js'],
    dependencies: [
      'mdast-util-to-string',
      'micromark',
      'micromark-util-decode-numeric-character-reference',
      'micromark-util-decode-string',
      'micromark-util-normalize-identifier',
    ],
  },
  {
    packageName: '@sdkwork/birdcoder-code',
    entryPath: ['node_modules', 'unist-util-visit-parents', 'lib', 'index.js'],
    dependencies: ['unist-util-is'],
  },
  {
    packageName: '@sdkwork/birdcoder-skills',
    entryPath: ['node_modules', 'react-markdown', 'lib', 'index.js'],
    dependencies: ['devlop', 'hast-util-to-jsx-runtime', 'html-url-attributes', 'mdast-util-to-hast', 'remark-parse', 'remark-rehype', 'unified', 'unist-util-visit', 'vfile'],
  },
  {
    packageName: '@sdkwork/birdcoder-skills',
    entryPath: ['node_modules', 'mdast-util-from-markdown', 'dev', 'lib', 'index.js'],
    dependencies: [
      'mdast-util-to-string',
      'micromark',
      'micromark-util-decode-numeric-character-reference',
      'micromark-util-decode-string',
      'micromark-util-normalize-identifier',
    ],
  },
  {
    packageName: '@sdkwork/birdcoder-skills',
    entryPath: ['node_modules', 'unist-util-visit-parents', 'lib', 'index.js'],
    dependencies: ['unist-util-is'],
  },
  {
    packageName: '@sdkwork/birdcoder-studio',
    entryPath: ['node_modules', 'react-markdown', 'lib', 'index.js'],
    dependencies: ['devlop', 'hast-util-to-jsx-runtime', 'html-url-attributes', 'mdast-util-to-hast', 'remark-parse', 'remark-rehype', 'unified', 'unist-util-visit', 'vfile'],
  },
  {
    packageName: '@sdkwork/birdcoder-studio',
    entryPath: ['node_modules', 'mdast-util-from-markdown', 'dev', 'lib', 'index.js'],
    dependencies: [
      'mdast-util-to-string',
      'micromark',
      'micromark-util-decode-numeric-character-reference',
      'micromark-util-decode-string',
      'micromark-util-normalize-identifier',
    ],
  },
  {
    packageName: '@sdkwork/birdcoder-studio',
    entryPath: ['node_modules', 'unist-util-visit-parents', 'lib', 'index.js'],
    dependencies: ['unist-util-is'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'devlop', 'lib', 'development.js'],
    dependencies: ['dequal'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'mdast-util-from-markdown', 'dev', 'lib', 'index.js'],
    dependencies: [
      'mdast-util-to-string',
      'micromark',
      'micromark-util-decode-numeric-character-reference',
      'micromark-util-decode-string',
      'micromark-util-normalize-identifier',
    ],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'parse-entities', 'lib', 'index.js'],
    dependencies: ['character-entities-legacy', 'character-reference-invalid', 'is-decimal', 'is-hexadecimal'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'hastscript', 'lib', 'index.js'],
    dependencies: ['property-information'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'hastscript', 'lib', 'create-h.js'],
    dependencies: ['comma-separated-tokens', 'hast-util-parse-selector', 'property-information', 'space-separated-tokens'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'remark-parse', 'lib', 'index.js'],
    dependencies: ['mdast-util-from-markdown'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'hast-util-to-jsx-runtime', 'lib', 'index.js'],
    dependencies: [
      'comma-separated-tokens',
      'estree-util-is-identifier-name',
      'hast-util-whitespace',
      'property-information',
      'space-separated-tokens',
      'style-to-js',
    ],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'unified', 'lib', 'index.js'],
    dependencies: ['bail', 'extend', 'is-plain-obj', 'trough'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'vfile', 'lib', 'index.js'],
    dependencies: ['vfile-message'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'unist-util-visit', 'lib', 'index.js'],
    dependencies: ['unist-util-visit-parents'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'unist-util-visit-parents', 'lib', 'index.js'],
    dependencies: ['unist-util-is'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'mdast-util-to-hast', 'lib', 'footer.js'],
    dependencies: ['@ungap/structured-clone', 'micromark-util-sanitize-uri'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'mdast-util-to-hast', 'lib', 'handlers', 'text.js'],
    dependencies: ['trim-lines'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'mdast-util-to-hast', 'lib', 'handlers', 'table.js'],
    dependencies: ['unist-util-position'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'react-syntax-highlighter', 'dist', 'esm', 'prism-light.js'],
    dependencies: ['refractor', 'refractor/core'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', 'refractor', 'lib', 'core.js'],
    dependencies: ['hastscript', 'parse-entities', 'prismjs'],
  },
  {
    packageName: '@sdkwork/birdcoder-ui',
    entryPath: ['node_modules', '@monaco-editor', 'loader', 'lib', 'es', 'loader', 'index.js'],
    dependencies: ['state-local'],
  },
];

function resolvePackageDirName(packageName) {
  return String(packageName).replace(/^@sdkwork\/birdcoder-/u, 'sdkwork-birdcoder-');
}

function assertDependencyVersion(packageName, dependencyName, actualVersion, expectedVersion) {
  const acceptedVersions = new Set([expectedVersion, 'catalog:']);

  assert.ok(
    acceptedVersions.has(actualVersion),
    `${packageName} must declare ${dependencyName} directly so Vite can resolve it from the verified desktop runtime manifest. Expected one of ${[...acceptedVersions].join(', ')}, received ${actualVersion ?? 'missing'}.`,
  );
}

for (const { packageName, dependencies } of packageDependencyExpectations) {
  const packageJsonPath =
    packageName === '.'
      ? path.join(rootDir, 'package.json')
      : path.join(rootDir, 'packages', resolvePackageDirName(packageName), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  for (const [dependencyName, expectedVersion] of Object.entries(dependencies)) {
    assertDependencyVersion(
      packageName,
      dependencyName,
      packageJson.dependencies?.[dependencyName],
      expectedVersion,
    );
  }
}

for (const { packageName, entryPath, dependencies } of runtimeResolutionChecks) {
  const absoluteEntryPath =
    packageName === '.'
      ? path.join(rootDir, ...entryPath)
      : path.join(rootDir, 'packages', resolvePackageDirName(packageName), ...entryPath);
  assert.ok(
    fs.existsSync(absoluteEntryPath),
    `Expected runtime entry to exist for ${packageName}: ${path.relative(rootDir, absoluteEntryPath)}`,
  );

  const entryRequire = createRequire(absoluteEntryPath);

  for (const dependency of dependencies) {
    assert.doesNotThrow(
      () => entryRequire.resolve(dependency),
      `${dependency} must resolve from ${path.relative(rootDir, absoluteEntryPath)} when desktop Vite traverses the startup graph.`,
    );
  }
}

console.log('runtime symlink dependency resolution contract passed.');
