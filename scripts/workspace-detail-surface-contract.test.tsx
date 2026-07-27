import assert from 'node:assert/strict';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  BrowserPreviewSurface,
  resolveBrowserPreviewAddress,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/BrowserPreviewSurface.tsx';
import { UniversalChatMarkdown } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx';
import { WorkspaceDetailSurface } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/WorkspaceDetailSurface.tsx';

assert.equal(resolveBrowserPreviewAddress('sdkwork.com/docs'), 'https://sdkwork.com/docs');
assert.equal(resolveBrowserPreviewAddress('localhost:5173/app'), 'http://localhost:5173/app');
assert.equal(resolveBrowserPreviewAddress('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
assert.equal(resolveBrowserPreviewAddress('javascript:alert(1)'), null);
assert.equal(resolveBrowserPreviewAddress('file:///C:/Users/admin/.ssh/id_rsa'), null);
assert.equal(resolveBrowserPreviewAddress(''), null);

const markdownHtml = renderToStaticMarkup(
  <UniversalChatMarkdown
    content="Open [SDKWork](https://sdkwork.com/docs)."
    mode="basic"
    onOpenUrl={() => undefined}
    openUrlLabel="Open link preview"
  />,
);

assert.match(markdownHtml, /data-chat-markdown-url-link="true"/u);
assert.match(
  markdownHtml,
  /aria-label="Open link preview: https:\/\/sdkwork\.com\/docs"/u,
);
assert.doesNotMatch(
  markdownHtml,
  /target="_blank"/u,
  'HTTP links with an injected preview callback must stay in the application workspace.',
);

const detailSurfaceHtml = renderToStaticMarkup(
  <WorkspaceDetailSurface
    activeViewId="code"
    views={[
      {
        id: 'preview',
        kind: 'browser',
        keepMounted: true,
        content: <div>Browser state</div>,
      },
      {
        id: 'code',
        kind: 'review',
        keepMounted: true,
        content: <div>Review state</div>,
      },
    ]}
  />,
);

assert.match(detailSurfaceHtml, /data-workspace-detail-active-view="code"/u);
assert.match(detailSurfaceHtml, /data-workspace-detail-active-kind="review"/u);
assert.match(
  detailSurfaceHtml,
  /aria-hidden="true"[^>]*class="hidden"[^>]*data-workspace-detail-kind="browser"/u,
  'Inactive keep-mounted renderers must retain state without remaining visible or exposed to assistive technology.',
);
assert.match(
  detailSurfaceHtml,
  /aria-hidden="false"[^>]*data-workspace-detail-kind="review"/u,
);

const browserPreviewHtml = renderToStaticMarkup(
  <BrowserPreviewSurface
    adapter={{
      id: 'sdkwork-browser-contract-adapter',
      render: ({ url }) => <div data-sdkwork-browser-contract="true">{url}</div>,
    }}
    labels={{
      address: 'Browser address',
      back: 'Back',
      forward: 'Forward',
      navigate: 'Navigate',
      openExternal: 'Open externally',
      refresh: 'Refresh',
      title: 'Browser preview',
    }}
    url="https://sdkwork.com/docs"
    onNavigate={() => undefined}
  />,
);

assert.match(
  browserPreviewHtml,
  /data-browser-preview-adapter="sdkwork-browser-contract-adapter"/u,
);
assert.match(browserPreviewHtml, /data-sdkwork-browser-contract="true"/u);
assert.match(browserPreviewHtml, /aria-label="Browser address"/u);
assert.match(browserPreviewHtml, /https:\/\/sdkwork\.com\/docs/u);

console.log('workspace detail surface contract passed.');
