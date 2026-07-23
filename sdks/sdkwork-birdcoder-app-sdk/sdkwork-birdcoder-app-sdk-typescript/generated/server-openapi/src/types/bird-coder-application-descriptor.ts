import type { BirdCoderApiGatewaySummary } from './bird-coder-api-gateway-summary';

export interface BirdCoderApplicationDescriptor {
  apiVersion: string;
  gateway: BirdCoderApiGatewaySummary;
  hostMode: 'web' | 'desktop' | 'server';
  moduleId: 'sdkwork-birdcoder';
  openApiPath: string;
  surfaces: ('app' | 'backend')[];
}
