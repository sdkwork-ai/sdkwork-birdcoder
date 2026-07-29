export interface BirdCoderMiniProgramModule {
  readonly id: string;
}

export interface BirdCoderMiniProgramModuleRegistry {
  list(): readonly BirdCoderMiniProgramModule[];
  resolve(moduleId: string): BirdCoderMiniProgramModule | null;
}

export function createBirdCoderMiniProgramModuleRegistry(
  modules: readonly BirdCoderMiniProgramModule[] = [],
): BirdCoderMiniProgramModuleRegistry {
  const modulesById = new Map<string, BirdCoderMiniProgramModule>();
  for (const module of modules) {
    const id = module.id.trim();
    if (!id || modulesById.has(id)) {
      throw new Error('Mini program module identifiers must be unique and non-empty.');
    }
    modulesById.set(id, { ...module, id });
  }
  const entries = [...modulesById.values()];

  return {
    list() {
      return entries;
    },
    resolve(moduleId) {
      return modulesById.get(moduleId.trim()) ?? null;
    },
  };
}
