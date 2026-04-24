import type {
  BirdCoderDefaultIdeServiceKey,
  BirdCoderDefaultIdeServices,
} from '@sdkwork/birdcoder-infrastructure-runtime';

const defaultIdeServicePromiseByKey = new Map<
  BirdCoderDefaultIdeServiceKey,
  Promise<BirdCoderDefaultIdeServices[BirdCoderDefaultIdeServiceKey]>
>();

type LazyServiceSyncMethodBridge<Service extends object> = (
  resolveService: () => Promise<Service>,
  propertyKey: keyof Service | string,
  args: unknown[],
) => unknown;

interface LazyServiceProxyOptions<Service extends object> {
  syncMethodBridges?: Record<string, LazyServiceSyncMethodBridge<Service>>;
}

function isVoidCleanup(value: unknown): value is () => void {
  return typeof value === 'function';
}

async function loadDefaultIdeService<K extends BirdCoderDefaultIdeServiceKey>(
  serviceKey: K,
): Promise<BirdCoderDefaultIdeServices[K]> {
  const cachedPromise = defaultIdeServicePromiseByKey.get(serviceKey) as
    | Promise<BirdCoderDefaultIdeServices[K]>
    | undefined;
  if (cachedPromise) {
    return cachedPromise;
  }

  const servicePromise = import('./defaultIdeServicesLoader.ts').then(
    ({ loadDefaultIdeServiceFromInfrastructure }) =>
      loadDefaultIdeServiceFromInfrastructure(serviceKey),
  ) as Promise<BirdCoderDefaultIdeServices[K]>;

  defaultIdeServicePromiseByKey.set(
    serviceKey,
    servicePromise as Promise<BirdCoderDefaultIdeServices[BirdCoderDefaultIdeServiceKey]>,
  );
  return servicePromise;
}

function createDeferredCleanupSubscriptionBridge<Service extends object>(
  resolveService: () => Promise<Service>,
  propertyKey: keyof Service | string,
  args: unknown[],
): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  void resolveService()
    .then((service) => {
      const member = Reflect.get(service as object, propertyKey);
      if (typeof member !== 'function') {
        console.warn(`Lazy service member "${String(propertyKey)}" is not callable.`);
        return undefined;
      }

      return Reflect.apply(member, service, args);
    })
    .then((cleanupCandidate) => {
      if (!isVoidCleanup(cleanupCandidate)) {
        if (cleanupCandidate !== undefined) {
          console.warn(
            `Lazy sync service method "${String(propertyKey)}" did not resolve to a cleanup function.`,
          );
        }
        return;
      }

      if (disposed) {
        cleanupCandidate();
        return;
      }

      cleanup = cleanupCandidate;
    })
    .catch((error) => {
      console.error(`Failed to resolve lazy service method "${String(propertyKey)}"`, error);
    });

  return () => {
    disposed = true;
    if (!cleanup) {
      return;
    }

    const release = cleanup;
    cleanup = null;
    release();
  };
}

function createLazyServiceProxy<Service extends object>(
  resolveService: () => Promise<Service>,
  options?: LazyServiceProxyOptions<Service>,
): Service {
  return new Proxy(
    {},
    {
      get(_target, propertyKey) {
        const syncMethodBridge = options?.syncMethodBridges?.[String(propertyKey)];
        if (syncMethodBridge) {
          return (...args: unknown[]) =>
            syncMethodBridge(resolveService, propertyKey as keyof Service | string, args);
        }

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
      async () => loadDefaultIdeService('adminDeploymentService'),
    ),
    adminPolicyService: createLazyServiceProxy(
      async () => loadDefaultIdeService('adminPolicyService'),
    ),
    authService: createLazyServiceProxy(async () => loadDefaultIdeService('authService')),
    auditService: createLazyServiceProxy(async () => loadDefaultIdeService('auditService')),
    catalogService: createLazyServiceProxy(
      async () => loadDefaultIdeService('catalogService'),
    ),
    collaborationService: createLazyServiceProxy(
      async () => loadDefaultIdeService('collaborationService'),
    ),
    coreReadService: createLazyServiceProxy(
      async () => loadDefaultIdeService('coreReadService'),
    ),
    coreWriteService: createLazyServiceProxy(
      async () => loadDefaultIdeService('coreWriteService'),
    ),
    deploymentService: createLazyServiceProxy(
      async () => loadDefaultIdeService('deploymentService'),
    ),
    documentService: createLazyServiceProxy(
      async () => loadDefaultIdeService('documentService'),
    ),
    fileSystemService: createLazyServiceProxy(
      async () => loadDefaultIdeService('fileSystemService'),
      {
        syncMethodBridges: {
          subscribeToFileChanges: createDeferredCleanupSubscriptionBridge,
        },
      },
    ),
    gitService: createLazyServiceProxy(async () => loadDefaultIdeService('gitService')),
    promptService: createLazyServiceProxy(
      async () => loadDefaultIdeService('promptService'),
    ),
    projectService: createLazyServiceProxy(async () => loadDefaultIdeService('projectService')),
    releaseService: createLazyServiceProxy(async () => loadDefaultIdeService('releaseService')),
    teamService: createLazyServiceProxy(async () => loadDefaultIdeService('teamService')),
    workspaceService: createLazyServiceProxy(
      async () => loadDefaultIdeService('workspaceService'),
    ),
  };
}
