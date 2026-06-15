import type { BirdCoderApiGatewaySummary } from './bird-coder-api-gateway-summary';

export interface BirdCoderCodingServerDescriptor {
  apiVersion: string;
  gateway: BirdCoderApiGatewaySummary;
  hostMode: 'web' | 'desktop' | 'server';
  moduleId: 'coding-server';
  openApiPath: string;
  surfaces: ('app' | 'backend')[];
}
