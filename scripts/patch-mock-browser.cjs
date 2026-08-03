const fs = require('fs');
const f = 'E:/sdkwork-space/sdkwork-birdcoder/scripts/pc-e2e-mock-api-server.mjs';
let t = fs.readFileSync(f, 'utf8');

// 1. length 120 → 123
const oldLen = 'Array.from({ length: 120 }, (_, index) => {';
const newLen = 'Array.from({ length: 123 }, (_, index) => {';
if (!t.includes(oldLen)) {
  console.log('len anchor missing');
  process.exit(1);
}
t = t.replace(oldLen, newLen);

// 2. browser-use 链（序列 121-123，在 sequence === 120 块之后、112 之前）
const oldSeq = '      if (sequence === 112) {';
const browserBlock = [
  `      if (sequence >= 121) {`,
  `        const isParent = sequence === 123;`,
  `        const step = 123 - sequence;`,
  `        const statusTexts = ['Started browser background', 'Corrected working directory typo', 'Navigated browser tab to target URL'];`,
  `        return {`,
  `          sessionId: 'e2e-codex-session',`,
  `          itemId: isParent ? 'e2e-codex-browser-nav' : \`e2e-codex-browser-step-\${step}\`,`,
  `          turnId: 'e2e-codex-turn-1',`,
  `          kind: 'tool_result',`,
  `          status: 'completed',`,
  `          sequence: String(sequence),`,
  `          content: null,`,
  `          contentType: 'application/json',`,
  `          toolName: 'provider_event',`,
  `          toolCallId: isParent ? 'e2e-codex-browser-nav' : \`e2e-codex-browser-step-\${step}\`,`,
  `          toolResult: {`,
  `            id: isParent ? 'e2e-codex-browser-nav' : \`e2e-codex-browser-step-\${step}\`,`,
  `            type: 'mcp_tool_call',`,
  `            server: 'browser-use',`,
  `            tool: isParent ? 'navigate' : 'act',`,
  `            arguments: isParent`,
  `              ? { url: 'https://example.com/target' }`,
  `              : { action: step === 1 ? 'start' : step === 2 ? 'fix_cwd' : 'goto', detail: statusTexts[step - 1] },`,
  `            status: 'completed',`,
  `            durationMs: 800 + step * 120,`,
  `            ...(isParent ? {} : { parentExecutionId: 'e2e-codex-browser-nav' }),`,
  `            result: {`,
  `              content: [`,
  `                { type: 'text', text: statusTexts[step - 1] },`,
  `              ],`,
  `            },`,
  `          },`,
  `          createdAt,`,
  `        };`,
  `      }`,
  `      if (sequence === 112) {`,
].join('\n');

if (!t.includes(oldSeq)) {
  console.log('seq anchor missing');
  process.exit(1);
}
t = t.replace(oldSeq, browserBlock);
fs.writeFileSync(f, t);
console.log('mock patched');
