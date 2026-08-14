import { useCallback, useMemo, useState } from "react";

export interface RouteParameterOptions<T> {
  name: string;
  initial: T;
  encode: (value: T) => string;
  decode: (value: string) => T;
}

export interface RouteParameter<T> {
  value: T;
  push: (value: T) => void;
  replace: (value: T) => void;
}

export function useRouteParameter<T>(options: RouteParameterOptions<T>): RouteParameter<T> {
  const [value, setValue] = useState<T>(() => {
    const raw = new URLSearchParams(window.location.search).get(options.name);
    return raw !== null ? options.decode(raw) : options.initial;
  });

  const push = useCallback(
    (value: T) => {
      const url = new URL(window.location.href);
      if (value === undefined || value === null) {
        url.searchParams.delete(options.name);
      } else {
        url.searchParams.set(options.name, options.encode(value));
      }
      window.history.pushState(null, "", url.toString());
      setValue(value);
    },
    [options.name, options.encode],
  );

  const replace = useCallback(
    (value: T) => {
      const url = new URL(window.location.href);
      if (value === undefined || value === null) {
        url.searchParams.delete(options.name);
      } else {
        url.searchParams.set(options.name, options.encode(value));
      }
      window.history.replaceState(null, "", url.toString());
      setValue(value);
    },
    [options.name, options.encode],
  );

  const param = useMemo(
    () => ({
      value,
      push,
      replace,
    }),
    [value, push, replace],
  );

  return param;
}
