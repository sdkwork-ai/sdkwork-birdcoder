import type { BirdCoderDefaultIdeServices } from '@sdkwork/birdcoder-infrastructure';

let defaultIdeServicesPromise: Promise<BirdCoderDefaultIdeServices> | null = null;

async function loadDefaultIdeServices(): Promise<BirdCoderDefaultIdeServices> {
  defaultIdeServicesPromise ??= import('./defaultIdeServicesLoader.ts').then(
    ({ loadDefaultIdeServicesFromInfrastructure }) =>
      loadDefaultIdeServicesFromInfrastructure(),
  );
  return defaultIdeServicesPromise;
}

function createLazyServiceProxy<Service extends object>(
  resolveService: () => Promise<Service>,
): Service {
  return new Proxy(
    {},
    {
      get(_target, propertyKey) {
        return async (...args: unknown[]) => {
          const service = await resolveService();
          const member = Reflect.get(service as object, propertyKey);
          if (typeof member !== 'function') {
            return member;
          }
          return Reflect.apply(member, service, args);
        };
      },
    },
  ) as Service;
}

export function createLazyDefaultIdeServices(): BirdCoderDefaultIdeServices {
  return {
    adminDeploymentService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).adminDeploymentService,
    ),
    adminPolicyService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).adminPolicyService,
    ),
    authService: createLazyServiceProxy(async () => (await loadDefaultIdeServices()).authService),
    auditService: createLazyServiceProxy(async () => (await loadDefaultIdeServices()).auditService),
    coreReadService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).coreReadService,
    ),
    coreWriteService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).coreWriteService,
    ),
    deploymentService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).deploymentService,
    ),
    documentService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).documentService,
    ),
    fileSystemService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).fileSystemService,
    ),
    projectService: createLazyServiceProxy(async () => (await loadDefaultIdeServices()).projectService),
    releaseService: createLazyServiceProxy(async () => (await loadDefaultIdeServices()).releaseService),
    teamService: createLazyServiceProxy(async () => (await loadDefaultIdeServices()).teamService),
    workspaceService: createLazyServiceProxy(
      async () => (await loadDefaultIdeServices()).workspaceService,
    ),
  };
}
