import type {
  BirdCoderDefaultIdeServiceKey,
  BirdCoderDefaultIdeServices,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

const APP_IDE_SERVICE_KEYS = [
  'agentSessionService',
  'authService',
  'catalogService',
  'documentService',
  'fileSystemService',
  'projectRuntimeLocationService',
  'gitService',
  'promptService',
  'projectService',
  'vipMembershipService',
] as const satisfies readonly BirdCoderDefaultIdeServiceKey[];

type AppIdeServiceKey = (typeof APP_IDE_SERVICE_KEYS)[number];
export type AppIdeServices = Pick<BirdCoderDefaultIdeServices, AppIdeServiceKey>;

const defaultIdeServicePromiseByKey = new Map<
  AppIdeServiceKey,
  Promise<AppIdeServices[AppIdeServiceKey]>
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

async function loadDefaultIdeService<K extends AppIdeServiceKey>(
  serviceKey: K,
): Promise<AppIdeServices[K]> {
  const cachedPromise = defaultIdeServicePromiseByKey.get(serviceKey) as
    | Promise<AppIdeServices[K]>
    | undefined;
  if (cachedPromise) {
    return cachedPromise;
  }

  const servicePromise = import('./defaultIdeServicesLoader.ts').then(
    ({ loadDefaultIdeServiceFromInfrastructure }) =>
      loadDefaultIdeServiceFromInfrastructure(serviceKey),
  ) as Promise<AppIdeServices[K]>;

  defaultIdeServicePromiseByKey.set(serviceKey, servicePromise);
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

export function createLazyDefaultIdeServices(): AppIdeServices {
  return {
    agentSessionService: createLazyServiceProxy(
      async () => loadDefaultIdeService('agentSessionService'),
    ),
    authService: createLazyServiceProxy(async () => loadDefaultIdeService('authService')),
    catalogService: createLazyServiceProxy(async () => loadDefaultIdeService('catalogService')),
    documentService: createLazyServiceProxy(async () => loadDefaultIdeService('documentService')),
    fileSystemService: createLazyServiceProxy(
      async () => loadDefaultIdeService('fileSystemService'),
      {
        syncMethodBridges: {
          subscribeToFileChanges: createDeferredCleanupSubscriptionBridge,
        },
      },
    ),
    projectRuntimeLocationService: createLazyServiceProxy(
      async () => loadDefaultIdeService('projectRuntimeLocationService'),
    ),
    gitService: createLazyServiceProxy(async () => loadDefaultIdeService('gitService')),
    promptService: createLazyServiceProxy(async () => loadDefaultIdeService('promptService')),
    projectService: createLazyServiceProxy(async () => loadDefaultIdeService('projectService')),
    vipMembershipService: createLazyServiceProxy(
      async () => loadDefaultIdeService('vipMembershipService'),
    ),
  };
}
