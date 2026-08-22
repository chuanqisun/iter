import { describe, expect, it } from "vitest";
import { clampNumber, OutputIndexPacer, sanitizeParamsFromOptions, selectEnum } from "./shared";

describe("OutputIndexPacer", () => {
  it("yields deltas unchanged on initial delta and matching indices", () => {
    const pacer = new OutputIndexPacer();
    expect(pacer.process(1, "Hello")).toBe("Hello");
    expect(pacer.process(1, " world")).toBe(" world");
    expect(pacer.process(1, "!")).toBe("!");
  });

  it("inserts an empty space when output delta text index changes", () => {
    const pacer = new OutputIndexPacer();
    expect(pacer.process(1, "First part.")).toBe("First part.");
    expect(pacer.process(1, " Still first.")).toBe(" Still first.");
    expect(pacer.process(4, "Second part.")).toBe("\n\nSecond part.");
    expect(pacer.process(4, " Still second.")).toBe(" Still second.");
    expect(pacer.process(7, "Third part.")).toBe("\n\nThird part.");
  });

  it("handles index starting at 0", () => {
    const pacer = new OutputIndexPacer();
    expect(pacer.process(0, "Block 0")).toBe("Block 0");
    expect(pacer.process(0, " text")).toBe(" text");
    expect(pacer.process(1, "Block 1")).toBe("\n\nBlock 1");
  });

  it("does not insert space when index is undefined", () => {
    const pacer = new OutputIndexPacer();
    expect(pacer.process(undefined, "Chunk 1")).toBe("Chunk 1");
    expect(pacer.process(undefined, "Chunk 2")).toBe("Chunk 2");
  });

  it("handles empty delta text", () => {
    const pacer = new OutputIndexPacer();
    expect(pacer.process(1, "")).toBe("");
  });
});

describe("sanitizeParamsFromOptions", () => {
  it("keeps valid parameters within bounds for supported options", () => {
    const sanitized = sanitizeParamsFromOptions(
      {
        temperature: { max: 2 },
        reasoningEffort: ["none", "low", "medium", "high"],
        maxTokens: { min: 1, max: 16384 },
      },
      {
        temperature: 0.7,
        reasoningEffort: "medium",
        maxTokens: 4096,
      },
    );

    expect(sanitized).toEqual({
      temperature: 0.7,
      reasoningEffort: "medium",
      maxTokens: 4096,
      verbosity: undefined,
      thinkingBudget: undefined,
      serviceTier: undefined,
      sort: undefined,
      costTier: undefined,
      minCodingScore: undefined,
    });
  });

  it("clamps numerical parameters and defaults invalid enum options", () => {
    const sanitized = sanitizeParamsFromOptions(
      {
        temperature: { min: 0.5, max: 1.0 },
        reasoningEffort: ["low", "medium", "high"],
        maxTokens: { min: 1, max: 8192 },
        minCodingScore: { min: 0, max: 1, step: 0.05 },
      },
      {
        temperature: 2.5,
        reasoningEffort: "invalid_effort",
        maxTokens: 32768,
        minCodingScore: 1.5,
      },
    );

    expect(sanitized.temperature).toBe(1.0);
    expect(sanitized.reasoningEffort).toBe("low");
    expect(sanitized.maxTokens).toBe(8192);
    expect(sanitized.minCodingScore).toBe(1.0);
  });

  it("sets unsupported parameter fields to undefined", () => {
    const sanitized = sanitizeParamsFromOptions(
      {
        temperature: { max: 2 },
      },
      {
        temperature: 0.5,
        reasoningEffort: "high",
        verbosity: "low",
        sort: "price",
        costTier: "high",
      },
    );

    expect(sanitized.temperature).toBe(0.5);
    expect(sanitized.reasoningEffort).toBeUndefined();
    expect(sanitized.verbosity).toBeUndefined();
    expect(sanitized.sort).toBeUndefined();
    expect(sanitized.costTier).toBeUndefined();
  });

  it("handles NaN numeric inputs by falling back to min or default bounds", () => {
    const sanitized = sanitizeParamsFromOptions(
      {
        temperature: { min: 0.1, max: 2.0 },
        thinkingBudget: { min: 100, max: 1000 },
      },
      {
        temperature: NaN,
        thinkingBudget: NaN,
      },
    );

    expect(sanitized.temperature).toBe(0.1);
    expect(sanitized.thinkingBudget).toBe(100);
  });

  it("handles serviceTier options correctly", () => {
    const sanitizedWithOption = sanitizeParamsFromOptions(
      { serviceTier: ["auto", "fast", "flex"] },
      { serviceTier: "fast" },
    );
    expect(sanitizedWithOption.serviceTier).toBe("fast");

    const sanitizedWithFlex = sanitizeParamsFromOptions(
      { serviceTier: ["auto", "fast", "flex"] },
      { serviceTier: "flex" },
    );
    expect(sanitizedWithFlex.serviceTier).toBe("flex");

    const sanitizedWithInvalid = sanitizeParamsFromOptions(
      { serviceTier: ["auto", "fast", "flex"] },
      { serviceTier: "unsupported_tier" },
    );
    expect(sanitizedWithInvalid.serviceTier).toBe("auto");

    const sanitizedWithoutOption = sanitizeParamsFromOptions({}, { serviceTier: "fast" });
    expect(sanitizedWithoutOption.serviceTier).toBeUndefined();
  });
});

describe("clampNumber & selectEnum helpers", () => {
  it("clampNumber clamps value to min/max range or fallback", () => {
    expect(clampNumber(5, { min: 0, max: 10 })).toBe(5);
    expect(clampNumber(-5, { min: 0, max: 10 })).toBe(0);
    expect(clampNumber(15, { min: 0, max: 10 })).toBe(10);
    expect(clampNumber(undefined, { min: 2, max: 10 })).toBe(2);
    expect(clampNumber(undefined, { min: 2, max: 10 }, 8)).toBe(8);
    expect(clampNumber(undefined, undefined)).toBeUndefined();
  });

  it("selectEnum returns matched allowed item or first item", () => {
    expect(selectEnum("high", ["low", "medium", "high"])).toBe("high");
    expect(selectEnum("unknown", ["low", "medium", "high"])).toBe("low");
    expect(selectEnum(undefined, ["low", "medium", "high"])).toBe("low");
    expect(selectEnum("high", undefined)).toBeUndefined();
    expect(selectEnum("high", [])).toBeUndefined();
  });
});
