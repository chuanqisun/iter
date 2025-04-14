import { useCallback, useState } from "react";

export interface RouteParameterOptions<T> {
  name: string;
  initial: T;
  encode: (value: T) => string;
  decode: (value: string) => T;
}
export function useRouteParameter<T>(options: RouteParameterOptions<T>) {
  const [value, setValue] = useState<T>(
    new URLSearchParams(window.location.search).get(options.name)
      ? options.decode(new URLSearchParams(window.location.search).get(options.name) as string)
      : options.initial,
  );

  const push = useCallback((value: T) => {
    const url = new URL(window.location.href);
    url.searchParams.set(options.name, options.encode(value));
    window.history.pushState(null, "", url.toString());
    setValue(value);
  }, []);

  const replace = useCallback((value: T) => {
    const url = new URL(window.location.href);
    url.searchParams.set(options.name, options.encode(value));
    window.history.replaceState(null, "", url.toString());
    setValue(value);
  }, []);

  return {
    value,
    push,
    replace,
  };
}
