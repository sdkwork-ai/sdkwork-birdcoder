export interface QRCodeToDataUrlOptions {
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: string;
  margin?: number;
  width?: number;
}

type QRCodeBrowserModule = {
  toDataURL: (
    text: string,
    options?: QRCodeToDataUrlOptions,
  ) => Promise<string>;
};

let qrcodeBrowserModulePromise: Promise<QRCodeBrowserModule> | null = null;

function loadQrCodeBrowserModule(): Promise<QRCodeBrowserModule> {
  if (!qrcodeBrowserModulePromise) {
    qrcodeBrowserModulePromise = import('qrcode/lib/browser.js') as Promise<QRCodeBrowserModule>;
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

const QRCode = {
  toDataURL,
};

export default QRCode;
