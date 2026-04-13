declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  import type { ComponentType } from 'react';

  type PrismLightSyntaxHighlighter = ComponentType<any> & {
    registerLanguage: (name: string, language: unknown) => void;
  };

  const SyntaxHighlighter: PrismLightSyntaxHighlighter;
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/*' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const vscDarkPlus: Record<string, unknown>;
}

export {};
