import { useCallback, useEffect, useState } from "react";
import { connectionsEvents, listConnections } from "./connections-store";
import type { BaseConnection } from "./providers/base";
import { createProvider } from "./providers/factory";

const initialConnections = listConnections();

export function useConnections() {
  const [connections, setConnections] = useState(initialConnections);

  useEffect(() => {
    const onChange = (e: Event) => {
      setConnections((e as CustomEvent<BaseConnection[]>).detail);
    };

    connectionsEvents.addEventListener("change", onChange);

    return () => connectionsEvents.removeEventListener("change", onChange);
  }, []);

  const getChatStreamProxy = useCallback((id: string) => {
    const connection = listConnections().find((connection) => connection.id === id);
    if (!connection) return null;

    const provider = createProvider(connection.type);
    const proxy = provider.getChatStreamProxy(connection);
    return proxy;
  }, []);

  return { connections, getChatStreamProxy };
}
