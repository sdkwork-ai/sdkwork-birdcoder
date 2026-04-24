import qrcodeBrowserModule from 'qrcode/lib/browser.js';

const qrcodeCompat = qrcodeBrowserModule?.default ?? qrcodeBrowserModule;

export const create = qrcodeCompat.create;
export const toCanvas = qrcodeCompat.toCanvas;
export const toDataURL = qrcodeCompat.toDataURL;
export const toString = qrcodeCompat.toString;

export default qrcodeCompat;
