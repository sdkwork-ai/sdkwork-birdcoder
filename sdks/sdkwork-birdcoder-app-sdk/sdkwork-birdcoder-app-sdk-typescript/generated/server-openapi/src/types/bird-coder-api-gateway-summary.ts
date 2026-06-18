import type { BirdCoderApiGatewaySurfaceSummary } from './bird-coder-api-gateway-surface-summary';

export interface BirdCoderApiGatewaySummary {
  docsPath: string;
  liveOpenApiPath: string;
  openApiPath: string;
  routeCatalogPath: string;
  routeCount: number;
  routesBySurface: Record<string, unknown>;
  surfaces: BirdCoderApiGatewaySurfaceSummary[];
}
