import { describe, expect, it } from "vitest";
import { CerebrasProvider } from "./cerebras";

describe("CerebrasProvider", () => {
  const provider = new CerebrasProvider();

  it("derives defaultModels from cerebrasModels keys", () => {
    expect(CerebrasProvider.defaultModels).toEqual(Object.keys(CerebrasProvider.cerebrasModels));
    expect(CerebrasProvider.defaultModels).toEqual(["gpt-oss-120b", "qwen-3.8-27b"]);
  });

  it("returns options using cerebrasModels metadata for gpt-oss-120b", () => {
    const connection = {
      id: "gpt-oss-120b:test-id",
      type: "cerebras" as const,
      displayGroup: "cerebras",
      displayName: "gpt-oss-120b",
      model: "gpt-oss-120b",
      apiKey: "test-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature?.max).toBe(2);
    expect(options.reasoningEffort).toEqual(["medium", "low", "high"]);
    expect(options.maxTokens).toEqual({ max: 40_000 });
  });

  it("returns options using cerebrasModels metadata for qwen-3.8-27b", () => {
    const connection = {
      id: "qwen-3.8-27b:test-id",
      type: "cerebras" as const,
      displayGroup: "cerebras",
      displayName: "qwen-3.8-27b",
      model: "qwen-3.8-27b",
      apiKey: "test-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature?.max).toBe(2);
    expect(options.reasoningEffort).toEqual(["none", "low", "medium", "high"]);
    expect(options.maxTokens).toEqual({ max: 40_000 });
  });

  it("handles unknown models gracefully in getOptions", () => {
    const connection = {
      id: "unknown:test-id",
      type: "cerebras" as const,
      displayGroup: "cerebras",
      displayName: "unknown",
      model: "unknown",
      apiKey: "test-key",
    };

    const options = provider.getOptions(connection);
    expect(options.temperature?.max).toBe(2);
    expect(options.reasoningEffort).toBeUndefined();
    expect(options.maxTokens).toBeUndefined();
  });
});
