import { describe, expect, it } from 'vitest';
import { resolveBirdCoderMonacoWorkerKind } from './monacoWorkerRouting';

describe('resolveBirdCoderMonacoWorkerKind', () => {
  it.each([
    ['json', 'json'],
    ['css', 'css'],
    ['less', 'css'],
    ['scss', 'css'],
    ['html', 'html'],
    ['handlebars', 'html'],
    ['razor', 'html'],
    ['javascript', 'typescript'],
    ['typescript', 'typescript'],
    ['editorWorkerService', 'editor'],
    ['', 'editor'],
  ] as const)('routes %s to the bundled %s worker', (label, expected) => {
    expect(resolveBirdCoderMonacoWorkerKind(label)).toBe(expected);
  });
});
