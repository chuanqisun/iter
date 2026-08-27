import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatNode } from "../chat-tree/tree-store";
import { AUTOSAVE_MANIFEST_KEY, getCheckpointStorageKey } from "./auto-save-history";
import { getActiveCheckpoint, hasCheckpoints, isThreadEmpty, saveCheckpoint } from "./auto-save-service";
import { stringifyChat } from "./format";

const memoryStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => {
  return {
    get: vi.fn(async (key: string) => memoryStore.get(key)),
    set: vi.fn(async (key: string, val: unknown) => {
      memoryStore.set(key, val);
    }),
    delMany: vi.fn(async (keys: string[]) => {
      for (const k of keys) memoryStore.delete(k);
    }),
  };
});

vi.mock("./format", () => ({
  stringifyChat: vi.fn(async (nodes: ChatNode[]) => `<mock-html-nodes-count-${nodes.length}>`),
}));

function createNode(role: "system" | "user" | "assistant", content: string): ChatNode {
  return {
    id: `node-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    metadata$: new BehaviorSubject({}),
  };
}

describe("auto-save-service", () => {
  beforeEach(() => {
    memoryStore.clear();
    vi.clearAllMocks();
  });

  describe("isThreadEmpty", () => {
    it("returns true for empty array", () => {
      expect(isThreadEmpty([])).toBe(true);
    });

    it("returns true for nodes with empty content and no attachments", () => {
      const nodes = [createNode("system", ""), createNode("user", "   ")];
      expect(isThreadEmpty(nodes)).toBe(true);
    });

    it("returns false if any node has text content", () => {
      const nodes = [createNode("system", ""), createNode("user", "Hello world")];
      expect(isThreadEmpty(nodes)).toBe(false);
    });

    it("returns false if any node has attachments", () => {
      const node = createNode("user", "");
      node.attachments = [
        {
          id: "att-1",
          type: "embedded",
          file: { name: "doc.txt", type: "text/plain", url: "data:...", size: 10 },
        },
      ];
      expect(isThreadEmpty([node])).toBe(false);
    });
  });

  describe("saveCheckpoint", () => {
    it("ignores empty threads and does not save to IDB", async () => {
      const nodes = [createNode("system", ""), createNode("user", "")];
      const result = await saveCheckpoint("inst-1", undefined, false, nodes);

      expect(result).toBeNull();
      expect(memoryStore.has(AUTOSAVE_MANIFEST_KEY)).toBe(false);
    });

    it("trims empty nodes at the tail before saving", async () => {
      const nodes = [
        createNode("system", "System prompt"),
        createNode("user", "User prompt"),
        createNode("assistant", "   "),
        createNode("user", ""),
      ];
      const result = await saveCheckpoint("inst-1", undefined, false, nodes);

      expect(result).not.toBeNull();
      expect(stringifyChat).toHaveBeenCalledWith([nodes[0], nodes[1]]);
      const checkpointKey = getCheckpointStorageKey("inst-1", result!.checkpointId);
      expect(memoryStore.get(checkpointKey)).toBe("<mock-html-nodes-count-2>");
    });

    it("saves new checkpoint when no previous checkpoint exists", async () => {
      const nodes = [createNode("system", "System prompt"), createNode("user", "User prompt")];
      const result = await saveCheckpoint("inst-1", undefined, false, nodes);

      expect(result).not.toBeNull();
      expect(result?.checkpointId).toBeDefined();

      const manifest = memoryStore.get(AUTOSAVE_MANIFEST_KEY) as any;
      expect(manifest.instances).toHaveLength(1);
      expect(manifest.instances[0].instanceId).toBe("inst-1");
      expect(manifest.instances[0].checkpoints[0].id).toBe(result?.checkpointId);

      const checkpointKey = getCheckpointStorageKey("inst-1", result!.checkpointId);
      expect(memoryStore.get(checkpointKey)).toBe("<mock-html-nodes-count-2>");
    });

    it("overwrites existing checkpoint by default", async () => {
      const nodes1 = [createNode("system", "System"), createNode("user", "Hello")];
      const res1 = await saveCheckpoint("inst-1", undefined, false, nodes1);
      const cpId = res1!.checkpointId;

      const nodes2 = [...nodes1, createNode("assistant", "Response")];
      const res2 = await saveCheckpoint("inst-1", cpId, false, nodes2);

      expect(res2?.checkpointId).toBe(cpId);
      const manifest = memoryStore.get(AUTOSAVE_MANIFEST_KEY) as any;
      expect(manifest.instances[0].checkpoints).toHaveLength(1);
      expect(manifest.instances[0].checkpoints[0].id).toBe(cpId);

      const checkpointKey = getCheckpointStorageKey("inst-1", cpId);
      expect(memoryStore.get(checkpointKey)).toBe("<mock-html-nodes-count-3>");
    });

    it("creates a new branch checkpoint when isNewBranch is true", async () => {
      const nodes1 = [createNode("system", "System"), createNode("user", "Hello")];
      const res1 = await saveCheckpoint("inst-1", undefined, false, nodes1);
      const cpId1 = res1!.checkpointId;

      const nodes2 = [nodes1[0], createNode("user", "Branched question")];
      const res2 = await saveCheckpoint("inst-1", cpId1, true, nodes2);
      const cpId2 = res2!.checkpointId;

      expect(cpId2).not.toBe(cpId1);
      const manifest = memoryStore.get(AUTOSAVE_MANIFEST_KEY) as any;
      expect(manifest.instances[0].checkpoints).toHaveLength(2);
      expect(manifest.instances[0].checkpoints[0].id).toBe(cpId2);
      expect(manifest.instances[0].checkpoints[1].id).toBe(cpId1);
    });

    it("cleans up evicted storage keys when limit is exceeded", async () => {
      const maxK = 2;
      let currentCpId: string | undefined;

      for (let i = 0; i < 4; i++) {
        const nodes = [createNode("system", "System"), createNode("user", `Prompt ${i}`)];
        const res = await saveCheckpoint("inst-1", currentCpId, true, nodes, {
          maxCheckpoints: maxK,
        });
        currentCpId = res!.checkpointId;
      }

      const manifest = memoryStore.get(AUTOSAVE_MANIFEST_KEY) as any;
      expect(manifest.instances[0].checkpoints).toHaveLength(maxK);

      // Check that only maxK checkpoints remain in memoryStore
      const checkpointKeys = [...memoryStore.keys()].filter((k) => k.startsWith("iter.checkpoint.inst-1."));
      expect(checkpointKeys).toHaveLength(maxK);
    });

    it("saves and updates fingerprints correctly", async () => {
      const nodes1 = [createNode("system", "System"), createNode("user", "Hello")];
      const res1 = await saveCheckpoint("inst-1", undefined, false, nodes1, ["fp1", "fp2"]);
      const cpId = res1!.checkpointId;

      const activeCp1 = await getActiveCheckpoint("inst-1", cpId);
      expect(activeCp1?.fingerprints).toEqual(["fp1", "fp2"]);

      const nodes2 = [...nodes1, createNode("assistant", "Response")];
      await saveCheckpoint("inst-1", cpId, false, nodes2, ["fp1", "fp2", "fp3"]);

      const activeCp2 = await getActiveCheckpoint("inst-1", cpId);
      expect(activeCp2?.fingerprints).toEqual(["fp1", "fp2", "fp3"]);
    });
  });

  describe("hasCheckpoints", () => {
    it("returns false when no manifest exists or empty", async () => {
      expect(await hasCheckpoints()).toBe(false);
    });

    it("returns true when manifest has checkpoints", async () => {
      const nodes = [createNode("system", ""), createNode("user", "Hello")];
      await saveCheckpoint("inst-1", undefined, false, nodes);
      expect(await hasCheckpoints()).toBe(true);
    });
  });
});
