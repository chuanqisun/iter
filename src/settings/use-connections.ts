import { useCallback, useEffect, useState } from "react";
import { connectionsEvents, getConnectionKey, listConnections, type ParsedConnection } from "./connections";

const initialConnections = listConnections();

export function useConnections() {
  const [connections, setConnections] = useState(initialConnections);

  useEffect(() => {
    const onChange = (e: Event) => {
      setConnections((e as CustomEvent<ParsedConnection[]>).detail);
    };

    connectionsEvents.addEventListener("change", onChange);

    return () => connectionsEvents.removeEventListener("change", onChange);
  }, []);

  const getChatEndpoint = useCallback((key: string) => {
    const connection = listConnections().find((connection) => getConnectionKey(connection) === key);
    if (!connection) return null;

    return {
      type: connection.type,
      endpoint: connection.endpoint,
      apiKey: connection.apiKey,
      model: connection.optionName,
    };
  }, []);

  return { connections, getChatEndpoint };
}
