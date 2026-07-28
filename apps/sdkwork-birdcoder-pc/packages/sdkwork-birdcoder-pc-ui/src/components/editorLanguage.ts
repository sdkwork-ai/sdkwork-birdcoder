export interface BirdCoderEditorLanguageDefinition {
  extensions: readonly string[];
  id: string;
  label: string;
}

export const BIRDCODER_EDITOR_LANGUAGE_DEFINITIONS = [
  { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'tsx', 'mts', 'cts'] },
  { id: 'javascript', label: 'JavaScript', extensions: ['js', 'jsx', 'mjs', 'cjs'] },
  { id: 'rust', label: 'Rust', extensions: ['rs'] },
  { id: 'go', label: 'Go', extensions: ['go'] },
  { id: 'cpp', label: 'C / C++', extensions: ['c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'ino'] },
  { id: 'python', label: 'Python', extensions: ['py', 'pyi', 'pyw', 'pyx'] },
  { id: 'java', label: 'Java', extensions: ['java', 'gradle', 'groovy'] },
  { id: 'kotlin', label: 'Kotlin', extensions: ['kt', 'kts'] },
  { id: 'csharp', label: 'C#', extensions: ['cs', 'csx'] },
  { id: 'swift', label: 'Swift', extensions: ['swift'] },
  { id: 'dart', label: 'Dart', extensions: ['dart'] },
  { id: 'objective-c', label: 'Objective-C', extensions: ['m', 'mm'] },
  { id: 'php', label: 'PHP', extensions: ['php', 'php3', 'php4', 'php5', 'phtml'] },
  { id: 'ruby', label: 'Ruby', extensions: ['rb', 'rake', 'gemspec'] },
  { id: 'lua', label: 'Lua', extensions: ['lua'] },
  { id: 'perl', label: 'Perl', extensions: ['pl', 'pm'] },
  { id: 'r', label: 'R', extensions: ['r', 'rprofile'] },
  { id: 'scala', label: 'Scala', extensions: ['scala', 'sc'] },
  { id: 'fsharp', label: 'F#', extensions: ['fs', 'fsi', 'fsx'] },
  { id: 'clojure', label: 'Clojure', extensions: ['clj', 'cljs', 'cljc', 'edn'] },
  { id: 'elixir', label: 'Elixir', extensions: ['ex', 'exs'] },
  { id: 'julia', label: 'Julia', extensions: ['jl'] },
  { id: 'pascal', label: 'Pascal', extensions: ['pas', 'pp'] },
  { id: 'solidity', label: 'Solidity', extensions: ['sol'] },
  { id: 'wgsl', label: 'WGSL', extensions: ['wgsl'] },
  { id: 'html', label: 'HTML', extensions: ['html', 'htm', 'xhtml', 'vue', 'svelte', 'astro'] },
  { id: 'razor', label: 'Razor', extensions: ['razor', 'cshtml'] },
  { id: 'css', label: 'CSS', extensions: ['css'] },
  { id: 'scss', label: 'SCSS', extensions: ['scss', 'sass'] },
  { id: 'less', label: 'Less', extensions: ['less'] },
  { id: 'json', label: 'JSON', extensions: ['json', 'jsonc', 'json5', 'geojson'] },
  { id: 'yaml', label: 'YAML', extensions: ['yaml', 'yml'] },
  { id: 'xml', label: 'XML', extensions: ['xml', 'xsd', 'xsl', 'xslt', 'svg', 'plist'] },
  { id: 'markdown', label: 'Markdown', extensions: ['md', 'markdown'] },
  { id: 'mdx', label: 'MDX', extensions: ['mdx'] },
  { id: 'restructuredtext', label: 'reStructuredText', extensions: ['rst'] },
  { id: 'sql', label: 'SQL', extensions: ['sql', 'ddl', 'dml'] },
  { id: 'graphql', label: 'GraphQL', extensions: ['graphql', 'gql'] },
  { id: 'protobuf', label: 'Protocol Buffers', extensions: ['proto'] },
  { id: 'shell', label: 'Shell', extensions: ['sh', 'bash', 'zsh', 'fish'] },
  { id: 'powershell', label: 'PowerShell', extensions: ['ps1', 'psm1', 'psd1'] },
  { id: 'bat', label: 'Windows Batch', extensions: ['bat', 'cmd'] },
  { id: 'dockerfile', label: 'Dockerfile', extensions: ['dockerfile', 'containerfile'] },
  { id: 'hcl', label: 'HCL / Terraform', extensions: ['hcl', 'tf', 'tfvars'] },
  { id: 'ini', label: 'INI', extensions: ['ini', 'cfg', 'conf', 'properties'] },
  { id: 'toml', label: 'TOML', extensions: ['toml'] },
  { id: 'dotenv', label: 'Environment', extensions: ['env'] },
  { id: 'makefile', label: 'Makefile', extensions: ['mk', 'mak'] },
  { id: 'cmake', label: 'CMake', extensions: ['cmake'] },
] as const satisfies readonly BirdCoderEditorLanguageDefinition[];

const languageByExtension = new Map<string, string>();
const labelByLanguage = new Map<string, string>([['plaintext', 'Plain Text']]);

for (const definition of BIRDCODER_EDITOR_LANGUAGE_DEFINITIONS) {
  labelByLanguage.set(definition.id, definition.label);
  for (const extension of definition.extensions) {
    languageByExtension.set(extension, definition.id);
  }
}

const languageByFileName: Readonly<Record<string, string>> = {
  '.bash_profile': 'shell',
  '.bashrc': 'shell',
  '.editorconfig': 'ini',
  '.gitattributes': 'plaintext',
  '.gitconfig': 'ini',
  '.gitignore': 'plaintext',
  '.npmrc': 'ini',
  '.profile': 'shell',
  '.yarnrc': 'yaml',
  '.zprofile': 'shell',
  '.zshrc': 'shell',
  'bsdmakefile': 'makefile',
  'cargo.lock': 'toml',
  'cmakelists.txt': 'cmake',
  'containerfile': 'dockerfile',
  'dockerfile': 'dockerfile',
  'gemfile': 'ruby',
  'gnumakefile': 'makefile',
  'go.mod': 'go',
  'go.work': 'go',
  'gradlew': 'shell',
  'makefile': 'makefile',
  'pipfile': 'toml',
  'poetry.lock': 'toml',
  'rakefile': 'ruby',
  'sconscript': 'python',
  'sconstruct': 'python',
};

function readNormalizedFileName(path: string): string {
  const normalizedPath = path.trim().replaceAll('\\', '/').split(/[?#]/u, 1)[0] ?? '';
  return normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1).toLowerCase();
}

export function resolveBirdCoderEditorLanguage(path: string): string {
  const fileName = readNormalizedFileName(path);
  if (!fileName) {
    return 'plaintext';
  }

  const fileNameLanguage = languageByFileName[fileName];
  if (fileNameLanguage) {
    return fileNameLanguage;
  }

  if (fileName === '.env' || fileName.startsWith('.env.')) {
    return 'dotenv';
  }

  if (fileName.startsWith('dockerfile.') || fileName.startsWith('containerfile.')) {
    return 'dockerfile';
  }

  const extensionSeparatorIndex = fileName.lastIndexOf('.');
  if (extensionSeparatorIndex < 0 || extensionSeparatorIndex === fileName.length - 1) {
    return 'plaintext';
  }

  const extension = fileName.slice(extensionSeparatorIndex + 1);
  return languageByExtension.get(extension) ?? 'plaintext';
}

export function resolveBirdCoderEditorLanguageLabel(language: string): string {
  const normalizedLanguage = language.trim().toLowerCase();
  if (!normalizedLanguage) {
    return 'Plain Text';
  }

  return labelByLanguage.get(normalizedLanguage) ?? language;
}
