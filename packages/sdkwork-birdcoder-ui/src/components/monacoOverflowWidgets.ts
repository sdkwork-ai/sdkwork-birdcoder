export const MONACO_OVERFLOW_WIDGETS_HOST_ID = 'sdkwork-birdcoder-monaco-overflow-widgets';
const MONACO_OVERFLOW_WIDGETS_STYLE_ID = 'sdkwork-birdcoder-monaco-overflow-widgets-style';
const MONACO_OVERFLOW_WIDGETS_Z_INDEX = '2147483647';

function ensureMonacoOverflowWidgetsStyle(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(MONACO_OVERFLOW_WIDGETS_STYLE_ID)) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = MONACO_OVERFLOW_WIDGETS_STYLE_ID;
  styleElement.textContent = `
    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} {
      position: fixed;
      top: 0;
      left: 0;
      z-index: ${MONACO_OVERFLOW_WIDGETS_Z_INDEX};
      isolation: isolate;
    }

    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} .monaco-menu-container,
    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} .context-view,
    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} .editor-widget,
    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} .suggest-widget,
    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} .monaco-hover,
    #${MONACO_OVERFLOW_WIDGETS_HOST_ID} .parameter-hints-widget,
    .monaco-menu-container,
    .context-view,
    .monaco-editor .suggest-widget,
    .monaco-editor .monaco-hover,
    .monaco-editor .parameter-hints-widget {
      z-index: ${MONACO_OVERFLOW_WIDGETS_Z_INDEX} !important;
    }
  `;
  document.head.appendChild(styleElement);
}

export function resolveMonacoOverflowWidgetsDomNode(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  ensureMonacoOverflowWidgetsStyle();

  let overflowWidgetsDomNode = document.getElementById(MONACO_OVERFLOW_WIDGETS_HOST_ID);
  if (overflowWidgetsDomNode) {
    return overflowWidgetsDomNode;
  }

  overflowWidgetsDomNode = document.createElement('div');
  overflowWidgetsDomNode.id = MONACO_OVERFLOW_WIDGETS_HOST_ID;
  overflowWidgetsDomNode.style.position = 'fixed';
  overflowWidgetsDomNode.style.top = '0';
  overflowWidgetsDomNode.style.left = '0';
  overflowWidgetsDomNode.style.zIndex = MONACO_OVERFLOW_WIDGETS_Z_INDEX;
  overflowWidgetsDomNode.style.isolation = 'isolate';
  document.body.appendChild(overflowWidgetsDomNode);
  return overflowWidgetsDomNode;
}
