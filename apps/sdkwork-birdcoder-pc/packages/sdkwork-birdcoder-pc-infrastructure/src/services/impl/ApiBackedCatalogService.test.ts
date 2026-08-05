import { describe, expect, it, vi } from 'vitest';
import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { McpAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/mcp-app';
import type { SdkworkSkillsAppClient } from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import { ApiBackedCatalogService } from './ApiBackedCatalogService.ts';

function createService({
  agentList = vi.fn(),
  connectorList = vi.fn(),
  skillList = vi.fn(),
} = {}) {
  return {
    agentList,
    connectorList,
    service: new ApiBackedCatalogService({
      agentsClient: { ai: { agents: { list: agentList } } } as unknown as AgentsAppSdkClient,
      mcpClient: { mcp: { listServers: connectorList } } as unknown as McpAppSdkClient,
      skillsClient: { skills: { marketplace: { list: skillList } } } as unknown as SdkworkSkillsAppClient,
      localPluginRuntime: { discover: vi.fn() },
    }),
    skillList,
  };
}

describe('ApiBackedCatalogService work resources', () => {
  it('passes bounded server pagination and expert scope to sdkwork-agents', async () => {
    const page = { items: [], pageInfo: { mode: 'offset' as const, page: 1, pageSize: 50 } };
    const agentList = vi.fn().mockResolvedValue(page);
    const { service } = createService({ agentList });

    await expect(service.listAgents({
      page: -3,
      pageSize: 500,
      query: '  legal  ',
      scope: 'mine',
    })).resolves.toEqual(page);

    expect(agentList).toHaveBeenCalledWith(
      { page: 1, pageSize: 50, q: 'legal', scope: 'mine' },
      undefined,
    );
  });

  it('preserves the canonical skills page from sdkwork-skills', async () => {
    const page = { items: [], pageInfo: { mode: 'cursor' as const, hasMore: false } };
    const skillList = vi.fn().mockResolvedValue(page);
    const { service } = createService({ skillList });

    await expect(service.listSkills({ page: 2, pageSize: 24 })).resolves.toEqual({
      items: [],
      pageInfo: {
        mode: 'cursor',
        page: 2,
        pageSize: 24,
        hasMore: false,
      },
    });
    expect(skillList).toHaveBeenCalledWith(
      { page: 2, pageSize: 24, q: undefined },
      undefined,
    );
  });

  it('narrows the generated MCP record page at the adapter boundary', async () => {
    const connector = {
      id: '1',
      uuid: 'connector-1',
      server_key: 'github',
      name: 'GitHub',
      transport: 'streamable-http',
      visibility: 'public',
      data_scope: 'tenant',
      health_status: 'healthy',
      lifecycle_status: 'active',
    };
    const connectorList = vi.fn().mockResolvedValue({
      items: [connector],
      pageInfo: { mode: 'offset', page: 3, pageSize: 24, hasMore: true },
    });
    const { service } = createService({ connectorList });

    await expect(service.listConnectors({ page: 3, pageSize: 24 })).resolves.toEqual({
      items: [connector],
      pageInfo: { mode: 'offset', page: 3, pageSize: 24, hasMore: true },
    });
  });

  it('rejects malformed MCP page records instead of leaking untyped data', async () => {
    const connectorList = vi.fn().mockResolvedValue({
      items: [{ id: 'missing-required-fields' }],
      pageInfo: { mode: 'offset' },
    });
    const { service } = createService({ connectorList });

    await expect(service.listConnectors()).rejects.toThrow('invalid server record');
  });

  it('rejects malformed expert pages before they reach the resource UI', async () => {
    const agentList = vi.fn().mockResolvedValue({ data: {} });
    const { service } = createService({ agentList });

    await expect(service.listAgents({ scope: 'market' })).rejects.toThrow(
      'Agent catalog returned an invalid page payload',
    );
  });
});
