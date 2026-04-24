declare module 'qrcode/lib/browser.js' {
  export interface QRCodeToDataUrlOptions {
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: string;
    margin?: number;
    width?: number;
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataUrlOptions,
  ): Promise<string>;
}
