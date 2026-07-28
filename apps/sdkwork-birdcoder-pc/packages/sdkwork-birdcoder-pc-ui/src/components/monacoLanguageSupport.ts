import type { Monaco } from '@monaco-editor/react';
import type { languages } from 'monaco-editor';

interface BirdCoderMonacoLanguageContribution {
  configuration: languages.LanguageConfiguration;
  extensionPoint: languages.ILanguageExtensionPoint;
  monarch: languages.IMonarchLanguage;
}

const TOML_LANGUAGE: BirdCoderMonacoLanguageContribution = {
  extensionPoint: {
    id: 'toml',
    aliases: ['TOML', 'toml'],
    extensions: ['.toml'],
    mimetypes: ['application/toml'],
  },
  configuration: {
    comments: { lineComment: '#' },
    brackets: [
      ['[', ']'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '[', close: ']' },
      { open: '{', close: '}' },
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '[', close: ']' },
      { open: '{', close: '}' },
    ],
  },
  monarch: {
    defaultToken: '',
    tokenPostfix: '.toml',
    tokenizer: {
      root: [
        [/^\s*#.*/, 'comment'],
        [/\[\[[^\]]+\]\]/, 'type.identifier'],
        [/\[[^\]]+\]/, 'type.identifier'],
        [/^\s*([A-Za-z0-9_.-]+)(\s*)(=)/, ['key', '', 'delimiter']],
        [/"""/, { token: 'string.quote', next: '@multiDoubleQuotedString' }],
        [/'''/, { token: 'string.quote', next: '@multiSingleQuotedString' }],
        [/"/, { token: 'string.quote', next: '@doubleQuotedString' }],
        [/'/, { token: 'string.quote', next: '@singleQuotedString' }],
        [/\b(?:true|false)\b/, 'constant.language'],
        [/\b\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?\b/, 'number'],
        [/[+-]?(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)/, 'number'],
        [/[\[\]{},]/, 'delimiter.bracket'],
      ],
      doubleQuotedString: [
        [/[^\\"]+/, 'string'],
        [/\\(?:[btnfr"\\]|u[\da-fA-F]{4}|U[\da-fA-F]{8})/, 'string.escape'],
        [/"/, { token: 'string.quote', next: '@pop' }],
      ],
      singleQuotedString: [
        [/[^']+/, 'string'],
        [/'/, { token: 'string.quote', next: '@pop' }],
      ],
      multiDoubleQuotedString: [
        [/[^\\"]+/, 'string'],
        [/\\(?:[btnfr"\\]|u[\da-fA-F]{4}|U[\da-fA-F]{8})/, 'string.escape'],
        [/"""/, { token: 'string.quote', next: '@pop' }],
        [/"/, 'string'],
      ],
      multiSingleQuotedString: [
        [/[^']+/, 'string'],
        [/'''/, { token: 'string.quote', next: '@pop' }],
        [/'/, 'string'],
      ],
    },
  },
};

const DOTENV_LANGUAGE: BirdCoderMonacoLanguageContribution = {
  extensionPoint: {
    id: 'dotenv',
    aliases: ['Environment', 'dotenv'],
    extensions: ['.env'],
  },
  configuration: {
    comments: { lineComment: '#' },
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '${', close: '}' },
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  },
  monarch: {
    defaultToken: '',
    tokenPostfix: '.dotenv',
    tokenizer: {
      root: [
        [/^\s*#.*/, 'comment'],
        [/^\s*(export)(\s+)/, ['keyword', '']],
        [/^\s*([A-Za-z_][\w.-]*)(\s*)(=)/, ['key', '', 'delimiter']],
        [/\$\{[A-Za-z_][\w.-]*(?::-[^}]*)?\}/, 'variable'],
        [/"/, { token: 'string.quote', next: '@doubleQuotedString' }],
        [/'[^']*'/, 'string'],
        [/\b(?:true|false|null)\b/i, 'constant.language'],
        [/[+-]?\d+(?:\.\d+)?/, 'number'],
      ],
      doubleQuotedString: [
        [/\$\{[A-Za-z_][\w.-]*(?::-[^}]*)?\}/, 'variable'],
        [/\\./, 'string.escape'],
        [/[^\\"$]+/, 'string'],
        [/"/, { token: 'string.quote', next: '@pop' }],
        [/./, 'string'],
      ],
    },
  },
};

const MAKEFILE_LANGUAGE: BirdCoderMonacoLanguageContribution = {
  extensionPoint: {
    id: 'makefile',
    aliases: ['Makefile', 'makefile'],
    extensions: ['.mk', '.mak'],
    filenames: ['Makefile', 'makefile', 'GNUmakefile', 'BSDmakefile'],
  },
  configuration: {
    comments: { lineComment: '#' },
    brackets: [
      ['(', ')'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '$(', close: ')' },
      { open: '${', close: '}' },
    ],
  },
  monarch: {
    defaultToken: '',
    tokenPostfix: '.makefile',
    tokenizer: {
      root: [
        [/^\s*#.*/, 'comment'],
        [/^\s*(?:-?include|sinclude|ifdef|ifndef|ifeq|ifneq|else|endif|define|endef|override|export|unexport|private|vpath)\b/, 'keyword'],
        [/^\s*([A-Za-z0-9_./%+@-]+)(?=\s*:)/, 'type.identifier'],
        [/\$[@%<?^+*|]/, 'variable.predefined'],
        [/\$\((?:[^()]|\([^)]*\))*\)|\$\{[^}]+\}/, 'variable'],
        [/\$\$/, 'string.escape'],
        [/"(?:\\.|[^"\\])*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/#.*$/, 'comment'],
        [/(?:\?=|:=|::=|\+=|!=|=|:)/, 'operator'],
      ],
    },
  },
};

const CMAKE_LANGUAGE: BirdCoderMonacoLanguageContribution = {
  extensionPoint: {
    id: 'cmake',
    aliases: ['CMake', 'cmake'],
    extensions: ['.cmake'],
    filenames: ['CMakeLists.txt'],
  },
  configuration: {
    comments: { lineComment: '#' },
    brackets: [
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
    ],
  },
  monarch: {
    defaultToken: '',
    ignoreCase: true,
    tokenPostfix: '.cmake',
    tokenizer: {
      root: [
        [/^\s*#.*/, 'comment'],
        [/\$\{[A-Za-z_][\w.-]*\}|\$ENV\{[A-Za-z_][\w.-]*\}/, 'variable'],
        [/\b(?:if|elseif|else|endif|foreach|endforeach|while|endwhile|function|endfunction|macro|endmacro|return|break|continue)\b/, 'keyword.control'],
        [/[A-Za-z_][\w]*(?=\s*\()/, 'function'],
        [/"/, { token: 'string.quote', next: '@doubleQuotedString' }],
        [/\b(?:ON|OFF|TRUE|FALSE|YES|NO|Y|N|IGNORE|NOTFOUND)\b/, 'constant.language'],
        [/[+-]?\d+(?:\.\d+)?/, 'number'],
        [/[()\[\]]/, 'delimiter.bracket'],
      ],
      doubleQuotedString: [
        [/\$\{[A-Za-z_][\w.-]*\}|\$ENV\{[A-Za-z_][\w.-]*\}/, 'variable'],
        [/\\./, 'string.escape'],
        [/[^\\"$]+/, 'string'],
        [/"/, { token: 'string.quote', next: '@pop' }],
        [/./, 'string'],
      ],
    },
  },
};

export const BIRDCODER_MONACO_LANGUAGE_CONTRIBUTIONS = [
  TOML_LANGUAGE,
  DOTENV_LANGUAGE,
  MAKEFILE_LANGUAGE,
  CMAKE_LANGUAGE,
] as const;

const configuredMonacoLanguageApis = new WeakSet<object>();

export function configureBirdCoderMonacoLanguages(monaco: Monaco): void {
  const monacoObject = monaco as object;
  if (configuredMonacoLanguageApis.has(monacoObject)) {
    return;
  }

  configuredMonacoLanguageApis.add(monacoObject);
  const registeredLanguageIds = new Set(
    monaco.languages.getLanguages().map(
      ({ id }: languages.ILanguageExtensionPoint) => id,
    ),
  );

  for (const contribution of BIRDCODER_MONACO_LANGUAGE_CONTRIBUTIONS) {
    const { id } = contribution.extensionPoint;
    if (registeredLanguageIds.has(id)) {
      continue;
    }

    monaco.languages.register(contribution.extensionPoint);
    monaco.languages.setMonarchTokensProvider(id, contribution.monarch);
    monaco.languages.setLanguageConfiguration(id, contribution.configuration);
    registeredLanguageIds.add(id);
  }
}
