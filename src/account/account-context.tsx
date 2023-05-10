import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { deduplicateByModelName, isChatModel, isSucceeded, listDeployments, smartSort, type ModelDeployment } from "../openai/management";

export interface Connection {
  id: string;
  endpoint: string;
  apiKey: string;
}

export interface RuntimeConnection extends Connection {
  displayName: string;
  models: RuntimeModel[] | undefined;
  errorMessage?: string;
}

export interface RuntimeModel {
  id: string;
  modelId: string;
  displayName: string;
}

export interface AccountContextType {
  connections?: RuntimeConnection[];
  setConnections?: (update: (previousConnections: Connection[]) => Connection[]) => void;
  getChatEndpoint?: (modelId: string) => null | { endpoint: string; apiKey: string };
}

export interface StoredContext {
  connections: Connection[];
}

export const AccountContext = createContext<AccountContextType>({});

const initialValue = JSON.parse(localStorage.getItem("accountContext") ?? "{}");
const validatedInitialValue: StoredContext = validateInitialValue(initialValue) ? initialValue : { connections: [] };

export const AccountContextProvider = (props: { children?: JSX.Element | JSX.Element[] }) => {
  const [storedContext, setStoredContext] = useState<StoredContext>(validatedInitialValue);
  const [runtimeConnections, setRuntimeConnections] = useState<RuntimeConnection[]>([]);

  const setConnections = useCallback((update: (previousConnections: Connection[]) => Connection[]) => {
    setStoredContext((prevStoredContext) => {
      const newConnections = update(prevStoredContext.connections);
      localStorage.setItem("accountContext", JSON.stringify({ connections: newConnections }));
      return { connections: newConnections };
    });
  }, []);

  const getChatEndpoint = useCallback(
    (id: string) => {
      const [connectionId, modelId] = id?.split(":") ?? [];
      if (!connectionId || !modelId) return null;

      const connection = runtimeConnections?.find((connection) => connection.id === connectionId);
      if (!connection) return null;

      const model = connection.models?.find((model) => model.modelId === modelId);
      if (!model) return null;

      const endpoint = `${connection.endpoint}openai/deployments/${modelId}/chat/completions?api-version=2023-03-15-preview`;

      return { endpoint, apiKey: connection.apiKey };
    },
    [runtimeConnections]
  );

  useEffect(() => {
    setRuntimeConnections(
      storedContext.connections.map((connection) => ({ ...connection, displayName: new URL(connection.endpoint).hostname, models: undefined }))
    );
    if (!storedContext.connections?.length) return;

    Promise.all(
      storedContext.connections.map((connection) =>
        listDeployments(connection.apiKey, connection.endpoint)
          .then((deployments) => {
            const validModels = deployments
              .filter(isSucceeded)
              .filter(isChatModel)
              .sort(smartSort)
              .filter(deduplicateByModelName)
              .map(toDisplayModel.bind(null, connection));
            setRuntimeConnections((prev) =>
              prev.map((prevConnection) =>
                prevConnection.id === connection.id
                  ? {
                      ...prevConnection,
                      models: validModels,
                      errorMessage: validModels.length ? undefined : "No chat models found",
                    }
                  : prevConnection
              )
            );
          })
          .catch((e) => {
            setRuntimeConnections((prev) =>
              prev.map((prevConnection) =>
                prevConnection.id === connection.id
                  ? {
                      ...prevConnection,
                      models: [],
                      errorMessage: e.message,
                    }
                  : prevConnection
              )
            );
          })
      )
    );
  }, [storedContext.connections]);

  return <AccountContext.Provider value={{ connections: runtimeConnections, setConnections, getChatEndpoint }}>{props.children}</AccountContext.Provider>;
};

export const useAccountContext = () => useContext(AccountContext);

function validateInitialValue(maybeValid: any): maybeValid is StoredContext {
  return Array.isArray(maybeValid.connections);
}

function toDisplayModel(connection: Connection, deployment: ModelDeployment): RuntimeModel {
  return { id: `${connection.id}:${deployment.id}`, modelId: deployment.id, displayName: deployment.model };
}
