import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_MANIFEST_KEY } from "./auto-save-history";
import {
  deleteInstance,
  downloadCheckpointFile,
  getCheckpointPreview,
  getCheckpointRaw,
  getManifest,
  restoreCheckpointNodes,
} from "./restore-service";

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
  parseChat: vi.fn(async (_raw: string) => [
    { id: "parsed-1", role: "system", content: "sys" },
    { id: "parsed-2", role: "user", content: "user" },
  ]),
}));

const mockDownloadFile = vi.fn();
vi.mock("./use-file-hooks", () => ({
  downloadFile: (file: File) => mockDownloadFile(file),
}));

describe("restore-service", () => {
  beforeEach(() => {
    memoryStore.clear();
    mockDownloadFile.mockClear();
    vi.clearAllMocks();
  });

  describe("getManifest", () => {
    it("returns empty manifest if none stored", async () => {
      const manifest = await getManifest();
      expect(manifest.instances).toEqual([]);
    });

    it("returns stored manifest", async () => {
      const stored = {
        instances: [
          {
            instanceId: "inst-1",
            createdAt: 100,
            updatedAt: 200,
            checkpoints: [{ id: "cp-1", timestamp: 200, storageKey: "key-1" }],
          },
        ],
      };
      memoryStore.set(AUTOSAVE_MANIFEST_KEY, stored);

      const manifest = await getManifest();
      expect(manifest).toEqual(stored);
    });
  });

  describe("getCheckpointRaw", () => {
    it("retrieves raw content by key", async () => {
      memoryStore.set("key-1", "<article>hello</article>");
      const raw = await getCheckpointRaw("key-1");
      expect(raw).toBe("<article>hello</article>");
    });
  });

  describe("getCheckpointPreview", () => {
    it("returns empty messages if checkpoint not found", async () => {
      const preview = await getCheckpointPreview("non-existent");
      expect(preview.messages).toEqual([]);
    });

    it("extracts chronological preview messages from html", async () => {
      // Provide mock DOMParser in node env
      const originalDOMParser = globalThis.DOMParser;
      class MockDOMParser {
        parseFromString(_html: string) {
          const createSec = (role: string, text: string) => ({
            dataset: { role },
            getAttribute: () => role,
            querySelectorAll: (sel: string) => (sel === "p" ? [{ textContent: text }] : []),
          });
          return {
            querySelectorAll: (sel: string) => {
              if (sel === "[data-role]") {
                return [
                  createSec("system", "You are an assistant."),
                  createSec("user", "Hello!"),
                  createSec("assistant", "Hi there!"),
                ];
              }
              return [];
            },
          };
        }
      }
      globalThis.DOMParser = MockDOMParser as any;

      try {
        memoryStore.set("sample-key", "<html><body>...</body></html>");
        const preview = await getCheckpointPreview("sample-key");
        expect(preview.messages).toEqual([
          { role: "system", content: "You are an assistant." },
          { role: "user", content: "Hello!" },
          { role: "assistant", content: "Hi there!" },
        ]);
      } finally {
        globalThis.DOMParser = originalDOMParser;
      }
    });
  });

  describe("downloadCheckpointFile", () => {
    it("downloads checkpoint file as html", async () => {
      memoryStore.set("key-1", "<html>save point</html>");
      await downloadCheckpointFile("key-1", "my-save.html");

      expect(mockDownloadFile).toHaveBeenCalledTimes(1);
      const file = mockDownloadFile.mock.calls[0][0] as File;
      expect(file.name).toBe("my-save.html");
      expect(file.type).toMatch(/^text\/html/);
    });

    it("throws if checkpoint does not exist", async () => {
      await expect(downloadCheckpointFile("missing-key")).rejects.toThrow();
    });
  });

  describe("restoreCheckpointNodes", () => {
    it("parses raw checkpoint into chat nodes", async () => {
      memoryStore.set("key-1", "<html>chat nodes</html>");
      const nodes = await restoreCheckpointNodes("key-1");

      expect(nodes).toHaveLength(2);
      expect(nodes[0].id).toBe("parsed-1");
      expect(nodes[1].id).toBe("parsed-2");
    });

    it("ensures trailing node is user if raw checkpoint ended with assistant", async () => {
      const { parseChat } = await import("./format");
      (parseChat as any).mockResolvedValueOnce([
        { id: "parsed-1", role: "system", content: "sys" },
        { id: "parsed-2", role: "assistant", content: "asst response" },
      ]);

      memoryStore.set("key-asst", "<html>chat ending in assistant</html>");
      const nodes = await restoreCheckpointNodes("key-asst");

      expect(nodes).toHaveLength(3);
      expect(nodes[0].id).toBe("parsed-1");
      expect(nodes[1].id).toBe("parsed-2");
      expect(nodes[2].role).toBe("user");
    });

    it("throws if checkpoint does not exist", async () => {
      await expect(restoreCheckpointNodes("missing-key")).rejects.toThrow();
    });
  });

  describe("deleteInstance", () => {
    it("removes instance and deletes keys from storage", async () => {
      const stored = {
        instances: [
          {
            instanceId: "inst-1",
            createdAt: 100,
            updatedAt: 200,
            checkpoints: [{ id: "cp-1", timestamp: 200, storageKey: "key-1" }],
          },
          {
            instanceId: "inst-2",
            createdAt: 300,
            updatedAt: 400,
            checkpoints: [{ id: "cp-2", timestamp: 400, storageKey: "key-2" }],
          },
        ],
      };
      memoryStore.set(AUTOSAVE_MANIFEST_KEY, stored);
      memoryStore.set("key-1", "content-1");
      memoryStore.set("key-2", "content-2");

      const updated = await deleteInstance("inst-1");
      expect(updated.instances).toHaveLength(1);
      expect(updated.instances[0].instanceId).toBe("inst-2");
      expect(memoryStore.get(AUTOSAVE_MANIFEST_KEY)).toEqual(updated);
      expect(memoryStore.has("key-1")).toBe(false);
      expect(memoryStore.has("key-2")).toBe(true);
    });
  });
});
