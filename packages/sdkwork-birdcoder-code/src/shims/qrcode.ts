export interface QRCodeToDataUrlOptions {
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: string;
  margin?: number;
  width?: number;
}

export interface QRCodeToSvgStringOptions extends QRCodeToDataUrlOptions {
  type?: 'svg';
}

type QRCodeBrowserModule = {
  toDataURL: (
    text: string,
    options?: QRCodeToDataUrlOptions,
  ) => Promise<string>;
  toString: (
    text: string,
    options?: QRCodeToSvgStringOptions,
  ) => Promise<string>;
};

type QRCodeBrowserModuleNamespace = QRCodeBrowserModule & {
  default?: QRCodeBrowserModule;
};

let qrcodeBrowserModulePromise: Promise<QRCodeBrowserModule> | null = null;

function loadQrCodeBrowserModule(): Promise<QRCodeBrowserModule> {
  if (!qrcodeBrowserModulePromise) {
    qrcodeBrowserModulePromise = import('qrcode/lib/browser.js').then((module) => {
      const resolvedModule = (module as QRCodeBrowserModuleNamespace).default ?? module;
      return resolvedModule as QRCodeBrowserModule;
    });
  }

  return qrcodeBrowserModulePromise;
}

export async function toDataURL(
  text: string,
  options?: QRCodeToDataUrlOptions,
): Promise<string> {
  const module = await loadQrCodeBrowserModule();
  return module.toDataURL(text, options);
}

export async function toSvgDataURL(
  text: string,
  options?: QRCodeToSvgStringOptions,
): Promise<string> {
  const module = await loadQrCodeBrowserModule();
  const svgMarkup = await module.toString(text, {
    ...options,
    type: 'svg',
  });

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
}

const QRCode = {
  toDataURL,
  toSvgDataURL,
};

export default QRCode;
