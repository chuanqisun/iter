import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredModelParams, setStoredModelParams } from "./model-parameter-store";

const memoryStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => {
  return {
    get: vi.fn(async (key: string) => memoryStore.get(key)),
    set: vi.fn(async (key: string, val: unknown) => {
      memoryStore.set(key, val);
    }),
  };
});

describe("model-parameter-store", () => {
  beforeEach(() => {
    memoryStore.clear();
    vi.clearAllMocks();
  });

  it("stores and retrieves model parameters cleanly", async () => {
    const params = { temperature: 0.7, reasoningEffort: "high", maxTokens: 4000 };
    await setStoredModelParams("openai:gpt-5.6", params);

    const retrieved = await getStoredModelParams("openai:gpt-5.6");
    expect(retrieved).toEqual(params);
  });

  it("filters out undefined, null, and NaN values when storing", async () => {
    const params = {
      temperature: 0.8,
      reasoningEffort: undefined,
      thinkingBudget: NaN,
      maxTokens: null as any,
    };
    await setStoredModelParams("anthropic:claude-3.5", params);

    const retrieved = await getStoredModelParams("anthropic:claude-3.5");
    expect(retrieved).toEqual({ temperature: 0.8 });
  });

  it("returns null for non-existent or invalid store items", async () => {
    expect(await getStoredModelParams("non-existent")).toBeNull();

    memoryStore.set("iter:model-params:corrupt", "NOT_AN_OBJECT");
    expect(await getStoredModelParams("corrupt")).toBeNull();

    memoryStore.set("iter:model-params:array", [1, 2, 3]);
    expect(await getStoredModelParams("array")).toBeNull();
  });

  it("handles storage exceptions gracefully without crashing", async () => {
    const { get, set } = await import("idb-keyval");
    vi.mocked(get).mockRejectedValueOnce(new Error("IndexedDB read error"));
    vi.mocked(set).mockRejectedValueOnce(new Error("IndexedDB write error"));

    await expect(setStoredModelParams("error-conn", { temperature: 0.5 })).resolves.not.toThrow();
    await expect(getStoredModelParams("error-conn")).resolves.toBeNull();
  });
});
