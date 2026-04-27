import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildHtmlPreviewDocument,
  buildSvgPreviewDocument,
  parseKeyValuePreviewValue,
  parseStructuredDataPreviewValue,
  parseTabularDataPreviewValue,
  resolveContentPreviewCodeLanguage,
  resolveContentPreviewDescriptor,
  resolveContentPreviewDisplayLabel,
  resolveContentPreviewKind,
  resolveContentPreviewSandbox,
  shouldDefaultToSplitContentWorkbench,
} from '../packages/sdkwork-birdcoder-ui/src/components/contentPreview.ts';

assert.equal(
  resolveContentPreviewKind({
    path: '/workspace/index.html',
    language: 'html',
    value: '<div>Hello</div>',
  }),
  'html',
  'HTML files must resolve to HTML preview mode.',
);

assert.equal(
  resolveContentPreviewKind({
    path: '/workspace/README.md',
    language: 'markdown',
    value: '# Demo',
  }),
  'markdown',
  'Markdown files must resolve to Markdown preview mode.',
);

assert.equal(
  resolveContentPreviewKind({
    path: '/workspace/logo.svg',
    language: 'svg',
    value: '<svg viewBox="0 0 10 10"></svg>',
  }),
  'svg',
  'SVG files must resolve to SVG preview mode.',
);

assert.equal(
  resolveContentPreviewKind({
    path: '/workspace/settings.json',
    language: 'json',
    value: '{"name":"demo"}',
  }),
  'text',
  'Structured data sources still resolve through the text preview pipeline.',
);

assert.deepEqual(
  parseStructuredDataPreviewValue({
    path: '/workspace/settings.json',
    language: 'json',
    value: '{"name":"demo","enabled":true}',
  }),
  { format: 'json', value: { name: 'demo', enabled: true } },
  'JSON files must be parsed for structured data preview.',
);

assert.deepEqual(
  parseStructuredDataPreviewValue({
    path: '/workspace/session.json',
    language: 'json',
    value: '{"sessionId":101777208078558017,"artifactIds":[101777208078558019]}',
  }),
  {
    format: 'json',
    value: {
      sessionId: '101777208078558017',
      artifactIds: ['101777208078558019'],
    },
  },
  'JSON structured preview must preserve unquoted Long identifiers as strings.',
);

assert.deepEqual(
  parseStructuredDataPreviewValue({
    path: '/workspace/value.json',
    language: 'json',
    value: 'null',
  }),
  { format: 'json', value: null },
  'Structured data parsing must preserve valid JSON primitive values.',
);

assert.deepEqual(
  parseStructuredDataPreviewValue({
    path: '/workspace/app.yaml',
    language: 'yaml',
    value: 'name: demo\nenabled: true\nitems:\n  - one\n  - two\n',
  }),
  {
    format: 'yaml',
    value: {
      name: 'demo',
      enabled: true,
      items: ['one', 'two'],
    },
  },
  'YAML files must be parsed for structured data preview.',
);

assert.deepEqual(
  parseStructuredDataPreviewValue({
    path: '/workspace/settings.jsonc',
    language: 'jsonc',
    value: '{\n  // comment\n  "name": "demo",\n  "enabled": true,\n}\n',
  }),
  {
    format: 'jsonc',
    value: {
      name: 'demo',
      enabled: true,
    },
  },
  'JSONC files must be parsed for structured data preview.',
);

assert.deepEqual(
  parseStructuredDataPreviewValue({
    path: '/workspace/Cargo.toml',
    language: 'toml',
    value: 'name = "demo"\nversion = "0.1.0"\n[package]\nedition = "2021"\n',
  }),
  {
    format: 'toml',
    value: {
      name: 'demo',
      version: '0.1.0',
      package: {
        edition: '2021',
      },
    },
  },
  'TOML files must be parsed for structured data preview.',
);

assert.equal(
  parseStructuredDataPreviewValue({
    path: '/workspace/.env',
    language: 'env',
    value: 'PORT = 3000\n',
  }),
  null,
  'Config files must not be misclassified as TOML structured data.',
);

assert.deepEqual(
  parseKeyValuePreviewValue({
    path: '/workspace/.env.local',
    language: 'env',
    value: 'PORT=3000\nAPI_URL=\"https://example.com\"\nEMPTY=\n',
  }),
  {
    entries: [
      {
        key: 'PORT',
        lineNumber: 1,
        section: null,
        value: '3000',
      },
      {
        key: 'API_URL',
        lineNumber: 2,
        section: null,
        value: 'https://example.com',
      },
      {
        key: 'EMPTY',
        lineNumber: 3,
        section: null,
        value: '',
      },
    ],
    format: 'dotenv',
    hasSections: false,
    sectionOrder: [],
  },
  'Dotenv files must be parsed into a reusable key-value preview payload.',
);

assert.deepEqual(
  parseKeyValuePreviewValue({
    path: '/workspace/.editorconfig',
    language: 'ini',
    value: 'root = true\n\n[*]\ncharset = utf-8\nindent_style = space\n\n[*.ts]\nindent_size = 2\n',
  }),
  {
    entries: [
      {
        key: 'root',
        lineNumber: 1,
        section: null,
        value: 'true',
      },
      {
        key: 'charset',
        lineNumber: 4,
        section: '*',
        value: 'utf-8',
      },
      {
        key: 'indent_style',
        lineNumber: 5,
        section: '*',
        value: 'space',
      },
      {
        key: 'indent_size',
        lineNumber: 8,
        section: '*.ts',
        value: '2',
      },
    ],
    format: 'ini',
    hasSections: true,
    sectionOrder: ['*', '*.ts'],
  },
  'INI-like config files must preserve section order and line numbers.',
);

assert.deepEqual(
  parseKeyValuePreviewValue({
    path: '/workspace/application.properties',
    language: 'properties',
    value: 'app.name=BirdCoder\nwelcome.message=hello\\\n world\n',
  }),
  {
    entries: [
      {
        key: 'app.name',
        lineNumber: 1,
        section: null,
        value: 'BirdCoder',
      },
      {
        key: 'welcome.message',
        lineNumber: 2,
        section: null,
        value: 'helloworld',
      },
    ],
    format: 'properties',
    hasSections: false,
    sectionOrder: [],
  },
  'Properties files must support continuation lines inside the shared key-value parser.',
);

assert.deepEqual(
  parseTabularDataPreviewValue({
    path: '/workspace/report.csv',
    language: 'csv',
    value: 'name,status\nalpha,ready\nbeta,running\n',
  }),
  {
    columnCount: 2,
    delimiter: ',',
    hasHeaderRow: true,
    rows: [
      ['name', 'status'],
      ['alpha', 'ready'],
      ['beta', 'running'],
    ],
  },
  'CSV files must be parsed into a reusable tabular preview payload.',
);

assert.deepEqual(
  parseTabularDataPreviewValue({
    path: '/workspace/report.tsv',
    language: 'tsv',
    value: 'name\tstatus\nalpha\tready\nbeta\trunning\n',
  }),
  {
    columnCount: 2,
    delimiter: '\t',
    hasHeaderRow: true,
    rows: [
      ['name', 'status'],
      ['alpha', 'ready'],
      ['beta', 'running'],
    ],
  },
  'TSV files must be parsed into a reusable tabular preview payload.',
);

assert.equal(
  parseTabularDataPreviewValue({
    path: '/workspace/.env',
    language: 'env',
    value: 'ALLOWED_HOSTS=app.example.com,admin.example.com\nPORT=3000\n',
  }),
  null,
  'Explicit config files must not be misclassified as CSV-style table previews.',
);

assert.equal(
  resolveContentPreviewDisplayLabel({
    path: '/workspace/settings.json',
    language: 'json',
    value: '{"name":"demo"}',
  }),
  'Structured Data',
  'Structured data files must advertise the structured preview label.',
);

assert.equal(
  resolveContentPreviewDisplayLabel({
    path: '/workspace/report.csv',
    language: 'csv',
    value: 'name,status\nalpha,ready\nbeta,running\n',
  }),
  'Data Table',
  'Delimited text files must advertise the table preview label.',
);

assert.equal(
  resolveContentPreviewDisplayLabel({
    path: '/workspace/app.yaml',
    language: 'yaml',
    value: 'name: demo\nenabled: true\n',
  }),
  'Structured Data',
  'YAML files must advertise the structured preview label.',
);

assert.equal(
  resolveContentPreviewDisplayLabel({
    path: '/workspace/settings.jsonc',
    language: 'jsonc',
    value: '{\n  // comment\n  "name": "demo",\n}\n',
  }),
  'Structured Data',
  'JSONC files must advertise the structured preview label.',
);

assert.equal(
  resolveContentPreviewDisplayLabel({
    path: '/workspace/Cargo.toml',
    language: 'toml',
    value: 'name = "demo"\n',
  }),
  'Structured Data',
  'TOML files must advertise the structured preview label.',
);

assert.equal(
  resolveContentPreviewDisplayLabel({
    path: '/workspace/.env',
    language: 'env',
    value: 'PORT=3000\n',
  }),
  'Config',
  'Key-value config files must advertise the config preview label.',
);

assert.deepEqual(
  resolveContentPreviewDescriptor({
    path: '/workspace/report.csv',
    language: 'csv',
    value: 'name,status\nalpha,ready\nbeta,running\n',
  }),
  {
    codeLanguage: 'text',
    displayLabel: 'Data Table',
    kind: 'text',
    keyValueData: null,
    language: 'csv',
    path: '/workspace/report.csv',
    presentation: 'table',
    shouldDefaultToSplit: true,
    sourceValue: 'name,status\nalpha,ready\nbeta,running\n',
    structuredData: null,
    tabularData: {
      columnCount: 2,
      delimiter: ',',
      hasHeaderRow: true,
      rows: [
        ['name', 'status'],
        ['alpha', 'ready'],
        ['beta', 'running'],
      ],
    },
  },
  'Content preview descriptor must standardize the full preview state for table content.',
);

assert.deepEqual(
  resolveContentPreviewDescriptor({
    path: '/workspace/app.yaml',
    language: 'yaml',
    value: 'name: demo\nenabled: true\n',
  }),
  {
    codeLanguage: 'yaml',
    displayLabel: 'Structured Data',
    kind: 'text',
    keyValueData: null,
    language: 'yaml',
    path: '/workspace/app.yaml',
    presentation: 'structured-data',
    shouldDefaultToSplit: true,
    sourceValue: 'name: demo\nenabled: true\n',
    structuredData: {
      format: 'yaml',
      value: {
        name: 'demo',
        enabled: true,
      },
    },
    tabularData: null,
  },
  'Content preview descriptor must standardize the full preview state for YAML structured content.',
);

assert.deepEqual(
  resolveContentPreviewDescriptor({
    path: '/workspace/settings.jsonc',
    language: 'jsonc',
    value: '{\n  // comment\n  "name": "demo",\n}\n',
  }),
  {
    codeLanguage: 'json',
    displayLabel: 'Structured Data',
    kind: 'text',
    keyValueData: null,
    language: 'jsonc',
    path: '/workspace/settings.jsonc',
    presentation: 'structured-data',
    shouldDefaultToSplit: true,
    sourceValue: '{\n  // comment\n  "name": "demo",\n}\n',
    structuredData: {
      format: 'jsonc',
      value: {
        name: 'demo',
      },
    },
    tabularData: null,
  },
  'Content preview descriptor must standardize the full preview state for JSONC structured content.',
);

assert.deepEqual(
  resolveContentPreviewDescriptor({
    path: '/workspace/Cargo.toml',
    language: 'toml',
    value: '[package]\nname = "demo"\nversion = "0.1.0"\n',
  }),
  {
    codeLanguage: 'toml',
    displayLabel: 'Structured Data',
    kind: 'text',
    keyValueData: null,
    language: 'toml',
    path: '/workspace/Cargo.toml',
    presentation: 'structured-data',
    shouldDefaultToSplit: true,
    sourceValue: '[package]\nname = "demo"\nversion = "0.1.0"\n',
    structuredData: {
      format: 'toml',
      value: {
        package: {
          name: 'demo',
          version: '0.1.0',
        },
      },
    },
    tabularData: null,
  },
  'Content preview descriptor must standardize the full preview state for TOML structured content.',
);

assert.deepEqual(
  resolveContentPreviewDescriptor({
    path: '/workspace/.env',
    language: 'env',
    value: 'PORT=3000\nAPI_URL=https://example.com\n',
  }),
  {
    codeLanguage: 'text',
    displayLabel: 'Config',
    keyValueData: {
      entries: [
        {
          key: 'PORT',
          lineNumber: 1,
          section: null,
          value: '3000',
        },
        {
          key: 'API_URL',
          lineNumber: 2,
          section: null,
          value: 'https://example.com',
        },
      ],
      format: 'dotenv',
      hasSections: false,
      sectionOrder: [],
    },
    kind: 'text',
    language: 'env',
    path: '/workspace/.env',
    presentation: 'key-value',
    shouldDefaultToSplit: true,
    sourceValue: 'PORT=3000\nAPI_URL=https://example.com\n',
    structuredData: null,
    tabularData: null,
  },
  'Content preview descriptor must standardize the full preview state for config content.',
);

assert.equal(
  resolveContentPreviewCodeLanguage({
    path: '/workspace/src/index.ts',
    language: '',
  }),
  'ts',
  'Code files must expose a preview language derived from the file path.',
);

assert.equal(
  resolveContentPreviewCodeLanguage({
    path: '/workspace/.env',
    language: 'env',
  }),
  'text',
  'Key-value config sources must stay on the plain text highlighting path.',
);

assert.equal(
  shouldDefaultToSplitContentWorkbench({
    path: '/workspace/settings.json',
    language: 'json',
    value: '{"name":"demo"}',
  }),
  true,
  'Structured data previews should open in split mode by default.',
);

assert.equal(
  shouldDefaultToSplitContentWorkbench({
    path: '/workspace/report.csv',
    language: 'csv',
    value: 'name,status\nalpha,ready\nbeta,running\n',
  }),
  true,
  'Table previews should open in split mode by default.',
);

assert.equal(
  shouldDefaultToSplitContentWorkbench({
    path: '/workspace/.env',
    language: 'env',
    value: 'PORT=3000\n',
  }),
  true,
  'Config previews should open in split mode by default.',
);

assert.equal(
  resolveContentPreviewSandbox('locked'),
  '',
  'Locked sandbox policy must remove all iframe permissions.',
);

assert.match(
  resolveContentPreviewSandbox('trusted'),
  /allow-same-origin/,
  'Trusted sandbox policy must allow same-origin rendering for trusted content.',
);

const htmlDocument = buildHtmlPreviewDocument('<main>Preview</main>', {
  title: 'Demo Preview',
});
assert.match(
  htmlDocument,
  /<title>Demo Preview<\/title>/,
  'HTML preview documents must inject the configured title.',
);
assert.match(
  htmlDocument,
  /<body><main>Preview<\/main><\/body>/,
  'HTML fragments must be wrapped into a preview document body.',
);

const svgDocument = buildSvgPreviewDocument('<svg viewBox="0 0 10 10"></svg>');
assert.match(
  svgDocument,
  /<svg viewBox="0 0 10 10"><\/svg>/,
  'SVG preview documents must keep the SVG markup intact.',
);

const codeEditorSurfaceSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeEditorSurface.tsx', import.meta.url),
  'utf8',
);
const contentPreviewerSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/ContentPreviewer.tsx', import.meta.url),
  'utf8',
);
const universalChatCodeBlockSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChatCodeBlock.tsx', import.meta.url),
  'utf8',
);

assert.match(
  codeEditorSurfaceSource,
  /resolveContentPreviewDescriptor/,
  'CodeEditorSurface must centralize preview resolution through the shared preview descriptor helper.',
);

assert.match(
  codeEditorSurfaceSource,
  /<ContentWorkbench[\s\S]*previewDescriptor=\{previewDescriptor \?\? undefined\}/,
  'CodeEditorSurface must pass the resolved preview descriptor into the shared ContentWorkbench.',
);

assert.match(
  contentPreviewerSource,
  /ContentStructuredDataPreview/,
  'ContentPreviewer must integrate the shared structured data preview component.',
);

assert.match(
  contentPreviewerSource,
  /format=\{previewDescriptor\.structuredData\.format\}/,
  'ContentPreviewer must forward the structured data source format into the shared structured preview component.',
);

assert.match(
  contentPreviewerSource,
  /ContentTablePreview/,
  'ContentPreviewer must integrate the shared table preview component.',
);

assert.match(
  contentPreviewerSource,
  /ContentKeyValuePreview/,
  'ContentPreviewer must integrate the shared key-value preview component.',
);

assert.match(
  contentPreviewerSource,
  /value=\{previewDescriptor\.keyValueData\}/,
  'ContentPreviewer must forward the resolved key-value descriptor payload into the shared config preview component.',
);

assert.match(
  contentPreviewerSource,
  /ContentCodePreview/,
  'ContentPreviewer must integrate the shared code preview component.',
);

assert.match(
  contentPreviewerSource,
  /descriptor \?\?/,
  'ContentPreviewer must accept a pre-resolved preview descriptor from upstream consumers.',
);

assert.match(
  universalChatCodeBlockSource,
  /\['toml', 'toml'\]/,
  'UniversalChatCodeBlock must register TOML so config-oriented code previews such as Cargo.toml render with correct syntax highlighting.',
);

console.log('content previewer contract passed');
