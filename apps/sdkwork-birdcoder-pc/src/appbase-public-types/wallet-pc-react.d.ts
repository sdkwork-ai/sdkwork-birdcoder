export interface SdkworkWalletVipPack {
  description?: string;
  durationDays?: number;
  id: string;
  levelName?: string;
  name: string;
  points?: number;
  priceCny?: number;
}

export interface SdkworkWalletService {
  getOverview(): Promise<unknown>;
}

export declare function createSdkworkWalletService(options?: {
  client?: unknown;
}): SdkworkWalletService;

export declare function formatSdkworkCurrencyCny(value: number): string;
