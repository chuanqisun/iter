import { afterEach, describe, expect, it, vi } from "vitest";
import { autoFocusNthInput, findLastUserNodeId } from "./focus";
import { getAssistantNode, getUserNode } from "./tree-helper";
import type { ChatNode } from "./tree-store";

describe("autoFocusNthInput", () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it("focuses and scrolls into view the target element at the specified index synchronously", () => {
    const el1 = {
      focus: vi.fn(),
      scrollIntoView: vi.fn(),
    };

    const el2 = {
      focus: vi.fn(),
      scrollIntoView: vi.fn(),
    };

    globalThis.document = {
      querySelectorAll: vi.fn().mockReturnValue([el1, el2]),
    } as any;

    autoFocusNthInput(-1);

    expect(globalThis.document.querySelectorAll).toHaveBeenCalledWith(".js-focusable");
    expect(el2.focus).toHaveBeenCalled();
    expect(el2.scrollIntoView).toHaveBeenCalled();
    expect(el1.focus).not.toHaveBeenCalled();
  });

  it("handles missing target gracefully without throwing", () => {
    globalThis.document = {
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as any;

    expect(() => {
      autoFocusNthInput(5);
    }).not.toThrow();
  });
});

describe("findLastUserNodeId", () => {
  it("finds the last user node ID in a list of nodes", () => {
    const nodes: ChatNode[] = [
      { id: "system-1", role: "system", content: "", isViewSource: true, metadata$: {} as any },
      getUserNode("user-1", { content: "hello" }),
      getAssistantNode("assistant-1", { content: "hi" }),
      getUserNode("user-2", { content: "follow up" }),
    ];

    expect(findLastUserNodeId(nodes)).toBe("user-2");
  });

  it("finds the last user node even when assistant is the last node", () => {
    const nodes: ChatNode[] = [
      { id: "system-1", role: "system", content: "", isViewSource: true, metadata$: {} as any },
      getUserNode("user-1", { content: "hello" }),
      getAssistantNode("assistant-1", { content: "hi" }),
    ];

    expect(findLastUserNodeId(nodes)).toBe("user-1");
  });

  it("falls back to the last node if no user node exists", () => {
    const nodes: ChatNode[] = [
      { id: "system-1", role: "system", content: "", isViewSource: true, metadata$: {} as any },
      getAssistantNode("assistant-1", { content: "hi" }),
    ];

    expect(findLastUserNodeId(nodes)).toBe("assistant-1");
  });

  it("returns null for empty node lists", () => {
    expect(findLastUserNodeId([])).toBeNull();
  });
});
