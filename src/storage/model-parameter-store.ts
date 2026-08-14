import { get, set } from "idb-keyval";
import type { ModelParams } from "../providers/base";

const PARAM_STORE_PREFIX = "iter:model-params:";

export async function getStoredModelParams(connectionId: string): Promise<ModelParams | null> {
  if (!connectionId) return null;
  try {
    const raw = await get<unknown>(`${PARAM_STORE_PREFIX}${connectionId}`);
    if (!raw || typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return null;
    }
    return raw as ModelParams;
  } catch (err) {
    console.warn(`[model-parameter-store] Failed to read stored parameters for "${connectionId}":`, err);
    return null;
  }
}

export async function setStoredModelParams(connectionId: string, params: ModelParams): Promise<void> {
  if (!connectionId) return;
  try {
    const cleanParams: ModelParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && (typeof value !== "number" || !isNaN(value))) {
        (cleanParams as any)[key] = value;
      }
    }
    await set(`${PARAM_STORE_PREFIX}${connectionId}`, cleanParams);
  } catch (err) {
    console.warn(`[model-parameter-store] Failed to store parameters for "${connectionId}":`, err);
  }
}
