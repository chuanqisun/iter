import { useMemo } from "react";
import { createProvider } from "../providers/factory";
import { listConnections } from "./connections-store";

export function useOptions(connectionId: string | null) {
  const options = useMemo(() => {
    const connection = listConnections().find((connection) => connection.id === connectionId);
    if (!connection) return null;

    const provider = createProvider(connection.type);
    const options = provider.getOptions(connection);
    return options;
  }, [connectionId]);

  return options;
}
