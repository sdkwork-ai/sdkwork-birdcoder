import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerHeader.tsx',
  ),
  'utf8',
);
const sessionRowSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionRow.tsx',
  ),
  'utf8',
);

assert.match(
  source,
  /className="project-explorer-scroll-region px-1 pb-2 flex-1 min-h-0 overflow-y-auto"/,
  'Project explorer session list must render through the dedicated hover-scroll region class with compact horizontal padding and min-height gating.',
);

const sectionHeaderIndex = source.indexOf(
  'className="flex items-center justify-between text-gray-400 text-xs mb-3 px-2 relative font-semibold tracking-wider uppercase animate-in fade-in slide-in-from-left-4 fill-mode-both"',
);
const searchInputIndex = source.indexOf('placeholder={searchSessionsPlaceholder}');
const scrollRegionIndex = source.indexOf(
  'className="project-explorer-scroll-region px-1 pb-2 flex-1 min-h-0 overflow-y-auto"',
);
const scrollRegionChildrenIndex = source.indexOf('{children}', scrollRegionIndex);

assert.notEqual(sectionHeaderIndex, -1, 'Project explorer section header must exist.');
assert.notEqual(searchInputIndex, -1, 'Project explorer search input must exist.');
assert.notEqual(scrollRegionIndex, -1, 'Project explorer scroll region must exist.');
assert.notEqual(scrollRegionChildrenIndex, -1, 'Project explorer children must render inside the scroll region.');

assert.ok(
  sectionHeaderIndex < scrollRegionIndex,
  'Project explorer section header and filters must render before the scroll region so project scrolling only moves the session list.',
);

assert.ok(
  searchInputIndex < scrollRegionIndex,
  'Project explorer search box must render before the scroll region so searching controls stay pinned above project scrolling.',
);

assert.doesNotMatch(
  source,
  /className="project-explorer-scroll-region px-1 pb-2 flex-1 min-h-0 overflow-y-auto"[\s\S]*?<span>\{sessionsLabel\}<\/span>/,
  'Project explorer scroll region must not contain the Sessions header.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region\s*\{[\s\S]*scrollbar-width:\s*none;[\s\S]*scrollbar-color:\s*transparent\s+transparent;/,
  'Project explorer scroll region must not reserve right-side scrollbar width by default.',
);

assert.doesNotMatch(
  source,
  /scrollbar-gutter:/,
  'Project explorer scroll region must not add gutter padding that makes the left and right visual spacing uneven.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region:hover\s*\{[\s\S]*scrollbar-width:\s*thin;[\s\S]*scrollbar-color:\s*rgba\(255,\s*255,\s*255,\s*0\.18\)\s*transparent;/,
  'Project explorer scroll region hover must reveal a thin scrollbar.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region:hover::\-webkit-scrollbar\s*\{[\s\S]*width:\s*8px;[\s\S]*height:\s*8px;/,
  'Project explorer scroll region must restore the WebKit scrollbar size on hover.',
);

assert.match(
  sessionRowSource,
  /className=\{`\$\{paddingClassName\} py-1\.5 relative group flex w-full min-w-0 max-w-full items-center justify-between overflow-hidden/,
  'Code ProjectExplorer session row must occupy a stable full-width box that cannot be widened by its hover content.',
);

assert.match(
  sessionRowSource,
  /<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">/,
  'Code ProjectExplorer session row text cluster must be min-w-0 so long titles shrink instead of changing row geometry.',
);

assert.match(
  sessionRowSource,
  /<span className="min-w-0 flex-1 truncate">\{session\.title\}<\/span>/,
  'Code ProjectExplorer session titles must truncate inside the row instead of participating in intrinsic width expansion.',
);

console.log('project explorer scrollbar contract passed.');
