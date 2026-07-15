import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectSectionSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerProjectSection.tsx',
    import.meta.url,
  ),
  'utf8',
);
const appStylesSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/src/index.css', import.meta.url),
  'utf8',
);

assert.match(
  projectSectionSource,
  /expanded \? <FolderOpen[\s\S]*: <Folder/s,
  'project rows must express expansion with open and closed folder icons',
);
assert.doesNotMatch(
  projectSectionSource,
  /ChevronDown|ChevronRight/,
  'project rows must not render a separate expansion chevron',
);
assert.match(
  projectSectionSource,
  /aria-expanded=\{expanded\}/,
  'the folder toggle must expose its expansion state',
);
assert.match(
  projectSectionSource,
  /onClick=\{handleProjectRowClick\}/,
  'clicking the project row must use the project selection and expansion toggle handler',
);
assert.match(
  projectSectionSource,
  /onSelectProject\(project\.id\);\s*onToggleProject\(project\.id, event\);/s,
  'the project row handler must select the project and toggle its expansion state',
);
assert.match(
  projectSectionSource,
  /transition-\[grid-template-rows,opacity\][\s\S]*gridTemplateRows: expanded \? '1fr' : '0fr'/s,
  'project sessions must animate between collapsed and expanded grid rows',
);
assert.match(
  projectSectionSource,
  /aria-hidden=\{!expanded\}[\s\S]*inert=\{!expanded\}/s,
  'collapsed project sessions must be hidden from interaction and assistive technology',
);

const selectedRule = /\.birdcoder-session-list \.birdcoder-session-selected \{(?<body>[\s\S]*?)\n  \}/u.exec(
  appStylesSource,
);
assert.ok(selectedRule?.groups?.body, 'selected session styling must exist');
assert.doesNotMatch(
  selectedRule.groups.body,
  /border|box-shadow/u,
  'selected project and session rows must use a borderless background treatment',
);

console.log('project explorer project row visual contract passed.');
