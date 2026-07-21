export interface BirdCoderChatMessageResourceOrigin {
  kind: 'file' | 'symbol' | 'resource';
  name?: string;
  path?: string;
  uri?: string;
  clientName?: string;
  lineStart?: number;
  lineEnd?: number;
  columnStart?: number;
  columnEnd?: number;
  excerpt?: string;
}
