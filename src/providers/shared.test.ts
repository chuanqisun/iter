import { describe, expect, it } from "vitest";
import { OutputIndexPacer } from "./shared";

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
