export type BirdCoderMonacoWorkerKind =
  | 'css'
  | 'editor'
  | 'html'
  | 'json'
  | 'typescript';

export function resolveBirdCoderMonacoWorkerKind(label: string): BirdCoderMonacoWorkerKind {
  switch (label.trim().toLowerCase()) {
    case 'json':
      return 'json';
    case 'css':
    case 'less':
    case 'scss':
      return 'css';
    case 'handlebars':
    case 'html':
    case 'razor':
      return 'html';
    case 'javascript':
    case 'typescript':
      return 'typescript';
    default:
      return 'editor';
  }
}
