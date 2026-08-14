import { useEffect, useRef } from "react";
import {
  MODEL_PARAM_KEYS,
  type BaseConnection,
  type ChatParamKey,
  type ModelParams,
  type VerifyAllChatParametersKeysCovered,
} from "../providers/base";
import { createProvider } from "../providers/factory";
import { sanitizeParamsFromOptions } from "../providers/shared";
import type { RouteParameter } from "../router/use-route-parameter";
import { getStoredModelParams, setStoredModelParams } from "../storage/model-parameter-store";

export type ModelParameterRouteParams = {
  connectionKey: RouteParameter<string | null>;
} & {
  [K in keyof ModelParams]-?: RouteParameter<ModelParams[K] | undefined>;
};

export { MODEL_PARAM_KEYS as CHAT_PARAM_KEYS, type ChatParamKey, type VerifyAllChatParametersKeysCovered };

export function extractChatParams(routeParams: ModelParameterRouteParams): ModelParams {
  const result: ModelParams = {};
  for (const key of MODEL_PARAM_KEYS) {
    result[key] = routeParams[key].value as any;
  }
  return result;
}

export function applyChatParams(routeParams: ModelParameterRouteParams, next: ModelParams) {
  for (const key of MODEL_PARAM_KEYS) {
    if (next[key] !== routeParams[key].value) {
      (routeParams[key] as RouteParameter<any>).replace(next[key]);
    }
  }
}

export function useModelParameterSync(connections: BaseConnection[], routeParams: ModelParameterRouteParams) {
  const prevConnectionIdRef = useRef<string | null>(null);
  const activeConnectionIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  const currentConnectionId = routeParams.connectionKey.value;
  activeConnectionIdRef.current = currentConnectionId;

  useEffect(() => {
    if (!currentConnectionId || !connections || connections.length === 0) return;

    const targetConnectionId = currentConnectionId;
    let canceled = false;
    isSyncingRef.current = true;

    async function syncOnModelChange() {
      try {
        const prevId = prevConnectionIdRef.current;
        const currentParams = extractChatParams(routeParams);

        if (prevId && prevId !== targetConnectionId) {
          await setStoredModelParams(prevId, currentParams);
        }

        if (canceled || activeConnectionIdRef.current !== targetConnectionId) return;
        prevConnectionIdRef.current = targetConnectionId;

        const stored = await getStoredModelParams(targetConnectionId);

        if (canceled || activeConnectionIdRef.current !== targetConnectionId) return;

        const conn = connections.find((c) => c.id === targetConnectionId);
        if (!conn) return;

        const provider = createProvider(conn.type);
        const candidateParams = stored ?? currentParams;
        const options = provider.getOptions(conn);
        const sanitized = sanitizeParamsFromOptions(options, candidateParams);

        applyChatParams(routeParams, sanitized);
        await setStoredModelParams(targetConnectionId, sanitized);
      } finally {
        if (activeConnectionIdRef.current === targetConnectionId) {
          isSyncingRef.current = false;
        }
      }
    }

    syncOnModelChange();

    return () => {
      canceled = true;
    };
  }, [currentConnectionId, connections]);

  const currentParams = extractChatParams(routeParams);
  useEffect(() => {
    if (isSyncingRef.current || !currentConnectionId || prevConnectionIdRef.current !== currentConnectionId) {
      return;
    }

    const connection = connections.find((c) => c.id === currentConnectionId);
    if (!connection) return;

    const provider = createProvider(connection.type);
    const options = provider.getOptions(connection);
    const sanitized = sanitizeParamsFromOptions(options, currentParams);

    setStoredModelParams(currentConnectionId, sanitized);
  }, [
    currentConnectionId,
    connections,
    currentParams.temperature,
    currentParams.maxTokens,
    currentParams.reasoningEffort,
    currentParams.verbosity,
    currentParams.thinkingBudget,
    currentParams.serviceTier,
    currentParams.sort,
    currentParams.costTier,
    currentParams.minCodingScore,
  ]);
}
