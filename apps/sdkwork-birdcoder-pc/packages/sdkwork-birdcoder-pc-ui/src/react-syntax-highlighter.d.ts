declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  import type * as React from 'react';

  export interface SyntaxHighlighterStyleMap {
    [selector: string]: React.CSSProperties;
  }

  export interface SyntaxHighlighterProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.ReactNode;
    CodeTag?: keyof React.JSX.IntrinsicElements | React.ComponentType<unknown>;
    customStyle?: React.CSSProperties;
    language?: string;
    PreTag?: keyof React.JSX.IntrinsicElements | React.ComponentType<unknown>;
    style?: SyntaxHighlighterStyleMap | React.CSSProperties;
  }

  export interface SyntaxHighlighterComponent extends React.FC<SyntaxHighlighterProps> {
    registerLanguage(name: string, language: unknown): void;
  }

  const SyntaxHighlighter: SyntaxHighlighterComponent;
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/bash' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/css' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/diff' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/javascript' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/json' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/jsx' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/markdown' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/markup' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/python' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/rust' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/sql' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/toml' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/tsx' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/typescript' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/yaml' {
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  import type * as React from 'react';

  export interface SyntaxHighlighterStyleMap {
    [selector: string]: React.CSSProperties;
  }

  export const vscDarkPlus: SyntaxHighlighterStyleMap;
}
