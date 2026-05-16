import type { ComponentType } from "react";

export interface SdkworkVipMessagesOverrides {
  page?: {
    description?: string;
    title?: string;
  };
}

export interface SdkworkVipPack {
  description?: string;
  durationDays?: number;
  id?: string;
  includedPoints?: number;
  levelName?: string;
  name: string;
  originalPriceCny?: number;
  packId?: string;
  points?: number;
  priceCny?: number;
  recommended?: boolean;
  tags?: readonly string[];
}

export interface SdkworkVipDashboardPlan {
  description?: string;
  durationDays?: number;
  includedPoints?: number;
  levelName?: string;
  name: string;
  originalPriceCny?: number;
  packId: string;
  priceCny?: number;
  recommended?: boolean;
  tags?: readonly string[];
}

export interface SdkworkVipDashboard {
  plans: readonly SdkworkVipDashboardPlan[];
}

export interface SdkworkVipService {
  getEmptyDashboard(): SdkworkVipDashboard;
  getOverview?(): Promise<unknown>;
}

export interface SdkworkVipController {
  readonly service: SdkworkVipService;
}

export interface SdkworkVipClient {
  vip?: {
    listVipBenefits?(): Promise<unknown>;
    listVipLevels?(): Promise<unknown>;
    renew?(payload: Record<string, unknown>): Promise<unknown>;
    upgrade?(payload: Record<string, unknown>): Promise<unknown>;
  };
}

export interface CreateSdkworkVipServiceOptions {
  getClient?(): SdkworkVipClient;
  getSessionTokens?(): {
    authToken?: string;
  };
  walletService?: {
    getOverview(): Promise<unknown>;
  };
}

export interface CreateSdkworkVipControllerOptions {
  locale?: string | null;
  messages?: SdkworkVipMessagesOverrides;
  service: SdkworkVipService;
}

export interface SdkworkVipPageProps {
  controller: SdkworkVipController;
  locale?: string;
  messages?: SdkworkVipMessagesOverrides;
}

export declare const SdkworkVipPage: ComponentType<SdkworkVipPageProps>;

export declare function createSdkworkVipController(
  options: CreateSdkworkVipControllerOptions,
): SdkworkVipController;

export declare function createSdkworkVipService(
  options?: CreateSdkworkVipServiceOptions,
): SdkworkVipService;
