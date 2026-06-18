export interface BirdCoderApiRouteCatalogEntry {
  authMode: 'host' | 'user' | 'admin';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  surface: 'app' | 'backend';
  summary: string;
  openApiPath: string;
  operationId: string;
}
