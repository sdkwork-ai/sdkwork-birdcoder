interface MonacoApi {
  editor: {
    defineTheme(themeId: string, definition: Record<string, unknown>): void;
    setTheme(themeId: string): void;
  };
  languages: Record<string, unknown>;
}

interface MonacoLayoutTarget {
  layout(dimension?: { height: number; width: number }): void;
}

const configuredMonacoApis = new WeakSet<object>();
const definedThemeIds = new Set<string>();

export function configureBirdCoderMonacoTypeScriptDefaults(monaco: MonacoApi): void {
  const monacoObject = monaco as object;
  if (configuredMonacoApis.has(monacoObject)) {
    return;
  }

  configuredMonacoApis.add(monacoObject);

  const ts = (monaco.languages as { typescript?: any }).typescript;
  if (!ts?.typescriptDefaults) {
    return;
  }

  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget?.ESNext || 99,
    allowNonTsExtensions: true,
    moduleResolution: ts.ModuleResolutionKind?.NodeJs || 2,
    module: ts.ModuleKind?.CommonJS || 1,
    noEmit: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit?.React || 2,
    reactNamespace: 'React',
    allowJs: true,
    strict: false,
  });

  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
}

export function applyBirdCoderMonacoTheme(
  monaco: MonacoApi,
  themeId: string,
  definition: Record<string, unknown>,
): void {
  if (!definedThemeIds.has(themeId)) {
    monaco.editor.defineTheme(themeId, definition);
    definedThemeIds.add(themeId);
  }

  monaco.editor.setTheme(themeId);
}

export function observeBirdCoderMonacoLayout(
  container: HTMLElement,
  target: MonacoLayoutTarget,
): () => void {
  let animationFrame = 0;

  const applyLayout = () => {
    animationFrame = 0;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    target.layout({ width, height });
  };

  const scheduleLayout = () => {
    if (typeof window === 'undefined') {
      applyLayout();
      return;
    }

    if (animationFrame !== 0) {
      return;
    }

    animationFrame = window.requestAnimationFrame(applyLayout);
  };

  scheduleLayout();

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      scheduleLayout();
    });
    observer.observe(container);
    return () => {
      if (animationFrame !== 0 && typeof window !== 'undefined') {
        window.cancelAnimationFrame(animationFrame);
      }
      observer.disconnect();
    };
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleLayout, { passive: true });
    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener('resize', scheduleLayout);
    };
  }

  return () => {};
}
