import { resolveAgentSessionItemToolCallResultBlocks, resolveAgentSessionItemToolCallOutput } from './apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-results';

const realMcpResult = {
  type: 'mcp_tool_call', id: 'mcp2', server: 'docs', tool: 'search', status: 'completed',
  arguments: { query: 'codex' }, appContext: null, pluginId: null, readOnlyHint: false,
  result: { content: [{ type: 'text', text: 'Found 3 docs about codex' }], structuredContent: { matches: 3 }, _meta: null },
  error: null, durationMs: 42,
};
const blocks = resolveAgentSessionItemToolCallResultBlocks(realMcpResult as never, 'success');
console.log('BLOCKS:', JSON.stringify(blocks, null, 1));
console.log('OUTPUT:', JSON.stringify(resolveAgentSessionItemToolCallOutput(realMcpResult as never).slice(0, 200)));

const realMcpError = {
  type: 'mcp_tool_call', id: 'mcp3', server: 'docs', tool: 'search', status: 'failed',
  arguments: {}, appContext: null, pluginId: null, readOnlyHint: false,
  result: null, error: { message: 'MCP server unavailable' }, durationMs: 5,
};
const blocks2 = resolveAgentSessionItemToolCallResultBlocks(realMcpError as never, 'error');
console.log('ERROR BLOCKS:', JSON.stringify(blocks2, null, 1));
console.log('ERROR OUTPUT:', JSON.stringify(resolveAgentSessionItemToolCallOutput(realMcpError as never).slice(0, 120)));
