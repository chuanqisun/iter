import { describe, expect, it } from "vitest";
import { isAppendingOnCheckpoint } from "./branch-detection";

describe("isAppendingOnCheckpoint", () => {
  it("returns false when savedFingerprints is undefined or empty", () => {
    expect(isAppendingOnCheckpoint(undefined, ["fp1", "fp2"])).toBe(false);
    expect(isAppendingOnCheckpoint([], ["fp1", "fp2"])).toBe(false);
  });

  it("returns true for sequential continuation (appending new messages)", () => {
    const saved = ["fp-sys", "fp-user1", "fp-asst1"];
    const current = ["fp-sys", "fp-user1", "fp-asst1", "fp-user2", "fp-asst2"];

    expect(isAppendingOnCheckpoint(saved, current)).toBe(true);
  });

  it("returns true when updating/streaming the active assistant node (same length)", () => {
    // Saved during prompt submit: [sys, user1, asst_empty]
    const saved = ["fp-sys", "fp-user1", "fp-asst-initial"];
    // Current after assistant generated response: [sys, user1, asst_done]
    const current = ["fp-sys", "fp-user1", "fp-asst-done"];

    expect(isAppendingOnCheckpoint(saved, current)).toBe(true);
  });

  it("returns false when a historical message was edited (mid-thread mutation)", () => {
    const saved = ["fp-sys", "fp-user1", "fp-asst1", "fp-user2"];
    const current = ["fp-sys", "fp-user1-edited", "fp-asst1", "fp-user2"];

    expect(isAppendingOnCheckpoint(saved, current)).toBe(false);
  });

  it("returns false when historical messages were deleted / pruned", () => {
    const saved = ["fp-sys", "fp-user1", "fp-asst1", "fp-user2", "fp-asst2"];
    // Pruned back to [sys, user1]
    const current = ["fp-sys", "fp-user1"];

    expect(isAppendingOnCheckpoint(saved, current)).toBe(false);
  });

  it("returns false when branching off an earlier turn", () => {
    const saved = ["fp-sys", "fp-user1", "fp-asst1", "fp-user2", "fp-asst2"];
    // Forked from user1: [sys, user1, new_asst, new_user]
    const current = ["fp-sys", "fp-user1", "fp-new-asst", "fp-new-user"];

    expect(isAppendingOnCheckpoint(saved, current)).toBe(false);
  });

  it("handles single-element saved fingerprints", () => {
    const saved = ["fp-sys"];
    const current = ["fp-sys", "fp-user1"];

    expect(isAppendingOnCheckpoint(saved, current)).toBe(true);
  });
});
