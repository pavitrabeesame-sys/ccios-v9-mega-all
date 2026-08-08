import { AsyncLocalStorage } from "async_hooks";

export interface TenantScope {
  companyId: string;
  userId?: string;
  brandId?: string;
}

const storage = new AsyncLocalStorage<TenantScope>();

export class TenantContext {
  public static runWithScope<T>(scope: TenantScope, fn: () => T): T {
    return storage.run(scope, fn);
  }

  public static getScope(): TenantScope {
    const scope = storage.getStore();
    if (!scope) {
      throw new Error(
        "TENANT_CONTEXT_ERROR: No tenant scope set. Wrap this request in TenantContext.runWithScope()."
      );
    }
    return scope;
  }

  public static tryGetScope(): TenantScope | undefined {
    return storage.getStore();
  }
}
