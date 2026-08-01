// @vitest-environment jsdom

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  AgentSessionCommandView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { ChatActivitySummary } from './ChatActivitySummary.tsx';

const commands: AgentSessionCommandView[] = [
  {
    command: 'pnpm typecheck',
    output: 'TypeScript check passed.',
    status: 'success',
    toolCallId: 'command-typecheck',
  },
  {
    command: 'pnpm test -- --runInBand',
    output: 'All focused tests passed.',
    status: 'success',
    toolCallId: 'command-tests',
  },
];

function ActivityHarness() {
  const [expandedDisclosureKeys, setExpandedDisclosureKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  return (
    <ChatActivitySummary
      commands={commands}
      copyLabel="Copy"
      copyMessageToClipboard={() => undefined}
      disclosureScopeKey="session-activity"
      expandedDisclosureKeys={expandedDisclosureKeys}
      messageId="message-activity"
      successIconSize={14}
      toggleDisclosure={(key) => {
        setExpandedDisclosureKeys((current) => {
          const next = new Set(current);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        });
      }}
    />
  );
}

afterEach(() => cleanup());

describe('ChatActivitySummary interactions', () => {
  it('expands a multi-command summary and preserves each command result independently', () => {
    const { container } = render(<ActivityHarness />);
    const summary = screen.getByRole('button', {
      name: /Ran 2 commands\. Show activity details/u,
    });

    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-chat-activity-details="true"]')).toBeNull();

    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');

    const activityDetails = container.querySelector<HTMLElement>(
      '[data-chat-activity-details="true"]',
    );
    expect(activityDetails).not.toBeNull();
    const commandDisclosures = within(activityDetails!).getAllByRole('button', {
      name: /Succeeded: .*Show activity details/u,
    });
    expect(commandDisclosures).toHaveLength(2);

    fireEvent.click(commandDisclosures[0]!);
    fireEvent.click(commandDisclosures[1]!);

    const commandDetails = activityDetails!.querySelectorAll(
      '[data-chat-command-details="true"]',
    );
    expect(commandDetails).toHaveLength(2);
    expect(commandDetails[0]?.textContent).toContain('pnpm typecheck');
    expect(commandDetails[0]?.textContent).toContain('TypeScript check passed.');
    expect(commandDetails[1]?.textContent).toContain('pnpm test -- --runInBand');
    expect(commandDetails[1]?.textContent).toContain('All focused tests passed.');
  });
});
