import { useCallback, useRef, useState } from "react";
import { getJson, setJson } from "./local-storage";

export interface UseLocalStorageProps<T = any> {
  key: string;
  getInitialValue: () => T;
}

export function useLocalStorage<T = any>(props: UseLocalStorageProps<T>) {
  const initialConfig = useRef(getJson(props.key) ?? props.getInitialValue());
  const [value, setConfig] = useState<T>(initialConfig.current);

  const update = useCallback((valueOrLambda: T | ((value: T) => T)) => {
    try {
      if (isLambda(valueOrLambda)) {
        setConfig((prev) => {
          const newValue = valueOrLambda(prev);
          setJson(props.key, newValue);
          return newValue;
        });
      } else {
        setJson(props.key, value);
        setConfig(value);
      }
    } catch {}
  }, []);

  const reset = useCallback(() => {
    try {
      const config = props.getInitialValue();
      setJson(props.key, config);
      setConfig(config);
    } catch {}
  }, []);

  return {
    value,
    update,
    reset,
  };
}

function isLambda<T>(value: T | ((value: T) => T)): value is (value: T) => T {
  return typeof value === "function";
}
