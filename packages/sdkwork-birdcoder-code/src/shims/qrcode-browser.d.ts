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

  export interface QRCodeToSvgStringOptions extends QRCodeToDataUrlOptions {
    type?: 'svg';
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataUrlOptions,
  ): Promise<string>;

  export function toString(
    text: string,
    options?: QRCodeToSvgStringOptions,
  ): Promise<string>;
}
