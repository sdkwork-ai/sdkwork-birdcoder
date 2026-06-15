export interface BirdCoderCommerceMembershipPackageSummary {
  id: string;
  name: string;
  description?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  price: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  originalPrice?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  pointAmount: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  durationDays: string;
  planName?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  sortWeight: string;
  recommended: boolean;
  tags: string[];
}
