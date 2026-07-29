export interface BirdCoderMiniProgramHostAdapter {
  readonly platform: 'weixin';
}

export interface BirdCoderMiniProgramHostRegistry {
  resolve(): BirdCoderMiniProgramHostAdapter | null;
}

export function createBirdCoderMiniProgramHostRegistry(
  adapter: BirdCoderMiniProgramHostAdapter | null = null,
): BirdCoderMiniProgramHostRegistry {
  return {
    resolve() {
      return adapter;
    },
  };
}
