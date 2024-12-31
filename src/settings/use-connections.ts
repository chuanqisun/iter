import { useCallback, useEffect, useState } from "react";
import { connectionsEvents, listConnections, type Connection } from "./connections";

const initialConnections = listConnections();

export function useConnections() {
  const [connections, setConnections] = useState(initialConnections);

  useEffect(() => {
    const onChange = (e: Event) => {
      setConnections((e as CustomEvent<Connection[]>).detail);
    };

    connectionsEvents.addEventListener("change", onChange);

    return () => connectionsEvents.removeEventListener("change", onChange);
  }, []);

  const getChatEndpoint = useCallback((id: string) => {
    const connection = listConnections().find((connection) => connection.id === id);
    if (!connection) return null;

    switch (connection.type) {
      case "openai":
        return {
          type: connection.type,
          endpoint: `https://api.openai.com/v1/chat/completions`,
          apiKey: connection.apiKey,
          model: connection.model,
        };

      case "aoai":
        return {
          type: connection.type,
          endpoint: `${connection.endpoint}openai/deployments/${connection.deployment}/chat/completions?api-version=${connection.apiVersion}`,
          apiKey: connection.apiKey,
          model: connection.deployment,
        };

      default:
        return null;
    }
  }, []);

  return { connections, getChatEndpoint };
}
