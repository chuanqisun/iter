import { describe, expect, it } from "vitest";
import {
  ensureTrailingUserNode,
  getAssistantNode,
  getNextId,
  getPrevId,
  getUserNode,
  isNodeEmpty,
  isTail,
  trimTrailingEmptyNodes,
} from "./tree-helper";
import type { ChatNode } from "./tree-store";

describe("tree-helper", () => {
  describe("isNodeEmpty", () => {
    it("returns true for empty or whitespace content without attachments", () => {
      expect(isNodeEmpty(getUserNode("1", { content: "" }))).toBe(true);
      expect(isNodeEmpty(getAssistantNode("2", { content: "   \n\t  " }))).toBe(true);
    });

    it("returns false for node with text content", () => {
      expect(isNodeEmpty(getUserNode("1", { content: "hello" }))).toBe(false);
    });

    it("returns false for node with attachments even if text is empty", () => {
      const node = getUserNode("1", {
        content: "",
        attachments: [
          {
            id: "att-1",
            type: "embedded",
            file: { name: "doc.txt", type: "text/plain", url: "data:...", size: 10 },
          },
        ],
      });
      expect(isNodeEmpty(node)).toBe(false);
    });
  });

  describe("trimTrailingEmptyNodes", () => {
    it("returns empty array for empty input", () => {
      expect(trimTrailingEmptyNodes([])).toEqual([]);
    });

    it("returns empty array when all nodes are empty", () => {
      const nodes = [getUserNode("1", { content: "" }), getUserNode("2", { content: "  " })];
      expect(trimTrailingEmptyNodes(nodes)).toEqual([]);
    });

    it("leaves nodes unchanged when tail node is not empty", () => {
      const nodes = [getUserNode("1", { content: "Sys" }), getUserNode("2", { content: "Hello" })];
      expect(trimTrailingEmptyNodes(nodes)).toEqual(nodes);
    });

    it("trims single and multiple empty nodes from the end", () => {
      const sys = getUserNode("1", { content: "Sys" });
      const user = getUserNode("2", { content: "Hello" });
      const empty1 = getAssistantNode("3", { content: "" });
      const empty2 = getUserNode("4", { content: "   " });

      expect(trimTrailingEmptyNodes([sys, user, empty1, empty2])).toEqual([sys, user]);
    });

    it("preserves empty nodes in the middle if followed by non-empty nodes", () => {
      const sys = getUserNode("1", { content: "" });
      const user = getUserNode("2", { content: "Hello" });
      const emptyTail = getAssistantNode("3", { content: "" });

      expect(trimTrailingEmptyNodes([sys, user, emptyTail])).toEqual([sys, user]);
    });
  });

  describe("isTail", () => {
    it("returns true for the last node", () => {
      const nodes: ChatNode[] = [
        getUserNode("1", { content: "hello" }),
        getAssistantNode("2", { content: "hi" }),
        getUserNode("3", { content: "how are you?" }),
      ];

      expect(isTail(2, nodes)).toBe(true);
    });

    it("returns true if following nodes have empty content and no attachments", () => {
      const nodes: ChatNode[] = [
        getUserNode("1", { content: "hello" }),
        getUserNode("2", { content: "" }),
        getAssistantNode("3", { content: "", attachments: [] }),
      ];

      expect(isTail(0, nodes)).toBe(true);
    });

    it("returns false if any subsequent node has content", () => {
      const nodes: ChatNode[] = [
        getUserNode("1", { content: "hello" }),
        getAssistantNode("2", { content: "hi" }),
        getUserNode("3", { content: "" }),
      ];

      expect(isTail(0, nodes)).toBe(false);
    });

    it("returns false if any subsequent node has attachments", () => {
      const nodes: ChatNode[] = [
        getUserNode("1", { content: "hello" }),
        getUserNode("2", {
          content: "",
          attachments: [{ id: "att-1", type: "external", file: new File([], "test.txt") }],
        }),
      ];

      expect(isTail(0, nodes)).toBe(false);
    });

    it("returns false for invalid index", () => {
      const nodes: ChatNode[] = [getUserNode("1", { content: "hello" })];

      expect(isTail(-1, nodes)).toBe(false);
      expect(isTail(5, nodes)).toBe(false);
    });
  });

  describe("getPrevId and getNextId", () => {
    it("returns previous and next ids correctly", () => {
      const nodes: ChatNode[] = [getUserNode("1"), getAssistantNode("2"), getUserNode("3")];

      expect(getPrevId("1", nodes)).toBeNull();
      expect(getPrevId("2", nodes)).toBe("1");
      expect(getPrevId("3", nodes)).toBe("2");

      expect(getNextId("1", nodes)).toBe("2");
      expect(getNextId("2", nodes)).toBe("3");
      expect(getNextId("3", nodes)).toBeNull();
    });
  });

  describe("ensureTrailingUserNode", () => {
    it("returns a single user node when input is empty", () => {
      const result = ensureTrailingUserNode([]);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
    });

    it("appends a user node when the last node is not a user node", () => {
      const sys = getUserNode("1", { role: "system", content: "sys" });
      const asst = getAssistantNode("2", { content: "response" });
      const result = ensureTrailingUserNode([sys, asst]);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe(sys);
      expect(result[1]).toBe(asst);
      expect(result[2].role).toBe("user");
    });

    it("leaves nodes unchanged when the last node is already a user node", () => {
      const sys = getUserNode("1", { role: "system", content: "sys" });
      const user = getUserNode("2", { content: "hello" });
      const result = ensureTrailingUserNode([sys, user]);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(sys);
      expect(result[1]).toBe(user);
    });
  });
});
