import { useCallback, useEffect } from "react";
import { getJson, setJson } from "../storage/local-storage";

export interface UseRouteCacheOptions {
  parameters: string[];
}
export function useRouteCache(options: UseRouteCacheOptions) {
  const cacheCurrentParams = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const searchParamsObject: Record<string, string> = {};
    for (const key of searchParams.keys()) {
      if (!options.parameters.includes(key)) continue;
      searchParamsObject[key] = searchParams.get(key) ?? "";
    }
    setJson("last-search-params", searchParamsObject);
  }, [options.parameters]);

  useEffect(() => {
    const cachedParams = getJson<Record<string, string>>("last-search-params") ?? {};
    const allowedParams = Object.fromEntries(Object.entries(cachedParams).filter(([key]) => options.parameters.includes(key)));
    const cachedKeys = new Set(Object.keys(allowedParams));
    if (cachedKeys.size === 0) return;

    const initialSearchParams = new URLSearchParams(window.location.search);
    const initialKeys = new Set(initialSearchParams.keys());

    const isSafeToRestoreCache = initialKeys.isDisjointFrom(cachedKeys);
    if (isSafeToRestoreCache) {
      console.log(`[url route cache] will restore`, { cachedKeys, initialKeys });
      const newSearchParams = new URLSearchParams(window.location.search);
      for (const key of cachedKeys) {
        newSearchParams.set(key, allowedParams[key]);
      }

      location.replace(`${location.pathname}?${newSearchParams.toString()}`);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", cacheCurrentParams);
    return () => window.removeEventListener("beforeunload", cacheCurrentParams);
  }, []);
}
