export interface BirdCoderApiGatewaySurfaceSummary {
  authMode: 'host' | 'user' | 'admin';
  basePath: string;
  description: string;
  name: 'app' | 'backend';
  routeCount: number;
}
