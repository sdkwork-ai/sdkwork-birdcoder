export interface BirdCoderUpdateCodingSessionRequest {
  title?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  hostMode?: 'web' | 'desktop' | 'server';
}
