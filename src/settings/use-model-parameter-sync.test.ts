import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseConnection } from "../providers/base";
import { DEFAULT_MIN_CODING_SCORE } from "../providers/shared";
import type { RouteParameter } from "../router/use-route-parameter";
import { getStoredModelParams, setStoredModelParams } from "../storage/model-parameter-store";
import {
  applyChatParams,
  CHAT_PARAM_KEYS,
  extractChatParams,
  mergeModelParams,
  type ModelParameterRouteParams,
} from "./use-model-parameter-sync";

const memoryStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => {
  return {
    get: vi.fn(async (key: string) => memoryStore.get(key)),
    set: vi.fn(async (key: string, val: unknown) => {
      memoryStore.set(key, val);
    }),
  };
});

describe("model parameter backup and recovery", () => {
  beforeEach(() => {
    memoryStore.clear();
    vi.clearAllMocks();
  });

  const gemini36Conn: BaseConnection = {
    id: "google:gemini-3.6-flash",
    type: "google-gen-ai",
    displayGroup: "Google",
    displayName: "gemini-3.6-flash",
  };

  const gemini37Conn: BaseConnection = {
    id: "google:gemini-3.7-flash",
    type: "google-gen-ai",
    displayGroup: "Google",
    displayName: "gemini-3.7-flash",
  };

  it("backs up last used parameters for gemini 3.6 and gemini 3.7 independently without state pollution", async () => {
    // 1. Save 3.6 with reasoningEffort = "minimal"
    await setStoredModelParams(gemini36Conn.id, { reasoningEffort: "minimal" });

    // 2. Save 3.7 with reasoningEffort = "low"
    await setStoredModelParams(gemini37Conn.id, { reasoningEffort: "low" });

    // 3. Verify retrieved params for 3.6 remain "minimal"
    const params36 = await getStoredModelParams(gemini36Conn.id);
    expect(params36?.reasoningEffort).toBe("minimal");

    // 4. Verify retrieved params for 3.7 remain "low"
    const params37 = await getStoredModelParams(gemini37Conn.id);
    expect(params37?.reasoningEffort).toBe("low");
  });
});

describe("extractChatParams & applyChatParams helpers", () => {
  function createMockRouteParams(): {
    routeParams: ModelParameterRouteParams;
    replaces: Record<string, ReturnType<typeof vi.fn>>;
  } {
    const replaces: Record<string, ReturnType<typeof vi.fn>> = {};
    const makeParam = <T>(val: T, name: string): RouteParameter<T> => {
      const replaceFn = vi.fn();
      replaces[name] = replaceFn;
      return {
        value: val,
        push: vi.fn(),
        replace: replaceFn as unknown as (value: T) => void,
      };
    };

    const routeParams: ModelParameterRouteParams = {
      connectionKey: makeParam<string | null>("test-conn", "connectionKey"),
      temperature: makeParam<number | undefined>(0.7, "temperature"),
      maxTokens: makeParam<number | undefined>(2000, "maxTokens"),
      reasoningEffort: makeParam<string | undefined>("medium", "reasoningEffort"),
      verbosity: makeParam<string | undefined>(undefined, "verbosity"),
      thinkingBudget: makeParam<number | undefined>(undefined, "thinkingBudget"),
      serviceTier: makeParam<string | undefined>("auto", "serviceTier"),
      sort: makeParam<string | undefined>("price", "sort"),
      costTier: makeParam<string | undefined>("low", "costTier"),
      minCodingScore: makeParam<number | undefined>(DEFAULT_MIN_CODING_SCORE, "minCodingScore"),
    };

    return { routeParams, replaces };
  }

  it("extracts chat parameters for all defined param keys", () => {
    const { routeParams } = createMockRouteParams();
    const extracted = extractChatParams(routeParams);

    expect(Object.keys(extracted)).toEqual(expect.arrayContaining([...CHAT_PARAM_KEYS]));
    expect(extracted.temperature).toBe(0.7);
    expect(extracted.maxTokens).toBe(2000);
    expect(extracted.reasoningEffort).toBe("medium");
    expect(extracted.verbosity).toBeUndefined();
  });

  it("only calls replace on route parameters whose value actually changes", () => {
    const { routeParams, replaces } = createMockRouteParams();

    applyChatParams(routeParams, {
      temperature: 0.7, // unchanged
      maxTokens: 4000, // changed
      reasoningEffort: "high", // changed
      verbosity: undefined, // unchanged
      thinkingBudget: undefined, // unchanged
      serviceTier: "auto", // unchanged
      sort: "price", // unchanged
      costTier: "low", // unchanged
      minCodingScore: DEFAULT_MIN_CODING_SCORE, // unchanged
    });

    expect(replaces.maxTokens).toHaveBeenCalledWith(4000);
    expect(replaces.reasoningEffort).toHaveBeenCalledWith("high");
    expect(replaces.temperature).not.toHaveBeenCalled();
    expect(replaces.verbosity).not.toHaveBeenCalled();
    expect(replaces.costTier).not.toHaveBeenCalled();
  });
});

describe("mergeModelParams", () => {
  it("overrides stored values with explicitly provided URL parameters", () => {
    const stored = { temperature: 0.7, maxTokens: 2000, reasoningEffort: "low" };
    const urlParams = { temperature: 1.2 };

    const merged = mergeModelParams(stored, urlParams);

    expect(merged.temperature).toBe(1.2);
    expect(merged.maxTokens).toBe(2000);
    expect(merged.reasoningEffort).toBe("low");
  });

  it("uses stored parameters as fallback when URL parameters are absent (undefined)", () => {
    const stored = { temperature: 0.5, reasoningEffort: "high", costTier: "free" };
    const urlParams = { temperature: undefined, reasoningEffort: undefined };

    const merged = mergeModelParams(stored, urlParams);

    expect(merged.temperature).toBe(0.5);
    expect(merged.reasoningEffort).toBe("high");
    expect(merged.costTier).toBe("free");
  });

  it("returns URL parameters when no stored parameters exist", () => {
    const urlParams = { temperature: 1.2, maxTokens: 3000 };

    const merged = mergeModelParams(null, urlParams);

    expect(merged).toEqual({ temperature: 1.2, maxTokens: 3000 });
  });

  it("honors explicit falsy URL parameter values like 0", () => {
    const stored = { temperature: 0.7, minCodingScore: 80 };
    const urlParams = { minCodingScore: 0 };

    const merged = mergeModelParams(stored, urlParams);

    expect(merged.minCodingScore).toBe(0);
    expect(merged.temperature).toBe(0.7);
  });
});
