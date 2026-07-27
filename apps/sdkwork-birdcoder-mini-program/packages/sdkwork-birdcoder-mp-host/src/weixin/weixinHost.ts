import type { BirdCoderSessionStoragePort } from '@sdkwork/birdcoder-mp-core';

export interface WeixinMiniProgramApi {
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  navigateTo(options: { url: string }): void;
  showToast(options: { title: string; icon: 'none' | 'success' }): void;
  stopPullDownRefresh(): void;
  login(options: {
    success(result: { code: string }): void;
    fail(error: unknown): void;
  }): void;
}

export interface BirdCoderWeixinHost {
  readonly storage: BirdCoderSessionStoragePort;
  navigateTo(url: string): void;
  notify(message: string): void;
  stopPullDownRefresh(): void;
  requestLoginCode(): Promise<string>;
}

export function createBirdCoderWeixinHost(api: WeixinMiniProgramApi): BirdCoderWeixinHost {
  return {
    storage: {
      remove(key) {
        api.removeStorageSync(key);
      },
    },
    navigateTo(url) {
      api.navigateTo({ url });
    },
    notify(message) {
      api.showToast({ title: message, icon: 'none' });
    },
    stopPullDownRefresh() {
      api.stopPullDownRefresh();
    },
    requestLoginCode() {
      return new Promise((resolve, reject) => {
        api.login({
          success(result) {
            if (!result.code) {
              reject(new Error('WeChat login did not return a code.'));
              return;
            }
            resolve(result.code);
          },
          fail(error) {
            reject(error);
          },
        });
      });
    },
  };
}

export function resolveWeixinMiniProgramApi(): WeixinMiniProgramApi {
  const api = (globalThis as typeof globalThis & { wx?: WeixinMiniProgramApi }).wx;
  if (!api) {
    throw new Error('WeChat Mini Program API is unavailable.');
  }
  return api;
}
