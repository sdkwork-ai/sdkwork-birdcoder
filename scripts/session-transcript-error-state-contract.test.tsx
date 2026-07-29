import assert from 'node:assert/strict';
import React, {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCodeChatEmptyStates } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageShared.tsx';
import { StudioSessionTranscriptErrorState } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioSessionTranscriptLoadingState.tsx';
import { SessionTranscriptErrorState } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/components/SessionTranscriptErrorState.tsx';

interface RetryButtonProps {
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'reset' | 'submit';
}

function findRetryButton(node: ReactNode): ReactElement<RetryButtonProps> | null {
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return null;
  }
  if (node.type === 'button') {
    return node as ReactElement<RetryButtonProps>;
  }
  for (const child of Children.toArray(node.props.children)) {
    const retryButton = findRetryButton(child);
    if (retryButton) {
      return retryButton;
    }
  }
  return null;
}

const errorStateProps = {
  description: 'The complete conversation could not be loaded.',
  retryLabel: 'Retry loading messages',
  title: 'Conversation unavailable',
};
let retryCount = 0;
const onRetry = () => {
  retryCount += 1;
};

const sharedErrorState = SessionTranscriptErrorState({
  ...errorStateProps,
  onRetry,
});
const sharedErrorHtml = renderToStaticMarkup(sharedErrorState);
const sharedRetryButton = findRetryButton(sharedErrorState);

assert.ok(sharedRetryButton, 'The shared error state must render a retry button.');
assert.match(sharedErrorHtml, /role="alert"/u);
assert.match(sharedErrorHtml, /Conversation unavailable/u);
assert.match(sharedErrorHtml, /The complete conversation could not be loaded\./u);
assert.match(sharedErrorHtml, /Retry loading messages/u);
assert.doesNotMatch(sharedErrorHtml, /<button[^>]*\sdisabled(?:=|\s|>)/u);
assert.equal(sharedRetryButton.props.type, 'button');
assert.notEqual(sharedRetryButton.props.disabled, true);
assert.equal(sharedRetryButton.props.onClick, onRetry);
sharedRetryButton.props.onClick?.();
assert.equal(retryCount, 1, 'The enabled retry control must invoke its supplied callback once.');

const codeErrorStates = createCodeChatEmptyStates(true, {
  ...errorStateProps,
  onRetry,
});
assert.ok(codeErrorStates.editorChatEmptyState);
for (const [surface, state] of [
  ['main', codeErrorStates.mainChatEmptyState],
  ['editor', codeErrorStates.editorChatEmptyState],
] as const) {
  const html = renderToStaticMarkup(<>{state}</>);
  assert.match(html, /role="alert"/u, `Code ${surface} chat must render an alert.`);
  assert.match(html, /Conversation unavailable/u);
  assert.doesNotMatch(
    html,
    /Loading conversation/u,
    `Code ${surface} chat must prioritize the load error over its hydration state.`,
  );
  assert.ok(isValidElement<{ onRetry?: () => void }>(state));
  assert.equal(state.props.onRetry, onRetry);
}

const studioErrorState = StudioSessionTranscriptErrorState({
  ...errorStateProps,
  onRetry,
});
const studioErrorHtml = renderToStaticMarkup(studioErrorState);
assert.match(studioErrorHtml, /role="alert"/u);
assert.match(studioErrorHtml, /Conversation unavailable/u);
assert.match(studioErrorHtml, /The complete conversation could not be loaded\./u);
assert.match(studioErrorHtml, /Retry loading messages/u);
assert.ok(isValidElement<{ onRetry?: () => void }>(studioErrorState));
assert.equal(
  studioErrorState.props.onRetry,
  onRetry,
  'Studio must forward the retry callback to the shared transcript error state.',
);

console.log('session transcript error state contract passed.');
